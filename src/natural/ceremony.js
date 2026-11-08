import * as THREE from 'three';
import {createCurvedPetalGeometry} from './falling-foliage.js';

// Keep the final view tied to the authored tree rather than a hardcoded branch.
export function ceremonyPath(position,target){
  return {
    position:new THREE.CatmullRomCurve3([
      new THREE.Vector3(-28,22,35),new THREE.Vector3(-21,13,26),
      new THREE.Vector3(-12,4.5,14),new THREE.Vector3(...position)
    ],false,'centripetal'),
    target:new THREE.CatmullRomCurve3([
      new THREE.Vector3(0,1.5,0),new THREE.Vector3(-1,1.8,0),
      new THREE.Vector3(-2,2,0),new THREE.Vector3(...target)
    ],false,'centripetal')
  };
}

export function guidingPetals(scene,anchor){
  const group=new THREE.Group();group.name='ceremony-guiding-petals';
  const geometry=createCurvedPetalGeometry(.14,.21);
  const end=anchor.clone();
  const path=new THREE.CubicBezierCurve3(end.clone().add(new THREE.Vector3(-1.8,2.1,-.3)),
    end.clone().add(new THREE.Vector3(1,1.9,.6)),end.clone().add(new THREE.Vector3(.9,.2,.65)),end);
  for(let i=0;i<3;i++){
    const petal=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:i===1?'#eef5d8':'#fffef0',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,roughness:.38,metalness:.05,forceSinglePass:true}));
    group.add(petal);
  }
  scene.add(group);let disposed=false;
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometry.dispose();group.children.forEach(petal=>petal.material.dispose());}
  return {dispose,update(age){
    if(disposed)return false;
    if(age>=5.8){dispose();return false;}
    group.children.forEach((petal,i)=>{
      const t=Math.max(0,Math.min(1,(age-i*.35)/4.8));
      petal.position.copy(path.getPoint(Math.min(1,t/.8)));
      if(t>.8){const a=(t-.8)/.2*Math.PI*2;petal.position.add(new THREE.Vector3(Math.sin(a)*.13,Math.sin(a*2)*.06,Math.cos(a)*.12));}
      petal.position.y+=Math.sin(t*8+i)*.045;
      const flutter=age*1.3+i;
      petal.rotation.set(t*3+i+Math.cos(flutter)*.25,t*5+Math.sin(flutter*.7)*.18,t*4+i+Math.sin(flutter)*.55);
      petal.material.opacity=Math.sin(Math.PI*t)*.92;
    });return true;
  }};
}
