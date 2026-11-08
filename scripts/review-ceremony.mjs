import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:true},
  define:{'import.meta.env.VITE_OPENING_PASSPHRASE':JSON.stringify('0520')}});
await server.listen();
const testUrl='http://127.0.0.1:'+server.httpServer.address().port+'/';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const checks=[],errors=[];let failure;
const out='work/qa/ceremony';await fs.mkdir(out,{recursive:true});
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
async function open(reducedMotion='no-preference'){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion});
  await context.addInitScript(()=>{
    window.audioRamps=[];window.audioContexts=[];
    const Original=window.AudioContext;
    window.AudioContext=class extends Original{constructor(...args){super(...args);window.audioContexts.push(this);}};
    const ramp=AudioParam.prototype.linearRampToValueAtTime;
    AudioParam.prototype.linearRampToValueAtTime=function(value,time){window.audioRamps.push({value,time,now:window.audioContexts.at(-1)?.currentTime});return ramp.call(this,value,time);};
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(testUrl,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await page.evaluate(()=>window.__PU.gardenAudio.ready);
  return {context,page};
}
async function unlock(page,value='0520'){
  await page.locator('#wax-seal').click();await page.locator('#passphrase-input').fill(value);
  await page.evaluate(()=>{
    document.querySelector('#passphrase-form').addEventListener('submit',()=>{
      const start=window.__PU.sceneTime;window.ceremonySamples=[];window.ceremonyLastStep=0;
      let previous=window.__PU.camera.position.clone();
      const capture=()=>{
        const p=window.__PU,t=p.sceneTime-start;
        if(t>8.8)window.ceremonyLastStep=Math.max(window.ceremonyLastStep,previous.distanceTo(p.camera.position));
        previous.copy(p.camera.position);
        if(t>=[3,6,9][window.ceremonySamples.length])window.ceremonySamples.push({time:t,position:p.camera.position.toArray(),target:p.controls.target.toArray(),phase:p.phase});
        if(window.ceremonySamples.length<3&&p.phase==='intro')requestAnimationFrame(capture);
      };requestAnimationFrame(capture);
    },{once:true});
  });
  await page.locator('#enter').click();
}
async function settle(page){await page.waitForFunction(()=>window.__PU.phase==='exploring'&&!window.__PU.flying,null,{timeout:60000});}
async function replay(page){await page.locator('#help-toggle').click();await page.locator('#replay').click();await page.locator('#invitation').waitFor({state:'visible'});}
try{
  const {context,page}=await open();
  await check('Loading creates no audio; seal reveals and focuses the passphrase field',async()=>{
    assert.equal(await page.evaluate(()=>window.audioContexts.length),0);
    assert.equal(await page.locator('#passphrase-form').isHidden(),true);
    await page.locator('#wax-seal').click();await page.locator('#passphrase-input').waitFor({state:'visible'});
    assert.equal(await page.locator('#passphrase-input').evaluate(el=>el===document.activeElement),true);
  });
  await check('Wrong and empty passphrases cannot bypass via submit or direct entry',async()=>{
    await page.locator('#passphrase-input').fill('wrong');await page.locator('#enter').click();
    assert.equal(await page.locator('#passphrase-input').getAttribute('aria-invalid'),'true');
    await page.locator('#passphrase-input').fill('');await page.locator('#enter-direct').click();
    assert.equal(await page.evaluate(()=>window.__PU.phase),'invitation');
    assert.equal(await page.evaluate(()=>window.audioContexts.length),0);
  });
  // Seed an actual decodable local song, then let the existing audio module load it.
  await page.evaluate(async()=>{
    const rate=22050,samples=rate*2,data=new ArrayBuffer(44+samples*2),view=new DataView(data);
    const str=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
    str(0,'RIFF');view.setUint32(4,data.byteLength-8,true);str(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,samples*2,true);
    for(let i=0;i<samples;i++)view.setInt16(44+i*2,Math.sin(i/rate*Math.PI*440)*800,true);
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('private-universe-audio',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction('tracks','readwrite');tx.objectStore('tracks').put({id:'personal',name:'ceremony-fixture.wav',blob:new Blob([data],{type:'audio/wav'})});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  });
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});await page.evaluate(()=>window.__PU.gardenAudio.ready);
  await page.screenshot({path:`${out}/sealed-letter.png`});
  await unlock(page);
  await check('Correct passphrase starts the full camera path and real nature/music fades',async()=>{
    assert.equal(await page.evaluate(()=>window.__PU.phase),'intro');
    await page.waitForFunction(()=>window.__PU.gardenAudio.getState().naturePlaying&&window.__PU.gardenAudio.getState().musicPlaying);
    const ramps=await page.evaluate(()=>window.audioRamps);
    assert.ok(ramps.some(r=>Math.abs(r.time-r.now-1)<.05&&r.value>0));
    assert.ok(ramps.some(r=>Math.abs(r.time-r.now-4)<.05&&r.value>0));
  });
  const samples=[];
  await check('Unskipped 9-second ceremony crosses the creek and ends at the actual ribbon view',async()=>{
    await settle(page);
    samples.push(...await page.evaluate(()=>window.ceremonySamples));
    await fs.writeFile(`${out}/camera-samples.json`,JSON.stringify(samples,null,2));
    assert.equal(samples.length,3);
    assert.ok(await page.evaluate(()=>window.ceremonyLastStep<.08),'The final camera handover must not snap against orbit limits');
    for(const [i,expected] of [[0,[-21,13,26]],[1,[-12,4.5,14]]])assert.ok(Math.hypot(...samples[i].position.map((v,axis)=>v-expected[axis]))<3,'Camera must cross its authored middle waypoints');
    assert.equal(await page.evaluate(()=>window.__PU.currentView),'tree');
    assert.equal(await page.evaluate(()=>window.__PU.controls.enabled),true);
    const state=await page.evaluate(()=>({target:window.__PU.controls.target.toArray(),anchor:window.__PU.anchors.ribbon.toArray(),petals:window.__PU.scene.getObjectByName('ceremony-guiding-petals')?.children.length}));
    assert.equal(state.petals,3);assert.ok(Math.hypot(...state.target.map((v,i)=>v-state.anchor[i]))<.3);
  });
  await page.screenshot({path:`${out}/ribbon-arrival.png`});
  await check('Petals release their scene objects after the one-shot guide',async()=>{
    await page.waitForFunction(()=>!window.__PU.scene.getObjectByName('ceremony-guiding-petals'),null,{timeout:30000});
  });
  await check('Replay resets seal, focus, errors and sound; fallback works and Escape skips smoothly',async()=>{
    await replay(page);assert.equal(await page.locator('#passphrase-form').isHidden(),true);
    assert.equal(await page.locator('#wax-seal').evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.evaluate(()=>window.__PU.gardenAudio.getState().naturePlaying),false);
    await unlock(page,'春天');await page.keyboard.press('Escape');await settle(page);
    assert.equal(await page.evaluate(()=>window.__PU.currentView),'tree');
  });
  await check('Skip button and ordinary keys terminate intro without duplicate guides',async()=>{
    await replay(page);await unlock(page);await page.locator('#skip-intro').click();await settle(page);
    await replay(page);await unlock(page);await page.keyboard.press('x');await settle(page);
    assert.equal(await page.evaluate(()=>window.__PU.scene.children.filter(o=>o.name==='ceremony-guiding-petals').length),1);
  });
  await check('Changing reduced motion during intro ends immediately and removes petals',async()=>{
    await replay(page);await unlock(page);await page.emulateMedia({reducedMotion:'reduce'});await settle(page);
    assert.equal(await page.evaluate(()=>!!window.__PU.scene.getObjectByName('ceremony-guiding-petals')),false);
  });
  await check('Leaving the page pauses ceremony sound',async()=>{
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await page.evaluate(()=>window.__PU.gardenAudio.getState().naturePlaying),false);
    assert.equal(await page.evaluate(()=>window.__PU.gardenAudio.getState().musicPlaying),false);
  });
  await context.close();
  const reduced=await open('reduce');
  await check('Reduced motion opens directly at the ribbon with no particles; mobile letter fits',async()=>{
    await reduced.page.setViewportSize({width:390,height:667});await reduced.page.locator('#wax-seal').click();
    assert.ok(await reduced.page.locator('.wax-envelope-card').evaluate(el=>el.scrollWidth<=el.clientWidth));
    await reduced.page.screenshot({path:`${out}/mobile-letter.png`});
    await reduced.page.locator('#passphrase-input').fill('0520');await reduced.page.locator('#enter').click();
    assert.equal(await reduced.page.evaluate(()=>window.__PU.phase),'exploring');
    assert.equal(await reduced.page.evaluate(()=>!!window.__PU.scene.getObjectByName('ceremony-guiding-petals')),false);
  });
  await reduced.context.close();assert.deepEqual(errors,[]);
  await fs.writeFile(`${out}/camera-samples.json`,JSON.stringify(samples,null,2));
}catch(error){failure=error;console.error(error);}
finally{await fs.writeFile(`${out}/result.json`,JSON.stringify({checks,errors,failure:failure?.stack||null},null,2));await browser.close();await server.close();}
if(failure)process.exitCode=1;
