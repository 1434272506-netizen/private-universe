import * as THREE from 'three';
import {guidingWindGust} from './falling-foliage.js';

function wingGeometry(){
  const curves=[
    new THREE.CubicBezierCurve3(new THREE.Vector3(0,0,-.015),new THREE.Vector3(.06,.015,-.14),new THREE.Vector3(.17,.02,-.10),new THREE.Vector3(.105,.008,.01)),
    new THREE.CubicBezierCurve3(new THREE.Vector3(.105,.008,.01),new THREE.Vector3(.15,.015,.10),new THREE.Vector3(.025,.005,.10),new THREE.Vector3(0,0,.015))
  ];
  const outline=curves.flatMap(c=>c.getPoints(5)),positions=[.045,.012,.008],softness=[1],indices=[];
  outline.forEach(p=>{positions.push(p.x,p.y,p.z);softness.push(.3);});
  for(let i=0;i<outline.length;i++)indices.push(0,i+1,(i+1)%outline.length+1);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('wingSoftness',new THREE.Float32BufferAttribute(softness,1));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function createButterflies(parent,perches){
  if(perches.length<6)throw new Error('Butterflies need six real flower perches');
  const group=new THREE.Group();group.name='meadow-butterflies';parent.add(group);
  const geometry=wingGeometry(),bodyGeometry=new THREE.OctahedronGeometry(.03),bodyMaterial=new THREE.MeshStandardMaterial({color:'#65756a',roughness:.8});
  const materials=[],butterflies=[],target=new THREE.Vector3();
  let clock=0,wasGust=false,disposed=false,paused=false,reduced=false;
  const clamp=THREE.MathUtils.clamp,ease=t=>t*t*t*(t*(t*6-15)+10);
  for(let i=0;i<2;i++){
    const root=new THREE.Group();root.name=i?'pale-blue-butterfly':'blush-white-butterfly';group.add(root);
    const material=new THREE.MeshStandardMaterial({color:i?'#bce6f4':'#fff0f1',side:THREE.DoubleSide,roughness:.65,transparent:true,opacity:.92,depthWrite:false,forceSinglePass:true});
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float wingSoftness;\nvarying float vWingSoftness;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWingSoftness=wingSoftness;');
      shader.fragmentShader='varying float vWingSoftness;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=vWingSoftness;\n#include <alphatest_fragment>');
    };
    material.customProgramCacheKey=()=> 'meadow-butterfly-feathered-wing';materials.push(material);
    const body=new THREE.Mesh(bodyGeometry,bodyMaterial);body.scale.set(.28,.3,1);root.add(body);
    const wings=[new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material)];wings[0].scale.x=-1;root.add(...wings);
    const b={root,wings,index:i,perch:i*3,next:i*3,state:'perched',age:0,duration:3.4+i*.35,start:new THREE.Vector3(),flights:0,phase:i*1.9};
    butterflies.push(b);
  }
  function tip(index,out){perches[index].getPoint(out);out.y+=.018;return out;}
  function rest(b,still=false){
    tip(b.perch,b.root.position);b.root.rotation.set(0,b.phase,0);
    const angle=THREE.MathUtils.degToRad(45+(still?0:30*Math.sin(clock*Math.PI*2*1.2+b.phase)));
    b.wings[0].rotation.z=-angle;b.wings[1].rotation.z=angle;
  }
  function launch(b){
    if(b.state!=='perched'||paused||reduced)return;
    b.state='flying';b.age=0;b.start.copy(b.root.position);b.next=b.index*3+(b.perch-b.index*3+1)%3;b.flights++;
  }
  function setReducedMotion(value){
    reduced=value;
    if(value)for(const b of butterflies){b.state='perched';b.age=0;rest(b,true);}
  }
  function update(delta,{covered=false,reducedMotion=false,windTime}={}){
    if(disposed)return false;
    paused=covered;
    if(covered)return false;
    if(reduced!==reducedMotion)setReducedMotion(reducedMotion);
    if(reduced)return false;
    const dt=clamp(delta,0,.06);clock+=dt;
    const gust=guidingWindGust(windTime??clock)>.4;
    if(gust&&!wasGust)for(const b of butterflies)launch(b);
    wasGust=gust;
    for(const b of butterflies){
      if(b.state==='perched'){rest(b);continue;}
      b.age+=dt;const u=clamp(b.age/b.duration,0,1),envelope=Math.sin(Math.PI*u)**2,angle=u*Math.PI*4+b.phase;
      tip(b.next,target);b.root.position.lerpVectors(b.start,target,ease(u));
      b.root.position.x+=Math.cos(angle)*envelope*(.9+b.index*.2);
      b.root.position.z+=Math.sin(angle)*envelope*(.9+b.index*.2);
      b.root.position.y+=envelope*(.85+b.index*.12);
      b.root.rotation.set(Math.sin(angle)*.2*envelope,angle,.15*Math.cos(angle)*envelope);
      const flap=.35+Math.sin(clock*Math.PI*2*7+b.phase)*.65;
      b.wings[0].rotation.z=-flap;b.wings[1].rotation.z=flap;
      if(u===1){b.perch=b.next;b.state='perched';rest(b);}
    }
    group.userData.clock=clock;return true;
  }
  function disturb(point){if(paused||reduced||disposed)return;for(const b of butterflies)if(b.root.position.distanceTo(point)<.65)launch(b);}
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometry.dispose();bodyGeometry.dispose();bodyMaterial.dispose();materials.forEach(m=>m.dispose());}
  butterflies.forEach(b=>rest(b));
  group.userData.triangles=2*(geometry.index.count/3*2+bodyGeometry.attributes.position.count/3);
  return {group,update,setReducedMotion,disturb,dispose,getState:()=>({clock,states:butterflies.map(b=>({state:b.state,perch:b.perch,flights:b.flights,age:b.age,position:b.root.position.toArray()}))})};
}
