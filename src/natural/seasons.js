import {
  Color, MathUtils, Matrix4, Vector3, Vector4, InstancedMesh, PlaneGeometry, BufferGeometry, Float32BufferAttribute,
  MeshBasicMaterial, MeshLambertMaterial, DoubleSide, DynamicDrawUsage, Object3D,
  InstancedBufferAttribute, CanvasTexture, DataTexture, RGBAFormat, SRGBColorSpace,
  LinearFilter, LinearMipmapLinearFilter, MeshDepthMaterial, RGBADepthPacking,
} from 'three';
import { rng, fbm } from './shared.js';
import { RX, RZ, TREE_SITE, CABIN_SITE, ground, creekX, waterY } from './land.js';
import { makeSnowBed, bindSnowContacts, SNOW_BED_GLSL } from './snow-bed.js';
import { makePaddyAndPlum, paddyContains } from './paddy-and-plum.js';
import { bindWaterSeasons } from './water.js';

const NAMES = ['spring', 'summer', 'autumn', 'winter'];
const LABELS = ['🌸 春', '🌿 夏', '🍁 秋', '❄️ 冬'];
const DURATION = 3;
const BLIZZARD_DURATION = 15;
const ease = seconds => 1 - (1 - seconds / DURATION) ** 3;
const rgb = hex => `vec3(${new Color(hex).toArray().map(n => n.toFixed(6)).join(',')})`;
const WHITE = rgb('#f8fafc');
const BED_DECL = 'varying vec4 vSnowBed, vFieldClimate;\nvarying vec3 vSnowWorld;\n';
const DECL = 'uniform vec4 uSeasons;\nuniform float uSnowProgress, uSnowAccumulation;\nvarying vec3 vSeasonNormal;\nvarying float vSeasonDetail;\n';

const BLOOMS = { petals: '#fff4eb', pollen: '#ffbb26', lavender: '#a56ae4' };
const SURFACES = new Map(Object.entries({
  'meadow-and-soil': 'ground', 'island-terrain': 'ground', 'patches-of-meadow-grass': 'grass',
  'daisy-petals': 'petals', 'daisy-centers': 'pollen', 'lavender-meadow-patches': 'lavender',
  'daisy-stems': 'herb', 'lavender-stems': 'herb', 'low-clover-mats': 'herb',
  'sunflower-fields': 'field', 'lavender-terraces': 'field', 'ambient-falling-foliage': 'seeds',
}));

const CANOPY = `
  vec3 spring = mix(${rgb('#38a169')}, ${rgb('#4ade80')}, smoothstep(.025,.42,lum));
  vec3 summer = mix(${rgb('#15803d')}, ${rgb('#16a34a')}, smoothstep(.04,.48,lum));
  vec3 maple = mix(${rgb('#dc2626')}, ${rgb('#ea580c')}, smoothstep(.20,.52,vSeasonDetail));
  maple = mix(maple, ${rgb('#f59e0b')}, smoothstep(.54,.83,vSeasonDetail));
  vec3 winter = mix(${rgb('#657e70')}, ${rgb('#bbcbbf')}, .22+.45*vSeasonDetail);
  diffuseColor.rgb = detail * (spring*uSeasons.x + summer*uSeasons.y + maple*uSeasons.z + winter*uSeasons.w);`;

const TURF = `
  vec3 turf = diffuseColor.rgb, summer = mix(${rgb('#15803d')}, ${rgb('#16a34a')}, smoothstep(.03,.36,lum));
  float ripe = .82*vFieldClimate.x+.18*smoothstep(.035,.28,lum);
  vec3 harvest = mix(${rgb('#91a447')}, ${rgb('#ca8a04')},smoothstep(.08,.66,ripe));
  harvest = mix(harvest,${rgb('#eab308')},.86*smoothstep(.32,.84,ripe));
  harvest = mix(harvest,${rgb('#d97706')},.57*smoothstep(.65,.96,ripe));
  vec3 evergreen = turf * vec3(.71,.86,.80) + vec3(.011,.019,.018);
  diffuseColor.rgb = turf*vec3(1.04,1.13,.98)*uSeasons.x
    + detail*summer*uSeasons.y + harvest*(.58+.65*detail)*uSeasons.z + evergreen*uSeasons.w;`;


const BED_VERTEX = `
  vec4 site=vec4(position,1.);
  #ifdef USE_INSTANCING
    site=instanceMatrix*site;
  #endif
  vSnowBed=snowBand(site.xz,0.);
  vFieldClimate=snowBand(site.xz,1.);
  vec4 drift=snowBand(site.xz,2.);
  float winterSnow=uSnowProgress*uSeasons.w;
  float snowRise=snowHeightAt(vSnowBed,drift,winterSnow,uSnowAccumulation)*smoothstep(-.2,.4,normal.y);
  vec2 gradient=mix(snowGradient(vSnowBed)*winterSnow,snowGradient(drift),uSnowAccumulation);
  vSnowBed.a=mix(vSnowBed.a,drift.a,uSnowAccumulation);
  vSnowWorld=(modelMatrix*site).xyz;`;

const SNOW_LIGHT = `
  vec3 snowN=normalize(vSeasonNormal);
  float loose=vSnowBed.r;
  float sunward=clamp(.82*smoothstep(.18,.90,dot(snowN,uSeasonSun))+.32*loose-.45*vFieldClimate.y
    +uSnowAccumulation*(vFieldClimate.w-.58)*.40,0.,1.);
  vec3 powder=mix(${rgb('#dbeafe')}*(.78+.16*loose),${rgb('#fffaed')},sunward);
  cover*=vSnowBed.a;
  diffuseColor.rgb=mix(diffuseColor.rgb,powder,cover);`;

