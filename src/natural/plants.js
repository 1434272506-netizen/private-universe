import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,fbm} from './shared.js';
import {ground,inside,creekX,creekWidth,RX,RZ} from './land.js';
import {makeBanyan} from './banyan.js';

// A little less lawn, a little more meadow: plants share patches of habitat,
// while the places people would sit, cross and walk remain softly open.
export function makePlants(parent,time){
  const random=rng(9284),dummy=new THREE.Object3D(),color=new THREE.Color();
  const tree=makeBanyan(parent,time);
  const blade=new THREE.BufferGeometry();
  blade.setAttribute('position',new THREE.Float32BufferAttribute([
    -.014,0,0,.014,0,0,-.011,.055,.009,.011,.055,.009,
    -.006,.115,.039,.006,.115,.039,.013,.17,.088
  ],3));
  blade.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,.3,1,.3,0,.65,1,.65,.5,1],2));
  blade.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6]);
  blade.computeVertexNormals();
  const grassMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,side:THREE.DoubleSide});
  grassMat.onBeforeCompile=shader=>{
    addWind(shader,time,.024);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vBladeHeight;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvBladeHeight=uv.y;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vBladeHeight;')
      .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(vec3(.61,.71,.53),vec3(1.0,1.01,.90),vBladeHeight);');
  };
  const grass=new THREE.InstancedMesh(blade,grassMat,59000);
  const shadeGrass=new THREE.Color('#3c603c'),meadowGrass=new THREE.Color('#6e8952'),dryGrass=new THREE.Color('#8b945f');
  let gi=0;
  for(let attempt=0;attempt<137000&&gi<grass.count;attempt++){
    const x=(random()-.5)*RX*2.2,z=(random()-.5)*RZ*2.2;
    if(!inside(x,z,.996)||Math.abs(x-creekX(z))<creekWidth(z)+.20)continue;
    const patch=fbm(x*.57+9,z*.57),smallPatch=fbm(x*2.15+5,z*2.15-3),path=walkway(x,z),root=Math.hypot(x+4.1,z+.6);
    const seat=Math.hypot(x-4.2,(z-1.5)*1.2);
    if(root<.56||seat<.63)continue;
    const openPath=THREE.MathUtils.smoothstep(path,.10,.65),rootMeadow=THREE.MathUtils.smoothstep(root,.65,2.05);
    let density=(.26+THREE.MathUtils.smoothstep(patch,.28,.70)*.64)*(.56+smallPatch*.54);
    density*=THREE.MathUtils.lerp(.42,1,openPath)*THREE.MathUtils.lerp(.48,1,rootMeadow);
    if(random()>density)continue;
    const edge=THREE.MathUtils.smoothstep(Math.abs(x-creekX(z)),creekWidth(z)+.2,creekWidth(z)+.8);
    const tuft=THREE.MathUtils.smoothstep(smallPatch,.40,.72);
    let height=(.20+Math.pow(random(),.8)*.70)*(.58+tuft*.60);
    height*=THREE.MathUtils.lerp(.37,1,openPath)*THREE.MathUtils.lerp(.58,1,rootMeadow);
    dummy.position.set(x,ground(x,z)-.013,z);
    dummy.rotation.set((random()-.5)*.25,random()*Math.PI*2,(random()-.5)*.27);
    dummy.scale.set(.58+random()*.68,height,height);
    dummy.updateMatrix();grass.setMatrixAt(gi,dummy.matrix);
    color.copy(shadeGrass).lerp(meadowGrass,.28+patch*.55+random()*.15);
    color.multiplyScalar(.86+random()*.25);
    if(random()>.94)color.lerp(dryGrass,.24);
    if(edge<.5)color.lerp(shadeGrass,.15);
    grass.setColorAt(gi++,color);
  }
  grass.count=gi;grass.receiveShadow=true;grass.name='patches-of-meadow-grass';parent.add(grass);

  const petalParts=[];
  for(let i=0;i<9;i++){
    const petal=new THREE.BufferGeometry();
    petal.setAttribute('position',new THREE.Float32BufferAttribute([
      0,.225,.012,-.009,.234,.024,-.012,.236,.043,-.007,.227,.059,
      0,.223,.065,.007,.227,.059,.012,.236,.043,.009,.234,.024,0,.241,.039
    ],3));
    petal.setAttribute('uv',new THREE.Float32BufferAttribute([.5,0,.1,.2,0,.5,.15,.85,.5,1,.85,.85,1,.5,.9,.2,.5,.5],2));
    const ids=[];for(let k=0;k<8;k++)ids.push(8,k,(k+1)%8);
    petal.setIndex(ids);petal.computeVertexNormals();petal.rotateY(i/9*Math.PI*2);petalParts.push(petal);
  }
  const petals=mergeGeometries(petalParts);petalParts.forEach(g=>g.dispose());
  const centers=new THREE.SphereGeometry(.014,8,5);centers.scale(1,.38,1);centers.translate(0,.238,0);
  const stems=new THREE.CylinderGeometry(.002,.003,.225,4);stems.translate(0,.1125,0);
  const flowerMats=[
    new THREE.MeshStandardMaterial({color:'#faf9f0',roughness:.88,side:THREE.DoubleSide}),
    new THREE.MeshStandardMaterial({color:'#c6ae5c',roughness:.92}),
    new THREE.MeshStandardMaterial({color:'#638044',roughness:1})
  ];
  flowerMats.forEach(mat=>mat.onBeforeCompile=shader=>addWind(shader,time,.012));
  const flowers=[petals,centers,stems].map((g,i)=>new THREE.InstancedMesh(g,flowerMats[i],440));
  const flowerPatches=[[-5.8,2.25,1.60,.74],[-2.65,2.55,.98,.55],[6,-.9,1.35,.85],[6.6,2.55,1.0,.52],[-5.9,-2.2,.95,.62]];
  let fi=0;
  for(let attempt=0;attempt<2600&&fi<340;attempt++){
    const patch=flowerPatches[Math.floor(random()*flowerPatches.length)],a=random()*Math.PI*2,r=Math.pow(random(),.64);
    const edge=1+.18*Math.sin(a*3+patch[0])+.12*Math.cos(a*5+patch[1]);
    const tail=random()<.12?1.75:1;
    const x=patch[0]+Math.cos(a)*r*patch[2]*edge*tail,z=patch[1]+Math.sin(a)*r*patch[3]*edge;
    if(!inside(x,z,.94)||Math.abs(x-creekX(z))<creekWidth(z)+.42||walkway(x,z)<.42||Math.hypot(x+4.1,z+.6)<1.07)continue;
    if(random()> .12+fbm(x*2.5+12,z*2.5-7)*.95||random()<r*.15)continue;
    dummy.position.set(x,ground(x,z),z);
    dummy.rotation.set((random()-.5)*.34,random()*Math.PI*2,(random()-.5)*.34);
    dummy.scale.setScalar(.50+random()*.71);dummy.updateMatrix();
    flowers.forEach(m=>m.setMatrixAt(fi,dummy.matrix));fi++;
  }
  flowers.forEach((m,i)=>{m.count=fi;m.receiveShadow=true;m.name=['daisy-petals','daisy-centers','daisy-stems'][i];parent.add(m);});

  // Pale, tapered flower spikes grow in small families, rather than isolated beads.
  const spikeParts=[];
  for(let i=0;i<10;i++){
    const g=new THREE.SphereGeometry(1,5,3),a=i*2.399,height=.22+i*.012;
    g.scale(.012*(1-i*.035),.019,.012*(1-i*.035));
    g.translate(Math.cos(a)*.013,height,Math.sin(a)*.013);spikeParts.push(g);
  }
  const spike=mergeGeometries(spikeParts);spikeParts.forEach(g=>g.dispose());
  const lavenderMat=new THREE.MeshStandardMaterial({color:'#a59abb',roughness:.95});
  lavenderMat.onBeforeCompile=shader=>addWind(shader,time,.018);
  const lavender=new THREE.InstancedMesh(spike,lavenderMat,250);
  const lavenderStem=new THREE.CylinderGeometry(.002,.003,.23,4);lavenderStem.translate(0,.115,0);
  const sprigs=new THREE.InstancedMesh(lavenderStem,new THREE.MeshStandardMaterial({color:'#607846',roughness:1}),250);
  const lavPatches=[[-7.3,.6,1.0,.75],[6.0,-2.2,.85,.7],[3.8,3.2,1.0,.55],[-1.7,-2.4,.65,.9]];
  let li=0;
  for(let attempt=0;attempt<700&&li<250;attempt++){
    const patch=lavPatches[Math.floor(random()*lavPatches.length)],a=random()*Math.PI*2,r=Math.sqrt(random());
    const rim=.83+.17*Math.sin(a*3+patch[0])+.14*Math.sin(a*5+patch[1]);
    const x=patch[0]+Math.cos(a)*r*patch[2]*rim,z=patch[1]+Math.sin(a)*r*patch[3]*rim;
    if(!inside(x,z,.93)||Math.abs(x-creekX(z))<creekWidth(z)+.37||walkway(x,z)<.42)continue;
    if(fbm(x*2.7+6,z*2.7+4)<.35)continue;
    dummy.position.set(x,ground(x,z),z);dummy.rotation.set((random()-.5)*.3,random()*Math.PI*2,(random()-.5)*.32);
    const s=.63+random()*.65;dummy.scale.setScalar(s);dummy.updateMatrix();
    lavender.setMatrixAt(li,dummy.matrix);sprigs.setMatrixAt(li,dummy.matrix);li++;
  }
  lavender.count=sprigs.count=li;lavender.receiveShadow=sprigs.receiveShadow=true;
  lavender.name='lavender-meadow-patches';sprigs.name='lavender-stems';parent.add(lavender,sprigs);
  return {...tree,grass:gi,flowers:fi,lavender:li};
}

function walkway(x,z){
  const segments=[[[.35,-.28],[4.2,1.5]],[[4.2,1.5],[4.7,-2]],[[.05,-.3],[-2.5,.0]]];
  let distance=Infinity;
  for(const [a,b] of segments){
    const dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
    distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }
  return distance;
}

function addWind(shader,time,strength){
  shader.uniforms.uTime=time;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>\n#ifdef USE_INSTANCING\nvec3 origin=instanceMatrix[3].xyz;float windHeight=clamp(position.y/.24,0.,1.);transformed.x+=sin(uTime*1.05+origin.x*.8+origin.z*.6)*${strength}*windHeight;transformed.z+=sin(uTime*.77+origin.z*.83)*${strength*.4}*windHeight;\n#endif`);
}
