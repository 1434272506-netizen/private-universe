import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright-core';
import {makeRomanticInteractions,triggerWish} from '../src/natural/romantic-interactions.js';

// Check the actual relief at every step, including both tracks on the bend.
const scene=new THREE.Scene(),island=new THREE.Group(),camera=new THREE.PerspectiveCamera(40,1.5,.1,500);
scene.add(island,camera);
const base=new THREE.PlaneGeometry(12,9,46,36).rotateX(-Math.PI/2);
const soil=new THREE.Mesh(base,new THREE.MeshStandardMaterial());soil.name='meadow-and-soil';island.add(soil);
let winter=.3, night=false, glow=0;
const romantic=makeRomanticInteractions(scene,island,{camera,isNight:()=>night,
  seasons:{getWinterWeight:()=>winter},setWishGlow:v=>glow=v});
romantic.update(.01);assert.equal(romantic.snowman.visible,false);
winter=1;romantic.update(.01);
assert.equal(soil.morphTargetInfluences[0],1);assert.equal(romantic.footprints.sites.length,16);
const pos=soil.geometry.attributes.position,offset=soil.geometry.morphAttributes.position[0];
for(const foot of romantic.footprints.sites){
  let deepest=0;
  for(let i=0;i<pos.count;i++)if(Math.hypot(pos.getX(i)-foot.x,pos.getZ(i)-foot.z)<.08)deepest=Math.min(deepest,offset.getY(i));
  assert.ok(deepest<-.042,'Each shoe leaves a physical depression');
}
assert.ok(romantic.activate('snowman'));romantic.update(.25);
assert.ok(Math.abs(romantic.snowman.rotation.z-Math.sin(3)*.18*Math.exp(-.75))<1e-9);
const root=island.getObjectByName('romantic-interactions');
const visibleHearts=()=>root.children.filter(m=>m.name==='rising-pink-heart'&&m.visible).length;
assert.equal(visibleHearts(),3);romantic.update(2);
assert.ok(romantic.activate('hot-cocoa'));const rest=romantic.cups[1].position.x;
romantic.update(.16);assert.ok(romantic.cups[1].position.x<rest-.025);
romantic.update(.24);assert.equal(visibleHearts(),2);romantic.update(1.4);assert.equal(romantic.cups[1].position.x,rest);
assert.equal(triggerWish(camera),false);night=true;assert.ok(triggerWish(camera));assert.equal(triggerWish(camera),false);
const visible=new Set();let peak=0;
for(let i=0;i<60;i++){
  romantic.update(.05);peak=Math.max(peak,glow);
  for(const star of romantic.shower.children)if(star.visible)visible.add(star);
}
assert.ok(peak>.9 && visible.size>=3 && visible.size<=5);assert.equal(glow,0);
const owned=new Map();
for(const group of [root,romantic.shower,soil])group.traverse(o=>{
  for(const resource of [o.geometry,o.material])if(resource && resource!==soil.material && !owned.has(resource)){
    owned.set(resource,0);resource.addEventListener('dispose',()=>owned.set(resource,owned.get(resource)+1));
  }
});
romantic.dispose();romantic.dispose();assert.equal(triggerWish(camera),false);assert.equal(soil.geometry,base);
assert.ok([...owned.values()].every(n=>n===1));assert.equal(root.parent,null);
base.dispose();soil.material.dispose();
console.log('PASS sixteen pressed footprints, seasonal picking, three/two hearts, mug contact, wish envelope and one-time disposal');