const CRYSTALS = `
  if(cover>.001){
    vec2 cell=vSnowWorld.xz*12., id=floor(cell);
    vec2 seed=fract(sin(vec2(dot(id,vec2(23.41,71.29)),dot(id,vec2(17.17,41.73))))*4375.37);
    float footprint=max(fwidth(cell.x),fwidth(cell.y));
    float spot=1.-smoothstep(.045,.085+min(.35,footprint),length(fract(cell)-(.18+.64*seed)));
    vec3 facet=normalize(snowN+vec3(seed.x-.5,0.,seed.y-.5)*1.4);
    vec3 halfway=normalize(uSeasonSun+normalize(cameraPosition-vSnowWorld));
    float glint=pow(max(0.,dot(facet,halfway)),74.)*spot*(1.-smoothstep(.28,1.,footprint));
    outgoingLight+=vec3(.68,.83,1.)*glint*cover*(.52+.58*uSnowAccumulation);
  }`;

// The roof and deck share timber, so select the gables and porch canopy in cabin coordinates.
const ROOF_REGION = `
  float mainRoof = step(3.77,position.y+.62*abs(position.x))*step(abs(position.x),2.8)*step(abs(position.z),2.24);
  float porchRoof = step(abs(position.x),.98)*step(1.90,position.z)*step(position.z,2.71)
                  * step(2.53,position.y)*step(position.y,2.64);
  vSeasonDetail = max(mainRoof,porchRoof);`;

