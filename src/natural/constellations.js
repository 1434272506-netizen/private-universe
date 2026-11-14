import * as THREE from 'three';
import {spiralGalaxy} from './spiral-galaxy.js';
import {makePortal} from './galaxy-art.js';

const vec=(x,y,z=0)=>new THREE.Vector3(x,y,z);
export function makeStargazing(scene,bench,moveTo,frame) {
  const sky=new THREE.Group(), macro=new THREE.Group();
  sky.name='private-constellations';sky.visible=false;scene.add(sky);sky.add(macro);
  const portals=[makePortal(true),makePortal(false)];
  for(const {portal,realm} of portals){macro.add(portal);sky.add(realm);}
  const disk=new THREE.Group(), galaxy=spiralGalaxy();
  disk.rotation.set(.27,0,.17);disk.position.set(-17,0,-62);disk.add(galaxy);macro.add(disk);
  const ui=document.querySelector('#garden-ui');
  function button(id,text){const el=document.createElement('button');el.id=id;el.textContent=text;el.hidden=true;ui.append(el);return el;}
  const toggle=button('stargaze','✨ 仰望星空'), back=button('galaxy-return','🌌 返回银河全景');
  const eye=vec(...bench.position),direction=vec(...bench.target).sub(eye);direction.y=0;
  direction.normalize().multiplyScalar(Math.cos(75*Math.PI/180));direction.y=Math.sin(75*Math.PI/180);
  const look=eye.clone().addScaledVector(direction,8);
  sky.position.copy(eye).addScaledVector(direction,70);sky.lookAt(eye);
  const proxies=portals.map(p=>p.hitProxy),gas=galaxy.getObjectByName('spiral-gas');
  let exposure, selected, hovered, traveling=false;
  function target(ray){
    if(!ray||!sky.visible||selected||traveling)return null;
    const hit=ray.intersectObjects(proxies,false)[0];
    return hit?portals.find(p=>p.hitProxy===hit.object):null;
  }
  function hover(ray){
    hovered=target(ray);
    for(const p of portals)p.title.visible=p===hovered;
    return Boolean(hovered);
  }
  function reset(){
    ui.classList.remove('in-realm');
    hover(null);selected=null;traveling=false;macro.visible=true;disk.scale.z=1;back.hidden=true;
    for(const p of portals){p.realm.visible=false;p.halo.scale.setScalar(4);}
  }
  function leave(){if(sky.visible){reset();sky.visible=false;frame('bench',true);}}
  function enter(){
    document.querySelector('[data-atmo="night"]').click();frame('bench');reset();sky.visible=true;
    moveTo(eye,look,{duration:1.6,min:2});
  }
  toggle.onclick=()=>sky.visible?leave():enter();
  function pick(ray){
    const star=target(ray);
    if(!star)return;
    hover(null);selected=star;traveling=true;
    selected.halo.scale.setScalar(24);
    const center=selected.portal.getWorldPosition(vec());
    const landing=selected.portal.localToWorld(vec(0,0,Math.max(15,16*innerHeight/innerWidth)));
    moveTo(landing,center,{duration:1.8,min:2,cosine:true,done:()=>{
      traveling=false;disk.scale.z=1;macro.visible=false;selected.realm.visible=true;ui.classList.add('in-realm');back.hidden=false;back.focus({preventScroll:true});
    }});
  }
  back.onclick=()=>{
    reset();traveling=true;
    moveTo(eye,look,{duration:1.8,min:2,cosine:true,done:()=>{traveling=false;}});
  };
  function update(view,available,time,renderer,reduced){
    const mode=ui.dataset.atmosphere;
    if(sky.visible&&(view!=='bench'||mode==='day')){
      reset();sky.visible=false;if(view==='bench')frame('bench',true);
    }
    if(sky.visible&&exposure===undefined){exposure=renderer.toneMappingExposure;renderer.toneMappingExposure=exposure*.85;}
    if(!sky.visible&&exposure!==undefined){renderer.toneMappingExposure=exposure;exposure=undefined;}
    toggle.hidden=!available||view!=='bench'||!['sunset','night'].includes(mode);
    toggle.textContent=sky.visible?'回到长椅':'✨ 仰望星空';
    if(!sky.visible)return;
    if(selected?.realm.visible)return;
    const pulse=reduced?0:Math.sin(time*2*Math.PI*1.2);
    if(!reduced)galaxy.rotation.y+=.0003;
    gas.scale.setScalar(1+.014*pulse);
    for(const p of portals){
      if(!reduced)p.spikes.material.rotation+=.002;
      p.spikes.material.opacity=.9+.1*pulse;
      p.halo.scale.setScalar((traveling&&p===selected?15:p===hovered?6:4)+.32*pulse);
    }
    disk.scale.z=traveling&&!reduced?1.65:1;

  }
  return {enter,leave,update,pick,hover,get realm(){return selected?.realm.visible ? selected.realm : null;},get active(){return sky.visible;}};
}
