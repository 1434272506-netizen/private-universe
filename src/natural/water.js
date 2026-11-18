import * as THREE from 'three';
import {mesh, rng, fbm} from './shared.js';
import {material} from './materials.js';
import {creekX, creekSlope, waterY, creekWidth, WATER_START, WATER_END, ground, inside} from './land.js';

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
  const ice=iceUniforms();
  const start = WATER_START;
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
  const surface = mesh(parent, creekGeometry, currentMaterial(time,ice));
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

  makeWaterfall(parent,time,{ice});
  return {pebbles: count, steppingStones: 5};
}

export const WATER_DYNAMICS=Object.freeze({mainSpeed:.78,detailSpeed:1.35,amplitude:.022});
export const STEPPING_STONES=Object.freeze(Array.from({length:5},(_,i)=>Object.freeze({
  x:creekX(-.25)+(i-2)*.31,z:-.25-(i-2)*.085,rotation:i*.83
})));

function iceUniforms(){
  return {uFreeze:{value:0},uIceSnow:{value:0},uFlowAnchor:{value:new THREE.Vector2()},uGlacier:{value:new THREE.Color('#b9e6fe')}};
}
const ICE_DECL='uniform float uFreeze,uIceSnow;uniform vec2 uFlowAnchor;uniform vec3 uGlacier;';
// The anchor preserves phase when velocity changes, including a complete stop.
const FLOW_CLOCK=`float flowPhase(float speed,float base){return (uTime-uFlowAnchor.x)*speed+uFlowAnchor.y*base;}
float liquidTime(){return flowPhase(1.0-uFreeze,1.0);}`;
const ICE_CRACKS=`float iceFracture(vec2 xy){
  vec2 p=xy*vec2(2.7,1.8);p+=.085*sin(p.yx*2.9);
  vec2 cell=floor(p),f=fract(p);float first=5.0,second=5.0;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    vec2 g=vec2(float(i),float(j)),id=cell+g;
    vec2 seed=fract(sin(vec2(dot(id,vec2(13.7,73.1)),dot(id,vec2(47.3,29.9))))*4375.17);
    vec2 d=g+.18+.64*seed-f;float r=dot(d,d);
    second=min(second,max(first,r));first=min(first,r);
  }
  float seam=sqrt(second)-sqrt(first),aa=max(fwidth(seam),.008);
  return (1.0-smoothstep(.008,.008+aa,seam))*.018/(.018+aa);
}`;