function seasonalMaterial(source, kind, uniforms) {
  const material = source.clone();
  const flower = BLOOMS[kind];
  const meadow = kind === 'grass' || kind === 'ground';
  const detail = {
    canopy: 'vSeasonDetail=.5+.27*sin(dot(position,vec3(1.6,1.1,-1.3)))+.23*sin(dot(position,vec3(-2.7,2.1,2.4)));',
    batch: ROOF_REGION, grass: 'vSeasonDetail=uv.y;',
  }[kind] || 'vSeasonDetail=1.0;';
  let shape = '';
  if (flower) {
    const base = kind === 'lavender' ? '.22' : '.225';
    shape = `transformed.xz*=1.0+.22*uSeasons.x; transformed.y+=(position.y-${base})*.13*uSeasons.x;`;
  }
  if (kind === 'grass' || flower || kind === 'herb') shape += 'transformed.y*=1.0-.89*uSnowProgress*uSeasons.w;';
  if (kind === 'field') shape = 'transformed.y*=1.-.94*uSnowAccumulation;';
  if (kind === 'ground') shape = 'transformed.y+=snowRise; vSnowWorld+=mat3(modelMatrix)*vec3(0.,snowRise,0.);';

  const pigment = kind === 'canopy' ? CANOPY : meadow ? TURF : flower ? `
    vec3 fresh=mix(diffuseColor.rgb,${rgb(flower)},.86);
    diffuseColor.rgb = fresh*uSeasons.x + diffuseColor.rgb*uSeasons.y
      + vec3(.87,.58,.28)*detail*uSeasons.z + vec3(.47,.49,.42)*detail*uSeasons.w;` :
    kind === 'field' || kind === 'herb' ? `
    diffuseColor.rgb=mix(diffuseColor.rgb,lum*vec3(1.19,.83,.47),.62*uSeasons.z);
    diffuseColor.rgb=mix(diffuseColor.rgb,lum*vec3(.82,.90,.84),.91*uSeasons.w);` : '';

  material.customProgramCacheKey = () => `${source.customProgramCacheKey()}:island-season-7:${kind}`;
  material.onBeforeCompile = function (shader, renderer) {
    source.onBeforeCompile.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    if (kind === 'seeds') {
      // Keep the existing wind simulation for butterflies and dandelion seeds.
      shader.fragmentShader = 'uniform vec4 uSeasons;\n' + shader.fragmentShader.replace(
        '#include <alphatest_fragment>', `if(vKind<.5) discard;
          diffuseColor.a*=uSeasons.x+uSeasons.y;
          if(diffuseColor.a<.003) discard;
          #include <alphatest_fragment>`);
      return;
    }
    let vertex = shader.vertexShader;
    if (material.isMeshBasicMaterial) vertex = vertex.replace('#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )', '#if 1');
    if (meadow) vertex = BED_DECL + SNOW_BED_GLSL + vertex.replace('#include <beginnormal_vertex>',
      `${BED_VERTEX}\n#include <beginnormal_vertex>\n${kind === 'ground' ?
        'objectNormal.xz-=gradient*objectNormal.y;' : ''}`);
    shader.vertexShader = DECL + vertex
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
        vSeasonNormal=normalize((vec4(transformedNormal,0.0)*viewMatrix).xyz);
        #ifdef FLIP_SIDED
          vSeasonNormal=-vSeasonNormal;
        #endif
        ${detail}`)
      .replace('#include <project_vertex>', `${shape}\n#include <project_vertex>`);
    const frost = kind === 'grass' ? '.78*smoothstep(.54,1.0,vSeasonDetail)' :
      kind === 'ground' ? '.20*smoothstep(.75,1.0,up)' : '.24*smoothstep(.79,1.0,up)';
    shader.fragmentShader = DECL + (meadow ? BED_DECL+'uniform vec3 uSeasonSun;\n' : '') + shader.fragmentShader
      .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
        float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        float detail=clamp(pow(max(0.0,lum),.25),.38,1.0);
        ${pigment}
        ${kind === 'ground' ? 'diffuseColor.rgb=mix(diffuseColor.rgb,turf,vFieldClimate.z);' : ''}
        float up=normalize(vSeasonNormal).y;
        float threshold=mix(.95,.40,uSnowProgress);
        float deposited=${meadow ? '1.0' : 'smoothstep(threshold-.1,threshold+.1,up)'};
        float cover=uSeasons.w*mix(${frost},deposited,uSnowProgress)${kind === 'batch' ? '*vSeasonDetail' : ''};
        ${meadow ? 'cover=max(cover,uSnowAccumulation);'+SNOW_LIGHT : `diffuseColor.rgb=mix(diffuseColor.rgb,${WHITE},cover);`}`)
      .replace('#include <opaque_fragment>', (meadow ? CRYSTALS+'\n' : '')+'#include <opaque_fragment>')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.94,cover);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor*=1.0-cover;');
  };
  return material;
}

function bindSurfaces(scene, tree, house, uniforms) {
  const copies = new Map(), bindings = [], depthCopies = new Map();
  function bindShadow(mesh, kind) {
    if (!mesh.castShadow || (kind !== 'field' && kind !== 'ground')) return;
    if (!depthCopies.has(kind)) {
      const depth = new MeshDepthMaterial({depthPacking:RGBADepthPacking});
      depth.customProgramCacheKey = () => 'snowfield-shadow-'+kind;
      depth.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, uniforms);
        const terrain = kind === 'ground';
        shader.vertexShader = DECL + (terrain ? SNOW_BED_GLSL : '') + shader.vertexShader.replace(
          '#include <begin_vertex>', '#include <begin_vertex>\n' + (terrain ? `
            transformed.y+=snowHeightAt(snowBand(position.xz,0.),snowBand(position.xz,2.),
              uSnowProgress*uSeasons.w,uSnowAccumulation)*smoothstep(-.2,.4,normal.y);`
            : 'transformed.y*=1.-.94*uSnowAccumulation;'));
      };
      depthCopies.set(kind,depth);
    }
    const replacement = depthCopies.get(kind);
    bindings.push([mesh,'customDepthMaterial',mesh.customDepthMaterial,replacement]);
    mesh.customDepthMaterial = replacement;
  }
  function bind(mesh, role) {
    if (!mesh.isMesh || !mesh.geometry.attributes.normal) return;
    const original = mesh.material, list = Array.isArray(original) ? original : [original];
    const next = list.map(source => {
      const kind = source && (typeof role === 'function' ? role(source) : role);
      if (!kind || !(source.isMeshStandardMaterial || source.isMeshBasicMaterial || source.isMeshLambertMaterial ||
        source.isMeshPhongMaterial || source.isMeshToonMaterial)) return source;
      const key = `${source.uuid}:${kind}`;
      if (!copies.has(key)) copies.set(key, seasonalMaterial(source, kind, uniforms));
      return copies.get(key);
    });
    if (next.every((mat,i) => mat === list[i])) return;
    const replacement = Array.isArray(original) ? next : next[0];
    mesh.material = replacement;
    bindings.push([mesh, 'material', original, replacement]);
    bindShadow(mesh,role);
  }
  scene.traverse(mesh => {
    const kind = SURFACES.get(mesh.name);
    if (kind && (kind !== 'seeds' || mesh.geometry?.hasAttribute('foliageKind'))) bind(mesh, kind);
  });
  const crown = scene.getObjectByName('Leaves_ContinuousUmbrella');
  (crown || tree)?.traverse(mesh => bind(mesh, mat =>
    (crown || mesh === tree || mesh.userData.gardenFoliage || /leaves|foliage|canopy/i.test(`${mesh.name} ${mat.name}`)) && 'canopy'));
  house?.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (/^cabin-(crafted-timber|ivory-painted-trim|bronze-trim)$/.test(mesh.name)) return bind(mesh,'batch');
    for (let node = mesh; node && node !== house.parent; node = node.parent) {
      if (/roof|shingle/i.test(node.name)) return bind(mesh,'roof');
    }
    bind(mesh, mat => /roof|shingle/i.test(mat.name) && 'roof');
  });
  return () => {
    for (const [mesh, key, original, replacement] of bindings) if (mesh[key] === replacement) mesh[key] = original;
    for (const mat of depthCopies.values()) mat.dispose();
    for (const mat of copies.values()) mat.dispose();
    copies.clear();
    bindings.length = 0;
  };
}

// Atmosphere changes continue to write the baseline while the renderer reads the winter gain.
function bindWarmth(target, key, snow) {
  const saved = target && Object.getOwnPropertyDescriptor(target,key);
  if (!saved?.configurable || !saved.writable) return;
  let base = saved.value;
  const get = () => base * (1+.4*snow.value);
  Object.defineProperty(target,key,{configurable:true, enumerable:saved.enumerable, get, set(value) { base=value; }});
  return () => {
    if (Object.getOwnPropertyDescriptor(target,key)?.get === get) Object.defineProperty(target,key,{...saved,value:base});
  };
}

function makeFlowerCarpet(scene, uniforms) {
  const grass = scene.getObjectByName('patches-of-meadow-grass');
  if (!grass?.isInstancedMesh || !grass.count) return;

  // A raised gold disk, five cupped petals and two crossed stem faces.
  const positions = [0, .241, 0], parts = [0], indices = [];
  const segments = 25, petalRadii = [.018, .057, .079, .077, .054];
  for (let i = 0; i < segments; i++) {
    const a = -i * 2 * Math.PI / segments, x = Math.cos(a), z = Math.sin(a);
    const r = petalRadii[i % 5], inner = 1 + i * 2, next = 1 + (i + 1) % segments * 2;
    positions.push(x * .016, .234, z * .016, x * r, .224 + .26 * r, z * r);
    parts.push(0, 1);
    indices.push(0, inner, next, inner, inner + 1, next + 1, inner, next + 1, next);
  }
  for (const [dx, dz] of [[.0026, 0], [0, .0026]]) {
    const i = parts.length;
    positions.push(-dx, 0, -dz, dx, 0, dz, dx, .234, dz, -dx, .234, -dz);
    parts.push(-1, -1, -1, -1);
    indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aFloret', new Float32BufferAttribute(parts, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const capacity = Math.min(1900, grass.count);
  const opening = new InstancedBufferAttribute(new Float32Array(capacity).fill(1), 1).setUsage(DynamicDrawUsage);
  geometry.setAttribute('aOpening', opening);
  const material = new MeshLambertMaterial({ side: DoubleSide });
  const breeze = { value: 0 };
  material.onBeforeCompile = shader => {
    shader.uniforms.uBloomTime = breeze;
    shader.vertexShader = 'attribute float aFloret, aOpening;\nuniform float uBloomTime;\n' +
      shader.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
          if (aFloret < 0.0) vColor.rgb = vec3(0.10, 0.24, 0.043);
          else if (aFloret == 0.0) vColor.rgb = vec3(1.0, 0.49, 0.035);
        #endif`).replace('#include <begin_vertex>', `#include <begin_vertex>
        float sway = sin(uBloomTime + dot(instanceMatrix[3].xz, vec2(0.8, 0.6)));
        transformed.x += 0.058 * position.y * sway;
        transformed.xz *= sqrt(aOpening);
        transformed.y *= aOpening;`);
  };

  const flowers = new InstancedMesh(geometry, material, capacity);
  const pose = new Object3D(), random = rng(40651);
  const colors = ['#fa5791', '#ffd14a', '#fff8f1'].map(hex => new Color(hex));
  const stride = Math.max(1, Math.floor(grass.count / (capacity * 4)));
  flowers.name = 'spring-wildflower-carpet';
  flowers.userData.gardenFoliage = true;
  flowers.receiveShadow = true;
  flowers.count = 0;
  for (let i = 0; i < grass.count && flowers.count < capacity; i += stride) {
    grass.getMatrixAt(i, pose.matrix);
    pose.position.setFromMatrixPosition(pose.matrix);
    const { x, z } = pose.position;
    if (paddyContains(x,z)) continue;
    const density = fbm(x * .44 + 12, z * .36 - 6);
    if (random() > .035 + Math.max(0, density - .43) * 4.8) continue;
    const hue = fbm(x * .27 - 17, z * .34 + 3) + (random() - .5) * .22;
    pose.rotation.set((random() - .5) * .50, random() * 2 * Math.PI, (random() - .5) * .50);
    pose.scale.setScalar(.8 + random() * .8);
    pose.updateMatrix();
    flowers.setMatrixAt(flowers.count, pose.matrix);
    flowers.setColorAt(flowers.count++, colors[hue < .46 ? 0 : hue < .56 ? 1 : 2]);
  }
  grass.add(flowers);
  let lastWeight = 1;
  return {
    update(delta = 0) {
      const weight = uniforms.uSeasons.value.x;
      flowers.visible = weight > .001;
      if (!flowers.visible) return;
      breeze.value += delta;
      if (weight === lastWeight) return;
      lastWeight = weight;
      for (let i = 0; i < flowers.count; i++) {
        const lag = ((i * 37) % 97) * .002;
        const t = Math.max(0, Math.min(1, (weight-lag)/.80));
        opening.setX(i, t*t*(3-2*t));
      }
      opening.needsUpdate = true;
    },
    dispose() {
      flowers.removeFromParent();
      flowers.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}

function weatherAtlas() {
  const size = 64, width = size * 4;
  const canvas = globalThis.document?.createElement('canvas');
  if (canvas) { canvas.width = width; canvas.height = size; }
  const ctx = canvas?.getContext('2d');
  const image = ctx?.createImageData(width,size);
  const pixels = image?.data || new Uint8Array(width*size*4);
  // Half of a serrated maple blade, from its terminal lobe down to its stem.
  const outline = [[0,.95],[.13,.54],[.22,.61],[.22,.27],[.62,.70],[.55,.36],
    [.74,.43],[.63,.14],[.93,.25],[.83,.02],[.94,.01],[.64,-.20],[.73,-.28],
    [.28,-.31],[.33,-.48],[.035,-.38],[.026,-.87],[0,-.88]];
  function maple(x, y) {
    let inside = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [a,b] = outline[i], [c,d] = outline[j];
      if ((b > y) !== (d > y) && x < a + (y-b)*(c-a)/(d-b)) inside = !inside;
    }
    return inside;
  }
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const x = 2*(col+.5)/size-1, y = 2*(row+.5)/size-1, r = Math.hypot(x,y);
    const a = Math.atan2(Math.abs(x), y+.43), radius = Math.hypot(x,y+.43);
    const vein = Math.exp(-Math.abs(Math.sin(a*4.7))*radius*23);
    const fan = radius < 1.16 - .19*Math.exp(-a*a*80) + .028*Math.cos(a*27) && a < 1.08;
    const ray = .5 + .5*Math.cos(a*39);
    const lobe = Math.cos(6*Math.atan2(y,x)), cloud = Math.max(0,1-r*r);
    const put = (cell, red, green, blue, opacity) => {
      const p = 4*(row*width+cell*size+col);
      pixels[p]=red; pixels[p+1]=green; pixels[p+2]=blue; pixels[p+3]=255*opacity;
    };
    put(0,255,233,160,cloud**3 * (.3+.7*Math.exp(-11*r*r)));
    put(1,210+42*vein,45+69*vein+18*y,32+11*vein,maple(Math.abs(x),y));
    put(2,252,177+37*ray+12*y,44+28*ray,fan || (Math.abs(x)<.025 && y>-.91 && y<-.41));
    const rim=.76+.17*lobe+.035*Math.sin(x*26+y*19);
    put(3,255,255,255,.95*(1-MathUtils.smoothstep(r,.20,rim)));
  }
  if (ctx) ctx.putImageData(image,0,0);
  const map = ctx ? new CanvasTexture(canvas) : new DataTexture(pixels,width,size,RGBAFormat);
  map.flipY = false;
  map.colorSpace = SRGBColorSpace;
  map.magFilter = LinearFilter;
  map.minFilter = LinearMipmapLinearFilter;
  map.generateMipmaps = map.needsUpdate = true;
  return map;
}

