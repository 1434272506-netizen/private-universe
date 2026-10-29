import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {providedPhotoImport} from '../src/personal-content.js';
import {prepareEmptyFixtureCollection,waitForContentReady} from './review-fixture-storage.mjs';
import {waitForPhotoPage,goToPhotoPage,currentPhoto} from './review-photo-helpers.mjs';

// Fixtures are intercepted in this browser only, never written as personal content.
const svg=(w,h,color)=>`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/><text x="15" y="35" font-size="20">LAYOUT TEST ONLY</text></svg>`)}`;
const fixtures={
  memories:[
    {image:svg(900,520,'#adc3ac'),caption:'测试横图：仅用于验证阅读布局。',date:'2026-01-01'},
    {image:svg(500,900,'#bdb1c8'),caption:'测试竖图：仅用于验证图片比例。',date:'2026-01-02'},
    {image:'/fixture-unreadable.jpg',caption:'测试图片读取失败，文字仍然可读。',date:'2026-01-03'},
  ],
  letters:[
    {title:'布局测试信件',from:'测试身份一',date:'2026-01-01',identity:'purple',body:'测试正文，仅用于检查。\n第二行也应保留。'},
    {title:'长正文与长标题测试'.repeat(8),from:'测试身份二',date:'2026-01-02',identity:'green',body:'LONGTEXT'.repeat(40)+'\n'+('这是一段用于检查滚动和换行的测试文字。\n'.repeat(55))+'测试结束标记'},
  ],
};
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await prepareEmptyFixtureCollection(context);
const page=await context.newPage();
const errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/src/personal-content.js*',route=>route.fulfill({contentType:'text/javascript',body:`export const memories=${JSON.stringify(fixtures.memories)};export const letters=${JSON.stringify(fixtures.letters)};export const providedPhotoImport=${JSON.stringify({id:providedPhotoImport.id,photos:[]})};`}));
await page.route('**/fixture-unreadable.jpg',route=>route.fulfill({contentType:'image/jpeg',body:'not an image'}));
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS',name);};
async function openPlace(place){await page.locator('#help-toggle').click();await page.locator(`[data-place="${place}"]`).click();}
async function closeDialog(name){await page.locator(`#${name} .close-story`).click();await page.locator(`#${name}`).waitFor({state:'hidden'});}
try{
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await waitForContentReady(page);
  await page.locator('#enter-direct').click();
  await openPlace('mailbox');await page.locator('#letter-dialog').waitFor({state:'visible'});
  await page.screenshot({path:'screenshots/stories-fixture-envelopes.png'});
  await check('Letters are selected from separate envelopes',async()=>{
    assert.equal(await page.locator('.letter-envelope').count(),2);
    assert.equal(await page.locator('.single-letter').count(),0);
    await page.locator('.letter-envelope').first().click();
    assert.equal(await page.locator('.single-letter').count(),1);
    assert.equal(await page.locator('.single-letter-body').textContent(),fixtures.letters[0].body);
  });
  await page.screenshot({path:'screenshots/stories-fixture-letter.png'});
  await check('Escape returns to envelopes, then closes the garden dialog',async()=>{
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#letter-dialog').isVisible(),true);
    assert.equal(await page.locator('.letter-envelope').count(),2);
    assert.equal(await page.locator('.letter-envelope').first().evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Escape');await page.locator('#letter-dialog').waitFor({state:'hidden'});
  });
  await openPlace('ribbon');await page.locator('#memory-dialog').waitFor({state:'visible'});
  await page.screenshot({path:'screenshots/stories-fixture-ribbon.png'});
  await check('Photos open large without cropping and support previous/next navigation',async()=>{
    await waitForPhotoPage(page,1,3);assert.equal(await page.locator('.album-page').count(),1);
    assert.equal(await page.locator('.story-position').textContent(),'1 / 3');
    assert.equal(await page.getByRole('button',{name:'← 上一页',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'下一页 →',exact:true}).click();await waitForPhotoPage(page,2,3);
    assert.equal(await page.locator('.story-position').textContent(),'2 / 3');
    assert.equal(await currentPhoto(page).evaluate(el=>getComputedStyle(el).objectFit),'contain');
  });
  await page.screenshot({path:'screenshots/stories-fixture-photo.png'});
  await check('Unavailable photo keeps a clear fallback and caption',async()=>{
    await page.keyboard.press('ArrowRight');await waitForPhotoPage(page,3,3);
    await page.locator('.memory-reader .photo-unavailable').waitFor({state:'visible'});
    assert.ok((await page.locator('.memory-reader figcaption').textContent()).includes(fixtures.memories[2].caption));
    assert.equal(await page.getByRole('button',{name:'下一页 →',exact:true}).isDisabled(),true);
  });
  await check('Escape closes the paged album directly',async()=>{
    await page.keyboard.press('Escape');await page.locator('#memory-dialog').waitFor({state:'hidden'});
  });
  await page.setViewportSize({width:390,height:844});
  await openPlace('mailbox');await page.locator('.letter-envelope').nth(1).click();
  await check('Long letter and title fit a narrow screen; start and end remain reachable',async()=>{
    const bounds=await page.locator('.single-letter').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
    assert.ok(await page.locator('#letter-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
    assert.ok(await page.getByRole('button',{name:'← 回到信件',exact:true}).evaluate(el=>el.getBoundingClientRect().top>=0));
    await page.locator('.single-letter-signature').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('.single-letter-signature').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight));
  });
  await page.screenshot({path:'screenshots/stories-fixture-long-letter-390.png'});
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('.letter-envelope').nth(1).evaluate(el=>el===document.activeElement));
  await closeDialog('letter-dialog');await openPlace('ribbon');await goToPhotoPage(page,2,3);
  await check('Portrait photo remains readable at 390px without horizontal overflow',async()=>{
    assert.ok(await page.locator('#memory-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
    const bounds=await currentPhoto(page).boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
  });
  await page.screenshot({path:'screenshots/stories-fixture-photo-390.png'});
  await closeDialog('memory-dialog');await openPlace('ribbon');
  await check('Reopening the paged album keeps the last page read',async()=>{await waitForPhotoPage(page,2,3);assert.equal(await page.locator('.album-page').count(),1);});
  assert.deepEqual(errors,[]);checks.push('No browser errors with content fixtures');
}finally{
  await fs.writeFile('screenshots/stories-review.json',JSON.stringify({fixtureOnly:true,checks,errors},null,2));await browser.close();
}
