import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {AdditiveBlending} from 'three';
import {daysTogether} from '../src/natural/anniversary-milestone.js';

assert.equal(daysTogether(Date.parse('2026-11-08T00:00:00+08:00')),411);
assert.equal(daysTogether(Date.parse('2025-09-23T23:59:59+08:00')),0);
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try {
  const page=await browser.newPage({viewport:{width:1000,height:760}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout:90000});
  await page.evaluate(()=>window.__PU.frame('bench'));
  await page.locator('[data-atmo="night"]').click();
  await page.locator('#stargaze').click();
  const settle=()=>page.waitForFunction(()=>!window.__PU.flying);
  await settle();
  const snapshot=()=>page.evaluate(()=>{
    const {scene,camera,controls}=window.__PU,g=scene.getObjectByName('spiral-galaxy');
    return {position:camera.position.toArray(),look:controls.target.toArray(),count:g.geometry.attributes.position.count,
      colors:g.geometry.attributes.color.count,rotation:g.rotation.y,blend:g.material.blending};
  });
  const gas=await page.evaluate(()=>window.__PU.scene.getObjectByName('spiral-gas').children.map(s=>[
    s.isSprite,s.material.opacity,s.material.blending,s.material.map.image.width
  ]));
  assert.equal(gas.length,36);
  for(const cloud of gas)assert.deepEqual(cloud,[true,.16,AdditiveBlending,128]);
  const start=await snapshot();
  assert.equal(start.count,48000);assert.equal(start.colors,48000);assert.equal(start.blend,AdditiveBlending);
  await page.waitForFunction(r=>window.__PU.scene.getObjectByName('spiral-galaxy').rotation.y>r,start.rotation);
  for(const name of ['sagittarius-portal','taurus-portal']){
    const xy=await page.evaluate(name=>{
      const {scene,camera}=window.__PU,v=scene.getObjectByName(name).getWorldPosition(camera.position.clone()).project(camera);
      return [(1+v.x)*innerWidth/2,(1-v.y)*innerHeight/2];
    },name);
    const file=name.startsWith('sagittarius')?'m8-lagoon':'m45-pleiades';
    await page.waitForFunction(([name,file])=>{
      const portal=window.__PU.scene.getObjectByName(name),veil=portal.getObjectByName(file);
      return veil.material.map.image?.naturalWidth===512 && veil.material.opacity===.55
        && portal.getObjectByName('hitProxy').material.visible===false;
    },[name,file]);
    await page.mouse.move(...xy);
    await page.waitForFunction(()=>document.querySelector('canvas[data-hover="star"]'));
    await page.mouse.click(...xy);
    await page.locator('#galaxy-return').waitFor({timeout:10000});
    assert.ok(await page.evaluate(name=>window.__PU.scene.getObjectByName(name+'-realm').visible,name));
    const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
    assert.ok(distance(start.position,(await snapshot()).position)>30);
    await page.locator('#galaxy-return').click();await settle();
    const end=await snapshot();
    assert.ok(distance(start.position,end.position)<.001 && distance(start.look,end.look)<.001);
  }
  assert.deepEqual(errors,[]);console.log('PASS galaxy warp, both portals, panorama return and 411 elapsed days');
} finally {await browser.close();}
