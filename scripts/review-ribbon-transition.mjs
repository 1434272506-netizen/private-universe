import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173/';
const output=process.env.RIBBON_QA_DIR||'work/qa/ribbon-transition';
await fs.mkdir(output,{recursive:true});
const checks=[],observations={},errors=[];
let failure=null;
const browser=await chromium.launch({
  executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless:true
});
async function check(name,fn){
  const result=await fn();checks.push(name);
  if(result!==undefined)observations[name]=result;
  console.log('PASS',name);
}
async function newPage(reducedMotion='no-preference'){
  const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.addInitScript(()=>{
    window.__unhandledRibbonRejections=[];
    window.addEventListener('unhandledrejection',event=>window.__unhandledRibbonRejections.push(String(event.reason)));
    window.__captureNextRibbon=false;
    const attach=()=>{
      const dialog=document.querySelector('#memory-dialog');
      if(!dialog)return;
      window.__ribbonCloseTiming=[];
      dialog.addEventListener('cancel',()=>{window.__ribbonCloseStarted=performance.now();});
      dialog.addEventListener('close',()=>{
        if(window.__ribbonCloseStarted!=null){
          window.__ribbonCloseTiming.push(performance.now()-window.__ribbonCloseStarted);
          window.__ribbonCloseStarted=null;
        }
      });
      // Freeze the first rendered state of the actual opening effect for measurement.
      new MutationObserver(()=>{
        if(!window.__captureNextRibbon||!dialog.open||!window.__PU)return;
        const surface=dialog.querySelector('.story-surface');
        const effects=surface.getAnimations({subtree:true});
        const surfaceEffect=effects.find(animation=>animation.effect?.target===surface);
        if(!surfaceEffect)return;
        window.__captureNextRibbon=false;
        for(const effect of effects){effect.pause();effect.currentTime=0;}
        const projected=window.__PU.anchors.ribbon.clone().project(window.__PU.camera);
        const bounds=surface.getBoundingClientRect();
        window.__ribbonCapture={
          effects,surfaceEffect,
          full:{width:surface.offsetWidth,height:surface.offsetHeight},
          initial:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,
            center:[bounds.left+bounds.width/2,bounds.top+bounds.height/2]},
          source:[(projected.x*.5+.5)*innerWidth,(-projected.y*.5+.5)*innerHeight]
        };
      }).observe(dialog,{attributes:true,attributeFilter:['open','class']});
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
  });
  await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await page.locator('#enter-direct').click();
  await page.locator('#invitation').waitFor({state:'hidden'});
  return {context,page};
}
async function view(page){
  return page.evaluate(()=>({position:window.__PU.camera.position.toArray(),target:window.__PU.controls.target.toArray()}));
}
function sameView(before,after){
  for(const key of ['position','target'])for(let axis=0;axis<3;axis++){
    assert.ok(Math.abs(before[key][axis]-after[key][axis])<.002,`${key}[${axis}] did not return to its original value.`);
  }
}
async function open(page,{capture=false}={}){
  await page.evaluate(armed=>{window.__captureNextRibbon=armed;window.__ribbonCapture=null;window.__PU.discover('ribbon');},capture);
  await page.locator('#memory-dialog').waitFor({state:'visible'});
  if(capture)await page.waitForFunction(()=>!!window.__ribbonCapture);
}
async function seek(page,milliseconds){
  return page.evaluate(time=>{
    const capture=window.__ribbonCapture;
    for(const effect of capture.effects){effect.pause();effect.currentTime=time;}
    const rect=document.querySelector('#memory-dialog .story-surface').getBoundingClientRect();
    return {time,x:rect.x,y:rect.y,width:rect.width,height:rect.height};
  },milliseconds);
}
async function finishOpening(page){
  await page.evaluate(()=>{
    const capture=window.__ribbonCapture;
    const end=Math.max(...capture.effects.map(effect=>effect.effect.getComputedTiming().endTime));
    for(const effect of capture.effects){effect.currentTime=end+1;effect.play();}
  });
  await page.waitForFunction(()=>{
    const surface=document.querySelector('#memory-dialog .story-surface');
    return surface.getAnimations({subtree:true}).every(animation=>animation.playState!=='running'&&!animation.pending);
  });
}
async function closeAndSettle(page){
  await page.keyboard.press('Escape');
  await page.locator('#memory-dialog').waitFor({state:'hidden'});
  await page.waitForFunction(()=>!window.__PU.flying&&window.__PU.activePlace===null);
}
async function cleanState(page){
  return page.evaluate(()=>({openDialogs:document.querySelectorAll('dialog[open]').length,
    activePlace:window.__PU.activePlace,
    controlsEnabled:window.__PU.controls.enabled,
    runningAnimations:document.querySelector('#memory-dialog').getAnimations({subtree:true})
      .filter(animation=>animation.playState==='running'||animation.pending).length,
    unhandled:window.__unhandledRibbonRejections}));
}
try{
  const {context,page}=await newPage();
  const original=await view(page);
  await open(page,{capture:true});
  const first=await page.evaluate(()=>{
    const {source,initial,full}=window.__ribbonCapture;return {source,initial,full};
  });
  await check('The first cloth frame is centered on the real ribbon screen projection',async()=>{
    assert.ok(Math.abs(first.initial.center[0]-first.source[0])<=2);
    assert.ok(Math.abs(first.initial.center[1]-first.source[1])<=2);
    assert.ok(first.initial.width<first.full.width*.15);
    return first;
  });
  await page.screenshot({path:path.join(output,'01-source-frame.png')});
  const duration=await page.evaluate(()=>window.__ribbonCapture.surfaceEffect.effect.getComputedTiming().endTime);
  const samples=[];
  for(let fraction=.05;fraction<1;fraction+=.05)samples.push(await seek(page,duration*fraction));
  const strip=samples.filter(sample=>sample.width>first.full.width*.7&&sample.height<first.full.height*.45)
    .sort((a,b)=>a.height/a.width-b.height/b.width)[0];
  await check('The opening passes through a visible extended ribbon before the full reading cloth',async()=>{
    assert.ok(strip,'No wide, shallow intermediate cloth was rendered.');
    return {durationMs:duration,strip,samples};
  });
  await seek(page,strip.time);
  await page.screenshot({path:path.join(output,'02-extended-ribbon.png')});
  await finishOpening(page);
  await check('The completed cloth occupies a usable reading area within the viewport',async()=>{
    const result=await page.locator('#memory-dialog .story-surface').evaluate(surface=>{
      const rect=surface.getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,
        viewport:[innerWidth,innerHeight],contentOpacity:getComputedStyle(surface.querySelector('.memory-content')).opacity};
    });
    assert.ok(result.width>=600&&result.height>=350);
    assert.ok(result.x>=0&&result.x+result.width<=result.viewport[0]+1);
    assert.ok(result.y>=0&&result.y+result.height<=result.viewport[1]+1);
    assert.equal(Number(result.contentOpacity),1);
    return result;
  });
  await page.screenshot({path:path.join(output,'03-open-cloth.png')});
  await closeAndSettle(page);
  await check('Normal closing restores the original camera and leaves no active transition',async()=>{
    sameView(original,await view(page));
    const state=await cleanState(page);
    assert.equal(state.openDialogs,0);assert.equal(state.activePlace,null);assert.equal(state.controlsEnabled,true);
    assert.equal(state.runningAnimations,0);assert.deepEqual(state.unhandled,[]);return state;
  });
  await open(page,{capture:true});
  await seek(page,duration*.22);
  await page.screenshot({path:path.join(output,'04-interrupted-opening.png')});
  await closeAndSettle(page);
  await check('Escape during unfolding closes safely and restores the camera without rejected animation promises',async()=>{
    sameView(original,await view(page));const state=await cleanState(page);
    assert.equal(state.openDialogs,0);assert.equal(state.runningAnimations,0);assert.deepEqual(state.unhandled,[]);
    assert.equal(state.controlsEnabled,true);return state;
  });
  await open(page,{capture:true});await finishOpening(page);
  await page.locator('#memory-dialog .close-story').click();
  await page.locator('#memory-dialog').waitFor({state:'hidden'});
  await page.waitForFunction(()=>!window.__PU.flying);
  await check('The ribbon can reopen and close again after an interrupted opening',async()=>{
    sameView(original,await view(page));const state=await cleanState(page);
    assert.equal(state.openDialogs,0);assert.equal(state.runningAnimations,0);assert.deepEqual(state.unhandled,[]);return state;
  });
  await open(page,{capture:true});await finishOpening(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await closeAndSettle(page);
  await check('Switching to reduced motion while reading makes the next close immediate',async()=>{
    const timing=await page.evaluate(()=>window.__ribbonCloseTiming.at(-1));
    assert.ok(Number.isFinite(timing)&&timing<160,`Closing still used a visible transition (${timing}ms).`);
    sameView(original,await view(page));return {closeDelayMs:timing,...await cleanState(page)};
  });
  await context.close();

  const reduced=await newPage('reduce');
  const reducedOriginal=await view(reduced.page);
  await open(reduced.page);
  await check('Reduced motion opens the full reading cloth without an unfolding transition',async()=>{
    const result=await reduced.page.locator('#memory-dialog .story-surface').evaluate(surface=>{
      const rect=surface.getBoundingClientRect();return {width:rect.width,height:rect.height,
        layoutWidth:surface.offsetWidth,layoutHeight:surface.offsetHeight,
        running:surface.getAnimations({subtree:true}).filter(animation=>animation.playState==='running'||animation.pending).length};
    });
    assert.ok(Math.abs(result.width-result.layoutWidth)<1&&Math.abs(result.height-result.layoutHeight)<1);
    assert.equal(result.running,0);return result;
  });
  await reduced.page.screenshot({path:path.join(output,'05-reduced-motion.png')});
  await closeAndSettle(reduced.page);
  await check('Reduced motion closes immediately and returns directly to the saved camera',async()=>{
    const timing=await reduced.page.evaluate(()=>window.__ribbonCloseTiming.at(-1));
    assert.ok(Number.isFinite(timing)&&timing<160);
    sameView(reducedOriginal,await view(reduced.page));const state=await cleanState(reduced.page);
    assert.equal(state.runningAnimations,0);assert.deepEqual(state.unhandled,[]);return {closeDelayMs:timing,...state};
  });
  await reduced.context.close();
  await check('All transition scenarios finish without JavaScript or WebGL errors',async()=>assert.deepEqual(errors,[]));
}catch(error){failure={message:error.message,stack:error.stack};throw error;}
finally{
  await fs.writeFile(path.join(output,'ribbon-transition-review.json'),JSON.stringify({status:failure?'FAIL':'PASS',checks,errors,observations,failure},null,2));
  await browser.close();
}
