import * as THREE from 'three';
import {fireflies} from './fireflies.js';
import {celestial} from './celestial.js';
import {fairyLights} from './fairy-lights.js';
import {shootingStars} from './shooting-stars.js';
import {makeAurora} from './aurora.js';
import {makeVolumetricBeams} from './volumetric-beams.js';
import {makeMoon} from './moon.js';
import {makeMilkyWay} from './milky-way.js';

export function benchAtmosphere(scene, atmosphere, sun, hemi, fill, time, anchor, renderer, cabin, estateFeatures){
  const flies=fireflies(time), stars=celestial(time), bulbs=fairyLights(time,anchor);
  const aurora=makeAurora(time), beams=makeVolumetricBeams(time);
  const moon=makeMoon(time), milkyWay=makeMilkyWay(time);
  scene.add(flies,stars,bulbs,aurora.mesh,beams.group,moon.group,milkyWay.mesh);
  const u=atmosphere.sky.material.uniforms;
  const updateMeteor=shootingStars(scene);
  const meteor=scene.getObjectByName('wishing-meteor');
  const water=scene.getObjectByName('creek-surface').material.userData.currentUniforms;
  const channels=[];
  function channel(values,write){
    // Dawn inherits a little peach from dusk unless a channel has an authored dawn value.
    if(values.length===3)values.push(THREE.MathUtils.lerp(values[0],values[1],.26));
    channels.push({values,write});
  }
  function color(target,...hex){
    const colors=hex.map(h=>new THREE.Color(h));
    for(const key of ['r','g','b']) channel(colors.map(c=>c[key]),v=>target[key]=v);
  }
  color(sun.color,'#ffe5c4','#ff8b54','#9ec2f8');
  color(hemi.color,'#edf4fa','#9b70a8','#22355c');
  color(hemi.groundColor,'#60734c','#454f38','#14201c');
  color(fill.color,'#d3e3ed','#a5728a','#233854');
  const fairFog=scene.fog.clone(), snowDay=new THREE.Color('#dce8ef'), snowNight=new THREE.Color('#8498ae');
  const mist=new THREE.Color();
  color(fairFog.color,'#d8e4e7','#a86c6a','#0b121e');
  color(water.uGlintColor.value,'#fffbed','#ff9944','#38bdf8');
  color(beams.uniforms.uColor.value,'#ffe4ac','#ffac67','#ffeac1','#ffd086');
  channel([1.18,3.35,0,2.35],v=>beams.uniforms.uScatter.value=v);
  let fillBase=0, wishGlow=0;
  channel([0,.63,1],v=>cabin.setWarmth(v));
  if(estateFeatures) channel([0,.55,1],v=>estateFeatures.setWarmth(v));
  channel([3.65,2.95,.88],v=>sun.intensity=v);
  channel([.92,.85,.58],v=>hemi.intensity=v);
  channel([.28,.35,.34],v=>fillBase=v);
  channel([.003,.004,.0035],v=>fairFog.density=v);
  channel([.14,.09,.042],v=>scene.environmentIntensity=v);
  channel([-11,-14,8],v=>sun.position.x=v);
  channel([10.5,2.1,12,4.6],v=>sun.position.y=v);
  channel([7.5,4.8,-6],v=>sun.position.z=v);
  channel([2.5,5.2,.1],v=>u.rayleigh.value=v);
  channel([1.8,3.8,1],v=>u.turbidity.value=v);
  channel([0,1,0],v=>u.dusk.value=v);
  channel([0,0,1],v=>u.night.value=v);
  for(const [obj,levels] of [[flies,[0,.25,.95]],[stars,[0,0,1]],[bulbs,[0,.08,1]]]){
    channel(levels,v=>{obj.material.uniforms.opacity.value=v;obj.visible=v>=.002;});
  }
  channel([0,0,.95],v=>{
    aurora.uniforms.uOpacity.value=v;
    aurora.mesh.visible=v>=.002;
  });
  channel([0,.35,1.0],v=>{
    moon.uniforms.uOpacity.value=v;
    moon.group.visible=v>=.002;
  });
  channel([0,.05,.95],v=>{
    milkyWay.uniforms.uOpacity.value=v;
    milkyWay.mesh.visible=v>=.002;
  });
  channel([.22,.065,0,.24],v=>{
    beams.uniforms.uOpacity.value=v;
    beams.group.visible=v>=.002;
  });
  const panel=document.querySelector('#atmosphere-switcher');
  let weights=[1,0,0,0],from=weights.slice(),goal=0,start=0,duration=0;
  function setWishGlow(value){
    wishGlow=value;
    const glow=weights[2]*value;
    u.wishGlow.value=glow;
    fill.intensity=fillBase+.54*glow;
    aurora.uniforms.uOpacity.value=weights[2]*.95+.53*glow;
    stars.material.uniforms.opacity.value=weights[2]*(1+.24*value);
  }
  function apply(){
    for(const {values,write} of channels) write(values.reduce((s,v,i)=>s+v*weights[i],0));
    setWishGlow(wishGlow);
    water.uSunDirection.value.copy(sun.position).normalize();
    u.sunPosition.value.copy(water.uSunDirection.value).multiplyScalar(450000);
    for(const cloud of atmosphere.clouds.children){
      const cu=cloud.material.uniforms;
      cu.uSun.value.copy(sun.position).divide(cloud.scale).normalize();
    }
    // Leave room for the enlarged crown between the sun and its shadow receivers.
    sun.position.normalize().multiplyScalar(38);
    renderer.shadowMap.needsUpdate=true;
  }
  // Compose from the current sky on every change, including dusk during a thaw.
  function setFog(pack,viewDistance=0) {
    mist.lerpColors(snowDay,snowNight,weights[1]*.40+weights[2]);
    scene.fog.color.copy(fairFog.color).lerp(mist,.82*pack);
    // Limit optical depth at the subject so fitting the entire island on a
    // narrow display doesn't erase the cabin in a wall of fog.
    const stormDensity=Math.max(fairFog.density,Math.min(fairFog.density+.013,.70/Math.max(1,viewDistance)));
    scene.fog.density=THREE.MathUtils.lerp(fairFog.density,stormDensity,pack);
  }
  apply(); setFog(0);
  function selectAtmosphere(event){
    const button=event.target.closest('[data-atmo]');
    if(!button)return;
    const next=['day','sunset','night','dawn'].indexOf(button.dataset.atmo);
    if(next<0)return;
    from=weights.slice();goal=next;
    document.querySelector('#garden-ui').dataset.atmosphere=button.dataset.atmo;
    start=performance.now();duration=matchMedia('(prefers-reduced-motion: reduce)').matches?300:1800;
    for(const b of panel.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===button));
  }
  panel.addEventListener('click',selectAtmosphere);
  return {
    get warmth(){return weights[1]*.55+weights[2]+weights[3]*.14;},
    get nightWeight(){return weights[2];},
    setWishGlow,
    aurora,
    beams,
    update(now,delta,reducedMotion,snowCover=0,viewDistance=0){
      updateMeteor(delta,u.night.value,reducedMotion);
      if(duration){
        const t=Math.min(1,(now-start)/duration),ease=t*t*(3-2*t);
        weights=from.map((v,i)=>THREE.MathUtils.lerp(v,Number(i===goal),ease));apply();
        if(t===1)duration=0;
      }
      setFog(snowCover,viewDistance);
    },
    dispose(){
      panel.removeEventListener('click',selectAtmosphere);setWishGlow(0);
      for(const root of [flies,stars,bulbs,aurora.mesh,beams.group,moon.group,milkyWay.mesh,meteor]){
        root.removeFromParent();
        root.traverse(obj=>{obj.geometry?.dispose();obj.material?.dispose();});
      }
    }
  };
}
