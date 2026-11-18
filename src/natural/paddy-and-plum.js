import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, curveTube } from './shared.js';
import { ground, creekX } from './land.js';
import { SNOW_BED_GLSL } from './snow-bed.js';

const PADDY_BORDERS = [-1, -.32, .40, 1];
function paddyPoint(s,t) {
  return [6.03+.32*(1-t*t)-.14*t+(2.08-.16*t*t)*s, -4.2+(1.91-.34*s*s)*t];
}
export function paddyContains(x,z) {
  if (x<3.5 || x>8.5 || z<-6.2 || z>-2.2) return false;
  let t=(z+4.2)/1.91, s=0;
  for (let i=0;i<3;i++) {
    s=(x-6.03-.32*(1-t*t)+.14*t)/(2.08-.16*t*t);
    t=(z+4.2)/(1.91-.34*s*s);
  }
  return Math.abs(s)<1.01 && Math.abs(t)<1.015;
}
function riceClump() {
  const vertices=[], indices=[], organs=[], pivots=[], V=THREE.Vector3;
  function vertex(p,organ,pivot) {
    vertices.push(...p); organs.push(organ); pivots.push(...pivot); return organs.length-1;
  }
  function ribbon(path,width,side,organ,pivot) {
    let prev=-1;
    for(let j=0;j<path.length;j++) {
      const r=width(j/(path.length-1)), p=path[j];
      const a=vertex(p.clone().addScaledVector(side,-r),organ,pivot);
      vertex(p.clone().addScaledVector(side,r),organ,pivot);
      if(prev>=0) indices.push(prev,prev+1,a,prev+1,a+1,a);
      prev=a;
    }
  }
  function grain(p,d,side,pivot) {
    const head=vertex(p,2,pivot), foot=vertex(p.clone().add(d),2,pivot);
    const mid=p.clone().addScaledVector(d,.48), lateral=new V().crossVectors(d,side).normalize();
    for(let j=0;j<4;j++) {
      const a=j*Math.PI*.5;
      vertex(mid.clone().addScaledVector(side,.006*Math.cos(a)).addScaledVector(lateral,.005*Math.sin(a)),2,pivot);
    }
    for(let j=0;j<4;j++) {const a=head+2+j,b=head+2+(j+1)%4;indices.push(head,a,b,foot,b,a);}
  }
  for(let k=0;k<4;k++) {
    const angle=k*2.39996, dir=new V(Math.cos(angle),0,Math.sin(angle)), side=new V(-dir.z,0,dir.x);
    const root=dir.clone().multiplyScalar(.016), top=dir.clone().multiplyScalar(.042);
    top.y=.40+.045*Math.sin(angle+1);
    ribbon([root,top],t=>.0035-.0014*t,side,1,root);
    ribbon([root,top],t=>.0035-.0014*t,dir,1,root);
    for(let leaf=0;leaf<3;leaf++) {
      const foot=root.clone().lerp(top,.12+leaf*.20), path=[];
      const radial=dir.clone().multiplyScalar(leaf%2?-1:1);
      for(let j=0;j<=5;j++) {const t=j/5;const p=foot.clone().addScaledVector(radial,.12*t*t);p.y+=.25*t-.11*t*t;path.push(p);}
      ribbon(path,t=>.0095*(1-t)*(.42+Math.sin(t*Math.PI)*1.6),side,0,foot);
    }
    const arc=[];
    for(let j=0;j<=9;j++) {
      const t=j/9, p=top.clone().addScaledVector(dir,.115*t);
      p.y+=.115*t-.17*t*t;arc.push(p);
      if(j>1) {
        const branch=p.clone().addScaledVector(side,(j%2?1:-1)*(.012+.014*t));branch.y-=.015+.016*t;
        ribbon([p,branch],()=>.0016,dir,2,top);
        grain(branch,new V(dir.x*.014,-.036,dir.z*.014),side,top);
      }
    }
    ribbon(arc,t=>.003*(1-.65*t),side,2,top);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('aRiceOrgan',new THREE.Float32BufferAttribute(organs,1));
  g.setAttribute('aRicePivot',new THREE.Float32BufferAttribute(pivots,3));
  g.setIndex(indices);g.computeVertexNormals();return g;
}
function buildPaddies(parent,scene,uniforms) {
  const clock={value:0}, random=rng(73825), pose=new THREE.Object3D();
  const banks={p:[],uv:[],ix:[]}, pools={p:[],uv:[],ix:[]};
  const group=new THREE.Group();group.name='east-cloud-terraces';parent.add(group);
  const make=(data,material,name)=>{
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.p,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));g.setIndex(data.ix);g.computeVertexNormals();
    const m=new THREE.Mesh(g,material);m.name=name;m.receiveShadow=true;group.add(m);return m;
  };
  const grass=new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.92});
  const water=new THREE.MeshPhysicalMaterial({color:'#729b9b',metalness:.25,roughness:.065,clearcoat:.85,envMap:scene.environment});
  const rice=new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.82});
  const crop=new THREE.InstancedMesh(riceClump(),rice,204);
  crop.name='terrace-rice-clumps';crop.userData.gardenFoliage=true;crop.receiveShadow=true;group.add(crop);
  function mountShader(material,key,vertexDecl,vertexCode,fragmentCode,extra='') {
    const snowSurface=key!=='rice' && Boolean(uniforms.uSnowBed && uniforms.uSnowAccumulation);
    material.customProgramCacheKey=()=>`terraced-garden:${key}:${snowSurface}`;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms,{uFieldTime:clock});
      const decl='uniform vec4 uSeasons;\nuniform float uSnowProgress,uFieldTime;\nvarying vec3 vField;\n'
        +(snowSurface?'uniform float uSnowAccumulation; varying vec2 vTerraceSnow;\n':'');
      const drift=snowSurface ? `
        vec4 bank=snowBand(position.xz,2.);
        float pack=uSnowAccumulation*smoothstep(-.2,.4,normal.y);
        transformed.y+=.65*bank.r*pack;
        vTerraceSnow=vec2(pack*bank.a,snowBand(position.xz,1.).a);` : '';
      let vertex=shader.vertexShader;
      if (snowSurface) vertex=vertex.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        objectNormal.xz-=snowGradient(snowBand(position.xz,2.))*objectNormal.y*uSnowAccumulation;`);
      shader.vertexShader=decl+(snowSurface?SNOW_BED_GLSL:'')+vertexDecl+vertex.replace('#include <begin_vertex>',`#include <begin_vertex>\n${vertexCode}\n${drift}`);
      const powder=snowSurface ? 'diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.71,.82,.98),vec3(.99,.96,.88),vTerraceSnow.y),vTerraceSnow.x);' : '';
      shader.fragmentShader=decl+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n${fragmentCode}\n${powder}`)
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\n${extra}`);
    };
  }
  mountShader(grass,'bund','','vField=vec3(position.xz,uv.y);',`
    vec2 soil=vField.xy;
    float clod=.5+.25*sin(soil.x*21.+sin(soil.y*14.))+.25*cos(soil.y*29.+soil.x*7.);
    float moss=smoothstep(.20,.85,vField.z+.22*sin(soil.x*5.9+sin(soil.y*7.3)));
    vec3 loam=mix(vec3(.16,.085,.043),vec3(.29,.19,.10),clod);
    vec3 sod=mix(vec3(.14,.20,.062),vec3(.30,.35,.105),clod);
    sod=mix(sod,vec3(.45,.29,.063),uSeasons.z*.68);
    diffuseColor.rgb=mix(loam,sod,moss);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.77,.86,.94),uSeasons.w*(.24+.65*uSnowProgress)*vField.z);`);
  mountShader(water,'mirror','','vField=vec3(uv,0.);',`
    float edge=smoothstep(.64,.99,max(abs(vField.x),abs(vField.y)));
    float bloom=uSeasons.w*(.17+.31*edge+.42*uSnowProgress);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.77,.87,.97),bloom);`,`
    normal=normalize(normal+mat3(viewMatrix)*vec3(sin(vField.y*24.+vField.x*3.+uFieldTime*.72),
      0.,cos(vField.x*17.-vField.y*5.+uFieldTime*.51))*.018*(1.-uSeasons.w));`);
  mountShader(rice,'rice','attribute float aRiceOrgan;\nattribute vec3 aRicePivot;\n',`
    vField=vec3(aRiceOrgan,.85+.15*sin(dot(instanceMatrix[3].xz,vec2(12.8,19.7))),0.);
    if(aRiceOrgan>1.5) transformed=mix(aRicePivot,transformed,uSeasons.z);
    if(aRiceOrgan<.5) transformed=mix(transformed,aRicePivot+(transformed-aRicePivot)*.08,uSeasons.w);
    float h=dot(uSeasons,vec4(.40,1.06,.95,.27)); transformed.y*=h;
    transformed.xz*=dot(uSeasons,vec4(.51,.99,1.,.62));
    float wave=sin(uFieldTime*1.75+dot(instanceMatrix[3].xz,vec2(1.6,.9)));
    transformed.x+=wave*transformed.y*transformed.y*.24;`,`
    vec3 grainGold=mix(vec3(.694,.184,.00182),vec3(.913,.342,.00335),smoothstep(.70,1.,vField.y));
    vec3 leaf=uSeasons.x*vec3(.238,.864,.412)+uSeasons.y*mix(vec3(.0075,.216,.047),vec3(.008,.366,.069),vField.y)
      +uSeasons.z*(vField.x>1.5?grainGold:vec3(.59,.35,.024))
      +uSeasons.w*mix(vec3(.392,.254,.138),vec3(.75,.80,.81),.19+.34*uSnowProgress);
    diffuseColor.rgb=leaf*vField.y;`);
  let n=0, lower=-Infinity;
  for(let k=2;k>=0;k--) {
    const a=PADDY_BORDERS[k], b=PADDY_BORDERS[k+1], point=(u,t)=>{
      // Part the two rims around the existing path lantern at (7.2,-4.2).
      const notch=.14*Math.exp(-22*t*t), left=a+(k===2?notch:0), right=b-(k===1?notch:0);
      const s=(left+right)*.5+(right-left)*.5*u*(1-.085*t**8);
      return paddyPoint(s,t*(1-.054*u**8));
    };
    let level=-Infinity;
    for(let j=0;j<=24;j++)for(let i=0;i<=10;i++){const [x,z]=point(i/5-1,j/12-1);level=Math.max(level,ground(x,z));}
    level=Math.max(level+.115,lower+.115);lower=level;
    const skirt=[], nu=6,nv=26, base=pools.p.length/3;
    for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++) {
      const u=i/nu*2-1,t=j/nv*2-1,[x,z]=point(u*.83,t*.90),v=base+j*(nu+1)+i;
      pools.p.push(x,level,z);pools.uv.push(u,t);
      if(j<nv&&i<nu)pools.ix.push(v,v+nu+1,v+1,v+1,v+nu+1,v+nu+2);
    }
    for(let i=0;i<nu;i++)skirt.push([i/nu*2-1,-1]);
    for(let j=0;j<nv;j++)skirt.push([1,j/nv*2-1]);
    for(let i=nu;i>0;i--)skirt.push([i/nu*2-1,1]);
    for(let j=nv;j>0;j--)skirt.push([-1,j/nv*2-1]);
    const start=banks.p.length/3, ring=skirt.length;
    const profile=[[.825,.899,-.018,.18,0],[.91,.938,.042,.82,0],[.98,.970,.048,1,0],
      [1.025,1.005,.015,.60,.44],[1.09,1.036,-.035,.17,1]];
    for(const [sx,sz,lift,sod,foot] of profile) {
      for(const [u,t] of skirt) {
        let [x,z]=point(u*sx,t*sz);
        const spread=foot*(.11+.33*Math.max(0,level-ground(x,z)));
        x=Math.max(3.5,Math.min(8.5,x+spread*u**5));
        z=Math.max(-6.2,Math.min(-2.2,z+spread*t**5));
        const crest=level+lift+.011*Math.sin(x*6.1+z*4.7)*sod;
        banks.p.push(x,THREE.MathUtils.lerp(crest,ground(x,z)-.028,foot),z);
        banks.uv.push(x+z,sod);
      }
    }
    for(let j=0;j<profile.length-1;j++)for(let i=0;i<ring;i++){const x=start+j*ring+i,y=start+j*ring+(i+1)%ring;banks.ix.push(x,y,x+ring,y,y+ring,x+ring);}
    for(let row=0;row<17;row++)for(let col=0;col<4;col++){
      const [x,z]=point((col-1.5)*.40+(random()-.5)*.05,(row-8)*.100+(random()-.5)*.026);
      pose.position.set(x,level-.017,z);pose.rotation.y=random()*Math.PI*2;pose.scale.setScalar(.80+random()*.31);
      pose.updateMatrix();crop.setMatrixAt(n++,pose.matrix);
    }
  }
  crop.instanceMatrix.needsUpdate=true;crop.computeBoundingSphere();
  make(banks,grass,'paddy-earthen-bunds');make(pools,water,'paddy-sky-mirrors');
  return {update(delta){
    clock.value+=delta;
    const w=uniforms.uSeasons.value,s=uniforms.uSnowProgress.value;
    const pack=uniforms.uSnowAccumulation?.value ?? 0;
    water.roughness=THREE.MathUtils.lerp(.065+.19*w.z+w.w*(.16+.42*s),.94,pack);
    water.clearcoat=.85*(1-pack);
    water.envMapIntensity=(scene.environmentIntensity??1)*(3.8-.9*w.z-1.4*w.w);
  },dispose(){group.removeFromParent();crop.dispose();for(const m of group.children){m.geometry.dispose();m.material.dispose();}}};
}

