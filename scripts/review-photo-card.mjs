import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {providedPhotoImport,memories} from '../src/personal-content.js';
import {photoInspirations} from '../src/memory-display.js';
import {waitForContentReady} from './review-fixture-storage.mjs';
import {waitForPhotoPage,goToPhotoPage} from './review-photo-helpers.mjs';
const out='work/qa/photo-card';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const checks=[],errors=[];let failure;
async function check(name,run){await run();checks.push(name);console.log('PASS',name);}
async function openRibbon(page){await page.locator('#help-toggle').click();await page.locator('[data-place="ribbon"]').click();await waitForPhotoPage(page,1,10);}
const context=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const card=()=>page.locator('.album-page[data-current="true"] .photo-card-flipper');
const back=()=>card().locator('.photo-card-back');
const flip=async()=>{await card().locator('.photo-flip-trigger').click();await page.waitForFunction(()=>document.querySelector('.photo-card-flipper')?.getAttribute('aria-expanded')==='true');};
try{
  await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5173/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await waitForContentReady(page);await page.locator('#enter-direct').click();await openRibbon(page);
  await check('All ten original IDs render the approved current title, caption and supplied date fallback',async()=>{
    assert.equal(providedPhotoImport.photos.length,10);
    for(let i=0;i<10;i++){
      const id=providedPhotoImport.photos[i].id,record=memories.find(m=>m.id===id),inspiration=photoInspirations[id];
      await goToPhotoPage(page,i+1,10);
      assert.equal(await back().locator('.photo-back-title').textContent(),inspiration.title);
      assert.equal(await back().locator('.photo-back-text').textContent(),record.caption||inspiration.note);
      if(record.date)assert.equal(await back().locator('.story-date').textContent(),record.date);else assert.equal(await back().locator('.story-date').isHidden(),true);
      assert.equal(await card().getAttribute('aria-expanded'),'false');
    }
    await goToPhotoPage(page,1,10);await page.screenshot({path:out+'/front-desktop.png'});
  });
  await check('Flip buttons synchronize hidden faces, inert controls, focus and live announcements',async()=>{
    await flip();assert.equal(await back().getAttribute('aria-hidden'),'false');
    assert.equal(await card().locator('.photo-card-front').evaluate(el=>el.inert),true);
    assert.equal(await page.locator('.photo-flip-status').textContent(),'已翻转至第 1 张照片背面小注');
    assert.equal(await card().evaluate(el=>el===document.activeElement),true);
    await page.waitForTimeout(700);await page.screenshot({path:out+'/back-desktop.png'});
    await back().locator('.photo-flip-back-trigger').click();assert.equal(await card().getAttribute('aria-expanded'),'false');
  });
  await check('Space, F and double click toggle, while a new page always starts on the front',async()=>{
    await card().focus();await page.keyboard.press('Space');assert.equal(await card().getAttribute('aria-expanded'),'true');
    await page.keyboard.press('f');assert.equal(await card().getAttribute('aria-expanded'),'false');
    await page.waitForTimeout(700);await card().locator('img').dblclick();assert.equal(await card().getAttribute('aria-expanded'),'true');
    await page.keyboard.press('ArrowRight');await waitForPhotoPage(page,2,10);assert.equal(await card().getAttribute('aria-expanded'),'false');
    await page.locator('.album-prev').click();await waitForPhotoPage(page,1,10);assert.equal(await card().getAttribute('aria-expanded'),'false');
  });
  await check('Back-note editing targets the existing photo and immediately refreshes its back',async()=>{
    await flip();await back().locator('.photo-edit-note-trigger').click();
    await page.waitForFunction(()=>document.querySelector('#memory-form [type=submit]').textContent.includes('保存照片修改'));
    await page.locator('#memory-caption').fill('只在隔离测试里写下的小注。\n第二行也要保留。');await page.locator('#memory-date').fill('2026-11-02');
    await page.locator('#memory-form [type=submit]').click();
    await page.waitForFunction(()=>document.querySelector('#memory-feedback').textContent.includes('已放到白丝带上'));await waitForContentReady(page);
    await page.locator('#close-editor').click();await waitForPhotoPage(page,1,10);
    assert.equal(await card().getAttribute('aria-expanded'),'true');assert.equal(await back().locator('.photo-back-text').textContent(),'只在隔离测试里写下的小注。\n第二行也要保留。');
    assert.equal(await back().locator('.story-date').textContent(),'2026-11-02');assert.equal(await back().locator('.photo-note-inspiration').count(),0);
    const stored=await page.evaluate(async()=>{const {loadLocalContent}=await import('/src/local-content.js');return (await loadLocalContent()).memories.map(({id,caption,date})=>({id,caption,date}));});
    assert.equal(stored.length,10);assert.equal(stored[0].id,providedPhotoImport.photos[0].id);assert.ok(stored.slice(1).every(p=>p.caption===''&&p.date===''));
  });
  await check('Reduced motion has no 3D rotation and long notes scroll without hiding actions',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await card().evaluate(el=>getComputedStyle(el).transform),'none');
    for(const viewport of [{width:390,height:667},{width:1280,height:720}]){
      await page.setViewportSize(viewport);
      await back().locator('.photo-back-text').evaluate(el=>el.textContent='长小注阅读验证。'.repeat(300));
      const content=back().locator('.photo-back-content');assert.equal(await content.evaluate(el=>el.scrollHeight>el.clientHeight),true);
      for(const selector of ['.photo-flip-back-trigger','.photo-edit-note-trigger']){const b=await back().locator(selector).boundingBox();assert.ok(b&&b.y>=0&&b.y+b.height<=viewport.height&&b.x>=0&&b.x+b.width<=viewport.width);}
      assert.ok(await page.locator('#memory-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
      await page.screenshot({path:out+'/back-'+viewport.width+'.png'});
    }
  });
  await check('A touch tap flips once and a swipe pages without flipping the next photo',async()=>{
    await page.setViewportSize({width:390,height:844});await back().locator('.photo-flip-back-trigger').click();
    const box=await card().locator('img').boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
    assert.equal(await card().getAttribute('aria-expanded'),'true');await back().locator('.photo-flip-back-trigger').click();
    const session=await context.newCDPSession(page);const y=box.y+box.height/2;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.8,y,id:1}]});
    for(let i=1;i<=5;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width*.8-i*25,y,id:1}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
    await waitForPhotoPage(page,2,10);assert.equal(await card().getAttribute('aria-expanded'),'false');
  });
  await check('Edited notes survive reload with no browser errors',async()=>{
    await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
    await waitForContentReady(page);await page.locator('#enter-direct').click();await openRibbon(page);await flip();
    assert.equal(await back().locator('.photo-back-text').textContent(),'只在隔离测试里写下的小注。\n第二行也要保留。');assert.deepEqual(errors,[]);
  });
}catch(error){failure=error;console.error(error);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await fs.writeFile(out+'/result.json',JSON.stringify({checks,errors,failure:failure?.stack||null},null,2));await browser.close();}
if(failure)process.exitCode=1;
