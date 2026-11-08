import * as THREE from 'three';
import {mesh, rng, fbm} from './shared.js';
import {material} from './materials.js';
import {creekX, waterY, creekWidth, WATER_END, ground, inside} from './land.js';

// Follow the terrain/water intersection so wakes reach the shallow outer stones.
export function waterBankX(z,side){
  let distance=creekWidth(z);
  while(distance<1.6&&ground(creekX(z)+side*distance,z)<waterY(z))distance+=.02;
  return creekX(z)+side*distance;
}

export function channelBounds(z){
  const taper=THREE.MathUtils.smoothstep(z,WATER_END-.45,WATER_END);
  return {
    left:THREE.MathUtils.lerp(waterBankX(z,-1),creekX(z)-creekWidth(z),taper),
    right:THREE.MathUtils.lerp(waterBankX(z,1),creekX(z)+creekWidth(z),taper)
  };
}

// Channel coordinates keep the current flowing towards +z while orbiting.
export function makeWater(parent, time) {
  let start = -4.8;
  while (!inside(creekX(start), start, .995)) start += .01;
  const positions = [], uvs = [], depths = [], indices = [], rows = 180, columns = 18;
  for (let j = 0; j <= rows; j++) {
    const z = start + (WATER_END - start) * j / rows;
    const {left,right}=channelBounds(z);
    for (let i = 0; i <= columns; i++) {
      const u = i / columns;
      const x = THREE.MathUtils.lerp(left,right,u);
      positions.push(x, waterY(z), z);
      depths.push(Math.max(0, waterY(z) - ground(x, z)));
      uvs.push(u, z);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const a = j * (columns + 1) + i, b = a + columns + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const creekGeometry = geometry(positions, uvs, indices);
  creekGeometry.setAttribute('waterDepth', new THREE.Float32BufferAttribute(depths, 1));
  const surface = mesh(parent, creekGeometry, currentMaterial(time));
  surface.name = 'creek-surface';
  surface.userData.flow=WATER_DYNAMICS;
  surface.castShadow = false;
  surface.renderOrder = 2;

  // Shared geometry/material replaces hundreds of pebble draw calls.
  const random = rng(881), dummy = new THREE.Object3D(), colour = new THREE.Color();
  const pebbleMaterial = material('rock', '#b3c0b7');
  pebbleMaterial.roughness = .9;
  pebbleMaterial.bumpScale = .014;
  const pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), pebbleMaterial, 500);
  pebbles.name = 'creek-pebble-bed';
  let count = 0;
  for (let i = 0; i < 500; i++) {
    const z = start + random() * (WATER_END - start);
    const x = creekX(z) + (random() - .5) * 1.8;
    if (!inside(x, z, .99)) continue;
    const size = .018 + random() * .046;
    dummy.position.set(x, ground(x, z) + size * .24, z);
    dummy.rotation.set(random() * 2, random() * Math.PI * 2, random() * 2);
    dummy.scale.set(size * (1 + random() * .45), size * .46, size * (.85 + random() * .5));
    dummy.updateMatrix();
    pebbles.setMatrixAt(count, dummy.matrix);
    colour.setHSL(.12 + random() * .07, .025 + random() * .08, .37 + random() * .16);
    pebbles.setColorAt(count++, colour);
  }
  pebbles.count = count;
  pebbles.receiveShadow = true;
  pebbles.castShadow = false;
  parent.add(pebbles);

  const stepMaterial = material('rock', '#c2c3b5');
  stepMaterial.roughness = .82;
  stepMaterial.bumpScale = .017;
  for (let i = 0; i < 5; i++) {
    const {x,z,rotation}=STEPPING_STONES[i];
    const stone = new THREE.SphereGeometry(1, 18, 10), p = stone.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const shape = .91 + .14 * fbm(p.getX(k) * 4 + i, p.getZ(k) * 4 + 5);
      p.setXYZ(k, p.getX(k) * shape * .135, p.getY(k) * .095, p.getZ(k) * shape * .23);
    }
    stone.computeVertexNormals();
    const step = mesh(parent, stone, stepMaterial, x, waterY(z) + .075, z);
    step.rotation.y = rotation;
    step.name = `stepping-stone-${i + 1}`;
  }

  makeWaterfall(parent, time);
  return {pebbles: count, steppingStones: 5};
}

export const WATER_DYNAMICS=Object.freeze({mainSpeed:.78,detailSpeed:1.35,amplitude:.022});
export const STEPPING_STONES=Object.freeze(Array.from({length:5},(_,i)=>Object.freeze({
  x:creekX(-.25)+(i-2)*.31,z:-.25-(i-2)*.085,rotation:i*.83
})));