function makePlums(parent, uniforms) {
  const group = new THREE.Group(), random = rng(68177);
  group.name = 'winter-plums';
  const material = new THREE.MeshStandardMaterial({vertexColors:true, roughness:.79, alphaHash:true});
  const sites = [
    [-7.04, 4.32, -2.30, 1.15, '#e11d48'],
    [creekX(3.9)-1.34, 3.9, -.63, .93, '#e11d48'],
    [-10.75, 6.91, -2.68, 1.02, '#eab308'],
  ];
  function tint(g, hue, bark=false) {
    const p=g.attributes.position, c=new THREE.Color(hue), values=[];
    for(let i=0;i<p.count;i++){
      const k=bark ? .82+.16*Math.sin(p.getY(i)*31+p.getX(i)*20)+.08*Math.cos(p.getZ(i)*37) : 1;
      values.push(c.r*k,c.g*k,c.b*k);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(values,3));
    return g;
  }
  function batch(parts) {
    const geometry=mergeGeometries(parts);
    for(const part of parts) part.dispose();
    return geometry;
  }
  const oval=(x,y,z,hue)=>tint(new THREE.SphereGeometry(1,8,5).scale(x,y,z),hue);
  function blossom(hue) {
    const wax=hue==='#eab308', parts=[oval(.016,.010,.016,'#db8c24')];
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5;
      parts.push(oval(.025,.009,wax?.034:.031,hue).rotateX(-.31).translate(0,.006,.027).rotateY(a));
      if(wax) parts.push(oval(.012,.007,.021,'#f8ce46').rotateX(-.58).translate(0,.012,.013).rotateY(a+.46));
      const x=.012*Math.sin(a),z=.012*Math.cos(a);
      parts.push(tint(new THREE.CylinderGeometry(.0016,.002,.020,4),'#f2d67c').translate(x,.018,z));
      parts.push(oval(.0045,.004,.0045,'#ffd35a').translate(x,.028,z));
    }
    return batch(parts);
  }
  let renderer, casting=false, disposed=false;
  for(const [site,[x,z,yaw,size,hue]] of sites.entries()){
    const parts=[], flower=blossom(hue), bud=oval(.015,.023,.016,hue);
    const v=(x,y,z)=>new THREE.Vector3(x,y,z);
    function branch(points,radius,tip) {
      const curve=new THREE.CatmullRomCurve3(points);
      const tube=curveTube(points.map(p=>p.toArray()),radius,tip,Math.max(6,points.length*2),radius>.035?8:5);
      // The shared tube winds its rings inward. Reverse them for solid bark and shadows.
      const idx=tube.index.array;
      for(let i=0;i<idx.length;i+=3) [idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
      tube.computeVertexNormals();
      parts.push(tint(tube,radius>.035?'#3f302a':'#664438',true));
      return curve;
    }
    const lean=[1.23,.96,.74][site];
    const bole=branch([v(0,-.045,0),v(-.10,.28,.06),v(.11,.50,-.015),v(.09,.73,-.04),
      v(.46*lean,.88,.075),v(.80*lean,.96,.02),v(lean,1.21,.13)],.098,.015);
    for(let j=0;j<5;j++){
      const start=bole.getPointAt(.19+j*.158), side=j===0?-1:1;
      const reach=side*(.46+random()*.46), rise=.31+random()*.45, depth=(random()-.5)*1.22;
      const fork=branch([start,start.clone().add(v(reach*.19,rise*.51,depth*.21)),
        start.clone().add(v(reach*.65,rise*.61,depth*.72)),start.clone().add(v(reach,rise,depth))],.040-j*.004,.007);
      for(let k=0;k<3;k++){
        const foot=fork.getPointAt(.33+k*.30), turn=(k%2?-1:1), lift=.18+.24*random();
        const twig=branch([foot,foot.clone().add(v(.09*side,.43*lift,.07*turn)),
          foot.clone().add(v((.10+.18*random())*side,lift,turn*(.10+.13*random())))],.0105,.0028);
        for(let f=0;f<3;f++){
          const anchor=twig.getPointAt(.24+f*.32), g=(f===2||random()<.26?bud:flower).clone();
          const s=.72+.53*random();
          parts.push(g.scale(s,s,s).rotateX(.42+random()*1.32).rotateY(random()*Math.PI*2)
            .translate(anchor.x,anchor.y,anchor.z));
        }
      }
    }
    flower.dispose(); bud.dispose();
    const shrub=new THREE.Mesh(batch(parts),material);
    shrub.name=['wall-corner-red-plum','stream-bank-red-plum','courtyard-wintersweet'][site];
    shrub.position.set(x,ground(x,z)-.014,z);
    shrub.rotation.y=yaw; shrub.scale.setScalar(size); shrub.receiveShadow=true;
    shrub.onBeforeRender=r=>{if(renderer!==r){renderer=r;if(casting) r.shadowMap.needsUpdate=true;}};
    group.add(shrub);
  }
  parent.add(group);
  function update(){
    if(disposed) return;
    const w=uniforms.uSeasons.value.w;
    group.visible=w>.001; material.opacity=w;
    if((w>.55)!==casting){
      casting=w>.55;
      for(const shrub of group.children) shrub.castShadow=casting;
      if(renderer) renderer.shadowMap.needsUpdate=true;
    }
  }
  update();
  return {update,dispose(){
    if(disposed) return;
    disposed=true; group.removeFromParent();
    for(const shrub of group.children) shrub.geometry.dispose();
    group.clear(); material.dispose();
    if(renderer&&casting) renderer.shadowMap.needsUpdate=true;
    renderer=null;
  }};
}

