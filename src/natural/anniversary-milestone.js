import * as THREE from 'three';
import * as personalContent from '../personal-content.js';
import {ground} from './land.js';

export function daysTogether(now=Date.now(),start=personalContent.relationshipStartDate) {
  const epoch=Date.parse(start+'T00:00:00+08:00');
  if(!Number.isFinite(epoch))throw new Error('Invalid relationship start date');
  return Math.max(0,Math.floor((now-epoch)/86400000));
}

function endGrain() {
  const c=document.createElement('canvas');c.width=c.height=512;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#aa7650';ctx.fillRect(0,0,512,512);
  for(let radius=10;radius<400;radius+=10){
    ctx.beginPath();
    for(let i=0;i<=128;i++){
      const t=i*Math.PI/64;
      const r=radius*(1+.024*Math.sin(5*t)+.015*Math.sin(9*t+radius*.04));
      const x=236+Math.cos(t)*r,y=270+Math.sin(t)*r;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.strokeStyle='#795337';ctx.lineWidth=2;ctx.stroke();
  }
  ctx.font='bold 46px Georgia, serif';ctx.textAlign='center';
  ctx.fillStyle='#543622';ctx.fillText('✦ OUR TIME ✦',256,274);
  ctx.fillStyle='#ffe3a4';ctx.fillText('✦ OUR TIME ✦',255,272);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

export function makeMilestone(island,{moveTo,frame,onOpen,onClose,stargaze,currentView}) {
  const plaque=new THREE.Group();plaque.name='anniversary-milestone';
  plaque.userData.interaction='anniversary';plaque.position.set(-1.55,ground(-1.55,.55),.55);
  const bark=new THREE.CylinderGeometry(.35,.40,.46,32);
  const pos=bark.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i);
    const ridge=1+.025*Math.sin(11*Math.atan2(z,x));
    pos.setXYZ(i,x*ridge,pos.getY(i)-z*.32,z*ridge);
  }
  bark.computeVertexNormals();
  const trunk=new THREE.Mesh(bark,new THREE.MeshStandardMaterial({color:'#684b35',roughness:1}));
  trunk.position.y=.23;plaque.add(trunk);
  const face=new THREE.Mesh(new THREE.CircleGeometry(.345,48),
    new THREE.MeshStandardMaterial({map:endGrain(),roughness:.86}));
  face.rotation.x=-Math.PI/2+.31;face.position.y=.47;plaque.add(face);island.add(plaque);

  const card=document.createElement('dialog');card.id='anniversary-card';
  card.setAttribute('aria-labelledby','anniversary-title');
  card.innerHTML='<button class="card-close" aria-label="收起时光铭牌">×</button><h2 id="anniversary-title"></h2><p>一隅春天 · 朝暮与年岁并往</p><p>走过四季流转，这里永远保留着我们最初的春日。</p><button class="card-stars">✨ 仰望我们的星空</button>';
  document.body.append(card);
  const entry=document.createElement('button');
  entry.type='button';
  entry.dataset.place='anniversary';
  entry.textContent='翻看我们的时光 ↗';
  document.querySelector('.help-places').append(entry);
  let previous,goToStars=false,timer;
  function open(){
    if(card.open)return;
    previous=currentView();
    onOpen();
    const focus=plaque.position.clone().add(new THREE.Vector3(0,.37,0));
    moveTo(focus.clone().add(new THREE.Vector3(.72,.75,1.65)),focus,{duration:1.0,min:1});
    refresh();
    card.showModal();
    timer=setInterval(refresh,60000);
  }
  function refresh(){
    card.querySelector('h2').textContent='与你相恋的第 '+daysTogether()+' 天';
  }
  card.addEventListener('close',()=>{
    clearInterval(timer);onClose();
    if(goToStars)stargaze();else frame(previous,true);
    goToStars=false;
  });
  card.querySelector('.card-close').onclick=()=>card.close();
  card.querySelector('.card-stars').onclick=()=>{goToStars=true;card.close();};
  return {plaque,open};
}
