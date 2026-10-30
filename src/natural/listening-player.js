import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export function makeListeningPlayer(bench){
  const player=new THREE.Group();player.name='spring-cassette-player';player.userData.interaction='sound';
  player.position.set(-.64,.56,.035);player.rotation.y=-.22;bench.add(player);
  const caseMaterial=new THREE.MeshStandardMaterial({color:'#d9d1ba',roughness:.91});
  const dark=new THREE.MeshStandardMaterial({color:'#4b5e51',roughness:.88});
  const metal=new THREE.MeshStandardMaterial({color:'#b2b5a1',roughness:.6,metalness:.22});
  const accent=new THREE.MeshStandardMaterial({color:'#aa99ba',roughness:.87});
  const add=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);player.add(mesh);return mesh;};
  add(new RoundedBoxGeometry(.40,.105,.25,2,.025),caseMaterial,0,0,0);
  add(new RoundedBoxGeometry(.235,.009,.125,2,.007),dark,-.05,.056,0);
  for(const x of [-.105,.005]){
    const spool=add(new THREE.TorusGeometry(.027,.0045,5,18),metal,x,.063,0);spool.rotation.x=Math.PI/2;
  }
  for(let i=0;i<5;i++)add(new THREE.BoxGeometry(.054,.004,.005),dark,.134,.059,-.056+i*.026);
  add(new RoundedBoxGeometry(.068,.012,.024,2,.004),accent,-.11,.061,.09);
  add(new RoundedBoxGeometry(.034,.012,.024,2,.004),metal,-.053,.061,.09);
  return player;
}