// Bake terrain and solid overhead surfaces once. Two packed 16-bit heights keep
// vertex texture sampling filterable on r170 without floating-point extensions.
function weatherSurface(island) {
  const width=256, height=160, spanX=RX*2.8, spanZ=RZ*2.8;
  const floor=new Float32Array(width*height), cover=new Float32Array(width*height);
  for(let j=0;j<height;j++)for(let i=0;i<width;i++) {
    const x=((i+.5)/width-.5)*spanX, z=((j+.5)/height-.5)*spanZ;
    floor[j*width+i]=ground(x,z);
    cover[j*width+i]=Math.abs(x-creekX(z))<1.8 ? Math.max(floor[j*width+i],waterY(z)) : floor[j*width+i];
  }
  island.updateWorldMatrix(true,true);
  const inverse=new Matrix4().copy(island.matrixWorld).invert(), matrix=new Matrix4();
  const a=new Vector3(),b=new Vector3(),c=new Vector3(), visited=new Set();
  let ceiling=14;
  function raster(mesh, terrain=false) {
    if(!mesh.isMesh||mesh.isInstancedMesh||visited.has(mesh))return;
    visited.add(mesh);
    const g=mesh.geometry, p=g.attributes.position, index=g.index, count=index?.count??p.count;
    matrix.multiplyMatrices(inverse,mesh.matrixWorld);
    for(let n=0;n<count;n+=3) {
      a.fromBufferAttribute(p,index?index.getX(n):n).applyMatrix4(matrix);
      b.fromBufferAttribute(p,index?index.getX(n+1):n+1).applyMatrix4(matrix);
      c.fromBufferAttribute(p,index?index.getX(n+2):n+2).applyMatrix4(matrix);
      ceiling=Math.max(ceiling,a.y+3,b.y+3,c.y+3);
      const determinant=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);
      if(Math.abs(determinant)<1e-8)continue;
      const left=Math.max(0,Math.floor((Math.min(a.x,b.x,c.x)/spanX+.5)*width-.5));
      const right=Math.min(width-1,Math.ceil((Math.max(a.x,b.x,c.x)/spanX+.5)*width-.5));
      const top=Math.max(0,Math.floor((Math.min(a.z,b.z,c.z)/spanZ+.5)*height-.5));
      const bottom=Math.min(height-1,Math.ceil((Math.max(a.z,b.z,c.z)/spanZ+.5)*height-.5));
      for(let j=top;j<=bottom;j++)for(let i=left;i<=right;i++) {
        const x=((i+.5)/width-.5)*spanX,z=((j+.5)/height-.5)*spanZ;
        const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/determinant;
        const v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/determinant;
        if(u<0 || v<0 || u+v>1) continue;
        const k=j*width+i, y=u*a.y+v*b.y+(1-u-v)*c.y;
        if(terrain) {
          floor[k]=y;
          cover[k]=Math.abs(x-creekX(z))<1.8 ? Math.max(y,waterY(z)) : y;
        } else cover[k]=Math.max(cover[k],y);
      }
    }
  }
  const meadow=island.getObjectByName('meadow-and-soil') || island.getObjectByName('island-terrain');
  if(meadow) meadow.traverse(mesh=>raster(mesh,true));
  for(const name of ['Leaves_ContinuousUmbrella','cabin-crafted-timber','cabin-roof','paddy-sky-mirrors','paddy-earthen-bunds','bridge-deck-and-railings'])
    island.getObjectByName(name)?.traverse(raster);
  const data=new Uint8Array(width*height*4);
  for(let i=0;i<floor.length;i++) {
    const f=Math.ceil(MathUtils.clamp((floor[i]+4)/32,0,1)*65535);
    const c=Math.ceil(MathUtils.clamp((cover[i]+4)/32,0,1)*65535);
    data.set([f>>8,f&255,c>>8,c&255],i*4);
  }
  const map=new DataTexture(data,width,height,RGBAFormat);
  map.minFilter=map.magFilter=LinearFilter;map.needsUpdate=true;
  return {map,ceiling};
}

