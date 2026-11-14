import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';

const out='work/qa/bench-atmosphere';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try {
  const page=await browser.newPage({viewport:{width:1120,height:740}, reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
  await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout:90000});
  await page.locator('#help-toggle').click();
  await page.locator('[data-place="bench"]').click();
  // Night moonlight is .88 since the preceding estate lighting upgrade; legacy 72-point opacity stays .95.
  for(const [mode,power,opacity] of [['day',3.65,0],['sunset',2.95,.25],['night',.88,.95]]){
    await page.locator('[data-atmo="'+mode+'"]').click();
    await page.waitForFunction(power=>window.__PU.scene.children.some(o=>o.isDirectionalLight&&o.intensity===power)&&!window.__PU.flying,power);
    const stats=await page.evaluate(()=>{
      const p=window.__PU.scene.getObjectByName('meadow-fireflies');
      return [p.geometry.attributes.position.count,p.material.uniforms.opacity.value];
    });
    assert.deepEqual(stats,[72,opacity]);
    await page.screenshot({path:out+'/'+mode+'.png'});
  }
  const magnitudes=await page.evaluate(()=>{
    const stars=window.__PU.scene.getObjectByName('star-dome');
    const counts=[0,0,0];
    for(const size of stars.geometry.attributes.size.array) counts[size>4?0:size>2?1:2]++;
    return counts;
  });
  assert.deepEqual(magnitudes,[72,320,950]);
  await page.emulateMedia({reducedMotion:'no-preference'});
  // Look up from the island and capture a naturally scheduled meteor on its rendered frame.
  const frame=await page.evaluate(async()=>{
    const {camera,controls,scene,renderer}=window.__PU;
    camera.position.set(4,13,3);
    controls.maxPolarAngle=Math.PI;
    controls.target.copy(camera.position).addScaledVector(camera.position.clone().set(-.95,.48,-.42),10);
    camera.fov=76;camera.updateProjectionMatrix();controls.update();
    const meteor=scene.getObjectByName('wishing-meteor');
    const deadline=performance.now()+180000;
    while(performance.now()<deadline){
      await new Promise(requestAnimationFrame);
      if(meteor.visible && meteor.material.uniforms.intensity.value>.8 &&
        meteor.position.y<87 && Math.abs(meteor.position.clone().project(camera).x)<.9){
        return renderer.domElement.toDataURL('image/png').split(',')[1];
      }
    }
    throw new Error('No visible meteor crossed the sky during capture');
  });
  await fs.writeFile(out+'/deep-celestial.png',Buffer.from(frame,'base64'));
  console.log('PASS 72/320/950 star tiers and live meteor capture');
  await page.keyboard.press('Escape');
  await page.locator('#atmosphere-switcher').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  console.log('PASS bench lighting, particle levels, screenshots and return');
} finally {await browser.close();}
