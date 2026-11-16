import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';

const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
  const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const settled=()=>page.waitForFunction(()=>!window.__PU.flying,undefined,{timeout:90000});
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout:90000});
  await page.locator('#invitation').waitFor({state:'hidden'});
  for(const kind of ['swing','campfire','picnic','telescope','meadow']){
    await page.locator('#help-toggle').click();
    await page.locator(`[data-place="${kind}"]`).click();
    await settled();
    const state=await page.evaluate(kind=>{
      const p=window.__PU,w=p.presets[kind];
      return {view:p.currentView,distance:p.camera.position.distanceTo({x:w.position[0],y:w.position[1],z:w.position[2]}),target:p.controls.target.toArray()};
    },kind);
    assert.equal(state.view,kind);assert.ok(state.distance<.02,`${kind} arrives at authored camera position`);
    console.log(`PASS ${kind}: shortcut, smooth camera arrival (${state.distance.toFixed(4)}m)`);
  }
  await page.evaluate(()=>window.__PU.discover('telescope'));await settled();
  await page.locator('#telescope-gaze').click();await settled();
  assert.equal(await page.evaluate(()=>window.__PU.gazing.active),true);
  assert.equal(await page.evaluate(()=>window.__PU.getAtmosphere()),'night');
  const tilt=await page.evaluate(()=>{const p=window.__PU;return Math.asin(p.camera.getWorldDirection(p.camera.position.clone()).y)*180/Math.PI;});
  assert.ok(Math.abs(tilt-75)<.02);await page.keyboard.press('Escape');await settled();
  console.log('PASS telescope: night switch and 75-degree deep-sky entry');

  await page.evaluate(()=>window.__PU.discover('campfire'));await settled();
  const fire=await page.evaluate(()=>{
    const p=window.__PU,light=p.scene.getObjectByName('campfire-glow-light'),sparks=p.scene.getObjectByName('campfire-rising-sparks');
    const first=Array.from(sparks.geometry.attributes.position.array);p.estateFeatures.campfire.stoke();
    p.estateFeatures.campfire.update(p.sceneTime,1);
    return {count:sparks.geometry.attributes.position.count,intensity:light.intensity,visible:sparks.visible,first};
  });
  assert.equal(fire.count,48);assert.equal(fire.visible,true);assert.ok(fire.intensity>2);
  await page.waitForFunction(first=>{const a=window.__PU.scene.getObjectByName('campfire-rising-sparks').geometry.attributes.position.array;return a.some((v,i)=>v!==first[i]);},fire.first);
  console.log('PASS campfire: 48 moving golden sparks and stoke light boost');

  await page.locator('#tour').click();
  assert.equal(await page.evaluate(()=>window.__PU.scenicTour.active),true);
  const first=await page.locator('#tour-chapter').innerText();assert.match(first,/01 \/ 08/);
  await page.locator('#tour-next').click();
  assert.match(await page.locator('#tour-chapter').innerText(),/02 \/ 08/);
  await settled();
  await page.waitForFunction(()=>{
    const p=window.__PU,rig=p.estateFeatures.swing.group.children.find(c=>c.isGroup);
    const natural=Math.sin(p.sceneTime*1.45)*.055;
    return Math.abs(rig.rotation.x-natural)>.001;
  },undefined,{timeout:10000});
  await page.waitForFunction(()=>window.__PU.scenicTour.index===2,undefined,{timeout:30000});
  console.log('PASS tour: chapter text, next button, arrival feedback and automatic dwell advance');
  await page.mouse.move(640,370);await page.mouse.down();await page.mouse.move(730,400,{steps:8});await page.mouse.up();
  assert.equal(await page.evaluate(()=>window.__PU.scenicTour.active),false);
  assert.equal(await page.evaluate(()=>window.__PU.flying),false);
  assert.equal(await page.locator('#tour-status').isVisible(),false);
  console.log('PASS tour: canvas drag cancels active flight and hands over control');
  for(const action of ['Escape','r','dialog']){
    await page.locator('#tour').click();
    if(action==='dialog')await page.evaluate(()=>window.__PU.discover('anniversary'));
    else await page.keyboard.press(action);
    assert.equal(await page.evaluate(()=>window.__PU.scenicTour.active),false);
    if(action==='dialog'){
      await page.locator('#anniversary-card[open]').waitFor();await settled();
      const plaque=await page.evaluate(()=>{
        const p=window.__PU,o=p.scene.getObjectByName('anniversary-milestone');
        return {position:o.position.toArray(),base:o.children[1].geometry.parameters.radiusTop,patio:o.children.at(-1).name};
      });
      assert.equal(plaque.position[0],-12);assert.equal(plaque.position[2],-1.5);
      assert.equal(plaque.base,.26);assert.equal(plaque.patio,'patioRing');
      await mkdir('screenshots',{recursive:true});await page.screenshot({path:'screenshots/20-tour-anniversary.png'});
      await page.locator('#anniversary-card .card-close').click();
    }
    await settled();
  }
  console.log('PASS tour: Escape, R and anniversary modal interrupt; base child order preserved');
  await page.locator('#tour').click();
  for(const [i,key] of ['meadow','swing','tree','waterfall','cabin','campfire','telescope','hero'].entries()){
    await settled();
    assert.deepEqual(await page.evaluate(()=>[window.__PU.scenicTour.index,window.__PU.currentView]),[i,key]);
    if(key==='telescope')await page.screenshot({path:'screenshots/22-tour-telescope-desktop.png'});
    await page.locator('#tour-next').click({timeout:5000});
  }
  assert.equal(await page.evaluate(()=>window.__PU.scenicTour.active),false);
  console.log('PASS all eight tour destinations and peaceful final overview');
  await page.evaluate(()=>{window.__PU.frame('hero');window.__PU.discover('create-surprise');});
  await page.locator('#choose-surprise-position').click();
  assert.equal(await page.evaluate(()=>window.__PU.placementPending),true);
  const placementView=await page.evaluate(()=>window.__PU.currentView);
  await page.evaluate(()=>window.__PU.discover('meadow'));
  assert.equal(await page.evaluate(()=>window.__PU.currentView),placementView);
  // Click real grass at the picnic landmark: placement must win over landmark picking.
  const grass=await page.evaluate(()=>{const p=window.__PU,v=p.anchors.picnic.clone().project(p.camera);return [(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2];});
  await page.mouse.click(...grass);
  await page.locator('#surprise-dialog[open]').waitFor();
  assert.equal(await page.evaluate(()=>window.__PU.placementPending),false);
  assert.equal(await page.evaluate(()=>window.__PU.currentView),placementView);
  await page.locator('#surprise-dialog .surprise-close').click();
  await page.waitForFunction(()=>window.__PU.controls.enabled);
  console.log('PASS balloon placement takes priority over meadow shortcuts and landmark clicks');
  await page.evaluate(()=>window.__PU.discover('telescope'));await settled();
  await page.setViewportSize({width:390,height:844});
  await page.locator('#telescope-gaze').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.__PU.currentView),'telescope');
  const fits=await page.locator('#telescope-gaze').evaluate(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth;});
  assert.ok(fits);await page.screenshot({path:'screenshots/21-tour-telescope-mobile.png'});
  assert.deepEqual(errors,[]);console.log('PASS responsive telescope UI; console.error=0, pageerror=0');
}finally{await browser.close();}