function makeWeather(scene, uniforms) {
  const snowCount=4096, count=312+snowCount, random=rng(64219), seeds=new Float32Array(count*4);
  const island=scene.getObjectByName('island')||scene, surface=weatherSurface(island);
  const geometry = new PlaneGeometry(1,1), map = weatherAtlas();
  const material = new MeshBasicMaterial({map, transparent:true, depthWrite:false, side:DoubleSide, forceSinglePass:true});
  const mesh = new InstancedMesh(geometry,material,count), anchor = new Object3D();
  mesh.name = 'seasonal-weather-particles';
  mesh.renderOrder = 6;
  mesh.frustumCulled = mesh.visible = false;
  for (let i=0; i<count; i++) {
    const kind = i < 104 ? 0 : i < 312 ? (random() < .63 ? 1 : 2) : 3;
    const angle = random()*Math.PI*2, radius = Math.sqrt(random());
    const nearTree = (kind===1 || kind===2) && random()<.68;
    const x = kind===3 ? (random()-.5)*RX*2.5 : (nearTree ? TREE_SITE.x : 0) + radius*Math.cos(angle)*(nearTree ? 6.5 : RX);
    const z = kind===3 ? (random()-.5)*RZ*2.5 : (nearTree ? TREE_SITE.z : 0) + radius*Math.sin(angle)*(nearTree ? 5 : RZ);
    anchor.position.set(x,ground(x,z),z);
    anchor.updateMatrix();
    mesh.setMatrixAt(i,anchor.matrix);
    const rank = kind === 3 ? (i-312+random())/(count-312) : random();
    seeds.set([kind,random(),random(),rank],i*4);
  }
  geometry.setAttribute('weatherSeed',new InstancedBufferAttribute(seeds,4));
  const clock = {value:0}, snowClock = {value:0};
  const cabinGround = ground(CABIN_SITE.x,CABIN_SITE.z).toFixed(4);
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms, {uWeatherTime:clock,uSnowTime:snowClock,uWeatherSurface:{value:surface.map}});
    shader.vertexShader = `
      uniform vec4 uSeasons;
      uniform float uWeatherTime, uSnowTime, uSnowProgress, uSnowAccumulation;
      uniform sampler2D uWeatherSurface;
      ${SNOW_BED_GLSL}
      attribute vec4 weatherSeed;
      varying float vWeatherAlpha;
      mat2 weatherTurn(float a) { float c=cos(a), s=sin(a); return mat2(c,s,-s,c); }
    ` + shader.vertexShader.replace('#include <project_vertex>', `
      float kind=weatherSeed.x, seed=weatherSeed.y, pace=weatherSeed.z, rank=weatherSeed.w;
      bool mote=kind<.5, snow=kind>2.5;
      float t=uWeatherTime, storm=uSnowAccumulation, phase=seed*6.283185;
      float age=fract(seed+(snow?uSnowTime:t)*mix(.042,.091,pace));
      float flutter=t*(1.2+pace)+phase*3.0, gust=sin(t*.66+phase);
      vec3 center=instanceMatrix[3].xyz;
      float breadth;
      if (mote) {
        center+=vec3(sin(t*.28+phase),.48+rank*3.4+.38*sin(t*.78+phase),cos(t*.35+phase)*.65);
        breadth=.07+.075*pace;
        vWeatherAlpha=uSeasons.y*(.33+.36*pow(.5+.5*sin(t*1.6+phase),2.0));
      } else if(snow) {
        // Independent phase, fall rate and size retain the 70 / 25 / 5 mixture.
        float powder=1.0-step(.70,rank), clump=step(.95,rank);
        float flake=1.0-powder-clump;
        float ordinary=(powder*mix(.045,.095,pace)+flake*mix(.16,.30,pace)+clump*mix(.36,.57,pace))*(.60+.40*uSnowProgress);
        float sizeRank=powder*.24*pace+flake*mix(.24,.72,pace)+clump*mix(.72,1.,pace);
        breadth=mix(ordinary,mix(.35,1.6,sizeRank),storm);
        flutter=uSnowTime*(1.0+pace*.58)+phase*3.0;
        gust=sin(uSnowTime*.33+center.z*.19)+.35*sin(uSnowTime*.81+center.x*.16);
        float cloudTop=${surface.ceiling.toFixed(4)}+pace*3.0+2.2*sin(center.z*.29)+1.6*cos(center.x*.18);
        center.y=mix(-.65,cloudTop,1.0-age);
        center.x+=(.5-age)*mix(8.,24.,storm)*mix(.32,1.,max(uSnowProgress,storm))+sin(flutter)*(.8+pace);
        center.z+=cos(flutter*.85)*1.2+gust*(2.8*uSnowProgress+1.8*storm);
        vec2 hearth=vec2(${CABIN_SITE.x},${CABIN_SITE.z}), radial=center.xz-hearth;
        float eddy=storm*(1.-smoothstep(2.,11.,length(radial)));
        center.xz=hearth+weatherTurn(eddy*(.76*sin(flutter*.53)+1.15*age))*radial;
        float curl=flutter*.61+center.x*.15-center.z*.12;
        center.x+=cos(curl)*(clump*.85+.16)*storm;
        center.y+=sin(curl*1.7)*(.14+.36*clump)*storm;
        vec2 siteUv=center.xz/vec2(${RX*2.8},${RZ*2.8})+.5;
        vec4 heights=texture2D(uWeatherSurface,siteUv);
        vec2 unpackHeight=vec2(65280.0,255.0)/65535.0;
        float terrain=dot(heights.rg,unpackHeight)*32.0-4.0;
        float roof=dot(heights.ba,unpackHeight)*32.0-4.0;
        vec4 bed=snowBand(center.xz,0.), drift=snowBand(center.xz,2.);
        float rise=snowHeightAt(bed,drift,uSeasons.w*uSnowProgress,storm);
        float impact=max(terrain+rise,roof);
        // Raised terrace ice and banks share the same wind-packed height field.
        if (bed.a<.1 && drift.a>.8 && roof-terrain<1.8) impact=max(impact,roof+rise);
        float clearance=center.y-impact;
        float density=smoothstep(rank-.010,rank+.010,mix(mix(.13,.75,uSnowProgress),1.02,storm));
        float fieldEdge=length(center.xz/vec2(${RX*1.42},${RZ*1.48}));
        vWeatherAlpha=uSeasons.w*density*smoothstep(0.,.14,age)*(1.-smoothstep(.84,1.21,fieldEdge))
          *smoothstep(breadth*.5+.055,breadth*.5+.40,clearance);
      } else {
        center.y+=(1.0-age)*mix(6.8,13.5,pace)+.20*sin(flutter);
        center.x+=age*5.2+sin(flutter)*(.42+.66*pace);
        center.z+=cos(flutter*.79)*.67+gust*.72;
        breadth=.22+.19*pace;
        vWeatherAlpha=uSeasons.z*smoothstep(0.0,.08,age)*(1.0-smoothstep(.90,1.0,age));
      }
      vec2 cabin=weatherTurn(${CABIN_SITE.yaw.toFixed(6)})*(center.xz-vec2(${CABIN_SITE.x},${CABIN_SITE.z}));
      if (abs(cabin.x)<2.58 && abs(cabin.y)<2.13 && center.y<${cabinGround}+3.90-.62*abs(cabin.x)) vWeatherAlpha=0.0;
      vec4 mvPosition=modelViewMatrix*vec4(center,1.0);
      vec3 corner=position*breadth;
      if (snow) vWeatherAlpha*=smoothstep(.35,2.2,-mvPosition.z);
      if (mote || snow) {
        mvPosition.xy+=weatherTurn(flutter*.45)*corner.xy;
      } else {
        corner.xy=weatherTurn(phase+.45*sin(flutter))*corner.xy;
        corner.yz=weatherTurn(flutter+gust*.8)*corner.yz;
        corner.xz=weatherTurn(.57*flutter+phase)*corner.xz;
        mvPosition.xyz+=mat3(modelViewMatrix)*corner;
        vWeatherAlpha*=.86+.14*abs(cos(flutter));
      }
      vMapUv.x=(vMapUv.x+kind)*.25;
      gl_Position=projectionMatrix*mvPosition;
      if (vWeatherAlpha<.001) gl_Position=vec4(2.,2.,2.,1.);
    `);
    shader.fragmentShader = 'varying float vWeatherAlpha;\n'+shader.fragmentShader.replace(
      '#include <alphatest_fragment>','diffuseColor.a*=vWeatherAlpha;\n#include <alphatest_fragment>');
  };
  material.customProgramCacheKey = () => 'four-seasons-weather-v5-snowfield';
  island.add(mesh);
  return {
    update(delta, reducedMotion) {
      const w=uniforms.uSeasons.value;
      mesh.visible=!reducedMotion && w.y+w.z+w.w>.0001;
      const drift=uniforms.uSnowAccumulation.value;
      const density=MathUtils.lerp(.15+.61*uniforms.uSnowProgress.value,1,drift);
      mesh.count = w.w>.0001 ? 312+Math.ceil((count-312)*density) : w.z>.0001 ? 312 : 104;
      if (!mesh.visible) return;
      clock.value+=delta;
      snowClock.value+=delta*(.8+2.15*uniforms.uSnowProgress.value+1.65*drift);
    },
    dispose() { mesh.removeFromParent(); mesh.dispose(); geometry.dispose(); material.dispose(); map.dispose(); surface.map.dispose(); },
  };
}

