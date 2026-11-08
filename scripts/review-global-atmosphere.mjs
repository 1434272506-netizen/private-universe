import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';

const out='work/qa/global-atmosphere';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try {
  const page=await browser.newPage({viewport:{width:1120,height:740},reducedMotion:'no-preference'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const panel=page.locator('#atmosphere-switcher');
  async function frame(view){
    await page.evaluate(view=>window.__PU.frame(view),view);
    await page.waitForFunction(view=>window.__PU.currentView===view&&!window.__PU.flying,view);
    assert.ok(await panel.isVisible(),view);
  }
  async function mode(expected){
    await page.waitForFunction(expected=>{
      const p=window.__PU, sky=p.scene.getObjectByName('spring-sky').material.uniforms;
      return p.getAtmosphere()===expected && sky.night.value===Number(expected==='night') &&
        sky.dusk.value===Number(expected==='sunset');
    },expected);
    assert.equal(await panel.locator('[aria-pressed="true"]').getAttribute('data-atmo'),expected);
  }
  async function capture(name){await page.screenshot({path:out+'/'+name+'.png'});}
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');
  const enter=page.locator('#enter-direct');
  await enter.waitFor({state:'visible',timeout:90000});
  assert.equal(await panel.isVisible(),false);
  await enter.click();
  await frame('hero');
  await mode('day');
  await panel.locator('[data-atmo="night"]').click();
  await mode('night');
  const lights=await page.evaluate(()=>['star-dome','meadow-fireflies','branch-fairy-lights'].map(name=>{
    const o=window.__PU.scene.getObjectByName(name);
    return [o.visible,o.geometry.attributes.position.count,o.material.uniforms.opacity.value];
  }));
  assert.deepEqual(lights,[[true,1342,1],[true,72,.95],[true,28,1]]);
  await capture('hero-night');

  await frame('creek');
  await mode('night');
  await page.evaluate(()=>window.__PU.setAtmosphere('day'));
  await mode('day');
  await panel.locator('[data-atmo="night"]').click();
  await mode('night');
  const waterColor=()=>page.evaluate(()=>window.__PU.scene.getObjectByName('creek-surface').material.userData.currentUniforms.uGlintColor.value.getHexString());
  assert.equal(await waterColor(),'38bdf8');
  const initial=await page.evaluate(()=>window.__PU.creekEcology.getState());
  await page.waitForFunction(initial=>{
    const eco=window.__PU.creekEcology, now=eco.getState();
    const moved=(f,g)=>Math.hypot(f.x-g.x,f.z-g.z)>.01;
    return eco.fishMesh.visible && eco.fishMesh.count>0 && eco.turtleMesh.visible &&
      now.silverFish.some((f,i)=>moved(f,initial.silverFish[i])) &&
      now.clownfish.some((f,i)=>moved(f,initial.clownfish[i])) && moved(now.turtle,initial.turtle);
  },initial);
  await capture('creek-night');
  await frame('tree');
  await mode('night');
  assert.equal(await page.evaluate(()=>window.__PU.scene.getObjectByName('branch-fairy-lights').material.uniforms.opacity.value),1);
  await capture('tree-night');
  await frame('mailbox');
  await page.evaluate(()=>window.__PU.setAtmosphere('sunset'));
  await mode('sunset');
  const sunset=await page.evaluate(()=>{
    const scene=window.__PU.scene, clouds=scene.getObjectByName('distant-clouds').children;
    return clouds.length>0 && clouds.every(c=>c.visible && c.material.uniforms.dusk.value===1 && c.material.uniforms.night.value===0) &&
      scene.children.some(o=>o.isDirectionalLight && o.color.getHexString()==='ff8b54' && o.intensity===2.95);
  });
  assert.ok(sunset,'Sunset light and fiery cloud shading active');
  await frame('creek');
  await mode('sunset');
  assert.equal(await waterColor(),'ff9944');
  await capture('creek-sunset');
  await page.evaluate(()=>window.__PU.discover('ribbon'));
  const album=page.locator('#memory-dialog');
  await album.waitFor({state:'visible'});
  assert.equal(await panel.isVisible(),false);
  await album.locator('.close-story').click();
  await album.waitFor({state:'hidden'});
  await panel.waitFor({state:'visible'});
  await mode('sunset');
  for(const view of ['bench','waterfall'])await frame(view);
  assert.deepEqual(errors,[]);
  console.log('PASS global atmosphere verified across hero, creek, tree, and mailbox with zero errors');
} finally {await browser.close();}
