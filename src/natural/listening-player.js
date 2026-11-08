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
  const disc=add(new THREE.CylinderGeometry(.10,.10,.009,40),new THREE.MeshStandardMaterial({color:'#201d25'}),-.045,.067,0);
  disc.name='listening-vinyl';
  const label=new THREE.Mesh(new THREE.CylinderGeometry(.033,.033,.01,24),accent);
  label.position.set(.003,.002,0);disc.add(label);
  const c=document.createElement('canvas');c.width=c.height=64;
  const ctx=c.getContext('2d');ctx.font='52px serif';ctx.textAlign='center';ctx.fillStyle='#ffdc83';ctx.fillText('♪',32,51);
  const noteMaterial=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthWrite:false});
  const notes=Array.from({length:6},()=>{const note=new THREE.Sprite(noteMaterial);note.scale.setScalar(.065);note.visible=false;player.add(note);return note;});
  let clock=0;
  player.userData.update=(delta,playing)=>{
    if(playing){clock+=delta;disc.rotation.y+=3.5*delta;}
    notes.forEach((note,i)=>{
      note.visible=playing;
      if(!playing)return;
      const t=(clock*.45+i/notes.length)%1;
      note.position.set(-.045-t*.22,.1+t*.55,Math.sin(t*4+i)*.07);
      note.scale.setScalar(.065*Math.sin(Math.PI*t));
    });
  };
  for(let i=0;i<5;i++)add(new THREE.BoxGeometry(.054,.004,.005),dark,.134,.059,-.056+i*.026);
  add(new RoundedBoxGeometry(.068,.012,.024,2,.004),accent,-.11,.061,.09);
  add(new RoundedBoxGeometry(.034,.012,.024,2,.004),metal,-.053,.061,.09);
  return player;
}
