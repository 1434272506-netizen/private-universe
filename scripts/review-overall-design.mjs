import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {memories,letters} from '../src/personal-content.js';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const errors=[],checks=[],metrics=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173/';
const settled=async()=>{await page.waitForFunction(()=>!window.__PU.flying);await page.waitForTimeout(150);};
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
async function capture(name){await page.screenshot({path:`screenshots/${name}.png`});}
async function coordinates(kind){return page.evaluate(key=>{const p=window.__PU,v=p.anchors[key].clone().project(p.camera);return {x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight};},kind);}
async function clickObject(kind){const c=await coordinates(kind);await page.mouse.move(c.x,c.y);await page.waitForTimeout(100);await page.mouse.click(c.x,c.y);}
try{
  await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await page.waitForTimeout(400);
  await check('Invitation waits for user input after real scene readiness',async()=>{
    assert.equal(await page.locator('#enter').isEnabled(),true);assert.equal(await page.evaluate(()=>window.__PU.phase),'invitation');
    assert.equal(await page.locator('#garden-ui').evaluate(el=>el.inert),true);
  });await capture('design-invitation');
  await page.locator('#enter').click();await page.waitForTimeout(1500);await capture('design-intro');
  await check('Cinematic entrance can be skipped',async()=>{
    assert.equal(await page.evaluate(()=>window.__PU.phase),'intro');await page.locator('#skip-intro').click();await settled();
    assert.equal(await page.evaluate(()=>window.__PU.phase),'exploring');assert.equal(await page.evaluate(()=>window.__PU.controls.enabled),true);
  });await capture('design-hero');
  await check('Overview contains the complete island silhouette',async()=>assert.ok(await page.evaluate(()=>window.__PU.points.every(point=>{
    const projected=point.clone().project(window.__PU.camera);return Math.abs(projected.x)<1&&Math.abs(projected.y)<1;
  }))));
  const original=await page.evaluate(()=>({position:window.__PU.camera.position.toArray(),target:window.__PU.controls.target.toArray()}));
  await check('Physical ribbon opens the memory scroll',async()=>{
    await clickObject('ribbon');await page.locator('#memory-dialog').waitFor({state:'visible',timeout:10000});await page.waitForTimeout(1000);
    if(memories.length)assert.equal(await page.locator('.memory-card').count(),memories.length);
    else assert.equal(await page.getByText('还没有放入照片',{exact:true}).isVisible(),true);
    assert.equal(await page.evaluate(()=>window.__PU.controls.enabled),false);
  });await capture('design-memory');
  await check('Escape closes scroll and restores prior camera',async()=>{
    await page.keyboard.press('Escape');await page.locator('#memory-dialog').waitFor({state:'hidden'});await settled();
    const after=await page.evaluate(()=>({position:window.__PU.camera.position.toArray(),target:window.__PU.controls.target.toArray()}));
    for(const key of ['position','target'])for(let i=0;i<3;i++)assert.ok(Math.abs(original[key][i]-after[key][i])<.002);
  });
  await check('Physical mailbox opens and shows the configured letter state',async()=>{
    await clickObject('mailbox');await page.locator('#letter-dialog').waitFor({state:'visible',timeout:10000});await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(()=>window.__PU.props.mailbox.userData.open),true);
    if(letters.length)assert.equal(await page.locator('.letter-envelope').count(),letters.length);
    else assert.equal(await page.getByText('信箱还空着。',{exact:true}).isVisible(),true);
  });await capture('design-letter');
  await page.getByRole('button',{name:'收好信纸'}).click();await page.locator('#letter-dialog').waitFor({state:'hidden'});await settled();
  await check('Mailbox closes on return',async()=>assert.equal(await page.evaluate(()=>window.__PU.props.mailbox.userData.open),false));
  await check('Dragging from a landmark does not trigger its content',async()=>{
    const c=await coordinates('mailbox');await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x+135,c.y+25,{steps:15});await page.mouse.up();
    await page.waitForTimeout(250);assert.equal(await page.locator('#letter-dialog').isVisible(),false);
    await page.keyboard.press('r');await settled();
  });
  await check('Bench offers a lower view and returns safely',async()=>{
    await clickObject('bench');await settled();assert.equal(await page.evaluate(()=>window.__PU.currentView),'bench');
    assert.ok(await page.evaluate(()=>window.__PU.camera.position.y<2.5));await capture('design-bench');
    const largestStep=await page.evaluate(async()=>{
      const p=window.__PU;let previous=p.camera.position.clone(),largest=0;
      document.querySelector('#return-view').click();
      for(let i=0;i<25;i++){await new Promise(requestAnimationFrame);largest=Math.max(largest,previous.distanceTo(p.camera.position));previous.copy(p.camera.position);}
      return largest;
    });
    assert.ok(largestStep<.6,`Returning should not jump, largest frame step: ${largestStep}`);await settled();
  });
  await check('Keyboard-accessible object navigation and focus recovery',async()=>{
    await page.locator('#help-toggle').click();await page.getByRole('button',{name:'看看白丝带'}).focus();await page.keyboard.press('Enter');
    await page.locator('#memory-dialog').waitFor({state:'visible'});await page.keyboard.press('Escape');await page.locator('#memory-dialog').waitFor({state:'hidden'});await settled();
    assert.equal(await page.locator('#help-toggle').evaluate(el=>el===document.activeElement),true);
  });
  await check('Tour starts; manual navigation stops it',async()=>{
    await page.locator('#tour').click();assert.equal(await page.evaluate(()=>window.__PU.controls.autoRotate),true);
    await page.mouse.move(850,450);await page.mouse.down();await page.mouse.move(910,470,{steps:7});await page.mouse.up();
    assert.equal(await page.evaluate(()=>window.__PU.controls.autoRotate),false);await page.keyboard.press('r');await settled();
  });
  await check('Tour from the bench first returns to the overview',async()=>{
    await clickObject('bench');await settled();await page.locator('#tour').click();await settled();
    assert.equal(await page.evaluate(()=>window.__PU.controls.autoRotate),true);
    assert.ok(await page.evaluate(()=>window.__PU.camera.position.distanceTo(window.__PU.controls.target)>20));
    await page.locator('#tour').click();await page.keyboard.press('r');await settled();
  });
  for(const which of ['side','overhead','opposite','tree','mailbox']){
    await page.evaluate(v=>window.__PU.frame(v),which);await settled();await capture(`design-${which}`);
  }
  await page.evaluate(()=>window.__PU.frame('hero'));
  for(const delta of [-100000,100000]){
    await page.mouse.move(850,450);await page.mouse.wheel(0,delta);await page.waitForTimeout(300);
    await check(`Zoom remains bounded (${delta})`,async()=>assert.ok(await page.evaluate(()=>{const p=window.__PU,d=p.camera.position.distanceTo(p.controls.target);return d>=p.controls.minDistance-.01&&d<=p.controls.maxDistance+.01;})));
  }
  await page.evaluate(()=>window.__PU.frame('hero'));
  metrics.push(await page.evaluate(async()=>{
    const frames=[];let last=performance.now();for(let i=0;i<90;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>10)frames.push(now-last);last=now;}
    frames.sort((a,b)=>a-b);return {viewport:[innerWidth,innerHeight],rafMedianMs:frames[Math.floor(frames.length*.5)],rafP90Ms:frames[Math.floor(frames.length*.9)],calls:window.__PU.renderer.info.render.calls,triangles:window.__PU.renderer.info.render.triangles};
  }));
  for(const [width,height] of [[1280,720],[390,844]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(300);await capture(`design-${width}`);
    await check(`Viewport ${width} has no horizontal overflow`,async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)));
  }
  await page.setViewportSize({width:1600,height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true');
  await page.locator('#enter').click();
  await check('Reduced motion skips camera introduction',async()=>assert.equal(await page.evaluate(()=>window.__PU.phase),'exploring'));
  await clickObject('mailbox');await page.locator('#letter-dialog').waitFor({state:'visible'});
  await check('Reduced motion mailbox reaches open geometry',async()=>assert.ok(await page.evaluate(()=>Math.abs(window.__PU.props.mailbox.getObjectByName('mailbox-door-pivot').rotation.x)>1)));
  await page.keyboard.press('Escape');await page.locator('#letter-dialog').waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);checks.push('No JavaScript or WebGL console errors');
}finally{
  await fs.writeFile('screenshots/overall-design-review.json',JSON.stringify({checks,errors,metrics},null,2));await browser.close();
}