export function currentMaterial(time,ice=iceUniforms()) {
  const water = new THREE.MeshPhysicalMaterial({
    color:'#ffffff',metalness:0,roughness:.14,ior:1.333,
    transparent:true,opacity:1,envMapIntensity:1.15,
    clearcoat:.38,clearcoatRoughness:.14,
    side:THREE.DoubleSide,depthWrite:false,
  });
  const uniforms={...ice,
    uRippleSimTex:{value:null},uRippleStrength:{value:0},
    uTime:time,uMainSpeed:{value:WATER_DYNAMICS.mainSpeed},uDetailSpeed:{value:WATER_DYNAMICS.detailSpeed},
    uWaveAmplitude:{value:WATER_DYNAMICS.amplitude},uWaterEnd:{value:WATER_END},uWaterStart:{value:WATER_START},
    uStonePositions:{value:STEPPING_STONES.map(p=>new THREE.Vector2(p.x,p.z))},
    uStoneSlopes:{value:STEPPING_STONES.map(p=>creekSlope(p.z))},
    uGlintColor:{value:new THREE.Color(1,.96,.83)},uFoamColor:{value:new THREE.Color('#f8fafc')},
    uSunDirection:{value:new THREE.Vector3(-11,10.5,7.5).normalize()},
    uWakeStrength:{value:1},uCrestStrength:{value:1},uGlintStrength:{value:1}
  };
  water.userData.currentUniforms=uniforms;
  water.customProgramCacheKey=()=> 'crystalline-creek-seasonal-v3';
  water.onBeforeCompile = shader => {
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute float waterDepth;varying float vWaterDepth;varying vec2 vCurrentUv;varying vec2 vChannelPosition;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvCurrentUv=uv;vWaterDepth=waterDepth;vChannelPosition=position.xz;transformed.y+=.034*uFreeze;');
    shader.vertexShader=ICE_DECL+'\n'+shader.vertexShader;
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
uniform sampler2D uRippleSimTex;
uniform float uRippleStrength;
uniform float uTime,uMainSpeed,uDetailSpeed,uWaveAmplitude,uWaterEnd,uWaterStart;
${ICE_DECL}
${FLOW_CLOCK}
${ICE_CRACKS}
uniform float uWakeStrength,uCrestStrength,uGlintStrength;
uniform vec2 uStonePositions[5];
uniform float uStoneSlopes[5];
uniform vec3 uGlintColor,uFoamColor,uSunDirection;
varying vec2 vCurrentUv,vChannelPosition;
varying float vWaterDepth;
float currentHeight(vec2 p){
  float mainFlow=p.y-flowPhase(uMainSpeed,${WATER_DYNAMICS.mainSpeed});
  float fastFlow=p.y-flowPhase(uDetailSpeed,${WATER_DYNAMICS.detailSpeed});
  return uWaveAmplitude*(sin(mainFlow*15.0+sin(p.x*8.0+mainFlow*2.0))
    +.35*sin(fastFlow*31.0-p.x*15.0)
    +.18*sin(p.x*22.0+fastFlow*7.0));
}
float churningFoam(vec2 p){
  float advected=p.y-flowPhase(uDetailSpeed,${WATER_DYNAMICS.detailSpeed});
  float curl=sin(p.x*37.0+sin(advected*19.0)*1.5)*sin(advected*32.0-p.x*13.0);
  return smoothstep(-.45,.6,curl);
}
float obstacleWake(vec2 point){
  float foam=0.0;
  for(int i=0;i<5;i++){
    vec2 stone=uStonePositions[i];
    vec2 forward=normalize(vec2(uStoneSlopes[i],1.0));
    vec2 relative=point-stone;
    float along=dot(relative,forward),across=dot(relative,vec2(forward.y,-forward.x));
    float tail=along-.13;
    float width=.10+max(tail,0.0)*.22;
    float curledEdge=.015*sin(tail*23.0-liquidTime()*7.0+float(i)*1.9);
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
vec2 simUv=vec2(vCurrentUv.x,(vCurrentUv.y-uWaterStart)/(uWaterEnd-uWaterStart));
float dynamicFoam=texture2D(uRippleSimTex,simUv).b*uRippleStrength;
float edgeDistance=min(vCurrentUv.x,1.0-vCurrentUv.x);
float bankFoam=(1.0-smoothstep(.012,.085,vWaterDepth))
  *smoothstep(.002,.025,edgeDistance)*churningFoam(vChannelPosition)*.14;
float wakeFoam=obstacleWake(vChannelPosition)*uWakeStrength;
float crestFoam=smoothstep(uWaterEnd-.40,uWaterEnd-.07,vCurrentUv.y)
  *(.55+.45*churningFoam(vChannelPosition))*uCrestStrength;
float foamAmount=clamp(max(max(wakeFoam,crestFoam),bankFoam)+dynamicFoam*.95,0.0,1.0)*(1.0-uFreeze);
float normalView=clamp(abs(dot(normalize(vNormal),normalize(vViewPosition))),0.0,1.0);
float absorption = 1.0 - exp(-vWaterDepth * 4.2);
diffuseColor.rgb=mix(vec3(0.18,0.58,0.65),vec3(0.012,0.38,0.62),absorption);
diffuseColor.rgb=mix(diffuseColor.rgb,uFoamColor,foamAmount*.86);
float fresnel=.0204+.9796*pow(1.0-normalView,5.0);
float clearAlpha=mix(.66*absorption,1.0,fresnel);
diffuseColor.a=mix(clearAlpha,.88,foamAmount)*smoothstep(0.0,.024,vWaterDepth);
float frostRim=0.0,fissure=0.0,iceHere=0.0;
if(uFreeze>0.0){
  float silt=.5+.5*sin(dot(vChannelPosition,vec2(3.7,2.1))+sin(vChannelPosition.y*7.3));
  frostRim=1.0-smoothstep(.025,.12+.13*uIceSnow,edgeDistance+.03*(silt-.5));
  iceHere=clamp(uFreeze+.80*uFreeze*(1.0-uFreeze)*(frostRim-.25),0.0,1.0);
  fissure=iceFracture(vChannelPosition);
  vec3 iceColor=uGlacier*mix(vec3(.62,.81,.96),vec3(.92,1.0,1.02),silt);
  iceColor=mix(iceColor,uFoamColor,.66*fissure+(.29+.53*uIceSnow)*frostRim*(1.0-.66*fissure));
  diffuseColor.rgb=mix(diffuseColor.rgb,iceColor,iceHere);
  float iceAlpha=.63+.15*fresnel+.20*frostRim+.13*fissure;
  diffuseColor.a=mix(diffuseColor.a,min(.98,iceAlpha)*smoothstep(-.006,.012,vWaterDepth),iceHere);
}`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
float rippleHeight=currentHeight(vec2(vCurrentUv.x*1.1,vCurrentUv.y));
rippleHeight+=texture2D(uRippleSimTex,simUv).r*.045*uRippleStrength*(1.0-uFreeze);
rippleHeight+=iceHere*(.0016*fissure+.0018*frostRim);
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
roughnessFactor=mix(mix(roughnessFactor,.55,foamAmount),.12+.55*frostRim+.16*fissure,iceHere);`)
      .replace('#include <opaque_fragment>',`
// Sharp sunlight reflections ride the perturbed wave crests in world space.
vec3 sunView=normalize((viewMatrix*vec4(uSunDirection,0.0)).xyz);
vec3 halfSun=normalize(sunView+normalize(vViewPosition));
float crestLight=.35+.65*smoothstep(-.3,.8,rippleHeight/max(uWaveAmplitude,.00001));
float glint=pow(max(0.0,dot(normal,halfSun)),64.0)*1.8*crestLight;
outgoingLight+=uGlintColor*glint*uGlintStrength*(1.0-foamAmount)*(1.0-iceHere);
outgoingLight=mix(outgoingLight,uFoamColor*(.90+.12*churningFoam(vChannelPosition)),foamAmount*.72);
#include <opaque_fragment>`);
  };
  return water;
}

export const WATERFALL_DYNAMICS=Object.freeze({speed:6.1,gravity:.65,exponent:1.4,drop:3.95,mistCount:40,mistOpacity:.44});

function hangingIcicles(fall,freeze){
  const geo=new THREE.ConeGeometry(1,1,6).rotateZ(Math.PI).translate(0,-.5,0);
  const mat=new THREE.MeshPhysicalMaterial({color:'#c5eaff',roughness:.16,ior:1.31,clearcoat:.82,
    clearcoatRoughness:.12,transparent:true,opacity:.86,depthWrite:false,flatShading:true});
  mat.onBeforeCompile=shader=>{
    shader.uniforms.uFreeze=freeze;
    shader.vertexShader='uniform float uFreeze;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed*=vec3(sqrt(uFreeze),uFreeze,sqrt(uFreeze));');
  };
  const pins=new THREE.InstancedMesh(geo,mat,19),pose=new THREE.Object3D(),rand=rng(1704);
  const x=creekX(WATER_END),y=waterY(WATER_END),width=2*creekWidth(WATER_END);
  for(let i=0;i<pins.count;i++){
    const u=(i+rand()*.7)/pins.count,d=.64+.12*rand(),arc=waterfallProfile(d);
    pose.position.set(x+(u-.5)*width*(1-.22*d),y-arc.drop+.08,WATER_END+arc.outward+.07);
    pose.rotation.set(rand()*.05,rand()*Math.PI,(rand()-.5)*.085);
    const r=.022+.032*rand();pose.scale.set(r,.36+rand()*.95,r*(.77+.35*rand()));
    pose.updateMatrix();pins.setMatrixAt(i,pose.matrix);
  }
  pins.name='winter-cascade-icicles';pins.visible=false;pins.renderOrder=4.5;fall.add(pins);
  return pins;
}

