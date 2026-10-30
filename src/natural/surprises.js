import * as THREE from 'three';

// Each real, locally saved surprise has one small patch of air in the garden.
export function createSurpriseWorld(parent,time,{ground=()=>0,reducedMotion=()=>false}={}){
  const root=new THREE.Group();root.name='saved-surprise-balloons';parent.add(root);
  const rigs=new Map();let elapsed=0;
  const sphere=new THREE.SphereGeometry(.30,24,18),knot=new THREE.ConeGeometry(.047,.09,10);
  const tailPoints=[new THREE.Vector3(0,-.36,0),new THREE.Vector3(.035,-.63,.025),new THREE.Vector3(-.04,-.93,.04),new THREE.Vector3(.015,-1.22,.02)];
  const tail=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPoints),20,.004,4,false);
  const thread=new THREE.MeshStandardMaterial({color:'#d7cbb5',roughness:1});
  function make(record){
    const rig=new THREE.Group();rig.name=`saved-surprise-${record.id}`;rig.userData.interaction=`surprise:${record.id}`;rig.userData.surpriseId=record.id;
    const material=new THREE.MeshStandardMaterial({color:record.color,roughness:.64,metalness:.03});
    const body=new THREE.Mesh(sphere,material);body.scale.set(.88,1.18,.88);rig.add(body);
    const tied=new THREE.Mesh(knot,material);tied.position.y=-.365;tied.rotation.z=Math.PI;rig.add(tied);
    rig.add(new THREE.Mesh(tail,thread));root.add(rig);
    const item={rig,material,position:{...record.position},phase:[...record.id].reduce((sum,char)=>sum+char.charCodeAt(0),0)*.17,flight:null};rigs.set(record.id,item);return item;
  }
  function dispose(id,item){root.remove(item.rig);item.material.dispose();rigs.delete(id);}
  function sync(records,event){
    const active=new Set(records.filter(record=>record.status==='active').map(record=>record.id));
    for(const [id,item] of rigs){
      if(active.has(id))continue;
      if(event?.type==='complete'&&event.id===id&&!isReduced()&&!item.flight)item.flight={start:elapsed,base:item.rig.position.clone()};
      else if(!item.flight)dispose(id,item);
    }
    for(const record of records){
      if(record.status!=='active')continue;
      const item=rigs.get(record.id)||make(record);item.position={...record.position};item.material.color.set(record.color);
    }
    update(elapsed);
  }
  function isReduced(){return typeof reducedMotion==='function'?reducedMotion():Boolean(reducedMotion);}
  function update(value=time?.value||0){
    elapsed=value;
    for(const [id,item] of rigs){
      const {rig,position,phase}=item;
      if(item.flight){
        const t=Math.max(0,elapsed-item.flight.start);
        rig.position.copy(item.flight.base);rig.position.y+=t*2.8+t*t*.45;rig.position.x+=Math.sin(phase+t)*t*.22;
        if(t>3.2||isReduced())dispose(id,item);continue;
      }
      const t=isReduced()?0:elapsed;
      rig.position.set(position.x+Math.sin(t*.57+phase)*.105,ground(position.x,position.z)+2.0+Math.sin(t*.43+phase)*.055,position.z+Math.cos(t*.51+phase)*.075);
      rig.rotation.z=Math.sin(t*.36+phase)*.025;
    }
  }
  return {sync,update,get objects(){return [...rigs.values()].filter(item=>!item.flight).map(item=>item.rig);},
    get flying(){return [...rigs.values()].some(item=>item.flight);},
    dispose(){for(const [id,item] of rigs)dispose(id,item);sphere.dispose();knot.dispose();tail.dispose();thread.dispose();parent.remove(root);}};
}
