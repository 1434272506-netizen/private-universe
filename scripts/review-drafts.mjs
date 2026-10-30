import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepareEmptyFixtureCollection,waitForContentReady} from './review-fixture-storage.mjs';

const base=process.env.REVIEW_URL||'http://127.0.0.1:5173/';
const out=process.env.DRAFT_QA_DIR||'work/qa/editor-drafts';
await fs.mkdir(out,{recursive:true});
const profile=await fs.mkdtemp(`${out}/isolated-profile-`);
const executablePath=process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFfkAAAAASUVORK5CYII=','base64');
const fixture={name:'DRAFT TEST ONLY.png',mimeType:'image/png',buffer:png};
const checks=[],errors=[];let context,page,failure;
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
function listen(target){target.on('pageerror',error=>errors.push(error.message));target.on('dialog',dialog=>dialog.accept());}
async function launch(){
  const result=await chromium.launchPersistentContext(profile,{executablePath,headless:true,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await prepareEmptyFixtureCollection(result);return result;
}
async function start(target){
  listen(target);await target.goto(base,{waitUntil:'networkidle'});
  await target.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await waitForContentReady(target);await target.locator('#enter-direct').click();await target.locator('#add-content').click();
}
async function saved(target,kind){
  await target.waitForFunction(kind=>document.querySelector(`#${kind}-draft-status`).textContent.includes('草稿已存于本机'),kind);
}
async function reload(target){await target.reload({waitUntil:'networkidle'});await target.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true');await waitForContentReady(target);await target.locator('#enter-direct').click();await target.locator('#add-content').click();}
async function readDraft(target,kind){return target.evaluate(async kind=>{
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('private-universe-drafts',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  return new Promise((resolve,reject)=>{const transaction=db.transaction('drafts','readonly'),request=transaction.objectStore('drafts').get(kind);let data;request.onsuccess=()=>{data=request.result;};transaction.oncomplete=()=>{db.close();resolve(data);};transaction.onabort=()=>reject(transaction.error);});
},kind);}
try{
  context=await launch();page=await context.newPage();await start(page);
  await check('Photo Blob and text draft survive reload with every field and original bytes',async()=>{
    await page.locator('#memory-file').setInputFiles(fixture);await page.locator('#memory-caption').fill('DRAFT TEST 照片说明');
    await page.locator('#memory-alt').fill('DRAFT TEST 原图');await page.locator('#memory-date').fill('2024-02-29');await saved(page,'memory');
    await reload(page);assert.equal(await page.locator('#memory-caption').inputValue(),'DRAFT TEST 照片说明');
    assert.equal(await page.locator('#memory-alt').inputValue(),'DRAFT TEST 原图');assert.equal(await page.locator('#memory-date').inputValue(),'2024-02-29');
    assert.equal(await page.locator('#memory-file').evaluate(input=>input.required),false);
    const hash=await page.evaluate(async()=>{const image=document.querySelector('#photo-preview img');await image.decode();const bytes=await (await fetch(image.src)).arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');});
    assert.equal(hash,createHash('sha256').update(png).digest('hex'));
  });
  await check('Saving a recovered photo draft creates one record and prevents draft resurrection',async()=>{
    await page.locator('#memory-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('#memory-feedback').textContent.includes('已放到白丝带上'));
    await reload(page);assert.equal(await page.locator('#memory-caption').inputValue(),'');assert.equal(await page.locator('#saved-memories .saved-item').count(),1);
    assert.equal((await readDraft(page,'memory')).deleted,true);
  });
  await check('Letter title, body, signature, date and seal survive reload',async()=>{
    await page.locator('#letter-tab').click();await page.locator('#letter-name').fill('DRAFT TEST 标题');await page.locator('#letter-body').fill('DRAFT TEST 第一段\n\n第二段。');
    await page.locator('#letter-from').fill('DRAFT TEST 署名');await page.locator('#letter-date').fill('2025-10-29');await page.locator('#letter-identity').selectOption('green');await saved(page,'letter');
    await reload(page);await page.locator('#letter-tab').click();
    assert.equal(await page.locator('#letter-name').inputValue(),'DRAFT TEST 标题');assert.equal(await page.locator('#letter-body').inputValue(),'DRAFT TEST 第一段\n\n第二段。');
    assert.equal(await page.locator('#letter-from').inputValue(),'DRAFT TEST 署名');assert.equal(await page.locator('#letter-date').inputValue(),'2025-10-29');assert.equal(await page.locator('#letter-identity').inputValue(),'green');
  });
  await check('A synchronous input immediately followed by reload recovers its text journal',async()=>{
    await page.evaluate(()=>{const input=document.querySelector('#letter-body');input.value='DRAFT TEST 刚输入就刷新';input.dispatchEvent(new Event('input',{bubbles:true}));location.reload();});
    await page.waitForLoadState('networkidle');await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true');await waitForContentReady(page);
    await page.locator('#enter-direct').click();await page.locator('#add-content').click();await page.locator('#letter-tab').click();
    assert.equal(await page.locator('#letter-body').inputValue(),'DRAFT TEST 刚输入就刷新');
  });
  await check('A full isolated browser close and reopen retains the unsaved letter',async()=>{
    await page.locator('#letter-body').fill('DRAFT TEST 关闭浏览器后继续');await saved(page,'letter');await context.close();
    context=await launch();page=await context.newPage();await start(page);await page.locator('#letter-tab').click();
    assert.equal(await page.locator('#letter-body').inputValue(),'DRAFT TEST 关闭浏览器后继续');
  });
  await check('Explicit clear removes the draft without modifying saved content',async()=>{
    await page.locator('#clear-letter-draft').click();await page.waitForFunction(()=>document.querySelector('#letter-draft-status').textContent.includes('草稿已清空'));
    await reload(page);await page.locator('#letter-tab').click();assert.equal(await page.locator('#letter-body').inputValue(),'');assert.equal(await page.locator('#saved-memories .saved-item').count(),1);
  });
  await check('An edited photo draft restores its record ID and updates without duplication',async()=>{
    await page.locator('#photo-tab').click();await page.locator('#saved-memories .saved-actions button').first().click();
    await page.locator('#memory-caption').fill('DRAFT TEST 修改已有照片');await saved(page,'memory');await reload(page);
    assert.equal(await page.locator('#memory-caption').inputValue(),'DRAFT TEST 修改已有照片');assert.equal(await page.locator('#cancel-memory-edit').isVisible(),true);
    await page.locator('#memory-form [type=submit]').click();await page.waitForFunction(()=>document.querySelector('#memory-feedback').textContent.includes('已放到白丝带上'));
    assert.equal(await page.locator('#saved-memories .saved-item').count(),1);assert.ok((await page.locator('#saved-memories').textContent()).includes('DRAFT TEST 修改已有照片'));
  });
  await check('Canceling an edited draft clears it while the saved letter stays unchanged',async()=>{
    await page.locator('#letter-tab').click();await page.locator('#letter-body').fill('DRAFT TEST 已保存的信');await page.locator('#letter-form [type=submit]').click();
    await page.waitForFunction(()=>document.querySelector('#letter-feedback').textContent.includes('已收进本机信箱'));
    await page.locator('#saved-letters .saved-actions button').first().click();await page.locator('#letter-body').fill('DRAFT TEST 不保存的修改');await saved(page,'letter');
    await page.locator('#cancel-letter-edit').click();await page.waitForFunction(()=>document.querySelector('#letter-draft-status').textContent.includes('草稿已清空'));
    await reload(page);await page.locator('#letter-tab').click();assert.equal(await page.locator('#letter-body').inputValue(),'');assert.equal(await page.locator('#saved-letters .saved-item').count(),1);
  });
  await check('Two tabs expose a conflict rather than silently overwriting newer text',async()=>{
    const other=await context.newPage();await start(other);await other.locator('#letter-tab').click();
    await page.locator('#letter-body').fill('DRAFT TEST 页面 A 的新草稿');await saved(page,'letter');
    await other.waitForFunction(()=>!document.querySelector('#letter-form .draft-conflict-actions').hidden);
    await other.locator('#letter-body').fill('DRAFT TEST 页面 B 的不同草稿');
    await other.waitForFunction(()=>document.querySelector('#letter-draft-status').dataset.error==='true');
    assert.equal((await readDraft(page,'letter')).payload.body,'DRAFT TEST 页面 A 的新草稿');
    assert.equal(await other.locator('#letter-body').inputValue(),'DRAFT TEST 页面 B 的不同草稿');
    await other.locator('#letter-form').getByRole('button',{name:'载入最新草稿',exact:true}).click();
    await other.waitForFunction(()=>document.querySelector('#letter-draft-status').textContent.includes('已载入最新草稿'));
    assert.equal(await other.locator('#letter-body').inputValue(),'DRAFT TEST 页面 A 的新草稿');
    await other.locator('#letter-body').fill('DRAFT TEST 页面 B 再次编辑');await saved(other,'letter');
    await page.waitForFunction(()=>!document.querySelector('#letter-form .draft-conflict-actions').hidden);
    await page.locator('#letter-form').getByRole('button',{name:'保留此处草稿',exact:true}).click();await saved(page,'letter');
    assert.equal((await readDraft(page,'letter')).payload.body,'DRAFT TEST 页面 A 的新草稿');await other.close();
  });
  await check('Reloading an unresolved conflicting draft keeps both versions and still requires a choice',async()=>{
    const other=await context.newPage();await start(other);await other.locator('#letter-tab').click();
    await page.locator('#letter-body').fill('DRAFT TEST 需要保留的已提交草稿 A');await saved(page,'letter');
    await other.waitForFunction(()=>!document.querySelector('#letter-form .draft-conflict-actions').hidden);
    await other.locator('#letter-body').fill('DRAFT TEST 尚未接受的冲突草稿 B');
    await other.waitForFunction(()=>document.querySelector('#letter-draft-status').dataset.error==='true');
    await reload(other);await other.locator('#letter-tab').click();
    assert.equal(await other.locator('#letter-body').inputValue(),'DRAFT TEST 尚未接受的冲突草稿 B');
    assert.equal(await other.locator('#letter-form .draft-conflict-actions').isVisible(),true);
    assert.equal((await readDraft(page,'letter')).payload.body,'DRAFT TEST 需要保留的已提交草稿 A');
    await other.locator('#letter-form').getByRole('button',{name:'载入最新草稿',exact:true}).click();
    await other.waitForFunction(()=>document.querySelector('#letter-draft-status').textContent.includes('已载入最新草稿'));
    assert.equal(await other.locator('#letter-body').inputValue(),'DRAFT TEST 需要保留的已提交草稿 A');await other.close();
  });
  await check('Submitting from a stale tab does not clear a newer draft or resurrect its submitted text',async()=>{
    const other=await context.newPage();await start(other);await other.locator('#letter-tab').click();
    await page.locator('#letter-body').fill('DRAFT TEST 仍应留在草稿里的 A');await saved(page,'letter');
    await other.waitForFunction(()=>!document.querySelector('#letter-form .draft-conflict-actions').hidden);
    await other.locator('#letter-body').fill('DRAFT TEST 由另一页面正式收藏的 B');
    await other.locator('#letter-form [type=submit]').click();
    await other.waitForFunction(()=>document.querySelector('#letter-feedback').textContent.includes('信件已保存，另一页面的草稿仍保留'));
    assert.equal((await readDraft(page,'letter')).payload.body,'DRAFT TEST 仍应留在草稿里的 A');
    await reload(other);await other.locator('#letter-tab').click();
    assert.equal(await other.locator('#letter-body').inputValue(),'DRAFT TEST 仍应留在草稿里的 A');
    assert.equal((await readDraft(page,'letter')).payload.body,'DRAFT TEST 仍应留在草稿里的 A');await other.close();
  });
  await check('An opener-created tab uses a different writer instead of inheriting its session identity',async()=>{
    const originalWriter=(await readDraft(page,'letter')).writer;
    const popupPromise=page.waitForEvent('popup');await page.evaluate(()=>window.open(location.href,'_blank'));
    const other=await popupPromise;await start(other);await other.locator('#letter-tab').click();
    await other.locator('#letter-body').fill('DRAFT TEST 新标签独立写入');await saved(other,'letter');
    assert.notEqual((await readDraft(other,'letter')).writer,originalWriter);
    await other.close();
  });
  await check('Storage failure stays explicit and leaves the written text available',async()=>{
    const bad=await chromium.launch({executablePath,headless:true});const target=await bad.newPage({reducedMotion:'reduce'});
    target.on('dialog',dialog=>dialog.accept());target.on('pageerror',error=>errors.push(error.message));
    await prepareEmptyFixtureCollection(target.context());
    await target.addInitScript(()=>{const original=indexedDB.open.bind(indexedDB);indexedDB.open=(name,...args)=>{if(name==='private-universe-drafts')throw new DOMException('DRAFT TEST storage failure','QuotaExceededError');return original(name,...args);};});
    try{
      await start(target);await target.locator('#letter-tab').click();await target.locator('#letter-body').fill('DRAFT TEST 保存失败仍保留文字');
      await target.waitForFunction(()=>document.querySelector('#letter-draft-status').dataset.error==='true');
      assert.equal(await target.locator('#letter-body').inputValue(),'DRAFT TEST 保存失败仍保留文字');assert.ok((await target.locator('#letter-draft-status').textContent()).includes('空间不足'));
    }finally{await bad.close();}
  });
  await check('Draft status and controls fit a narrow screen',async()=>{
    await page.setViewportSize({width:390,height:844});await page.locator('#letter-draft-status').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#content-dialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth));await page.screenshot({path:`${out}/draft-mobile.png`});
  });
  await check('Draft workflows complete without unhandled browser errors',async()=>assert.deepEqual(errors,[]));
}catch(error){failure=error;console.error(error);}
finally{await context?.close();await fs.writeFile(`${out}/result.json`,JSON.stringify({url:base,isolatedFixtures:true,checks,errors,failure:failure?.stack||null},null,2));}
if(failure)process.exitCode=1;