export function bindWaterSeasons(scene){
  const u=scene.getObjectByName('creek-surface')?.material?.userData.currentUniforms;
  if(!u?.uFreeze)return;
  const outer=scene.getObjectByName('waterfall-outer-curtain'),inner=scene.getObjectByName('waterfall-inner-curtain');
  const pins=outer&&hangingIcicles(outer,u.uFreeze);
  const rates=[u.uMainSpeed,u.uDetailSpeed,u.uWaveAmplitude,outer?.material.userData.fallUniforms?.uFallSpeed,
    inner?.material.userData.fallUniforms?.uFallSpeed].filter(Boolean).map(ref=>[ref,ref.value]);
  const anchor=u.uFlowAnchor.value,savedAnchor=anchor.clone(),savedIce=u.uFreeze.value,savedSnow=u.uIceSnow.value;
  const bow=scene.getObjectByName('waterfall-spray-rainbow'),original=bow?.material;
  let bowMaterial,disposed=false;
  if(original?.isShaderMaterial){
    bowMaterial=original.clone();
    bowMaterial.uniforms={...original.uniforms,uCascadeIce:u.uFreeze};
    bowMaterial.fragmentShader='uniform float uCascadeIce;\n'+original.fragmentShader.replace(/}\s*$/,
      'gl_FragColor.a*=1.0-uCascadeIce;\n}');
    bow.material=bowMaterial;
  }
  return {
    update(winter,snow=0){
      if(disposed)return;
      u.uIceSnow.value=THREE.MathUtils.clamp(snow,0,1);
      const f=THREE.MathUtils.clamp(winter,0,1);
      if(f===u.uFreeze.value)return;
      const now=u.uTime.value;
      anchor.y+=(now-anchor.x)*(1-u.uFreeze.value);anchor.x=now;
      u.uFreeze.value=f;
      for(const [rate,base] of rates)rate.value=base*(1-f);
      if(pins)pins.visible=f>.001;
    },
    dispose(){
      if(disposed)return;disposed=true;
      anchor.copy(savedAnchor);u.uFreeze.value=savedIce;u.uIceSnow.value=savedSnow;
      for(const [rate,base] of rates)rate.value=base;
      if(pins){pins.removeFromParent();pins.dispose();pins.geometry.dispose();pins.material.dispose();}
      if(bowMaterial){if(bow.material===bowMaterial)bow.material=original;bowMaterial.dispose();}
    }
  };
}

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
export function makeWaterfall(parent,time,{textureFactory=mistTexture,ice=iceUniforms()}={}){
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
    const uniforms={...ice,uTime:time,uFallSpeed:{value:WATERFALL_DYNAMICS.speed},uFallLayer:{value:layer},
      uFallBlue:{value:new THREE.Color('#0284c7')},uFallGreen:{value:new THREE.Color('#059669')}};
    mat.userData.fallUniforms=uniforms;mat.customProgramCacheKey=()=> 'gravity-ice-cascade-v3';
    mat.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader
        .replace('#include <common>',`#include <common>
uniform float uTime,uFallSpeed;varying vec2 vFallUv;
${ICE_DECL}
${FLOW_CLOCK}`)
        .replace('#include <begin_vertex>',`#include <begin_vertex>
vFallUv=uv;
float lower=smoothstep(.18,.75,uv.y);
float phase=flowPhase(uFallSpeed,${WATERFALL_DYNAMICS.speed}),liquid=1.0-uFreeze;
transformed.x+=sin(uv.y*17.0-phase+uv.x*9.0)*.025*lower*liquid;
transformed.z+=sin(uv.y*24.0-phase*1.15+uv.x*15.0)*.018*lower*liquid;
float flute=.5+.5*cos(uv.x*51.0+1.2*sin(uv.x*14.0)+.65*uv.y);
transformed.y+=.034*uFreeze*(1.0-smoothstep(0.0,.14,uv.y));
transformed.z+=uFreeze*(.025+.075*flute)*smoothstep(0.0,.2,uv.y);
transformed.y+=uFreeze*(.24+.55*(1.0-flute))*smoothstep(.63,1.0,uv.y);`);
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <common>',`#include <common>
uniform float uTime,uFallSpeed,uFallLayer;
${ICE_DECL}
${FLOW_CLOCK}
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
float fallingPhase=fallTravel(vFallUv.y)*22.0-flowPhase(uFallSpeed,${WATERFALL_DYNAMICS.speed});
float tearing=smoothstep(.20,.68,vFallUv.y);
float ribbonNoise=fallNoise(vec2(vFallUv.x*18.0+sin(fallingPhase*.40+vFallUv.x*11.0)*.8,
  fallingPhase*.22+uFallLayer*3.1));
float filaments=smoothstep(.31,.64,ribbonNoise);
float foam=tearing*(.45+.55*filaments);
vec3 core=mix(uFallBlue,uFallGreen,.5+.5*sin(vFallUv.x*6.0+fallingPhase*.10));
diffuseColor.rgb=uFallLayer>.5?mix(core,vec3(.91,.97,1.0),foam*.42)
  :mix(core,vec3(1.0),.18+foam*.82);
float ribs=.5+.5*cos(vFallUv.x*51.0+1.2*sin(vFallUv.x*14.0)+.65*vFallUv.y);
float iceTip=.72+.27*ribs;
float shoulder=(1.0-smoothstep(.01,.23,vFallUv.y))*(.4+.44*uIceSnow);
vec3 hangingIce=mix(uGlacier*vec3(.54,.79,.99),uGlacier,ribs);
diffuseColor.rgb=mix(diffuseColor.rgb,mix(hangingIce,vec3(.94,.97,1.0),shoulder),uFreeze);`)
        .replace('#include <alphatest_fragment>',`
float ragged=.025+tearing*(.025+.035*fallNoise(vec2(fallingPhase*.3,vFallUv.x*9.0)));
float edge=smoothstep(0.0,ragged,vFallUv.x)*(1.0-smoothstep(1.0-ragged,1.0,vFallUv.x));
float threadCoverage=mix(1.0,filaments,tearing);
float filteredCoverage=mix(threadCoverage,mix(1.0,.35,tearing),smoothstep(.3,1.3,fwidth(vFallUv.x)*18.0));
float flowingAlpha=diffuseColor.a*edge*(1.0-smoothstep(.88,1.0,vFallUv.y))*filteredCoverage;
float frozenAlpha=edge*(1.0-smoothstep(iceTip-.018,iceTip,vFallUv.y))*(.70+.17*ribs+.1*shoulder);
diffuseColor.a=mix(flowingAlpha,frozenAlpha,uFreeze);
#include <alphatest_fragment>`)
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
float fallHeight=.014*sin(vFallUv.x*43.0+sin(fallingPhase*.55+vFallUv.x*7.0)*2.0)
  +.009*(fallNoise(vec2(vFallUv.x*35.0,fallingPhase*.65))-.5);
fallHeight=mix(fallHeight,.027*ribs+.004*sin(vFallUv.x*89.0+.7*vFallUv.y),uFreeze);
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
    curtain.geometry.computeBoundingSphere();curtain.geometry.boundingSphere.radius+=.12;
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
  mistMaterial.userData.mistUniforms={...ice,uTime:time};
  mistMaterial.customProgramCacheKey=()=> 'billowing-waterfall-mist-v2';
  mistMaterial.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,mistMaterial.userData.mistUniforms);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>',`#include <common>
uniform float uTime;attribute float aMistSeed;varying float vMistFade,vMistRotation;
${ICE_DECL}
${FLOW_CLOCK}`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
float t=liquidTime(),life=fract(t*(.10+aMistSeed*.035)+aMistSeed);
vMistFade=smoothstep(0.0,.16,life)*(1.0-smoothstep(.68,1.0,life))*(1.0-uFreeze);
vMistRotation=t*(.12+aMistSeed*.16)+aMistSeed*6.28318;
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