export function currentMaterial(time) {
  const water = new THREE.MeshPhysicalMaterial({
    color:'#ffffff',metalness:0,roughness:.14,ior:1.333,
    transparent:true,opacity:1,envMapIntensity:1.15,
    clearcoat:.38,clearcoatRoughness:.14,
    side:THREE.DoubleSide,depthWrite:false,
  });
  const uniforms={
    uRippleSimTex:{value:null},uRippleStrength:{value:0},
    uTime:time,uMainSpeed:{value:WATER_DYNAMICS.mainSpeed},uDetailSpeed:{value:WATER_DYNAMICS.detailSpeed},
    uWaveAmplitude:{value:WATER_DYNAMICS.amplitude},uWaterEnd:{value:WATER_END},
    uStonePositions:{value:STEPPING_STONES.map(p=>new THREE.Vector2(p.x,p.z))},
    uShallowBlue:{value:new THREE.Color('#7dd3fc')},uShallowGreen:{value:new THREE.Color('#6ee7b7')},
    uDeepBlue:{value:new THREE.Color('#0284c7')},uDeepGreen:{value:new THREE.Color('#059669')},
    uGlintColor:{value:new THREE.Color(1,.96,.83)},uFoamColor:{value:new THREE.Color('#f8fafc')},
    uSunDirection:{value:new THREE.Vector3(-11,10.5,7.5).normalize()},
    uWakeStrength:{value:1},uCrestStrength:{value:1},uGlintStrength:{value:1}
  };
  water.userData.currentUniforms=uniforms;
  water.customProgramCacheKey=()=> 'crystalline-creek-dual-current-v1';
  water.onBeforeCompile = shader => {
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute float waterDepth;varying float vWaterDepth;varying vec2 vCurrentUv;varying vec2 vChannelPosition;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvCurrentUv=uv;vWaterDepth=waterDepth;vChannelPosition=position.xz;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
uniform sampler2D uRippleSimTex;
uniform float uRippleStrength;
uniform float uTime,uMainSpeed,uDetailSpeed,uWaveAmplitude,uWaterEnd;
uniform float uWakeStrength,uCrestStrength,uGlintStrength;
uniform vec2 uStonePositions[5];
uniform vec3 uGlintColor,uShallowBlue,uShallowGreen,uDeepBlue,uDeepGreen,uFoamColor,uSunDirection;
varying vec2 vCurrentUv,vChannelPosition;
varying float vWaterDepth;
float currentHeight(vec2 p){
  float mainFlow=p.y-uTime*uMainSpeed;
  float fastFlow=p.y-uTime*uDetailSpeed;
  return uWaveAmplitude*(sin(mainFlow*15.0+sin(p.x*8.0+mainFlow*2.0))
    +.35*sin(fastFlow*31.0-p.x*15.0)
    +.18*sin(p.x*22.0+fastFlow*7.0));
}
float churningFoam(vec2 p){
  float advected=p.y-uTime*uDetailSpeed;
  float curl=sin(p.x*37.0+sin(advected*19.0)*1.5)*sin(advected*32.0-p.x*13.0);
  return smoothstep(-.45,.6,curl);
}
float obstacleWake(vec2 point){
  float foam=0.0;
  for(int i=0;i<5;i++){
    vec2 stone=uStonePositions[i];
    vec2 forward=normalize(vec2(.73+.533*cos(stone.y*.82),1.0));
    vec2 relative=point-stone;
    float along=dot(relative,forward),across=dot(relative,vec2(forward.y,-forward.x));
    float tail=along-.13;
    float width=.10+max(tail,0.0)*.22;
    float curledEdge=.015*sin(tail*23.0-uTime*7.0+float(i)*1.9);
    float band=1.0-smoothstep(.018,.072,abs(abs(across)-width-curledEdge));
    float lengthMask=smoothstep(0.0,.14,tail)*(1.0-smoothstep(.7,1.3,tail));
    float strands=band*lengthMask*(.30+.70*churningFoam(vec2(across,along+float(i))));
    // A small bow wave precedes each stone; the long V remains downstream.
    float bow=(1.0-smoothstep(.025,.075,abs(length(vec2(across/.19,along/.25))-1.0)*.2))
      *(1.0-smoothstep(-.02,.08,along))*.22;
    foam=max(foam,strands+bow);
  }
  return clamp(foam,0.0,1.0);
}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
vec2 simUv=vec2(vCurrentUv.x,(vCurrentUv.y+4.8)/(uWaterEnd+4.8));
float dynamicFoam=texture2D(uRippleSimTex,simUv).b*uRippleStrength;
float edgeDistance=min(vCurrentUv.x,1.0-vCurrentUv.x);
float bankFoam=(1.0-smoothstep(.008,.065,edgeDistance))
  *churningFoam(vChannelPosition)*.20;
float wakeFoam=obstacleWake(vChannelPosition)*uWakeStrength;
float crestFoam=smoothstep(uWaterEnd-.40,uWaterEnd-.07,vCurrentUv.y)
  *(.55+.45*churningFoam(vChannelPosition))*uCrestStrength;
float foamAmount=clamp(max(max(wakeFoam,crestFoam),bankFoam)+dynamicFoam*.95,0.0,1.0);
float normalView=max(abs(dot(normalize(vNormal),normalize(vViewPosition))),.25);
float opticalDepth=vWaterDepth/normalView;
float absorption=1.0-exp(-opticalDepth*2.3);
float deepening=smoothstep(.025,.24,vWaterDepth);
float hue=.5+.5*sin(vCurrentUv.y*.7+vCurrentUv.x*2.0);
diffuseColor.rgb=mix(mix(uShallowBlue,uShallowGreen,hue),mix(uDeepBlue,uDeepGreen,hue),deepening);
diffuseColor.rgb=mix(diffuseColor.rgb,uFoamColor,foamAmount*.86);
float fresnel=.0204+.9796*pow(1.0-normalView,5.0);
float clearAlpha=clamp(.055+absorption*.48+fresnel*.18,.055,.62);
diffuseColor.a=mix(clearAlpha,.88,foamAmount)*smoothstep(0.0,.024,vWaterDepth);`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
float rippleHeight=currentHeight(vec2(vCurrentUv.x*1.1,vCurrentUv.y));
rippleHeight+=texture2D(uRippleSimTex,simUv).r*.045*uRippleStrength;
vec3 currentDx=dFdx(-vViewPosition),currentDy=dFdy(-vViewPosition);
vec3 currentR1=cross(currentDy,normal),currentR2=cross(normal,currentDx);
float currentDet=dot(currentDx,currentR1);
vec3 currentGradient=sign(currentDet)*(dFdx(rippleHeight)*currentR1+dFdy(rippleHeight)*currentR2);
normal=normalize(max(abs(currentDet),.0000001)*normal-currentGradient);`)
      .replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
#ifdef USE_CLEARCOAT
clearcoatNormal=normal;
#endif`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=mix(roughnessFactor,.55,foamAmount);`)
      .replace('#include <opaque_fragment>',`
// Sharp sunlight reflections ride the perturbed wave crests in world space.
vec3 sunView=normalize((viewMatrix*vec4(uSunDirection,0.0)).xyz);
vec3 halfSun=normalize(sunView+normalize(vViewPosition));
float crestLight=.35+.65*smoothstep(-.3,.8,rippleHeight/max(uWaveAmplitude,.00001));
float glint=pow(max(0.0,dot(normal,halfSun)),64.0)*1.8*crestLight;
outgoingLight+=uGlintColor*glint*uGlintStrength*(1.0-foamAmount);
outgoingLight=mix(outgoingLight,uFoamColor*(.90+.12*churningFoam(vChannelPosition)),foamAmount*.72);
#include <opaque_fragment>`);
  };
  return water;
}

