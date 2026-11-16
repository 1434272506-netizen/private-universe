import * as THREE from 'three';

export function makeCabinPlayfulness(group){
 const root=new THREE.Group();root.name='cabin-playful-details';root.visible=false;group.add(root);
 const targets=[],stretch={value:new THREE.Vector3(1,1,1)},pivot={value:new THREE.Vector3(1.28,.745,.36)};
 const state={pats:0,age:Infinity,radioPlaying:false,knobAngle:0,maskedVertices:0,clock:0};
 let reduced=false,disposed=false;
 function target(name,kind,position,size){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial());mesh.name=name;mesh.position.set(...position);mesh.visible=false;mesh.userData.interaction=kind;root.add(mesh);targets.push(mesh);return mesh;}
 target('sleepy-piglet-pat-target','piglet-pat',[1.28,.945,.405],[.275,.39,.25]);
 target('cabin-radio-touch-target','cabin-radio',[1.44,1.36,-1.16],[.43,.29,.22]);
 target('cabin-journal-touch-target','cabin-journal',[.50,1.067,-.96],[.24,.045,.16]);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const ctx=canvas.getContext('2d');
 ctx.shadowColor='#ff9ebb';ctx.shadowBlur=12;ctx.fillStyle='#ffc8d9';ctx.beginPath();ctx.moveTo(48,77);ctx.bezierCurveTo(5,50,9,14,32,21);ctx.bezierCurveTo(42,23,48,32,48,36);ctx.bezierCurveTo(51,12,79,14,82,35);ctx.bezierCurveTo(85,52,65,65,48,77);ctx.fill();
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const hearts=Array.from({length:3},(_,i)=>{const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,color:'#ffbfd2',transparent:true,opacity:0,depthWrite:false,depthTest:true}));sprite.name=`piglet-heart-${i+1}`;sprite.scale.setScalar(.055);sprite.visible=false;root.add(sprite);return sprite;});
 const knob=new THREE.Group();knob.name='cabin-radio-turning-knob';knob.position.set(1.535,1.34,-1.075);root.add(knob);
 const bronze=new THREE.MeshStandardMaterial({color:'#b79863',metalness:.65,roughness:.38}),tickMaterial=new THREE.MeshStandardMaterial({color:'#e6d5a8'});
 const dial=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.012,14),bronze);dial.rotation.x=Math.PI/2;knob.add(dial);
 const tick=new THREE.Mesh(new THREE.BoxGeometry(.003,.009,.002),tickMaterial);tick.position.set(0,.006,.008);knob.add(tick);
 const waves=Array.from({length:3},(_,i)=>{const mesh=new THREE.Mesh(new THREE.RingGeometry(.027,.029,24),new THREE.MeshBasicMaterial({color:'#e2c48a',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));mesh.position.set(1.44,1.245,-1.075+i*.001);mesh.visible=false;mesh.userData.gardenFoliage=true;root.add(mesh);return mesh;});
 function bind(mesh){
  if(!mesh||mesh.name!=='cabin-interior-furniture')return;
  group.updateWorldMatrix(true,true);mesh.updateWorldMatrix(true,false);
  const transform=new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(mesh.matrixWorld),p=new THREE.Vector3(),position=mesh.geometry.attributes.position,color=mesh.geometry.attributes.color,weights=new Float32Array(position.count);
  for(let i=0;i<position.count;i++){
   p.fromBufferAttribute(position,i).applyMatrix4(transform);
   if(p.x<1.11||p.x>1.45||p.y<.747||p.y>1.14||p.z<.23||p.z>.53)continue;
   // Pink plush and warm facial details are distinct from the green sofa and lavender cushions.
   const pink=color.getX(i)>color.getZ(i)*1.035&&color.getZ(i)>color.getY(i)*.92;
   const ribbon=p.y>.918&&p.y<.955&&p.z>.462&&p.z<.495&&Math.abs(p.x-1.28)<.04;
   const face=p.z>.44&&p.y>.95;
   if(pink||ribbon||face)weights[i]=1;
  }
  // A complete triangle moves together, including the dark eyelid/snout seams.
  const index=mesh.geometry.index;
  for(let i=0;i<(index?.count||position.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);if(ids.some(v=>weights[v]))ids.forEach(v=>weights[v]=1);}
  state.maskedVertices=weights.reduce((sum,value)=>sum+value,0);
  mesh.geometry.setAttribute('pigletWeight',new THREE.BufferAttribute(weights,1));
  pivot.value.set(1.28,.745,.36).applyMatrix4(transform.clone().invert());
  mesh.userData.pigletInteraction='piglet-pat';root.visible=true;
 }
 function decorateShader(shader){
  if(typeof shader.vertexShader!=='string')return;
  shader.uniforms??={};
  shader.uniforms.pigletStretch=stretch;shader.uniforms.pigletPivot=pivot;
  shader.vertexShader='attribute float pigletWeight;uniform vec3 pigletStretch;uniform vec3 pigletPivot;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=mix(transformed,pigletPivot+(transformed-pigletPivot)*pigletStretch,pigletWeight);');
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal/=mix(vec3(1.0),pigletStretch,pigletWeight);');
 }
 function pat(){if(disposed||!state.maskedVertices)return false;state.pats++;state.age=0;return true;}
 function resetMotion(){stretch.value.set(1,1,1);hearts.forEach(h=>h.visible=false);}
 function update(delta,{covered=false,reducedMotion=false,radioPlaying=false}={}){
  if(disposed||covered)return;
  if(reducedMotion!==reduced){reduced=reducedMotion;if(reduced)resetMotion();}
  state.clock+=Math.min(delta,.06);state.radioPlaying=radioPlaying;
  if(Number.isFinite(state.age))state.age+=Math.min(delta,.06);
  if(!reduced&&state.age<.45){
   const first=state.age/.45,k=first<.45?first/.45:(first-.45)/.55,a=first<.45?[1.18,.82,1.18]:[.92,1.12,.92],b=first<.45?[.92,1.12,.92]:[1,1,1],s=k*k*(3-2*k);
   stretch.value.set(...a).lerp(new THREE.Vector3(...b),s);
  }else stretch.value.set(1,1,1);
  for(let i=0;i<3;i++){
   const age=state.age-i*.1,life=age/1.4,heart=hearts[i];heart.visible=!reduced&&age>=0&&life<1;
   if(!heart.visible)continue;
   const angle=age*2.7+i*2.1;heart.position.set(1.28+Math.cos(angle)*.055,1.15+age*.22,.40+Math.sin(angle)*.035);heart.material.opacity=.64*Math.sin(Math.PI*life);heart.scale.setScalar(.048+.015*Math.sin(Math.PI*life));
  }
  const desired=radioPlaying?Math.PI*.6:0;state.knobAngle=THREE.MathUtils.damp(state.knobAngle,desired,12,delta);knob.rotation.z=state.knobAngle;
  waves.forEach((wave,i)=>{wave.visible=radioPlaying&&!reduced;if(wave.visible){const u=(state.clock*.7+i/3)%1;wave.scale.setScalar(1+u*2.8);wave.material.opacity=(1-u)*.15;}});
 }
 function dispose(){if(disposed)return;disposed=true;root.removeFromParent();const resources=new Set();root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});resources.add(map);resources.forEach(r=>r.dispose());}
 return {root,targets,bind,decorateShader,pat,update,dispose,getState:()=>({...state,stretch:stretch.value.toArray(),hearts:hearts.filter(h=>h.visible).length,reducedMotion:reduced})};
}
