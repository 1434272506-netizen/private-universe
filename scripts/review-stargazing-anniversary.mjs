import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {daysTogether} from '../src/natural/anniversary-milestone.js';
assert.equal(daysTogether(Date.parse('2026-11-08T00:00:00+08:00')),411);
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout:90000});
  await page.locator('#invitation').waitFor({state:'hidden'});
  const point=await page.evaluate(async()=>{
    const p=window.__PU;p.frame('tree');
    await new Promise(requestAnimationFrame);
    const face=p.scene.getObjectByName('anniversary-milestone').children[1];
    const v=face.getWorldPosition(p.camera.position.clone()).project(p.camera);
    return [(1+v.x)*innerWidth/2,(1-v.y)*innerHeight/2];
  });
  await page.mouse.click(...point);
  await page.locator('#anniversary-card[open]').waitFor({timeout:8000});
  assert.equal(await page.locator('#anniversary-title').innerText(),'从 2025.09.23 至今，我们已经携手走过了整整 '+daysTogether()+' 天');
  await page.locator('.card-stars').click();
  await page.waitForFunction(()=>window.__PU.flying);
  await page.waitForFunction(()=>!window.__PU.flying);
  const inspect=()=>page.evaluate(()=>{
    const p=window.__PU,sky=p.scene.getObjectByName('private-constellations');
    return [sky.visible,p.currentView,Math.asin(p.camera.getWorldDirection(p.camera.position.clone()).y)*180/Math.PI,
      sky.getObjectByName('sagittarius-teapot').geometry.attributes.position.count,
      sky.getObjectByName('taurus-hyades').geometry.attributes.position.count,Boolean(sky.getObjectByName('starlight-heart'))];
  });
  const [visible,view,angle,...counts]=await inspect();
  assert.ok(visible && view==='bench' && Math.abs(angle-75)<.02);
  assert.deepEqual(counts,[8,13,false]);
  for(const action of ['Escape','button']){
    if(action==='button'){
      await page.locator('#stargaze').click();
      await page.waitForFunction(()=>!window.__PU.flying);
      await page.locator('#stargaze').click();
    }else await page.keyboard.press(action);
    await page.waitForFunction(()=>!window.__PU.flying);
    const [active,v,tilt]=await inspect();
    assert.ok(!active && v==='bench' && tilt<20);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS anniversary plaque and 75-degree constellation stargazing');
}finally{await browser.close();}