export const WATERFALL_DYNAMICS=Object.freeze({speed:6.1,gravity:.65,exponent:1.4,drop:3.95,mistCount:40,mistOpacity:.44});

// A physical launch arc: forward velocity persists while gravity turns the
// water downward. Depth is normalized physical height, shared with the shader.
export function waterfallProfile(depth){
  const d=THREE.MathUtils.clamp(depth,0,1)*WATERFALL_DYNAMICS.drop;
  const flightTime=(Math.sqrt(.35*.35+2*9.81*d)-.35)/9.81;
  return {drop:d,outward:.85*flightTime};
}
export function waterfallTravel(depth){
  const y=THREE.MathUtils.clamp(depth,0,1),step=y/4;
  let sum=0;
  for(let i=0;i<=4;i++)sum+=(i===0||i===4?1:i%2?4:2)/(1+.65*Math.pow(step*i,1.4));
  return sum*step/3;
}
export function makeWaterfall(parent,time,{textureFactory=mistTexture}={}){
  const endX=creekX(WATER_END),endY=waterY(WATER_END),initialWidth=creekWidth(WATER_END)*2,curtains=[];
  for(let layer=0;layer<2;layer++){
    const positions=[],uvs=[],indices=[],rows=96,columns=20;
    for(let j=0;j<=rows;j++){
      const t=j/rows,arc=waterfallProfile(t),width=initialWidth*(1-t*.22)*(layer?.80:1);
      for(let i=0;i<=columns;i++){
        const u=i/columns;
        positions.push(endX+(u-.5)*width+.018*Math.sin(t*9),
          endY-arc.drop,WATER_END-.018+arc.outward+(layer?0:.035*t)+.035*Math.sin(u*Math.PI)*t);
        uvs.push(u,t);
      }
    }
    for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
      const a=j*(columns+1)+i,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);
    }
    const mat=new THREE.MeshPhysicalMaterial({
      color:'#ffffff',roughness:layer?.19:.32,metalness:0,ior:1.333,
      clearcoat:layer?.55:.35,clearcoatRoughness:.17,transparent:true,opacity:layer?.52:.78,
      side:THREE.DoubleSide,depthWrite:false,envMapIntensity:1.45,forceSinglePass:true
    });
    const uniforms={uTime:time,uFallSpeed:{value:WATERFALL_DYNAMICS.speed},uFallLayer:{value:layer},
      uFallBlue:{value:new THREE.Color('#0284c7')},uFallGreen:{value:new THREE.Color('#059669')}};
    mat.userData.fallUniforms=uniforms;mat.customProgramCacheKey=()=> 'gravity-torn-cascade-v2';
    mat.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader
        .replace('#include <common>','#include <common>\nuniform float uTime,uFallSpeed;\nvarying vec2 vFallUv;')
        .replace('#include <begin_vertex>',`#include <begin_vertex>
vFallUv=uv;
float lower=smoothstep(.18,.75,uv.y);
transformed.x+=sin(uv.y*17.0-uTime*uFallSpeed+uv.x*9.0)*.025*lower;
transformed.z+=sin(uv.y*24.0-uTime*uFallSpeed*1.15+uv.x*15.0)*.018*lower;`);
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <common>',`#include <common>
uniform float uTime,uFallSpeed,uFallLayer;
uniform vec3 uFallBlue,uFallGreen;
varying vec2 vFallUv;
float fallHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float fallNoise(vec2 p){
  vec2 cell=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(fallHash(cell),fallHash(cell+vec2(1,0)),f.x),
    mix(fallHash(cell+vec2(0,1)),fallHash(cell+vec2(1,1)),f.x),f.y);
}
float fallTravel(float depth){
  // Integrate inverse velocity. Unlike multiplying time by height, this cannot
  // reverse the flow or stretch the texture indefinitely during a long visit.
  float stepSize=depth/4.0,sum=0.0;
  for(int i=0;i<=4;i++){
    float weight=(i==0||i==4)?1.0:((i==1||i==3)?4.0:2.0);
    sum+=weight/(1.0+.65*pow(stepSize*float(i),1.4));
  }
  return sum*stepSize/3.0;
}`)
        .replace('#include <color_fragment>',`#include <color_fragment>