const STYLE = `
.season-picker{position:fixed;z-index:9;left:max(12px,env(safe-area-inset-left));bottom:max(14px,env(safe-area-inset-bottom));display:flex;gap:2px;padding:4px;border:1px solid #fff9;border-radius:99px;background:#f5f1e7d9;box-shadow:0 3px 16px #18251e24;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);pointer-events:auto}
.season-picker button{appearance:none;min-width:44px;min-height:40px;padding:4px 8px;border:0;border-radius:99px;background:transparent;color:#374338;font:500 13px/1.2 system-ui,sans-serif;white-space:nowrap;cursor:pointer;touch-action:manipulation;transition:background .16s,color .16s,transform .16s}
.season-picker button[aria-pressed=true]{background:#35483e;color:#fff}
.season-picker button[data-deep=true]{background:#365b70;box-shadow:inset 0 -2px #d6efff}
.season-picker button:focus-visible{outline:2px solid #346a86;outline-offset:2px}
.season-picker button:active{transform:scale(.95)}
@media(hover:hover){.season-picker button[aria-pressed=false]:hover{background:#3858411a}}
@media(prefers-reduced-motion:reduce){.season-picker button{transition:none;transform:none}}
#garden-ui>:is(.season-picker,#season-controls){position:absolute;z-index:9;left:max(var(--edge,16px),env(safe-area-inset-left));bottom:max(84px,11vh)}
#season-controls{display:flex;align-items:center;gap:7px}
#season-controls .season-picker{position:static}
#blizzard-toggle{min-height:44px;padding:0 13px;white-space:nowrap;touch-action:manipulation;font:500 13px/1.2 var(--chinese,system-ui);
  color:#244752;border:1px solid #fff9;border-radius:99px;background:#e9f2f0df;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 3px 16px #182d3d26;cursor:pointer}
#blizzard-toggle[aria-pressed=true]{color:#fbfeff;background:#31586aef;border-color:#d9f5ff;box-shadow:inset 0 -2px #bfdeec,0 3px 16px #182d3d35}
#blizzard-toggle:focus-visible{outline:2px solid #346a86;outline-offset:2px}
@media(hover:hover){#blizzard-toggle:hover{border-color:#6092a0}}
@media(min-width:1101px){#app[data-view='cabin'] #garden-ui>:is(.season-picker,#season-controls){bottom:max(176px,21vh)}}
#garden-ui:has(#atmosphere-switcher[hidden])>:is(.season-picker,#season-controls){display:none}
@media(max-width:1100px){
  #garden-ui>:is(.season-picker,#season-controls){--bar:max(84px,11vh);bottom:calc(var(--bar) + 50px)}
  #app[data-view=cabin] #garden-ui>:is(.season-picker,#season-controls){--bar:158px}
  #garden-ui:has(:is(#stargaze,#telescope-gaze):not([hidden]))>:is(.season-picker,#season-controls){bottom:calc(var(--bar) + 104px)}
  .season-picker button{min-height:44px}
}
@media(max-width:359px){#season-controls{gap:4px}#blizzard-toggle{padding:0 9px}.season-picker button{min-width:40px;padding-inline:4px}}`;

