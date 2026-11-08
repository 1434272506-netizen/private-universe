import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {memories,letters,providedPhotoImport} from '../src/personal-content.js';
import {waitForContentReady} from './review-fixture-storage.mjs';
const expectedMemories=memories.length+providedPhotoImport.photos.length;

const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const errors=[],verified=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
async function check(label,fn){await fn();verified.push(label);console.log('PASS',label);}
try{
  await page.goto(process.env.PRODUCTION_PREVIEW_URL||'http://127.0.0.1:5174/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await waitForContentReady(page);
  await check('Production renders; development hooks absent',async()=>{
    assert.equal(await page.locator('#enter').isEnabled(),true);
    assert.equal(await page.evaluate(()=>typeof window.__PU),'undefined');
  });
  await check('Production wax seal unlocks the full ceremony and hands over to exploration',async()=>{
    await page.locator('#wax-seal').click();await page.locator('#passphrase-input').waitFor({state:'visible'});
    await page.locator('#enter').click();
    await page.waitForFunction(()=>document.querySelector('#app').dataset.phase==='exploring',null,{timeout:60000});
    assert.equal(await page.locator('#garden-ui').evaluate(el=>el.inert),false);
    assert.equal(await page.locator('#skip-intro').isHidden(),true);
    assert.equal(await page.locator('#view-title').textContent(),'记忆，系在枝头。');
    await page.locator('#reset').click();await page.waitForTimeout(1800);
  });
  await page.screenshot({path:'screenshots/design-production.png'});
  await check('Ribbon opens and closes through the accessible controls',async()=>{
    await page.locator('#help-toggle').click();await page.locator('[data-place="ribbon"]').click();
    await page.locator('#memory-dialog').waitFor({state:'visible'});
    if(expectedMemories){await page.waitForFunction(()=>document.querySelector('#memory-content')?.getAttribute('aria-busy')!=='true');assert.equal(await page.locator('.album-page[data-current="true"]').count(),1);assert.equal(await page.locator('.story-position').textContent(),`1 / ${expectedMemories}`);}
    else assert.equal(await page.getByText('还没有放入照片',{exact:true}).isVisible(),true);
    await page.keyboard.press('Escape');await page.locator('#memory-dialog').waitFor({state:'hidden'});await page.waitForTimeout(1800);
  });
  await check('Mailbox opens and closes through the accessible controls',async()=>{
    await page.locator('#help-toggle').click();await page.locator('[data-place="mailbox"]').click();
    await page.locator('#letter-dialog').waitFor({state:'visible'});
    if(letters.length)assert.equal(await page.locator('.letter-envelope').count(),letters.length);
    else assert.equal(await page.getByText('信箱还空着。',{exact:true}).isVisible(),true);
    await page.getByRole('button',{name:'收好信纸'}).click();await page.locator('#letter-dialog').waitFor({state:'hidden'});await page.waitForTimeout(1800);
  });
  await check('Bench can return to the garden',async()=>{
    await page.locator('#help-toggle').click();await page.locator('[data-place="bench"]').click();await page.waitForTimeout(1800);
    assert.equal(await page.locator('#view-title').textContent(),'坐一会儿，春天还很长。');
    await page.locator('#return-view').click();await page.waitForTimeout(1800);
    assert.equal(await page.locator('#view-title').textContent(),'风很轻，日子很慢。');
  });
  if(await page.locator('#fullscreen').isVisible())await check('Fullscreen enters and exits',async()=>{
    await page.locator('#fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);
    await page.locator('#fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);
  });
  await check('Invitation can be replayed',async()=>{
    await page.locator('#help-toggle').click();await page.locator('#replay').click();
    await page.locator('#invitation').waitFor({state:'visible'});
    assert.equal(await page.locator('#garden-ui').evaluate(el=>el.inert),true);
  });
  assert.deepEqual(errors,[]);verified.push('No browser errors');
}finally{
  await fs.writeFile('screenshots/production-review.json',JSON.stringify({errors,verified,url:page.url()},null,2));
  await browser.close();
}
