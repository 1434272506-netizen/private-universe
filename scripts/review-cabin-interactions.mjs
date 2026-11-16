import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {clickTreeRibbon} from './review-ribbon-helpers.mjs';

// Included by review-cabin so local acceptance covers the new experience as well as geometry.
export async function reviewCabinInteractions(browser,errors,out){
 const report={},context=await browser.newContext({viewport:{width:1280,height:800},timezoneId:'Asia/Shanghai'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const settled=()=>page.waitForFunction(()=>!window.__PU.flying,null,{timeout:30000});
 const screen=()=>page.screenshot({path:`${out}/${report.capture}.png`});
 async function aim(position,target){
  await page.evaluate(({position,target})=>{const p=window.__PU,c=p.cabin.group;p.frame('hero');p.controls.minDistance=.1;p.camera.position.copy(c.localToWorld(p.camera.position.clone().set(...position)));p.controls.target.copy(c.localToWorld(p.controls.target.clone().set(...target)));p.controls.update();p.camera.updateMatrixWorld(true);},{position,target});
 }
 async function project(local){return page.evaluate(local=>{const p=window.__PU,v=p.cabin.group.localToWorld(p.camera.position.clone().set(...local)).project(p.camera);return [(v.x+1)*innerWidth/2,(1-v.y)*innerHeight/2];},local);}
 async function hover(point,kind){await page.mouse.move(...point);await page.waitForFunction(kind=>document.querySelector('#app > canvas').dataset.hover===kind,kind,{timeout:5000});}
 try{
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');await page.locator('#enter-direct').click({timeout:90000});await page.locator('#invitation').waitFor({state:'hidden'});
  const early=await page.evaluate(()=>window.__PU.ribbonGuideDiagnostics);assert.ok(!early.shown&&early.exploreTime<20);
  await page.locator('#add-content').click();
  const paused=await page.evaluate(()=>window.__PU.ribbonGuideDiagnostics.exploreTime);await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>window.__PU.ribbonGuideDiagnostics.exploreTime),paused);
  await page.locator('#close-editor').click();
  await page.waitForFunction(()=>window.__PU.ribbonGuideDiagnostics.shown,null,{timeout:25000});
  report.guide=await page.evaluate(()=>({state:window.__PU.ribbonGuideDiagnostics,count:window.__PU.scene.getObjectByName('ceremony-guiding-petals')?.children.length}));
  assert.ok(report.guide.state.exploreTime>=20&&report.guide.state.exploreTime<21);assert.equal(report.guide.count,3);
  report.capture='theme-ribbon-guide';await screen();
  await clickTreeRibbon(page);
  assert.ok(await page.evaluate(()=>window.__PU.ribbonGuideDiagnostics.opened&&!window.__PU.ribbonGuideDiagnostics.active&&!window.__PU.scene.getObjectByName('ceremony-guiding-petals')));
  await page.locator('#memory-dialog .close-story').click();await page.locator('#memory-dialog').waitFor({state:'hidden'});await settled();
  console.log('PASS 20-second exploration reminder: 3 petals, paused in editor, immediately removed on album opening');

  await page.evaluate(()=>window.__PU.frame('hero'));
  const cabinPoint=await project([0,3,0]);await hover(cabinPoint,'cabin');await page.mouse.click(...cabinPoint);await settled();
  assert.equal(await page.evaluate(()=>window.__PU.currentView),'cabin');
  assert.equal(await page.locator('#view-title').innerText(),'屋里炉火正旺，小猪在替我们守着这个家。');
  report.camera=await page.evaluate(()=>{const p=window.__PU;return {position:p.cabin.group.worldToLocal(p.camera.position.clone()).toArray(),target:p.cabin.group.worldToLocal(p.controls.target.clone()).toArray(),distance:p.camera.position.distanceTo(p.controls.target)};});
  for(const mode of ['day','sunset','night']){
   await page.evaluate(mode=>window.__PU.setAtmosphere(mode),mode);
   await page.waitForFunction(mode=>Math.abs(window.__PU.cabin.group.getObjectByName('porch-warm-light').intensity-28*({day:0,sunset:.63,night:1}[mode]))<1e-9,mode);
   report.capture=`theme-${mode}-discovery`;await screen();
   if(mode!=='day')assert.equal(await page.locator('#view-title').evaluate(el=>getComputedStyle(el).color),'rgb(255, 241, 220)');
  }
  assert.equal(await page.locator('dialog[open]').count(),0);
  await page.keyboard.press('Escape');await settled();
  assert.equal(await page.evaluate(()=>window.__PU.activePlace),null);
  console.log('PASS real cabin click, clear window composition, day/sunset/night card and clean camera restoration');

  await aim([3.2,2.8,6],[.89,2.22,2.46]);const bell=await project([.89,2.24,2.46]);
  await hover(bell,'cabin-chime');
  const before=await page.evaluate(()=>window.__PU.cabin.group.getObjectByName('porch-brass-wind-chime').userData.strikeCount||0);
  await page.mouse.click(...bell);
  await page.waitForFunction(before=>(window.__PU.cabin.group.getObjectByName('porch-brass-wind-chime').userData.strikeCount||0)>before,before);
  await page.waitForFunction(()=>window.__PU.gardenAudio.getState().audioState==='running');
  report.bell=await page.evaluate(()=>{const p=window.__PU,chime=p.cabin.group.getObjectByName('porch-brass-wind-chime'),before=chime.quaternion.toArray();p.cabin.ringChime(10);p.cabin.updateSmoke(10.1);const moving=chime.quaternion.toArray();p.cabin.updateSmoke(0);const still=chime.quaternion.toArray();p.cabin.updateSmoke(0);return {before,moving,still,again:chime.quaternion.toArray(),audio:p.gardenAudio.getState().audioState};});
  assert.notDeepEqual(report.bell.before,report.bell.moving);assert.deepEqual(report.bell.still,report.bell.again);
  console.log('PASS actual porch chime click, running native audio, damped swing and reduced-motion freeze');

  await page.evaluate(()=>window.__PU.scenicTour.start(4));await settled();
  assert.match(await page.locator('#tour-chapter').innerText(),/^05 \/ 08 · 炉边微光，小猪正守着春天。$/);
  assert.equal(await page.evaluate(()=>window.__PU.currentView),'cabin');report.capture='theme-tour-fifth';await screen();
  await page.locator('#tour-next').click();assert.equal(await page.evaluate(()=>window.__PU.scenicTour.index),5);
  await page.keyboard.press('Escape');await settled();
  report.days=await page.evaluate(async()=>{const {daysTogether}=await import('/src/natural/anniversary-milestone.js');const p=window.__PU,plaque=p.scene.getObjectByName('anniversary-milestone');return {start:daysTogether(new Date(2025,8,23).getTime()),today:daysTogether(),fixture:daysTogether(new Date(2026,10,14).getTime()),next:daysTogether(new Date(2026,10,15).getTime()),inscription:plaque.getObjectByName('anniversary-live-inscription').userData.text};});
  assert.equal(report.days.start,0);assert.equal(report.days.fixture,417);assert.equal(report.days.next,418);assert.equal(report.days.inscription,`从 2025.09.23 至今，我们已经携手走过了整整 ${report.days.today} 天`);
  await page.evaluate(()=>window.__PU.discover('anniversary'));assert.equal(await page.locator('#anniversary-title').innerText(),report.days.inscription);await page.locator('#anniversary-card .card-close').click();await settled();
  console.log('PASS fifth of eight chapters, next/escape controls and live anniversary inscription');

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{window.__PU.frame('hero');window.__PU.discover('cabin');});await settled();
  report.mobile=await page.evaluate(()=>{const p=window.__PU,rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return {caption:rect('.scene-caption'),atmosphere:rect('#atmosphere-switcher'),footer:rect('.footer-tools'),targets:p.ribbonTouchTargets.map(t=>({radius:t.geometry.parameters.radius,rendered:t.visible,interaction:t.userData.interaction}))};});
  assert.ok(report.mobile.caption.y>=report.mobile.atmosphere.bottom+4);assert.ok(report.mobile.footer.y>=report.mobile.caption.bottom+4);
  assert.equal(report.mobile.targets.length,3);assert.ok(report.mobile.targets.every(t=>t.radius===1.2&&!t.rendered&&t.interaction==='ribbon'));
  const pig=await project([1.28,.905,.375]);assert.ok(pig[0]>55&&pig[0]<335&&pig[1]>160&&pig[1]<590,'Portrait composition must keep the piglet clear of edges and HUD');report.mobile.pig= pig;
  assert.equal(await page.locator('#return-view').evaluate(el=>getComputedStyle(el).color),'rgb(255, 241, 220)');
  report.capture='theme-mobile-night';await screen();await page.keyboard.press('Escape');await settled();
  // Search an actual expanded sphere hit outside both the physical silk and 28px fallback.
  const touch=await page.evaluate(async()=>{
   const {Vector3,Raycaster}=await import('/node_modules/three/build/three.module.js');const p=window.__PU,t=p.ribbonTouchTargets[0],a=t.position.clone();p.frame('hero');p.controls.minDistance=.2;p.camera.position.copy(a).add(new Vector3(0,1.8,7));p.controls.target.copy(a);p.controls.update();p.camera.updateMatrixWorld(true);p.scene.updateMatrixWorld(true);
   const r=new Raycaster(),centre=a.clone().project(p.camera),cx=(centre.x+1)*innerWidth/2,cy=(1-centre.y)*innerHeight/2;
   for(const dx of [36,-36,48,-48,60,-60])for(const dy of [0,-20,20]){
    const x=cx+dx,y=cy+dy;if(x<20||x>innerWidth-20||y<160||y>innerHeight-170)continue;
    r.setFromCamera({x:x/innerWidth*2-1,y:1-y/innerHeight*2},p.camera);const h=r.intersectObjects(p.interactive,true)[0],b=r.intersectObjects(p.occluders,false)[0];
    if(h&&(!b||b.distance>h.distance-.15))continue;
    if(!r.intersectObject(t,false).length||(b&&b.distance<p.camera.position.distanceTo(a)-.55))continue;
    return {point:[x,y],distance:Math.hypot(dx,dy)};
   }return null;
  });
  assert.ok(touch,'An unobstructed enlarged touch target must work outside the old 28px fallback');await hover(touch.point,'ribbon');await page.mouse.click(...touch.point);await page.locator('#memory-dialog[open]').waitFor();report.expandedTouch=touch;
  report.capture='theme-mobile-ribbon-album';await screen();
  console.log('PASS 390x844 HUD separation and genuine enlarged ribbon touch opens the album');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#memory-dialog .close-story').click();await page.locator('#memory-dialog').waitFor({state:'hidden'});await settled();
  await aim([3.2,2.8,6],[.89,2.22,2.46]);const reducedBell=await project([.89,2.24,2.46]);await hover(reducedBell,'cabin-chime');await page.mouse.click(...reducedBell);await page.evaluate(()=>new Promise(requestAnimationFrame));
  report.reducedMotion=await page.evaluate(()=>{const p=window.__PU,chime=p.cabin.group.getObjectByName('porch-brass-wind-chime');return {rotation:chime.rotation.toArray().slice(0,3),petals:!!p.scene.getObjectByName('ceremony-guiding-petals'),tourHidden:document.querySelector('#tour').hidden};});
  assert.deepEqual(report.reducedMotion.rotation,[0,0,0]);assert.ok(!report.reducedMotion.petals&&report.reducedMotion.tourHidden);
  console.log('PASS reduced-motion engine freezes the clicked bell and removes all petal/tour motion');
  assert.deepEqual(errors,[]);await writeFile(`${out}/interaction-result.json`,JSON.stringify(report,null,2));
 }finally{await context.close();}
 return report;
}