function makePicker(select) {
  if (typeof document === 'undefined' || !document.body) return;
  const panel = document.createElement('div'), style = document.createElement('style');
  panel.className = 'season-picker';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', '四季');
  style.textContent = STYLE;
  panel.append(style);
  const buttons = NAMES.map((name, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.season = name;
    button.textContent = LABELS[i];
    panel.append(button);
    return button;
  });
  function click(event) {
    const button = event.target.closest('button[data-season]');
    if (button) select(button.dataset.season);
  }
  panel.addEventListener('click', click);
  const rail=document.getElementById('season-controls'), stormButton=rail?.querySelector('#blizzard-toggle');
  if (rail) rail.prepend(panel);
  else (document.getElementById('garden-ui') || document.body).append(panel);
  return {
    sync(name, snow, blizzard) {
      stormButton?.setAttribute('aria-pressed',String(blizzard));
      for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.season === name));
      const winter = buttons[3], selected = name === 'winter';
      winter.dataset.deep = String(selected && snow === 1);
      winter.title = !selected ? '冬 · 初雪微霜' : snow ? '深雪 · 点击回到初雪' : '初雪 · 点击积成深雪';
      winter.setAttribute('aria-label', winter.title);
    },
    dispose() { panel.removeEventListener('click', click); panel.remove(); stormButton?.setAttribute('aria-pressed','false'); },
  };
}