float fallingPhase=fallTravel(vFallUv.y)*22.0-uTime*uFallSpeed;
float tearing=smoothstep(.20,.68,vFallUv.y);
float ribbonNoise=fallNoise(vec2(vFallUv.x*18.0+sin(fallingPhase*.40+vFallUv.x*11.0)*.8,
  fallingPhase*.22+uFallLayer*3.1));
float filaments=smoothstep(.31,.64,ribbonNoise);
float foam=tearing*(.45+.55*filaments);
vec3 core=mix(uFallBlue,uFallGreen,.5+.5*sin(vFallUv.x*6.0+fallingPhase*.10));
diffuseColor.rgb=uFallLayer>.5?mix(core,vec3(.91,.97,1.0),foam*.42)
  :mix(core,vec3(1.0),.18+foam*.82);`)
        .replace('#include <alphatest_fragment>',`
float ragged=.025+tearing*(.025+.035*fallNoise(vec2(fallingPhase*.3,vFallUv.x*9.0)));
float edge=smoothstep(0.0,ragged,vFallUv.x)*(1.0-smoothstep(1.0-ragged,1.0,vFallUv.x));
float threadCoverage=mix(1.0,filaments,tearing);
float filteredCoverage=mix(threadCoverage,mix(1.0,.35,tearing),smoothstep(.3,1.3,fwidth(vFallUv.x)*18.0));
diffuseColor.a*=edge*(1.0-smoothstep(.88,1.0,vFallUv.y))*filteredCoverage;
#include <alphatest_fragment>`)
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
float fallHeight=.014*sin(vFallUv.x*43.0+sin(fallingPhase*.55+vFallUv.x*7.0)*2.0)
  +.009*(fallNoise(vec2(vFallUv.x*35.0,fallingPhase*.65))-.5);
vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
vec3 r1=cross(dy,normal),r2=cross(normal,dx);float det=dot(dx,r1);
normal=normalize(max(abs(det),.0000001)*normal-sign(det)*(dFdx(fallHeight)*r1+dFdy(fallHeight)*r2));`)
        .replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
#ifdef USE_CLEARCOAT
clearcoatNormal=normal;
#endif`);
    };
    const curtain=mesh(parent,geometry(positions,uvs,indices),mat);
    curtain.name=layer?'waterfall-inner-curtain':'waterfall-outer-curtain';
    curtain.castShadow=curtain.receiveShadow=false;curtain.renderOrder=layer?3:4;curtains.push(curtain);
    curtain.geometry.computeBoundingSphere();curtain.geometry.boundingSphere.radius+=.05;
  }
  const random=rng(905),positions=[],seeds=[];
  for(let i=0;i<WATERFALL_DYNAMICS.mistCount;i++){
    positions.push(endX+.2+(random()-.5)*1.2,-3.48+random()*1.1,WATER_END+.4+random()*.5);
    seeds.push(random());
  }
  const mistGeometry=new THREE.BufferGeometry();
  mistGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  mistGeometry.setAttribute('aMistSeed',new THREE.Float32BufferAttribute(seeds,1));
  const mistMaterial=new THREE.PointsMaterial({color:'#f3faff',map:textureFactory(),size:.88,sizeAttenuation:true,
    transparent:true,opacity:WATERFALL_DYNAMICS.mistOpacity,depthWrite:false});
  mistMaterial.userData.mistUniforms={uTime:time};
  mistMaterial.customProgramCacheKey=()=> 'billowing-waterfall-mist-v2';
  mistMaterial.onBeforeCompile=shader=>{
    shader.uniforms.uTime=time;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nuniform float uTime;\nattribute float aMistSeed;\nvarying float vMistFade,vMistRotation;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
float life=fract(uTime*(.10+aMistSeed*.035)+aMistSeed);
vMistFade=smoothstep(0.0,.16,life)*(1.0-smoothstep(.68,1.0,life));
vMistRotation=uTime*(.12+aMistSeed*.16)+aMistSeed*6.28318;
transformed.x+=life*(.30+aMistSeed*.35)+sin(vMistRotation*1.5)*.10;
transformed.y+=life*.5+sin(vMistRotation*1.2)*.05;
transformed.z+=life*.30+cos(vMistRotation)*.10;`)
      .replace('gl_PointSize = size;','gl_PointSize = size*(.65+life*.85)*(.8+aMistSeed*.5);');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying float vMistFade,vMistRotation;')
      .replace('#include <map_particle_fragment>',`
vec2 centered=gl_PointCoord-vec2(.5);
float c=cos(vMistRotation),s=sin(vMistRotation);
vec2 puffUv=mat2(c,-s,s,c)*centered+vec2(.5);
float insidePuff=step(0.0,puffUv.x)*step(puffUv.x,1.0)*step(0.0,puffUv.y)*step(puffUv.y,1.0);
diffuseColor*=texture2D(map,clamp(puffUv,0.0,1.0));
diffuseColor.a*=vMistFade*insidePuff;`);
  };
  const mist=new THREE.Points(mistGeometry,mistMaterial);mist.name='waterfall-soft-mist';mist.renderOrder=5;mist.frustumCulled=false;
  mist.userData.count=WATERFALL_DYNAMICS.mistCount;parent.add(mist);
  let disposed=false;
  return {curtains,mist,dispose(){if(disposed)return;disposed=true;
    for(const c of curtains){c.removeFromParent();c.geometry.dispose();c.material.dispose();}
    mist.removeFromParent();mistGeometry.dispose();mistMaterial.map.dispose();mistMaterial.dispose();
  }};
}

function mistTexture(){
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(128,128):document.createElement('canvas');
  canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Unable to paint waterfall mist');
  for(const [x,y,r,alpha] of [[64,65,52,.65],[42,51,31,.35],[82,45,32,.38],[89,78,30,.3],[43,85,30,.3],[64,34,25,.22]]){
    const gradient=ctx.createRadialGradient(x,y,0,x,y,r);
    gradient.addColorStop(0,'rgba(255,255,255,'+alpha+')');gradient.addColorStop(.5,'rgba(255,255,255,'+alpha*.46+')');gradient.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.name='billowing-spray-cloud';texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

function geometry(positions, uvs, indices) {
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  result.setIndex(indices);
  result.computeVertexNormals();
  return result;
}
