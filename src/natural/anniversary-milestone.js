import * as THREE from 'three';
import * as personalContent from '../personal-content.js';
import {ground} from './land.js';
const relationshipStartDate=personalContent.relationshipStartDate||'2025-09-23';

export function daysTogether(now=Date.now(),start=relationshipStartDate) {
  const beginning=new Date(start+'T00:00:00'),today=new Date(now);
  if(!Number.isFinite(beginning.getTime())||!Number.isFinite(today.getTime()))throw new Error('Invalid relationship date');
  // Count the client's calendar days; DST must not turn a day into 23/25 hours.
  const ordinal=date=>Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
  return Math.max(0,Math.round((ordinal(today)-ordinal(beginning))/86400000));
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
  const x=-12.0,z=-1.5;
  plaque.userData.interaction='anniversary';plaque.position.set(x,ground(x,z),z);

  // 告别呆板切断木桩，重塑为：浪漫精致的【星轨时光浑天日晷 (Celestial Brass Astrolabe)】
  // A. 汉白玉叠级打磨原石基座 (Tiered Marble Base)
  const stoneMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.65,
    metalness: 0.05
  });
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.09, 24), stoneMat);
  base1.position.y = 0.045;
  base1.castShadow = true;
  base1.receiveShadow = true;
  plaque.add(base1);

  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.30, 0.07, 24), stoneMat);
  base2.position.y = 0.125;
  base2.castShadow = true;
  base2.receiveShadow = true;
  plaque.add(base2);

  // B. 复古黄铜支柱与承托座 (Antique Brass Mounting)
  const brassMat = new THREE.MeshStandardMaterial({
    color: '#d97706',
    roughness: 0.28,
    metalness: 0.85
  });

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.034, 0.26, 12), brassMat);
  column.position.y = 0.29;
  column.castShadow = true;
  plaque.add(column);

  const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.020, 0.05, 16), brassMat);
  bracket.position.y = 0.44;
  plaque.add(bracket);

  // C. 浑天黄铜双环与极轴日晷指针 (Armillary Celestial Rings & Gnomon)
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.014, 8, 36), brassMat);
  ring1.rotation.x = 0.58;
  ring1.position.y = 0.60;
  ring1.castShadow = true;
  plaque.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 8, 36), brassMat);
  ring2.rotation.y = 0.75;
  ring2.rotation.z = 0.38;
  ring2.position.y = 0.60;
  ring2.castShadow = true;
  plaque.add(ring2);

  const gnomon = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.52, 8), brassMat);
  gnomon.rotation.z = 0.65;
  gnomon.position.y = 0.60;
  gnomon.castShadow = true;
  plaque.add(gnomon);

  // D. 核心时光星核发光水晶球 (Luminous Time Core)
  const crystalMat = new THREE.MeshStandardMaterial({
    color: '#fffbeb',
    emissive: '#fde047',
    emissiveIntensity: 0.42,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.068, 20, 16), crystalMat);
  core.position.y = 0.60;
  plaque.add(core);

  // 核心微弱暖光
  const coreLight = new THREE.PointLight('#fef08a', 0.55, 2.5, 1.6);
  coreLight.position.y = 0.60;
  plaque.add(coreLight);

  const inscriptionCanvas=document.createElement('canvas');inscriptionCanvas.width=1024;inscriptionCanvas.height=256;
  const inscriptionTexture=new THREE.CanvasTexture(inscriptionCanvas);inscriptionTexture.colorSpace=THREE.SRGBColorSpace;
  const inscription=new THREE.Mesh(new THREE.BoxGeometry(.9,.225,.022),new THREE.MeshStandardMaterial({map:inscriptionTexture,roughness:.58,metalness:.15,emissive:'#fff1dc',emissiveMap:inscriptionTexture,emissiveIntensity:.28}));
  inscription.name='anniversary-live-inscription';inscription.position.set(0,.16,.38);inscription.rotation.x=-.45;plaque.add(inscription);
  let displayedDays=-1,nextRefresh=0;
  const dateLabel=relationshipStartDate.replaceAll('-','.');
  const sentence=()=>`从 ${dateLabel} 至今，我们已经携手走过了整整 ${daysTogether()} 天`;
  function update(){
    if(Date.now()<nextRefresh)return;nextRefresh=Date.now()+60000;
    const days=daysTogether();if(days===displayedDays)return;displayedDays=days;
    const ctx=inscriptionCanvas.getContext('2d');ctx.fillStyle='#463729';ctx.fillRect(0,0,1024,256);
    ctx.strokeStyle='#b89a65';ctx.lineWidth=6;ctx.strokeRect(10,10,1004,236);
    ctx.textAlign='center';ctx.fillStyle='#fff1dc';ctx.font='34px "Microsoft YaHei", sans-serif';
    ctx.fillText(`从 ${dateLabel} 至今`,512,65);ctx.fillText('我们已经携手走过了',512,125);
    ctx.font='bold 46px "Microsoft YaHei", sans-serif';ctx.fillText(`整整 ${days} 天`,512,203);
    plaque.userData.daysTogether=days;inscription.userData.text=sentence();inscriptionTexture.needsUpdate=true;
  }
  update();

  const patioRing=new THREE.Mesh(new THREE.CylinderGeometry(.56,.62,.035,24),stoneMat);
  patioRing.name='patioRing';patioRing.position.y=.0175;patioRing.receiveShadow=true;
  plaque.add(patioRing);

  island.add(plaque);

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
    const focus=plaque.position.clone().add(new THREE.Vector3(0,.52,0));
    moveTo(focus.clone().add(new THREE.Vector3(.68,.68,1.55)),focus,{duration:1.0,min:1});
    refresh();
    card.showModal();
    timer=setInterval(refresh,60000);
  }
  function refresh(){
    update();card.querySelector('h2').textContent=sentence();
  }
  card.addEventListener('close',()=>{
    clearInterval(timer);onClose();
    if(goToStars)stargaze();else frame(previous,true);
    goToStars=false;
  });
  card.querySelector('.card-close').onclick=()=>card.close();
  card.querySelector('.card-stars').onclick=()=>{goToStars=true;card.close();};
  return {plaque,open,update};
}
