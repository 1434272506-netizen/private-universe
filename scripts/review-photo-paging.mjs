import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {providedPhotoImport} from '../src/personal-content.js';
import {prepareEmptyFixtureCollection,waitForContentReady} from './review-fixture-storage.mjs';
import {waitForPhotoPage,goToPhotoPage,currentPhoto} from './review-photo-helpers.mjs';

// These explicit fixtures exist only inside isolated browser contexts.
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173/';
const out=process.env.PAGING_QA_DIR||'work/qa/photo-paging';
await fs.mkdir(out,{recursive:true});
const svg=(width,height,index)=>`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${index%2?'#bcb4cb':'#bcc9b1'}"/><text x="20" y="50" font-size="24">PAGING TEST ${index}</text></svg>`)}`;
const fixtures=Array.from({length:12},(_,index)=>({
  id:`paging-fixture-${index+1}`,image:index===2?'/fixture-paging-bad.jpg':svg(index%2?600:1200,index%2?1000:700,index+1),
  caption:`分页测试 ${index+1}，不是真实回忆。`,alt:`PAGING TEST ${index+1}`,date:'',
}));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const checks=[],errors=[],observations={};let failure,debugPage;
async function check(name,fn){const result=await fn();checks.push(name);if(result!==undefined)observations[name]=result;console.log('PASS',name);}
async function scenario(photos,{motion='no-preference',width=1440,height=1000}={}){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:motion,hasTouch:true});
  await prepareEmptyFixtureCollection(context);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/src/personal-content.js*',route=>route.fulfill({contentType:'text/javascript',body:`export const memories=${JSON.stringify(photos)};export const letters=[];export const providedPhotoImport=${JSON.stringify({id:providedPhotoImport.id,photos:[]})};`}));
  await page.route('**/fixture-paging-bad.jpg',route=>route.fulfill({contentType:'image/jpeg',body:'PAGING TEST INVALID IMAGE'}));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await waitForContentReady(page);await page.locator('#enter-direct').click();
  await page.locator('#help-toggle').click();await page.locator('[data-place="ribbon"]').click();
  await page.locator('#memory-dialog').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#memory-dialog .story-surface').getAnimations({subtree:true}).every(animation=>animation.playState!=='running'&&!animation.pending));
  return {context,page};
}
async function swipe(page,{dx,dy}){
  const bounds=await page.locator('.album-stage').boundingBox();assert.ok(bounds);
  const start={x:bounds.x+bounds.width*.5-dx*.5,y:bounds.y+bounds.height*.5-dy*.5};
  const session=await page.context().newCDPSession(page);
  try{
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y,id:1}]});
    for(let step=1;step<=5;step++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+dx*step/5,y:start.y+dy*step/5,id:1}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }finally{await session.detach();}
}
async function assertControlsVisible(page){
  for(const selector of ['#memory-dialog .close-story','.album-prev','.album-next']){
    const bounds=await page.locator(selector).boundingBox();assert.ok(bounds);
    const viewport=page.viewportSize();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=viewport.width+.5,`${selector} overflowed horizontally`);
    assert.ok(bounds.y>=0&&bounds.y+bounds.height<=viewport.height+.5,`${selector} left the visible viewport`);
  }
}
try{
  const main=await scenario(fixtures);const page=main.page;debugPage=page;
  await check('Opening the ribbon immediately presents a single complete page',async()=>{
    await waitForPhotoPage(page,1,12);
    assert.equal(await page.locator('.memory-track,.memory-card,.open-memory').count(),0);
    assert.equal(await page.locator('.album-page').count(),1);
    await currentPhoto(page).evaluate(image=>image.decode());
    assert.equal(await currentPhoto(page).getAttribute('alt'),fixtures[0].alt);
    assert.equal(await page.locator('.album-prev').isDisabled(),true);
    await assertControlsVisible(page);
  });
  await check('Next and previous swap complete photographs while the stage stays stable',async()=>{
    const before=await page.locator('.album-stage').boundingBox();
    await page.locator('.album-next').click();await waitForPhotoPage(page,2,12);
    await currentPhoto(page).evaluate(image=>image.decode());
    assert.equal(await currentPhoto(page).getAttribute('alt'),fixtures[1].alt);
    assert.equal(await currentPhoto(page).evaluate(image=>getComputedStyle(image).objectFit),'contain');
    const after=await page.locator('.album-stage').boundingBox();
    assert.ok(Math.abs(before.height-after.height)<1&&Math.abs(before.width-after.width)<1,'Portrait page changed the reading stage size');
    await page.locator('.album-prev').click();await waitForPhotoPage(page,1,12);
    assert.ok(await page.locator('#memory-dialog').evaluate(dialog=>dialog.contains(document.activeElement)),'Reaching a disabled boundary dropped keyboard focus out of the album');
    await page.screenshot({path:`${out}/desktop-page.png`});return {before,after};
  });
  await check('Rapid mixed keyboard input reaches the latest requested page without stale content or duplicate pages',async()=>{
    await page.evaluate(()=>{
      window.__pagingMaxPages=0;
      window.__pagingObserver=new MutationObserver(()=>{window.__pagingMaxPages=Math.max(window.__pagingMaxPages,document.querySelectorAll('.album-page').length);});
      window.__pagingObserver.observe(document.querySelector('.album-stage'),{childList:true,subtree:true});
      const target=document.querySelector('#memory-dialog');
      for(let index=0;index<8;index++)target.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    });
    await waitForPhotoPage(page,9,12);
    assert.equal(await currentPhoto(page).getAttribute('alt'),fixtures[8].alt);
    await page.evaluate(()=>{
      const target=document.querySelector('#memory-dialog');
      for(let index=0;index<5;index++)target.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
      target.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    });
    await waitForPhotoPage(page,5,12);assert.equal(await currentPhoto(page).getAttribute('alt'),fixtures[4].alt);
    const maxPages=await page.evaluate(()=>{window.__pagingObserver.disconnect();return window.__pagingMaxPages;});assert.ok(maxPages<=2);return {maxMountedPages:maxPages};
  });
  await check('Home, End and repeated boundary input stay within the album',async()=>{
    await page.keyboard.press('End');await waitForPhotoPage(page,12,12);assert.equal(await page.locator('.album-next').isDisabled(),true);
    for(let index=0;index<4;index++)await page.keyboard.press('ArrowRight');await waitForPhotoPage(page,12,12);
    await page.keyboard.press('Home');await waitForPhotoPage(page,1,12);
    for(let index=0;index<4;index++)await page.keyboard.press('ArrowLeft');await waitForPhotoPage(page,1,12);
  });
  await check('A bad photo remains understandable and can be paged past',async()=>{
    await goToPhotoPage(page,3,12);await page.locator('.album-page[data-current="true"] .photo-unavailable').waitFor({state:'visible'});
    assert.ok((await page.locator('.album-page[data-current="true"] figcaption').textContent()).includes(fixtures[2].caption));
    await page.locator('.album-next').click();await waitForPhotoPage(page,4,12);await currentPhoto(page).evaluate(image=>image.decode());
    assert.equal(await currentPhoto(page).getAttribute('alt'),fixtures[3].alt);
  });
  await check('Escape closes once and reopening resumes the page already being read',async()=>{
    await page.keyboard.press('Escape');await page.locator('#memory-dialog').waitFor({state:'hidden'});
    await page.locator('#help-toggle').click();await page.locator('[data-place="ribbon"]').click();await page.locator('#memory-dialog').waitFor({state:'visible'});
    await waitForPhotoPage(page,4,12);
  });
  await check('Short desktop and 390px pages keep complete photos with reachable navigation',async()=>{
    await page.setViewportSize({width:1280,height:720});await assertControlsVisible(page);
    await page.screenshot({path:`${out}/desktop-short-page.png`});
    await page.setViewportSize({width:390,height:844});await goToPhotoPage(page,2,12);
    await currentPhoto(page).evaluate(image=>image.decode());await assertControlsVisible(page);
    assert.equal(await currentPhoto(page).evaluate(image=>getComputedStyle(image).objectFit),'contain');
    assert.ok(await page.locator('#memory-dialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth));
    await page.screenshot({path:`${out}/mobile-page.png`});
    await page.setViewportSize({width:390,height:667});await assertControlsVisible(page);
    await page.screenshot({path:`${out}/mobile-short-page.png`});
  });
  await check('Horizontal touch gestures turn one page while vertical gestures keep the same photograph',async()=>{
    await page.setViewportSize({width:390,height:844});await goToPhotoPage(page,4,12);
    await swipe(page,{dx:-130,dy:3});await waitForPhotoPage(page,5,12);
    await swipe(page,{dx:130,dy:2});await waitForPhotoPage(page,4,12);
    await swipe(page,{dx:8,dy:-130});await waitForPhotoPage(page,4,12);
  });
  await check('The covered garden pauses repeated 3D rendering and resumes on close',async()=>{
    const exposed=await page.evaluate(()=>typeof window.__PU?.overlayRenderPaused==='boolean');
    assert.equal(exposed,true,'The development pause observation is missing');
    await page.waitForFunction(()=>window.__PU.overlayRenderPaused===true);
    const frozen=await page.evaluate(async()=>{
      const before={renders:window.__PU.renderCount,time:window.__PU.sceneTime};
      for(let frame=0;frame<12;frame++)await new Promise(requestAnimationFrame);
      return {before,after:{renders:window.__PU.renderCount,time:window.__PU.sceneTime}};
    });
    assert.equal(frozen.after.renders,frozen.before.renders);assert.equal(frozen.after.time,frozen.before.time);
    await page.keyboard.press('Escape');await page.locator('#memory-dialog').waitFor({state:'hidden'});
    await page.waitForFunction(()=>window.__PU.overlayRenderPaused===false);
    assert.equal(await page.evaluate(()=>window.__PU.controls.enabled),true);
    await page.waitForFunction(before=>window.__PU.renderCount>before,frozen.before.renders);
    return frozen;
  });
  await main.context.close();
  const single=await scenario([fixtures[0]],{motion:'reduce'});
  await check('A single-photo album has both boundaries disabled and reduced motion has no page animation',async()=>{
    await waitForPhotoPage(single.page,1,1);
    assert.equal(await single.page.locator('.album-prev').isDisabled(),true);assert.equal(await single.page.locator('.album-next').isDisabled(),true);
    await single.page.keyboard.press('ArrowRight');await waitForPhotoPage(single.page,1,1);
    assert.equal(await single.page.locator('.album-stage').evaluate(stage=>stage.getAnimations({subtree:true}).filter(animation=>animation.playState==='running'||animation.pending).length),0);
    await single.page.keyboard.press('Escape');await single.page.locator('#memory-dialog').waitFor({state:'hidden'});
  });await single.context.close();
  const empty=await scenario([],{motion:'reduce'});
  await check('An empty album retains a working add-photo entry',async()=>{
    assert.equal(await empty.page.locator('.empty-memory').count(),1);assert.equal(await empty.page.locator('.album-stage').count(),0);
    await empty.page.locator('#memory-content .story-add-content').click();await empty.page.locator('#content-dialog').waitFor({state:'visible'});
    assert.equal(await empty.page.locator('#photo-tab').getAttribute('aria-selected'),'true');
  });await empty.context.close();
  await check('Paging, gestures, close and reopen finish without browser errors',async()=>assert.deepEqual(errors,[]));
}catch(error){failure=error;if(debugPage&&!debugPage.isClosed())observations.failureState=await debugPage.evaluate(()=>({position:document.querySelector('.story-position')?.textContent,busy:document.querySelector('#memory-content')?.getAttribute('aria-busy'),pages:Array.from(document.querySelectorAll('.album-page')).map(page=>({index:page.dataset.index,current:page.dataset.current})),focused:document.activeElement?.outerHTML.slice(0,300),dialogOpen:document.querySelector('#memory-dialog')?.open}));console.error(error);}
finally{await fs.writeFile(`${out}/result.json`,JSON.stringify({url:base,fixtureOnly:true,checks,observations,errors,failure:failure?.stack||null},null,2));await browser.close();}
if(failure)process.exitCode=1;