export function makeSeasons(scene, { camera, lighting, cabin, treeAsset } = {}) {
  const weights = new Vector4(1,0,0,0), from = weights.clone(), to = weights.clone();
  const snow = {value:0}, accumulation = {value:0}, snowBed=makeSnowBed(paddyContains);
  const current=scene.getObjectByName('creek-surface')?.material.userData.currentUniforms;
  const uniforms = { uSeasons: { value: weights }, uSnowProgress: snow, uSnowAccumulation:accumulation, uSnowBed:{value:snowBed.texture},
    uSeasonSun:current?.uSunDirection || {value:new Vector3(-11,10.5,7.5).normalize()} };
  const house = cabin?.group || scene.getObjectByName('secret-haven-cabin');
  const restore = bindSurfaces(scene, treeAsset?.tree, house, uniforms);
  const lamp = house?.getObjectByName('porch-warm-light') || scene.getObjectByName('porch-warm-light');
  const porch = bindWarmth(lamp,'intensity',snow);
  const hearth = bindWarmth(house?.getObjectByName('cabin-flame-core')?.material.uniforms?.uGain,'value',snow);
  const carpet = makeFlowerCarpet(scene, uniforms);
  const fields = makePaddyAndPlum(scene, uniforms), ice = bindWaterSeasons(scene);
  const restoreContacts=bindSnowContacts(scene,lighting?.contact?.normalMaterial,uniforms);
  const weather = makeWeather(scene, uniforms);
  const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let season = 'spring', seasonTime = DURATION, snowTime = DURATION, snowFrom = 0, snowTo = 0, disposed = false;
  let blizzard=false, stormPhase=0;
  const picker = makePicker(setSeason);
  picker?.sync(season, snowTo, blizzard);

  function setSeason(name, form) {
    const index = NAMES.indexOf(name);
    if (disposed || index < 0) return;
    let target = 0;
    if (name === 'winter') {
      if (form === undefined) target = Number(season === name && snowTo === 0);
      else if (form === 1 || form === 'deep') target = 1;
      else if (form !== 0 && form !== 'light') return;
    }
    if (name !== 'winter' || !target) blizzard=false;
    if (name !== season) {
      from.copy(weights);
      to.set(0,0,0,0).setComponent(index,1);
      season = name;
      seasonTime = 0;
    }
    if (target !== snowTo) {
      snowFrom = snow.value;
      snowTo = target;
      snowTime = 0;
    }
    picker?.sync(season,snowTo,blizzard);
  }
  function setBlizzard(enabled) {
    if (disposed || typeof enabled !== 'boolean' || blizzard===enabled) return;
    blizzard=enabled;
    setSeason('winter',enabled ? 'deep' : 'light');
  }
  function update(delta, visibleDelta=delta) {
    if (disposed || !Number.isFinite(delta) || delta <= 0) return;
    if (seasonTime < DURATION) {
      seasonTime = Math.min(DURATION, seasonTime + delta);
      weights.lerpVectors(from,to,ease(seasonTime));
    }
    if (snowTime < DURATION) {
      snowTime = Math.min(DURATION, snowTime + delta);
      snow.value = snowFrom + (snowTo - snowFrom) * ease(snowTime);
    }
    if (Number.isFinite(visibleDelta) && visibleDelta>0) {
      stormPhase=MathUtils.clamp(stormPhase+(blizzard?1:-1)*visibleDelta/BLIZZARD_DURATION,0,1);
      accumulation.value=stormPhase*stormPhase*(3-2*stormPhase);
    }
    carpet?.update(motion?.matches ? 0 : delta);
    weather.update(delta, motion?.matches);
    fields.update(motion?.matches ? 0 : delta);
    ice?.update(weights.w,snow.value);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    blizzard=false; season='spring'; accumulation.value=0; snow.value=0; weights.set(1,0,0,0);
    picker?.dispose();
    ice?.dispose();
    restoreContacts?.();
    fields.dispose();
    weather.dispose();
    carpet?.dispose();
    hearth?.();
    porch?.();
    restore();
    snowBed.texture.dispose();
  }
  function getSnowHeight(x,z) {
    return disposed ? 0 : snowBed.heightAt(x,z,snow.value*weights.w,accumulation.value);
  }
  return {update, setSeason, setBlizzard, getSeason:()=>season, getWinterWeight:()=>weights.w,
    getBlizzard:()=>blizzard, getDeepSnow:()=>snow.value*weights.w,
    getSnowAccumulation:()=>accumulation.value, getSnowHeight, dispose};
}