const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
  const page=await browser.newPage({viewport:{width:1100,height:780},reducedMotion:'reduce'});
  const errors=[],remote=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.protocol.startsWith('http')&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){remote.push(url.origin);return route.abort();}
    return route.continue();
  });
  await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5173/');
  await page.waitForFunction(()=>window.__PU?.phase==='exploring',{timeout:30000});
  await page.locator('#invitation').waitFor({state:'hidden'});
  const mix=await page.evaluate(async()=>{
    const {makeNatureSoundscape}=await import('/src/natural/nature-soundscape.js');
    const render=async({season='spring',night=0,storm=false,yaw=0,muted=false,site=[13.5,2,-1.5]}={})=>{
      const ctx=new OfflineAudioContext(2,48000,32000), camera=window.__PU.camera.clone();
      camera.position.set(...site);camera.rotation.set(0,yaw,0);
      const rng=Math.random;let seed=94,graph;
      try{
        // Identical noise and impulses isolate the change made by turning the listener.
        Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
        graph=makeNatureSoundscape(ctx,{camera,nightWeight:()=>night});
        graph.update(camera.position,season,storm);
        if(!muted)graph.toggle();
      }finally{Math.random=rng;}
      const samples=await ctx.startRendering();
      const left=samples.getChannelData(0),right=samples.getChannelData(1);
      let l=0,r=0,treble=0;
      for(let i=12001;i<left.length;i++){
        l+=left[i]**2;r+=right[i]**2;treble+=(left[i]-left[i-1])**2+(right[i]-right[i-1])**2;
      }
      graph.dispose();graph.dispose();
      return [l,r,treble].map(n=>Math.sqrt(n/(left.length-12001)));
    };
    return {front:await render(),back:await render({yaw:Math.PI}),silent:await render({muted:true}),
      snow:await render({season:'winter',storm:true}),summer:await render({season:'summer'}),
      summerNight:await render({season:'summer',night:1}),creek:await render({site:[0,2,0]})};
  });
  assert.deepEqual(mix.silent,[0,0,0]);assert.ok(mix.front[0]>.001);
  assert.ok(Math.abs(mix.front[0]-mix.back[1])<.0001 && Math.abs(mix.front[1]-mix.back[0])<.0001);
  assert.ok(mix.front[1]>mix.front[0]*1.2);
  assert.ok(mix.snow[0]+mix.snow[1]>(mix.front[0]+mix.front[1])*1.15,JSON.stringify(mix));
  assert.ok(mix.summerNight[2]>mix.summer[2]*1.04,JSON.stringify(mix));assert.ok(mix.creek[0]>mix.front[0]);
  console.log('PASS native offline PCM, opposite stereo channels on rotation, near-creek mix, summer night, winter storm and silent output');

  const speaker=page.locator('#garden-speaker');
  await speaker.click();await page.waitForFunction(()=>window.__PU.gardenAudio.getState().naturePlaying);
  await speaker.click();assert.equal(await page.locator('#sound-mute').getAttribute('aria-pressed'),'true');
  await speaker.click();assert.equal(await speaker.getAttribute('aria-pressed'),'true');
  async function clickPart(name,localY) {
    const xy=await page.evaluate(([name,y])=>{
      const p=window.__PU,obj=p.scene.getObjectByName(name);
      p.camera.updateWorldMatrix(true,false);
      const v=obj.localToWorld(p.camera.position.clone().set(0,y,0)).project(p.camera);
      return [(1+v.x)*innerWidth/2,(1-v.y)*innerHeight/2];
    },[name,localY]);
    await page.mouse.click(...xy);
  }
  await page.locator('[data-season="winter"]').click();
  await page.waitForFunction(()=>window.__PU.romantic.snowman.visible);
  await page.locator('#help-toggle').click();await page.locator('[data-place="snow-yard"]').click();
  await clickPart('cabin-snowman',.98);
  assert.match(await page.locator('#announcement').textContent(),/三颗粉色的心/);
  await page.evaluate(()=>window.__PU.frame('campfire'));
  for(const name of ['blush-pink-mug','warm-blue-mug']){
    await page.evaluate(()=>document.querySelector('#explore-hint').classList.remove('is-visible'));
    await clickPart(name,.13);
    await page.locator('#explore-hint.is-visible').waitFor();
    assert.equal(await page.locator('#explore-hint').textContent(),'热可可碰一杯，冬天很暖。');
    await page.waitForFunction(()=>window.__PU.scene.getObjectByName('romantic-interactions').children.some(m=>m.name==='rising-pink-heart'&&m.visible));
    await page.waitForFunction(()=>!window.__PU.scene.getObjectByName('romantic-interactions').children.some(m=>m.name==='rising-pink-heart'&&m.visible));
  }
  await page.locator('[data-atmo="dawn"]').click();
  await page.waitForFunction(()=>window.__PU.scene.getObjectByName('canopy-light-veils').material.uniforms.uScatter.value>2.3);
  await page.locator('[data-atmo="night"]').click();
  await page.waitForFunction(()=>window.__PU.scene.getObjectByName('spring-sky').material.uniforms.night.value===1);
  await page.evaluate(()=>window.__PU.frame('sky'));
  await page.mouse.click(540,210);
  await page.waitForFunction(()=>window.__PU.romantic.shower.visible);
  assert.equal(await page.locator('#explore-hint').textContent(),'心愿已悄悄收下。');
  await page.waitForFunction(()=>!window.__PU.romantic.shower.visible);
  assert.equal(await page.evaluate(()=>window.__PU.scene.getObjectByName('spring-sky').material.uniforms.wishGlow.value),0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  // Sample a real ambient meteor on its rendered frame. A round trip to the
  // test process between projection and hover can miss the moving trail.
  await page.evaluate(()=>{
    const p=window.__PU;p.frame('bench');p.camera.position.set(4,13,3);
    p.camera.fov=76;p.camera.updateProjectionMatrix();p.controls.maxPolarAngle=Math.PI;
    p.controls.target.set(-5.5,17.8,-1.2);p.controls.update();
  });
  await page.waitForFunction(()=>{
    const p=window.__PU,meteor=p.scene.getObjectByName('wishing-meteor'),canvas=p.renderer.domElement;
    if(!meteor.visible||meteor.material.uniforms.intensity.value<.2)return false;
    const v=meteor.localToWorld(p.camera.position.clone().set(-1.2,0,0)).project(p.camera);
    const x=(1+v.x)*innerWidth/2,y=(1-v.y)*innerHeight/2;
    if(v.z>1||document.elementFromPoint(x,y)!==canvas)return false;
    canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:y,pointerType:'mouse'}));
    return p.romantic.shower.visible;
  },null,{timeout:150000});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{const p=window.__PU;p.camera.fov=34;p.camera.updateProjectionMatrix();p.frame('campfire');});
  assert.ok(await page.evaluate(()=>{
    const p=window.__PU;
    return p.romantic.cups.every(cup=>{
      const v=cup.localToWorld(p.camera.position.clone().set(0,.13,0)).project(p.camera);
      return document.elementFromPoint((1+v.x)*innerWidth/2,(1-v.y)*innerHeight/2)===p.renderer.domElement;
    });
  }),'Both cups remain touchable in portrait');
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
  console.log('PASS actual snowman, both cup picks, coordinated mute, dawn, sky tap and ambient meteor hover with external traffic blocked');
}finally{await browser.close();}
