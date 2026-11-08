import * as THREE from 'three';
import {fireflies} from './fireflies.js';
import {celestial} from './celestial.js';
import {fairyLights} from './fairy-lights.js';

import {shootingStars} from './shooting-stars.js';

export function benchAtmosphere(scene, atmosphere, sun, hemi, fill, time, anchor, renderer){
  const flies=fireflies(time), stars=celestial(time), bulbs=fairyLights(time,anchor);
  scene.add(flies,stars,bulbs);
  const u=atmosphere.sky.material.uniforms;
  const updateMeteor=shootingStars(scene);
  const water=scene.getObjectByName('creek-surface').material.userData.currentUniforms;
  const channels=[];
  function channel(values,write){
    channels.push({values,write});
  }
  function color(target,...hex){
    const colors=hex.map(h=>new THREE.Color(h));
    for(const key of ['r','g','b']) channel(colors.map(c=>c[key]),v=>target[key]=v);
  }
  color(sun.color,'#ffe5c4','#ff8b54','#9ec2f8');
  color(hemi.color,'#edf4fa','#9b70a8','#162038');
  color(hemi.groundColor,'#60734c','#454f38','#0f1814');
  color(fill.color,'#d3e3ed','#a5728a','#233854');
  color(scene.fog.color,'#d8e4e7','#a86c6a','#0b121e');
  color(water.uGlintColor.value,'#fffbed','#ff9944','#38bdf8');
  channel([3.65,2.95,.65],v=>sun.intensity=v);
  channel([.92,.85,.45],v=>hemi.intensity=v);
  channel([.28,.35,.2],v=>fill.intensity=v);
  channel([.003,.004,.0035],v=>scene.fog.density=v);
  channel([.14,.09,.016],v=>scene.environmentIntensity=v);
  channel([-11,-14,8],v=>sun.position.x=v);
  channel([10.5,2.1,12],v=>sun.position.y=v);
  channel([7.5,4.8,-6],v=>sun.position.z=v);
  channel([2.5,5.2,.1],v=>u.rayleigh.value=v);
  channel([1.8,3.8,1],v=>u.turbidity.value=v);
  channel([0,1,0],v=>u.dusk.value=v);
  channel([0,0,1],v=>u.night.value=v);
  for(const [obj,levels] of [[flies,[0,.25,.95]],[stars,[0,0,1]],[bulbs,[0,.08,1]]]){
    channel(levels,v=>{obj.material.uniforms.opacity.value=v;obj.visible=v>.001;});
  }
  const panel=document.querySelector('#atmosphere-switcher');
  let weights=[1,0,0],from=weights.slice(),goal=0,start=0,duration=0;
  function apply(){
    for(const {values,write} of channels) write(values.reduce((s,v,i)=>s+v*weights[i],0));
    water.uSunDirection.value.copy(sun.position).normalize();
    u.sunPosition.value.copy(water.uSunDirection.value).multiplyScalar(450000);
    for(const cloud of atmosphere.clouds.children){
      const cu=cloud.material.uniforms;
      cu.uSun.value.copy(sun.position).divide(cloud.scale).normalize();
    }
    renderer.shadowMap.needsUpdate=true;
  }
  apply();
  panel.addEventListener('click',event=>{
    const button=event.target.closest('[data-atmo]');
    if(!button)return;
    from=weights.slice(); goal=['day','sunset','night'].indexOf(button.dataset.atmo);
    document.querySelector('#garden-ui').dataset.atmosphere=button.dataset.atmo;
    start=performance.now();duration=matchMedia('(prefers-reduced-motion: reduce)').matches?300:1800;
    for(const b of panel.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===button));
  });
  return {update(now,delta,reducedMotion){
    updateMeteor(delta,u.night.value,reducedMotion);
    if(!duration)return;
    const t=Math.min(1,(now-start)/duration),ease=t*t*(3-2*t);
    weights=from.map((v,i)=>THREE.MathUtils.lerp(v,Number(i===goal),ease));apply();
    if(t===1)duration=0;
  }};
}
