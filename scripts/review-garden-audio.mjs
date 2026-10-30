import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

const base=process.env.REVIEW_URL||'http://127.0.0.1:5173/';
const out=process.env.AUDIO_QA_DIR||'work/qa/garden-audio';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const errors=[],checks=[],observations={};let failure;
await context.addInitScript(()=>{
  window.__audioContexts=[];window.__audioAnalysers=[];
  const OriginalContext=window.AudioContext;
  if(OriginalContext)window.AudioContext=class extends OriginalContext{constructor(...args){super(...args);window.__audioContexts.push(this);}};
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination,...args){
    if(destination===this.context.destination){
      const analyser=this.context.createAnalyser();analyser.fftSize=2048;
      window.__audioAnalysers.push(analyser);connect.call(this,analyser);connect.call(analyser,destination);return destination;
    }
    return connect.call(this,destination,...args);
  };
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
const wav=(()=>{
  const rate=22050,samples=rate*2,buffer=Buffer.alloc(44+samples*2);
  buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++)buffer.writeInt16LE(Math.round(Math.sin(2*Math.PI*220*i/rate)*800),44+i*2);return buffer;
})();
const fixture={name:'仅供检查的低音量音频.wav',mimeType:'audio/wav',buffer:wav};
const expectedHash=createHash('sha256').update(wav).digest('hex');
async function check(name,run){const result=await run();checks.push(name);if(result!==undefined)observations[name]=result;console.log('PASS',name);}
async function initialize(){
  await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await page.locator('#enter-direct').click();
  // Allows this module's tests to run before the owning engine integration lands.
  if(!await page.locator('#sound-dialog').count())await page.evaluate(async()=>{window.__audioTestAPI=(await import('/src/garden-audio.js')).prepareGardenAudio();await window.__audioTestAPI.ready;});
  await page.waitForFunction(()=>document.querySelector('#sound-dialog')?.getAttribute('aria-busy')!=='true');
}
async function open(){await page.locator('#help-toggle').click();await page.locator('#garden-sound').click();await page.locator('#sound-dialog').waitFor({state:'visible'});}
async function message(text){await page.waitForFunction(text=>document.querySelector('#sound-feedback').textContent.includes(text),text);await page.waitForFunction(()=>document.querySelector('#sound-dialog').getAttribute('aria-busy')!=='true');}
async function stored(){return page.evaluate(async()=>{
  const row=await new Promise((resolve,reject)=>{const request=indexedDB.open('private-universe-audio',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,transaction=db.transaction('tracks','readonly');let result;const get=transaction.objectStore('tracks').get('personal');get.onsuccess=()=>{result=get.result;};transaction.oncomplete=()=>{db.close();resolve(result);};transaction.onabort=()=>{db.close();reject(transaction.error);};};});
  if(!row)return null;return {name:row.name,bytes:row.blob.size,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await row.blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('')};
});}
async function sampleRMS(){return page.evaluate(()=>{const analyser=window.__audioAnalysers.at(-1);if(!analyser)return null;const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,value)=>sum+value*value,0)/data.length);});}
async function advanceAudioClock(seconds=.25){
  const initial=await page.evaluate(()=>window.__audioContexts.at(-1)?.currentTime??null);assert.notEqual(initial,null,'No actual playback context was created');
  // Device startup may report "running" before its first render quantum. Wait
  // for the audio clock, including the gain fade and analyser window, rather
  // than treating a fixed wall-clock delay as proof of audible output.
  await page.waitForFunction(target=>{const context=window.__audioContexts.at(-1);return context?.state==='running'&&context.currentTime>=target;},initial+seconds,{timeout:10000});
}
try{
  await initialize();
  await check('Initial visit stays silent and offers an accessible sound panel',async()=>{
    assert.equal(await page.evaluate(()=>window.__audioContexts.length),0);await open();
    assert.equal(await page.locator('#nature-play').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#music-play').isDisabled(),true);
    assert.equal(await page.locator('#sound-dialog').getAttribute('aria-labelledby'),'sound-title');
    await page.screenshot({path:`${out}/sound-desktop.png`});
  });
  await check('A user gesture starts low-level natural sound through the actual audio graph',async()=>{
    await page.locator('#nature-play').click();await page.waitForFunction(()=>document.querySelector('#sound-dialog').dataset.naturePlaying==='true');
    await advanceAudioClock();assert.equal(await page.locator('#sound-dialog').getAttribute('data-audio-state'),'running');
    const rms=await sampleRMS();assert.ok(rms>0&&rms<.12,`Unexpected natural sound level: ${rms}`);return {rms,audioClockAtSample:await page.evaluate(()=>window.__audioContexts.at(-1).currentTime)};
  });
  await check('Independent volume controls and global mute change actual output',async()=>{
    await page.locator('#nature-volume').evaluate(input=>{input.value='61';input.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.locator('#nature-volume-label').textContent(),'61%');
    await page.locator('#music-volume').evaluate(input=>{input.value='27';input.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.locator('#music-volume-label').textContent(),'27%');
    await page.locator('#sound-mute').click();await advanceAudioClock();assert.equal(await sampleRMS(),0);
    await page.locator('#sound-mute').click();await advanceAudioClock();assert.ok(await sampleRMS()>0);
  });
  await check('Closing the sound panel and reading a letter keep chosen sound playing',async()=>{
    await page.locator('.sound-close').click();await page.locator('#sound-dialog').waitFor({state:'hidden'});
    await page.locator('#help-toggle').click();await page.locator('[data-place="mailbox"]').click();await page.locator('#letter-dialog').waitFor({state:'visible'});
    assert.equal(await page.locator('#sound-dialog').getAttribute('data-nature-playing'),'true');assert.ok(await sampleRMS()>0);
    await page.keyboard.press('Escape');await page.locator('#letter-dialog').waitFor({state:'hidden'});await open();
  });
  await check('Selecting music validates decoding and commits the original bytes without autoplay',async()=>{
    await page.locator('#music-file').setInputFiles(fixture);await message('音乐已保存在');
    const record=await stored();assert.equal(record.sha256,expectedHash);assert.equal(record.bytes,wav.length);
    assert.equal(await page.locator('#sound-dialog').getAttribute('data-music-playing'),'false');assert.equal(await page.locator('#music-play').isEnabled(),true);
    assert.equal(await page.locator('#music-name').textContent(),fixture.name);
  });
  await check('Personal music plays and pauses from explicit controls',async()=>{
    await page.locator('#music-play').click();await page.waitForFunction(()=>document.querySelector('#sound-dialog').dataset.musicPlaying==='true');
    await page.locator('#music-play').click();await page.waitForFunction(()=>document.querySelector('#sound-dialog').dataset.musicPlaying==='false');
    await page.locator('#nature-play').click();await page.waitForFunction(()=>document.querySelector('#sound-dialog').dataset.naturePlaying==='false');
  });
  await check('Reload preserves music and levels but creates no playback context',async()=>{
    await initialize();await open();await page.waitForFunction(()=>document.querySelector('#music-name').textContent.includes('仅供检查'));
    assert.equal(await page.evaluate(()=>window.__audioContexts.length),0);assert.equal(await page.locator('#sound-dialog').getAttribute('data-music-playing'),'false');assert.equal(await page.locator('#sound-dialog').getAttribute('data-nature-playing'),'false');
    assert.equal(await page.locator('#nature-volume').inputValue(),'61');assert.equal(await page.locator('#music-volume').inputValue(),'27');assert.equal((await stored()).sha256,expectedHash);
  });
  await check('Hiding the page cancels a pending playback unlock instead of starting hidden sound',async()=>{
    // A first gesture may construct an already-running AudioContext and skip
    // resume entirely. Exercise a genuine resume by pausing the real context
    // first, then hold only its returned promise for the cancellation check.
    await page.locator('#nature-play').click();await page.waitForFunction(()=>document.querySelector('#sound-dialog').dataset.naturePlaying==='true');
    await page.locator('#nature-play').click();await page.waitForFunction(()=>document.querySelector('#sound-dialog').dataset.audioState==='suspended');
    await page.evaluate(()=>{
      const resume=AudioContext.prototype.resume;window.__resumeBeforeAudioRace=resume;
      AudioContext.prototype.resume=function(){
        const operation=resume.call(this);
        return new Promise((resolve,reject)=>{window.__releasePendingAudioResume=()=>operation.then(resolve,reject);});
      };
    });
    try{
      await page.locator('#nature-play').click();
      await page.waitForFunction(()=>typeof window.__releasePendingAudioResume==='function');
      assert.equal(await page.locator('#nature-play').isDisabled(),true);
      await page.evaluate(()=>{
        Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
        window.__releasePendingAudioResume();
      });
      await page.waitForFunction(()=>document.querySelector('#sound-dialog').dataset.audioState==='suspended');
      assert.equal(await page.locator('#sound-dialog').getAttribute('data-nature-playing'),'false');
      assert.equal(await page.locator('#sound-dialog').getAttribute('data-music-playing'),'false');
      assert.equal(await page.locator('#nature-play').isEnabled(),true);
    }finally{
      await page.evaluate(()=>{
        AudioContext.prototype.resume=window.__resumeBeforeAudioRace;
        delete window.__resumeBeforeAudioRace;delete window.__releasePendingAudioResume;
        delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
      });
    }
  });
  await check('Unreadable audio is rejected while the previous saved song remains unchanged',async()=>{
    await page.locator('#music-file').setInputFiles({name:'损坏的检查音频.wav',mimeType:'audio/wav',buffer:Buffer.from('not audio')});await message('无法读取');assert.equal((await stored()).sha256,expectedHash);
    await page.locator('#music-file').setInputFiles({name:'不是音乐.txt',mimeType:'text/plain',buffer:Buffer.from('audio test')});await message('请选择 MP3');assert.equal((await stored()).sha256,expectedHash);
  });
  await check('Storage failure is explicit and never replaces the existing music',async()=>{
    await page.evaluate(()=>{window.__originalAudioPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Audio test quota','QuotaExceededError');};});
    await page.locator('#music-file').setInputFiles(fixture);await message('空间不足');
    await page.evaluate(()=>{IDBObjectStore.prototype.put=window.__originalAudioPut;delete window.__originalAudioPut;});assert.equal((await stored()).sha256,expectedHash);
  });
  await check('Page visibility changes pause sound rather than leaving hidden playback',async()=>{
    await page.locator('#nature-play').click();await page.waitForFunction(()=>document.querySelector('#sound-dialog').dataset.naturePlaying==='true');await page.locator('#music-play').click();await page.waitForFunction(()=>document.querySelector('#sound-dialog').dataset.musicPlaying==='true');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>document.querySelector('#sound-dialog').dataset.naturePlaying==='false'&&document.querySelector('#sound-dialog').dataset.musicPlaying==='false');
    await page.waitForFunction(()=>document.querySelector('#sound-dialog').dataset.audioState==='suspended');
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});return {visibilityEventSimulated:true};
  });
  await check('The 390px panel fits, closes and can remove persisted local music',async()=>{
    await page.setViewportSize({width:390,height:667});assert.ok(await page.locator('#sound-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
    await page.locator('#music-remove').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/sound-mobile.png`});
    page.once('dialog',dialog=>dialog.accept());await page.locator('#music-remove').click();await message('本机音乐已移除');assert.equal(await stored(),null);assert.equal(await page.locator('#music-play').isDisabled(),true);
    await page.locator('.sound-close').click();await page.locator('#sound-dialog').waitFor({state:'hidden'});
  });
  await check('All sound flows finish without unhandled browser errors',async()=>assert.deepEqual(errors,[]));
}catch(error){failure=error;console.error(error);}
finally{await fs.writeFile(`${out}/result.json`,JSON.stringify({url:base,isolatedBrowser:true,syntheticAudioFixture:true,hardwareListeningVerified:false,checks,observations,errors,failure:failure?.stack||null},null,2));await browser.close();}
if(failure)process.exitCode=1;
