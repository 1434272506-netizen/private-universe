import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {memories as staticMemories,letters as staticLetters} from '../src/personal-content.js';

// Test content exists only in isolated browser contexts, never in personal-content.js.
const base=process.env.REVIEW_URL||'http://127.0.0.1:5173/';
const out=process.env.CONTENT_REVIEW_OUTPUT||'work/qa/content-editor';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});
const page=await context.newPage();
const errors=[],checks=[];
let failure;
page.on('pageerror',error=>errors.push(error.message));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFfkAAAAASUVORK5CYII=','base64');
const fixture={name:'仅供自动检查.png',mimeType:'image/png',buffer:png};
const caption='自动检查用照片，不是真实回忆。';
const title='自动检查信件';
const body='自动检查正文。\n<img src=x onerror="window.fixtureExecuted=true">\n结束。';
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
async function start(target){
  await target.goto(base,{waitUntil:'networkidle'});
  await target.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await target.locator('#enter-direct').click();
}
async function openPlace(place){await page.locator('#help-toggle').click();await page.locator(`[data-place="${place}"]`).click();await page.locator(place==='ribbon'?'#memory-dialog':'#letter-dialog').waitFor({state:'visible'});}
async function openEditor(target=page){await target.locator('#add-content').click();await target.locator('#content-dialog').waitFor({state:'visible'});}
async function closeEditor(target=page){await target.locator('#close-editor').click();await target.locator('#content-dialog').waitFor({state:'hidden'});}
async function saved(target,kind,text){
  await target.waitForFunction(({kind,text})=>document.querySelector(`#${kind}-feedback`).textContent.includes(text),{kind,text});
  await target.waitForFunction(()=>document.querySelector('#content-dialog').getAttribute('aria-busy')!=='true');
}
async function submit(target,kind){await target.locator(`#${kind}-form [type=submit]`).click();}
try{
  await start(page);
  await check('Visible garden entry opens an accessible editor and suspends camera controls',async()=>{
    await openEditor();assert.equal(await page.locator('#photo-tab').getAttribute('aria-selected'),'true');
    assert.ok((await page.locator('.editor-backup').textContent()).includes('当前浏览器'));
    assert.equal(await page.evaluate(()=>window.__PU?window.__PU.controls.enabled:false),false);
    await page.screenshot({path:`${out}/editor-desktop-empty.png`});
  });
  await check('390px editor and garden entry fit; backup and close stay reachable',async()=>{
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.locator('#content-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
    await page.screenshot({path:`${out}/editor-mobile-empty.png`});
    await page.locator('#download-content').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#download-content').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight));
    await closeEditor();
    const geometry=await page.evaluate(()=>({brand:document.querySelector('.masthead').getBoundingClientRect().toJSON(),actions:document.querySelector('.top-actions').getBoundingClientRect().toJSON()}));
    assert.ok(geometry.brand.right<=geometry.actions.left||geometry.brand.bottom<=geometry.actions.top);
    assert.equal(await page.evaluate(()=>window.__PU?window.__PU.controls.enabled:true),true);
    await page.setViewportSize({width:1440,height:1000});
  });
  await check('Empty ribbon offers nested addition; Escape returns to ribbon before garden',async()=>{
    await openPlace('ribbon');
    if(!staticMemories.length)await page.locator('#memory-content .story-add-content').click();
    else await page.evaluate(()=>document.dispatchEvent(new CustomEvent('content-add',{detail:{kind:'memory'}})));
    assert.equal(await page.locator('#content-dialog').isVisible(),true);
    await page.keyboard.press('Escape');await page.locator('#content-dialog').waitFor({state:'hidden'});
    assert.equal(await page.locator('#memory-dialog').isVisible(),true);
    await page.keyboard.press('Escape');await page.locator('#memory-dialog').waitFor({state:'hidden'});
  });
  await check('Photo selection and real save immediately appear on the memory ribbon',async()=>{
    await openEditor();await page.locator('#memory-file').setInputFiles(fixture);
    await page.locator('#memory-caption').fill(caption);await page.locator('#memory-alt').fill('自动检查的单像素图片');
    await page.locator('#memory-date').fill('2024-02-29');await submit(page,'memory');await saved(page,'memory','已放到白丝带上');
    assert.equal(await page.locator('#saved-memories .saved-item').count(),1);
    await closeEditor();await openPlace('ribbon');await page.locator('.open-memory').nth(staticMemories.length).click();
    assert.equal(await page.locator('.memory-reader figcaption').textContent(),caption+'2024-02-29');
    assert.ok(await page.locator('.memory-reader img').evaluate(el=>el.complete&&el.naturalWidth===1));
    await page.keyboard.press('Escape');assert.equal(await page.locator('.open-memory').count(),staticMemories.length+1);
    await page.keyboard.press('Escape');await page.locator('#memory-dialog').waitFor({state:'hidden'});
  });
  await check('Photo edit preserves image without reselecting a file',async()=>{
    await openEditor();await page.locator('#saved-memories .saved-actions button').first().click();
    assert.equal(await page.locator('#memory-file').evaluate(el=>el.required),false);
    await page.locator('#memory-caption').fill(caption+' 已修改');await submit(page,'memory');await saved(page,'memory','已放到白丝带上');
    assert.equal(await page.locator('#saved-memories .saved-item').count(),1);
    assert.ok(await page.locator('#saved-memories img').evaluate(el=>el.complete&&el.naturalWidth===1));
  });
  await check('Letter saves into mailbox and markup remains plain text',async()=>{
    await page.locator('#letter-tab').click();await page.locator('#letter-name').fill(title);
    await page.locator('#letter-body').fill(body);await page.locator('#letter-from').fill('自动检查身份');
    await page.locator('#letter-identity').selectOption('green');await submit(page,'letter');await saved(page,'letter','已收进本机信箱');
    await closeEditor();await openPlace('mailbox');await page.locator('.letter-envelope').nth(staticLetters.length).click();
    assert.equal(await page.locator('.single-letter-body').textContent(),body);
    assert.equal(await page.locator('.single-letter-body img').count(),0);assert.equal(await page.evaluate(()=>window.fixtureExecuted),undefined);
    assert.equal(await page.locator('.single-letter').getAttribute('data-identity'),'green');
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.locator('#letter-dialog').waitFor({state:'hidden'});
  });
  await check('Browser reload preserves both photograph Blob and letter',async()=>{
    await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});await page.locator('#enter-direct').click();
    await openEditor();assert.equal(await page.locator('#saved-memories .saved-item').count(),1);
    assert.ok(await page.locator('#saved-memories img').evaluate(el=>el.complete&&el.naturalWidth===1));
    await page.locator('#letter-tab').click();assert.equal(await page.locator('#saved-letters .saved-item').count(),1);
  });
  await check('Unsaved drafts survive closing the editor within this visit',async()=>{
    await page.locator('#letter-body').fill('尚未保存的检查草稿');await closeEditor();await openEditor();await page.locator('#letter-tab').click();
    assert.equal(await page.locator('#letter-body').inputValue(),'尚未保存的检查草稿');await page.locator('#letter-body').fill('');
  });
  await check('Blank-only letter is rejected without adding a record',async()=>{
    await page.locator('#letter-body').fill('   ');await submit(page,'letter');await saved(page,'letter','请填写');
    assert.equal(await page.locator('#saved-letters .saved-item').count(),1);await page.locator('#letter-body').fill('');
  });
  await check('Unsupported or unreadable images do not add a photograph',async()=>{
    await page.locator('#photo-tab').click();
    await page.locator('#memory-file').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
    assert.equal(await page.locator('#memory-file').inputValue(),'');
    await page.locator('#memory-file').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not a photograph')});
    await saved(page,'memory','未能打开');assert.equal(await page.locator('#saved-memories .saved-item').count(),1);
  });
  let backupPath;
  await check('Backup download includes actual image bytes and letter text',async()=>{
    const downloadPromise=page.waitForEvent('download');await page.locator('#download-content').click();const download=await downloadPromise;
    backupPath=`${out}/test-content-backup.json`;await download.saveAs(backupPath);
    const backup=JSON.parse(await fs.readFile(backupPath,'utf8'));
    assert.equal(backup.memories.length,1);assert.ok(backup.memories[0].image.startsWith('data:image/png;base64,'));
    assert.equal(backup.letters[0].body,body);
  });
  await check('Backup restores in another isolated browser context; repeated restore does not duplicate',async()=>{
    const other=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const target=await other.newPage();target.on('pageerror',error=>errors.push(error.message));
    try{
      await start(target);await openEditor(target);await target.locator('#content-backup-file').setInputFiles(backupPath);await saved(target,'backup','已恢复 1 张照片、1 封信');
      assert.equal(await target.locator('#saved-memories .saved-item').count(),1);
      assert.ok(await target.locator('#saved-memories img').evaluate(el=>el.complete&&el.naturalWidth===1));
      await target.locator('#content-backup-file').setInputFiles(backupPath);await saved(target,'backup','已恢复 0 张照片、0 封信');
      assert.equal(await target.locator('#saved-memories .saved-item').count(),1);assert.equal(await target.locator('#saved-letters .saved-item').count(),1);
    }finally{await other.close();}
  });
  await check('Malformed backup leaves existing saved content intact',async()=>{
    await page.locator('#content-backup-file').setInputFiles({name:'broken-backup.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await saved(page,'backup','不是有效');
    assert.equal(await page.locator('#saved-memories .saved-item').count(),1);assert.equal(await page.locator('#saved-letters .saved-item').count(),1);
  });
  await check('Deletion requires confirmation and refreshes stories to honest empty states',async()=>{
    await page.locator('#saved-memories .saved-actions button').nth(1).click();assert.equal(await page.locator('#saved-memories .saved-item').count(),1);
    await page.locator('#saved-memories').getByRole('button',{name:'保留',exact:true}).click();
    await page.locator('#saved-memories .saved-actions button').nth(1).click();await page.locator('#saved-memories').getByRole('button',{name:'确认移除',exact:true}).click();await saved(page,'memory','已从本机收藏移除');
    assert.equal(await page.locator('#photo-tab').evaluate(el=>el===document.activeElement),true);
    await page.locator('#letter-tab').click();await page.locator('#saved-letters .saved-actions button').nth(1).click();await page.locator('#saved-letters').getByRole('button',{name:'确认移除',exact:true}).click();await saved(page,'letter','已从本机收藏移除');
    assert.equal(await page.locator('#letter-tab').evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.locator('#saved-memories .saved-item').count(),0);assert.equal(await page.locator('#saved-letters .saved-item').count(),0);
    await closeEditor();await openPlace('mailbox');
    if(!staticLetters.length){assert.equal(await page.locator('#letter-content .empty-letter').count(),1);await page.locator('#letter-content .story-add-content').click();}
    else {assert.equal(await page.locator('.letter-envelope').count(),staticLetters.length);await page.evaluate(()=>document.dispatchEvent(new CustomEvent('content-add',{detail:{kind:'letter'}})));}
    assert.equal(await page.locator('#letter-tab').getAttribute('aria-selected'),'true');await closeEditor();
    await page.keyboard.press('Escape');await page.locator('#letter-dialog').waitFor({state:'hidden'});
  });
  await check('No unhandled browser errors',async()=>assert.deepEqual(errors,[]));
}catch(error){failure=error;console.error(error);}
finally{
  await fs.writeFile(`${out}/result.json`,JSON.stringify({url:base,isolatedBrowserFixtures:true,checks,errors,failure:failure?.stack||null},null,2));
  await browser.close();
}
if(failure)process.exitCode=1;