function clearPaddyGrass(parent) {
  const roots = new Set(['patches-of-meadow-grass','daisy-petals','daisy-centers','daisy-stems','lavender-meadow-patches','lavender-stems']);
  const pose = new THREE.Matrix4(), small = new THREE.Vector3(.0001,.0001,.0001), restore = [];
  parent.traverse(mesh => {
    if (!mesh.isInstancedMesh || !roots.has(mesh.name)) return;
    const rows = [];
    for (let i=0;i<mesh.count;i++) {
      mesh.getMatrixAt(i,pose);
      if (!paddyContains(pose.elements[12],pose.elements[14])) continue;
      rows.push([i,pose.clone()]);
      mesh.setMatrixAt(i,pose.scale(small));
    }
    if (rows.length) {
      mesh.instanceMatrix.needsUpdate=true;
      restore.push(() => {
        for (const [i,matrix] of rows) mesh.setMatrixAt(i,matrix);
        mesh.instanceMatrix.needsUpdate=true;
      });
    }
  });
  return () => restore.forEach(fn=>fn());
}

export function makePaddyAndPlum(scene, uniforms) {
  const island=scene.getObjectByName('island') || scene;
  const paddy=buildPaddies(island,scene,uniforms), plums=makePlums(island,uniforms);
  const restore=clearPaddyGrass(island);
  let disposed=false;
  paddy.update(0);
  return {
    update(delta) { if (!disposed) { paddy.update(delta); plums.update(); } },
    dispose() {
      if (disposed) return;
      disposed=true;
      plums.dispose(); paddy.dispose(); restore();
    },
  };
}
