import * as THREE from 'three';
import {creekX,waterY,ground} from './land.js';

export function makeKoi(parent,ripples){
 const group=new THREE.Group();group.name='creek-couple-koi';parent.add(group);
 const fish=[],positions=[],indices=[],colours=[];
 // A smooth spindle with a fan tail; both fish fit inside the bed's measured depth.
 const rings=18,sides=12;
 for(let j=0;j<=rings;j++)for(let k=0;k<=sides;k++){
  const u=j/rings,a=k/sides*Math.PI*2,z=(u-.5)*.58,r=.012+.059*Math.sin(Math.PI*u)**.8;
  positions.push(Math.cos(a)*r,Math.sin(a)*r*.58,z);
  const patch=Math.sin(u*21+a*2)>.3;colours.push(...new THREE.Color(patch?'#ffb66e':'#ffffff').toArray());
 }
 for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){const a=j*(sides+1)+k,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const base=positions.length/3;positions.push(-.11,0,-.40,0,0,-.24,.11,0,-.40);colours.push(1,1,1,1,1,1,1,1,1);indices.push(base,base+1,base+2);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const materials=[];
 for(let i=0;i<2;i++){
  const tailClock={value:0};
  const material=new THREE.MeshStandardMaterial({color:i?'#f7ede2':'#ff6b35',vertexColors:true,roughness:.26,metalness:.08,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{shader.uniforms.koiClock=tailClock;shader.uniforms.koiPhase={value:i*2.4};shader.vertexShader='uniform float koiClock;uniform float koiPhase;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat tail=pow(clamp((.18-position.z)/.58,0.0,1.0),1.5);transformed.x+=sin(koiClock-position.z*12.0+koiPhase)*.055*tail;');};
  material.customProgramCacheKey=()=>`couple-koi-${i}`;materials.push(material);
  const root=new THREE.Group();root.name=i?'pearl-couple-koi':'gold-couple-koi';const body=new THREE.Mesh(geometry,material);root.add(body);group.add(root);
  const eyeMaterial=new THREE.MeshStandardMaterial({color:'#342e2a'}),eyeGeometry=new THREE.SphereGeometry(.007,6,4);
  for(const side of [-1,1]){const eye=new THREE.Mesh(eyeGeometry,eyeMaterial);eye.position.set(side*.036,.012,.205);root.add(eye);}
  fish.push({root,phase:i*Math.PI,position:new THREE.Vector3(),previous:new THREE.Vector3(),tailClock,speed:0,eyeGeometry,eyeMaterial});
 }
 let time=0,wake=0,disposed=false,wakesEnabled=true;
 function pose(){
  for(const f of fish){
   const a=time*.32+f.phase,z=1.1+Math.sin(a),x=creekX(z)+Math.cos(a)*.11;
   const floor=ground(x,z),surface=waterY(z),y=THREE.MathUtils.clamp(surface-.082,floor+.046,surface-.052);
   f.root.position.set(x,y,z);f.root.rotation.y=Math.atan2(.11*-Math.sin(a)+(.73+1.32*.46*Math.cos(z*.46))*Math.cos(a),Math.cos(a));f.position.copy(f.root.position);
  }
 }
 function update(delta,{covered=false,reducedMotion=false}={}){
  if(disposed||covered||reducedMotion)return;const dt=Math.max(0,Math.min(.06,delta));for(const f of fish)f.previous.copy(f.position);time+=dt;pose();
  for(const f of fish){f.speed=dt?f.previous.distanceTo(f.position)/dt:0;f.tailClock.value+=dt*(2.2+f.speed*7);}
  wake-=dt;if(wake<=0){wake=1.2;if(wakesEnabled)for(const f of fish)if(waterY(f.position.z)-ground(f.position.x,f.position.z)<.23)ripples?.addImpulseWorld(f.position.x,f.position.z,.085,-.012);}
 }
 pose();
 return {group,update,setWakesEnabled(value){wakesEnabled=Boolean(value);},getState:()=>({time,count:fish.length,wakesEnabled,colours:materials.map(m=>'#'+m.color.getHexString()),fish:fish.map(f=>({position:f.position.toArray(),heading:f.root.rotation.y,speed:f.speed,tailPhase:f.tailClock.value,depth:waterY(f.position.z)-f.position.y,clearance:f.position.y-ground(f.position.x,f.position.z)}))}),dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometry.dispose();materials.forEach(m=>m.dispose());fish.forEach(f=>{f.eyeGeometry.dispose();f.eyeMaterial.dispose();});}};
}
