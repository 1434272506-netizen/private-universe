import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {makeKoi} from '../src/natural/koi.js';

const out='work/qa/playful';await mkdir(out,{recursive:true});
const checks=[],errors=[],pageerrors=[],observations={};let browser,failure;
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
try{
 await check('Two koi remain submerged, above the real bed and finite over 180 seconds; pause and dispose are deterministic',()=>{
  const scene=new THREE.Scene(),impulses=[],koi=makeKoi(scene,{addImpulseWorld:(...args)=>impulses.push(args)});let minDepth=Infinity,minClearance=Infinity;
  for(let i=0;i<6000;i++){koi.update(.03);for(const f of koi.getState().fish){minDepth=Math.min(minDepth,f.depth);minClearance=Math.min(minClearance,f.clearance);assert.ok(f.position.every(Number.isFinite));assert.ok(f.depth>.04&&f.clearance>.04);}}
  const state=koi.getState();koi.update(.03,{covered:true});assert.deepEqual(koi.getState(),state);koi.update(.03,{reducedMotion:true});assert.deepEqual(koi.getState(),state);assert.equal(state.count,2);assert.ok(impulses.length>0);
  observations.koi={minDepth,minClearance,wakes:impulses.length};koi.dispose();koi.dispose();assert.equal(scene.children.length,0);
 });
 browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 await context.addInitScript(()=>{
  window.__playfulAudio=[];window.__playfulAnalysers=[];window.__playfulAudioPeak=0;
  const connect=AudioNode.prototype.connect,Original=window.AudioContext;
  // Record short one-shots on the native audio render thread. A 21ms main-thread
  // analyser window can miss the entire bubble while WebGL compiles its first frame.
  const code=`class PeakTap extends AudioWorkletProcessor{constructor(){super();this.peak=0;}process(inputs){let sum=0,n=0;for(const c of inputs[0]||[])for(const v of c){sum+=v*v;n++;}const rms=n?Math.sqrt(sum/n):0;if(rms>this.peak){this.peak=rms;this.port.postMessage(rms);}return true;}}registerProcessor('playful-peak-tap',PeakTap);`;
  window.AudioContext=class extends Original{
   constructor(...args){super(...args);window.__playfulAudio.push(this);this.__tapSources=[];const url=URL.createObjectURL(new Blob([code],{type:'application/javascript'}));
    this.__tapReady=this.audioWorklet.addModule(url).then(()=>{this.__tap=new AudioWorkletNode(this,'playful-peak-tap');this.__tap.port.onmessage=e=>window.__playfulAudioPeak=Math.max(window.__playfulAudioPeak,e.data);for(const source of this.__tapSources)connect.call(source,this.__tap);connect.call(this.__tap,this.destination);}).finally(()=>URL.revokeObjectURL(url));
   }
   async resume(){await this.__tapReady;return super.resume();}
  };
  AudioNode.prototype.connect=function(destination,...args){if(destination===this.context.destination){const analyser=this.context.createAnalyser();analyser.fftSize=1024;window.__playfulAnalysers.push(analyser);this.context.__tapSources?.push(this);if(this.context.__tap)connect.call(this,this.context.__tap);connect.call(this,analyser);connect.call(analyser,destination);return destination;}return connect.call(this,destination,...args);};
 });
 const page=await context.newPage();page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>pageerrors.push(e.message));
 await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__PU?.phase==='exploring',{timeout:30000});await page.locator('#invitation').waitFor({state:'hidden'});
 const shot=name=>page.screenshot({path:`${out}/${name}.png`,style:'#object-hint{visibility:hidden!important}'});
 async function aim(position,target,{local=true,fov=34}={}){await page.evaluate(({position,target,local,fov})=>{const p=window.__PU,c=p.cabin.group;p.frame('hero');p.scenicTour.stop();p.controls.minDistance=.1;p.controls.maxPolarAngle=2.5;p.camera.fov=fov;p.camera.updateProjectionMatrix();const a=p.camera.position.clone().set(...position),b=p.controls.target.clone().set(...target);p.camera.position.copy(local?c.localToWorld(a):a);p.controls.target.copy(local?c.localToWorld(b):b);p.controls.update();p.camera.updateMatrixWorld(true);},{position,target,local,fov});}
 async function clickToy(kind){const point=await page.evaluate(kind=>{const p=window.__PU,t=p.cabin.toys.targets.find(t=>t.userData.interaction===kind),v=t.getWorldPosition(p.camera.position.clone()).project(p.camera);return [(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2];},kind);await page.mouse.move(...point);await page.waitForFunction(kind=>document.querySelector('#app > canvas').dataset.hover===kind,kind);await page.mouse.click(...point);return point;}
 await check('Real pig click deforms only the merged plush, returns in .45s, emits three hearts and unlocks native audio',async()=>{
  await page.evaluate(()=>window.__PU.discover('cabin'));await page.waitForFunction(()=>!window.__PU.flying);await clickToy('piglet-pat');assert.ok(await page.evaluate(()=>window.__PU.cabin.toys.getState().pats)>0,'Piglet must also be reachable through the normal cabin window');
  const firstEnergy=await page.evaluate(async()=>{const data=new Float32Array(1024);let peak=0;for(let i=0;i<24;i++){await new Promise(r=>setTimeout(r,15));for(const a of window.__playfulAnalysers){a.getFloatTimeDomainData(data);peak=Math.max(peak,Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length));}}return peak;});
  await aim([1.27,1.35,1.25],[1.28,.99,.40]);assert.equal(await page.locator('#launch-fireworks').isVisible(),false);
  await clickToy('piglet-pat');
  const samples=await page.evaluate(async()=>{const values=[],buffer=new Float32Array(1024);for(let i=0;i<600;i++){await new Promise(requestAnimationFrame);const state=window.__PU.cabin.toys.getState();let energy=0;for(const analyser of window.__playfulAnalysers){analyser.getFloatTimeDomainData(buffer);energy=Math.max(energy,Math.sqrt(buffer.reduce((sum,v)=>sum+v*v,0)/buffer.length));}values.push({...state,energy});if(state.age>.6)break;}return values;});
  assert.ok(samples.some(s=>s.stretch[1]<.95));assert.ok(samples.some(s=>s.stretch[1]>1.05));assert.ok(samples.some(s=>s.hearts===3));assert.deepEqual(samples.at(-1).stretch,[1,1,1]);assert.ok(samples[0].maskedVertices>500);
  await clickToy('piglet-pat');await page.waitForFunction(()=>window.__PU.cabin.toys.getState().hearts===3);await shot('piglet-pat-hearts');
  await page.waitForFunction(()=>window.__PU.cabin.toys.getState().age>1.8);assert.equal(await page.evaluate(()=>window.__PU.cabin.toys.getState().hearts),0);
  assert.equal(await page.evaluate(()=>window.__playfulAudio.length),1);observations.piglet={minimumY:Math.min(...samples.map(s=>s.stretch[1])),maximumY:Math.max(...samples.map(s=>s.stretch[1])),vertices:samples[0].maskedVertices,audioRms:Math.max(firstEnergy,...samples.map(s=>s.energy),await page.evaluate(()=>window.__playfulAudioPeak)),audio:await page.evaluate(()=>({state:window.__PU.gardenAudio.getState(),analysers:window.__playfulAnalysers.length,time:window.__playfulAudio[0].currentTime,renderThreadPeak:window.__playfulAudioPeak}))};assert.ok(observations.piglet.audioRms>.0001,'Bubble sound must reach the audio destination');
 });
 await check('Actual radio click starts offline original music, turns its knob and emits waves; second click pauses the shared player',async()=>{
  await aim([.9,1.55,.05],[1.44,1.37,-1.2]);await clickToy('cabin-radio');await page.waitForFunction(()=>window.__PU.gardenAudio.musicPlaying);
  await page.waitForFunction(()=>window.__PU.cabin.toys.getState().knobAngle>1);
  observations.radio=await page.evaluate(()=>({audio:window.__PU.gardenAudio.getState(),knob:window.__PU.cabin.toys.getState().knobAngle,contexts:window.__playfulAudio.length}));
  assert.match(observations.radio.audio.track.name,/木屋小圆舞曲/);assert.equal(observations.radio.contexts,1);await shot('radio-playing');await clickToy('cabin-radio');await page.waitForFunction(()=>!window.__PU.gardenAudio.musicPlaying);
 });
 await check('Actual gilt journal click opens one accessible note, freezes ecology and closes without changing the camera',async()=>{
  await aim([.65,1.65,-.35],[.50,1.06,-.96]);const camera=await page.evaluate(()=>window.__PU.camera.position.toArray());await clickToy('cabin-journal');await page.locator('#cabin-journal-dialog[open]').waitFor();
  assert.match(await page.locator('#cabin-journal-dialog').innerText(),/和小猪一起守家，等某人回来/);assert.equal(await page.locator('dialog[open]').count(),1);await shot('journal-note');
  const before=await page.evaluate(()=>({koi:window.__PU.koi.getState(),butterflies:window.__PU.butterflies.getState()}));await page.waitForTimeout(350);assert.deepEqual(await page.evaluate(()=>({koi:window.__PU.koi.getState(),butterflies:window.__PU.butterflies.getState()})),before);
  await page.keyboard.press('Escape');await page.locator('#cabin-journal-dialog').waitFor({state:'hidden'});const returned=await page.evaluate(()=>window.__PU.camera.position.toArray());assert.ok(returned.every((v,i)=>Math.abs(v-camera[i])<1e-10));
 });
 await check('Two green/purple butterflies follow the porch/flower-field spline and flap at sin(t*14); koi are visible below the bridge',async()=>{
  const state=await page.evaluate(()=>window.__PU.butterflies.getState());assert.deepEqual(state.colours,['#42b883','#a892b8']);assert.ok(state.route&&state.states.every(s=>s.state==='flying'));
  const b=state.states[0].position;await aim([b[0]+.65,b[1]+.30,b[2]+1.1],b,{local:false});await shot('butterfly-wings');
  await page.waitForFunction(()=>{const fish=window.__PU.koi.getState().fish;return Math.abs(fish[0].position[2]-fish[1].position[2])<.45;});
  await aim([3.5,2.7,4.2],[1.55,.12,1.1],{local:false,fov:42});await shot('bridge-koi');observations.butterflies=state;
 });
 await check('Night button launches a golden ascent and 1536 pooled green/purple stars with a heart, blocks duplicate shows and fully releases drawing',async()=>{
  await page.evaluate(()=>{const p=window.__PU;p.camera.fov=34;p.camera.updateProjectionMatrix();p.frame('hero');p.setAtmosphere('night');});await page.waitForFunction(()=>window.__PU.cabin.group.getObjectByName('porch-warm-light').intensity===28);
  await page.locator('#launch-fireworks').click();await page.waitForFunction(()=>window.__PU.fireworks.getState().phase==='rising');await shot('firework-golden-ascent');
  assert.equal(await page.evaluate(()=>window.__PU.launchFireworks()),false);
  await page.waitForFunction(()=>window.__PU.fireworks.getState().phase==='burst'&&window.__PU.fireworks.getState().age>1.9);await shot('firework-heart-peak');
  observations.fireworks=await page.evaluate(()=>{const p=window.__PU;let lights=0;p.scene.traverse(o=>{if(o.isPointLight)lights++;});return {...p.fireworks.getState(),lights,additive:p.fireworks.group.getObjectByName('couple-firework-stardust').material.blending};});
  assert.equal(observations.fireworks.particleCount,1536);assert.equal(observations.fireworks.lights,4);assert.equal(observations.fireworks.additive,THREE.AdditiveBlending);
  await page.waitForFunction(()=>window.__PU.fireworks.getState().phase==='idle');assert.equal(await page.evaluate(()=>window.__PU.fireworks.group.visible),false);
 });
 await check('A real empty-night-sky click launches; daylight and open panels cannot accidentally launch',async()=>{
  await aim([2,3,8],[2,12,-8],{local:false});const before=await page.evaluate(()=>window.__PU.fireworks.getState().launches);await page.mouse.click(640,290);await page.waitForFunction(before=>window.__PU.fireworks.getState().launches===before+1,before);
  await page.evaluate(()=>window.__PU.setAtmosphere('day'));await page.waitForFunction(()=>!window.__PU.fireworks.group.visible);assert.equal(await page.locator('#launch-fireworks').isVisible(),false);
  await page.locator('#add-content').click();assert.equal(await page.evaluate(()=>window.__PU.launchFireworks()),false);await page.locator('#close-editor').click();
 });
 await check('Reduced motion freezes butterflies/koi and pig deformation; explicit fireworks become one quiet static heart',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);const read=()=>page.evaluate(()=>({koi:window.__PU.koi.getState(),butterflies:window.__PU.butterflies.getState()})),a=await read();await page.waitForTimeout(180);assert.deepEqual(await read(),a);
  await aim([1.27,1.35,1.25],[1.28,.99,.40]);await clickToy('piglet-pat');await page.evaluate(()=>new Promise(requestAnimationFrame));assert.deepEqual(await page.evaluate(()=>window.__PU.cabin.toys.getState().stretch),[1,1,1]);assert.equal(await page.evaluate(()=>window.__PU.cabin.toys.getState().hearts),0);
  await page.evaluate(()=>{window.__PU.frame('hero');window.__PU.setAtmosphere('night');});await page.locator('#launch-fireworks').waitFor({state:'visible'});await page.locator('#launch-fireworks').click();assert.equal(await page.evaluate(()=>window.__PU.fireworks.getState().phase),'still-heart');await shot('reduced-motion-heart');
 });
 await check('390x844 night button stays clear of masthead, top actions, tour, return button and atmosphere controls',async()=>{
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__PU.frame('hero'));await page.locator('#launch-fireworks').waitFor({state:'visible'});
  const overlaps=await page.evaluate(()=>{const a=document.querySelector('#launch-fireworks').getBoundingClientRect();return ['.masthead','.top-actions','#tour-status','#return-view','#atmosphere-switcher'].filter(s=>{const el=document.querySelector(s);if(!el||el.hidden||!el.getClientRects().length)return false;const b=el.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;});});assert.deepEqual(overlaps,[]);await shot('mobile-night-hud');
 });
 assert.deepEqual(errors,[]);assert.deepEqual(pageerrors,[]);await context.close();
}catch(error){failure=error;console.error(error);}
finally{await browser?.close();await writeFile(`${out}/result.json`,JSON.stringify({checks,consoleErrors:errors,pageerrors,observations,pass:!failure,error:failure?.stack},null,2));}
if(failure)process.exitCode=1;
