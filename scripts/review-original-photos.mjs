import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {providedPhotoImport} from '../src/personal-content.js';
import {prepareEmptyFixtureCollection,waitForContentReady} from './review-fixture-storage.mjs';
import {waitForPhotoPage,goToPhotoPage,currentPhoto} from './review-photo-helpers.mjs';

// Only isolated browser profiles are changed. Source photographs are read-only.
const base=process.env.REVIEW_URL||'http://127.0.0.1:5173/';
const out=process.env.ORIGINAL_REVIEW_OUTPUT||'work/qa/real-photo-import/browser';
const sourceDirectory=process.env.SOURCE_PHOTO_DIR||'C:/Users/Administrator/.codex/codex-remote-attachments/01a182a0-9cdf-7f32-90b7-f4e02c044057/67F76A55-A236-4B79-A64B-8BA02E6B63E9';
const photos=providedPhotoImport.photos;
const expectedById=new Map(photos.map(photo=>[photo.id,photo]));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const checks=[],errors=[],geometry=[];
let failure;
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1100},reducedMotion:'reduce',acceptDownloads:true});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
async function check(name,run){await run();checks.push(name);console.log('PASS',name);}
async function start(target){
  await target.goto(base,{waitUntil:'networkidle'});
  await target.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await waitForContentReady(target);await target.locator('#enter-direct').click();
}
async function reload(){
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await waitForContentReady(page);await page.locator('#enter-direct').click();
}
async function openEditor(target=page){await target.locator('#add-content').click();await target.locator('#content-dialog').waitFor({state:'visible'});}
async function closeEditor(target=page){await target.locator('#close-editor').click();await target.locator('#content-dialog').waitFor({state:'hidden'});}
async function openRibbon(){
  await page.locator('#help-toggle').click();await page.locator('[data-place="ribbon"]').click();await page.locator('#memory-dialog').waitFor({state:'visible'});
}
async function closeRibbon(){
  await page.keyboard.press('Escape');await page.locator('#memory-dialog').waitFor({state:'hidden'});
}
async function readStored(target=page){
  return target.evaluate(async()=>{
    const records=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('private-universe-content',2);
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const database=request.result;let result=[];
        const transaction=database.transaction('memories','readonly');
        const read=transaction.objectStore('memories').getAll();read.onsuccess=()=>{result=read.result;};
        transaction.oncomplete=()=>{database.close();resolve(result);};
        transaction.onabort=()=>{database.close();reject(transaction.error);};
      };
    });
    records.sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id));
    return Promise.all(records.map(async record=>({id:record.id,caption:record.caption,alt:record.alt,date:record.date,bytes:record.photo.size,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await record.photo.arrayBuffer())),value=>value.toString(16).padStart(2,'0')).join('')})));
  });
}
async function assertImage(image,photo,label){
  await image.waitFor({state:'visible'});
  await image.evaluate(element=>element.decode());
  const result=await image.evaluate(element=>{
    const style=getComputedStyle(element),width=element.clientWidth,height=element.clientHeight;
    const scale=Math.min(width/element.naturalWidth,height/element.naturalHeight);
    return {naturalWidth:element.naturalWidth,naturalHeight:element.naturalHeight,objectFit:style.objectFit,objectPosition:style.objectPosition,boxWidth:width,boxHeight:height,paintWidth:element.naturalWidth*scale,paintHeight:element.naturalHeight*scale};
  });
  assert.equal(result.naturalWidth,photo.width);assert.equal(result.naturalHeight,photo.height);
  assert.equal(result.objectFit,'contain');assert.equal(result.objectPosition,'50% 50%');
  assert.ok(result.boxWidth>0&&result.boxHeight>0);
  assert.ok(result.paintWidth<=result.boxWidth+.01&&result.paintHeight<=result.boxHeight+.01);
  assert.ok(Math.abs(result.paintWidth/result.paintHeight-photo.width/photo.height)<.000001);
  geometry.push({photo:photo.alt,label,...result});
}
async function saved(kind,fragment){
  await page.waitForFunction(({kind,fragment})=>document.querySelector(`#${kind}-feedback`).textContent.includes(fragment),{kind,fragment});
  await waitForContentReady(page);
}
async function assertOriginalFiles(){
  for(const [index,photo] of photos.entries()){
    const source=await fs.readFile(path.join(sourceDirectory,`${index+1}-照片-${index+1}.jpg`));
    const copied=await fs.readFile(path.join('public',photo.image));
    assert.equal(source.length,photo.bytes);assert.equal(copied.length,photo.bytes);
    assert.equal(digest(source),photo.sha256);assert.equal(digest(copied),photo.sha256);
  }
}
try{
  await check('All 10 copied JPEG files exactly match supplied source SHA-256 and byte sizes',assertOriginalFiles);
  await start(page);
  await check('A fresh browser imports exactly 10 editable photos in supplied order with blank captions and dates',async()=>{
    const records=await readStored();assert.deepEqual(records.map(record=>record.id),photos.map(photo=>photo.id));
    assert.ok(records.every(record=>record.caption===''&&record.date===''));
    await openEditor();assert.equal(await page.locator('#saved-memories .saved-item').count(),10);
    await page.screenshot({path:`${out}/editable-original-collection.png`});await closeEditor();
  });
  await check('Every IndexedDB photograph keeps the complete original JPEG bytes',async()=>{
    const records=await readStored();for(const record of records){assert.equal(record.sha256,expectedById.get(record.id).sha256);assert.equal(record.bytes,expectedById.get(record.id).bytes);}
  });
  await openRibbon();
  await check('The album opens directly to one complete photo page without a thumbnail strip',async()=>{
    await waitForPhotoPage(page,1,10);assert.equal(await page.locator('.album-page').count(),1);
    assert.equal(await page.locator('.memory-card,.memory-track,.open-memory').count(),0);
    await assertImage(currentPhoto(page),photos[0],'desktop-first-page');
    await page.screenshot({path:`${out}/ribbon-original-collection.png`});
  });
  await check('Each detail preserves original dimensions and proportions, including the horizontal fifth image',async()=>{
    await goToPhotoPage(page,1,10);
    for(let index=0;index<photos.length;index++){
      assert.equal(await page.locator('.story-position').textContent(),`${index+1} / 10`);
      await waitForPhotoPage(page,index+1,10);await assertImage(currentPhoto(page),photos[index],'desktop-page');
      if([1,4,7].includes(index))await page.screenshot({path:`${out}/original-photo-${String(index+1).padStart(2,'0')}-desktop.png`});
      if(index<photos.length-1){await page.locator('.album-next').click();await waitForPhotoPage(page,index+2,10);}
    }
  });
  await check('Open-original link exposes the original image dimensions and identical original bytes',async()=>{
    const href=await page.locator('.story-original').getAttribute('href');assert.ok(href.startsWith('blob:'));
    const result=await page.evaluate(async href=>{
      const bytes=await (await fetch(href)).arrayBuffer();
      const image=new Image();image.src=href;await image.decode();
      return {width:image.naturalWidth,height:image.naturalHeight,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('')};
    },href);
    assert.equal(result.width,photos[9].width);assert.equal(result.height,photos[9].height);assert.equal(result.sha256,photos[9].sha256);
  });
  await closeRibbon();await page.setViewportSize({width:390,height:844});await openRibbon();
  await check('390px pages keep all 10 photographs complete without horizontal overflow',async()=>{
    await goToPhotoPage(page,1,10);
    for(let index=0;index<photos.length;index++){
      await waitForPhotoPage(page,index+1,10);await assertImage(currentPhoto(page),photos[index],'mobile-page');
      assert.ok(await page.locator('#memory-dialog').evaluate(element=>element.scrollWidth<=element.clientWidth));
      if([1,4,7].includes(index))await page.screenshot({path:`${out}/original-photo-${String(index+1).padStart(2,'0')}-390.png`});
      if(index<photos.length-1){await page.locator('.album-next').click();await waitForPhotoPage(page,index+2,10);}
    }
  });
  await closeRibbon();await page.setViewportSize({width:1600,height:1100});await reload();
  await check('Reload does not duplicate the provided photo batch',async()=>assert.equal((await readStored()).length,10));
  const testCaption='仅在隔离浏览器验证修改，生产说明仍留空。';
  await check('Editing a caption survives reload and keeps its original JPEG unchanged',async()=>{
    await openEditor();await page.locator('#saved-memories .saved-item').first().getByRole('button',{name:'编辑一张照片',exact:true}).click();
    await page.locator('#memory-caption').fill(testCaption);await page.locator('#memory-form [type=submit]').click();await saved('memory','已放到白丝带上');
    await closeEditor();await reload();const records=await readStored();assert.equal(records[0].caption,testCaption);assert.equal(records[0].sha256,photos[0].sha256);
  });
  await check('Confirmed removal survives reload and does not resurrect the supplied photograph',async()=>{
    await openEditor();const last=page.locator('#saved-memories .saved-item').last();await last.getByRole('button',{name:'移除一张照片',exact:true}).click();
    await last.getByRole('button',{name:'确认移除',exact:true}).click();await saved('memory','已从本机收藏移除');await closeEditor();await reload();
    const records=await readStored();assert.equal(records.length,9);assert.ok(!records.some(record=>record.id===photos[9].id));
  });
  let backupPath;
  await check('Downloaded backup contains the remaining 9 complete original JPEGs with identical SHA-256',async()=>{
    await openEditor();const downloading=page.waitForEvent('download');await page.locator('#download-content').click();const download=await downloading;
    backupPath=`${out}/isolated-nine-originals-backup.json`;await download.saveAs(backupPath);
    const backup=JSON.parse(await fs.readFile(backupPath,'utf8'));assert.equal(backup.memories.length,9);assert.equal(backup.letters.length,0);
    for(const record of backup.memories){const bytes=Buffer.from(record.image.split(',')[1],'base64');assert.equal(digest(bytes),expectedById.get(record.id).sha256);assert.equal(bytes.length,expectedById.get(record.id).bytes);}
  });
  await check('Another isolated browser restores original bytes and repeated restore preserves an existing caption edit',async()=>{
    const other=await browser.newContext({viewport:{width:1600,height:1100},reducedMotion:'reduce'});await prepareEmptyFixtureCollection(other);
    const target=await other.newPage();target.on('pageerror',error=>errors.push(error.message));
    try{
      await start(target);await openEditor(target);await target.locator('#content-backup-file').setInputFiles(backupPath);
      await target.waitForFunction(()=>document.querySelector('#backup-feedback').textContent.includes('已恢复 9 张照片、0 封信'));await waitForContentReady(target);
      let records=await readStored(target);assert.equal(records.length,9);for(const record of records)assert.equal(record.sha256,expectedById.get(record.id).sha256);
      await target.locator('#saved-memories .saved-item').first().getByRole('button',{name:`编辑${testCaption}`,exact:true}).click();
      await target.locator('#memory-caption').fill('仅在恢复测试中再次修改。');await target.locator('#memory-form [type=submit]').click();
      await target.waitForFunction(()=>document.querySelector('#memory-feedback').textContent.includes('已放到白丝带上'));await waitForContentReady(target);
      await target.locator('#content-backup-file').setInputFiles(backupPath);await target.waitForFunction(()=>document.querySelector('#backup-feedback').textContent.includes('已恢复 0 张照片、0 封信'));await waitForContentReady(target);
      records=await readStored(target);assert.equal(records.length,9);assert.equal(records[0].caption,'仅在恢复测试中再次修改。');assert.equal(records[0].sha256,photos[0].sha256);
    }finally{await other.close();}
  });
  await check('A normal fresh browser merges an edited backup into the 10 supplied originals and protects later edits',async()=>{
    // Do not skip the initial photo batch here: this follows the user's real
    // new-browser flow, including the pristine copies already seeded by the site.
    const other=await browser.newContext({viewport:{width:1600,height:1100},reducedMotion:'reduce'});
    const target=await other.newPage();target.on('pageerror',error=>errors.push(error.message));
    try{
      await start(target);assert.equal((await readStored(target)).length,10);await openEditor(target);
      await target.locator('#content-backup-file').setInputFiles(backupPath);
      await target.waitForFunction(()=>document.querySelector('#backup-feedback').textContent.includes('已恢复'));
      await waitForContentReady(target);
      let records=await readStored(target);assert.equal(records.length,10);
      assert.equal(records.find(record=>record.id===photos[0].id).caption,testCaption);
      assert.ok(records.some(record=>record.id===photos[9].id),'Merge restore must keep the tenth initial original');
      for(const record of records)assert.equal(record.sha256,expectedById.get(record.id).sha256);
      await target.locator('#saved-memories .saved-item').first().getByRole('button',{name:`编辑${testCaption}`,exact:true}).click();
      await target.locator('#memory-caption').fill('正常新浏览器恢复后又修改的说明。');await target.locator('#memory-form [type=submit]').click();
      await target.waitForFunction(()=>document.querySelector('#memory-feedback').textContent.includes('已放到白丝带上'));await waitForContentReady(target);
      await target.locator('#content-backup-file').setInputFiles(backupPath);
      await target.waitForFunction(()=>document.querySelector('#backup-feedback').textContent.includes('已恢复 0 张照片、0 封信'));await waitForContentReady(target);
      records=await readStored(target);assert.equal(records.length,10);
      assert.equal(records.find(record=>record.id===photos[0].id).caption,'正常新浏览器恢复后又修改的说明。');
      assert.equal(records.find(record=>record.id===photos[0].id).sha256,photos[0].sha256);
    }finally{await other.close();}
  });
  await check('All source and project originals remain byte-for-byte unchanged after viewing, editing, removing and backup',assertOriginalFiles);
  await check('No unhandled browser errors occur throughout real-photo workflows',async()=>assert.deepEqual(errors,[]));
}catch(error){failure=error;console.error(error);}
finally{
  await fs.writeFile(`${out}/result.json`,JSON.stringify({url:base,isolatedBrowser:true,photos:photos.length,checks,errors,geometry,failure:failure?.stack||null},null,2));
  await browser.close();
}
if(failure)process.exitCode=1;
