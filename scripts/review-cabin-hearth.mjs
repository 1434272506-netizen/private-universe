import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import manifest from '../public/models/cabin-interior.manifest.json' with {type:'json'};

export async function reviewCabinHearth(page,check,observations,out){
 await check('Compact piglet and furnished two-batch room remain within 5400–5950 triangles; static fire cones removed',async()=>{
  assert.ok(manifest.totalTriangles>=5400&&manifest.totalTriangles<=5950);
  assert.equal(manifest.drawCallMeshes,2);assert.deepEqual(manifest.piglet.authoredSegments,[20,12]);
  assert.ok(manifest.piglet.surfaceTriangles>=1000&&manifest.piglet.protectedDetailTriangles>=250);
  assert.ok(manifest.piglet.features.includes('rounded-forward-drooping-ears')&&manifest.piglet.features.includes('lavender-bow'));
  assert.equal(manifest.hearth.staticFlames,0);assert.deepEqual(manifest.hearth.emberColors,['#d84212','#ff7420']);
 });
 await check('Three transparent curved flame layers, 15 finite rising embers and exact hearth breathing curve',async()=>{
  const result=await page.evaluate(async()=>{
   const p=window.__PU,c=p.cabin,fire=c.group.getObjectByName('cabin-hearth-fire'),emitter=fire.getObjectByName('cabin-firebox-emitter');
   const saved=c.group.getObjectByName('porch-warm-light').intensity/28,glow=c.group.getObjectByName('cabin-interior-glow').material;
   const layers=emitter.children.filter(o=>o.isMesh).map(o=>({name:o.name,shader:o.material.isShaderMaterial,color:o.material.uniforms.uColor.value.getHexString(),side:o.material.side,transparent:o.material.transparent,depthWrite:o.material.depthWrite,aoSkipped:o.userData.gardenFoliage,casts:o.castShadow,occluder:p.occluders.includes(o)}));
   const sparks=fire.getObjectByName('cabin-hearth-embers');
   const states=[];
   for(const warmth of [0,.2,.63,1])for(const t of [0,.13,.47,1.19]){
    c.setWarmth(warmth);c.updateSmoke(t);states.push({warmth,t,emission:glow.emissiveIntensity,porch:c.group.getObjectByName('porch-warm-light').intensity});
   }
   c.updateSmoke(2);const a=Array.from(sparks.geometry.attributes.position.array),lifeA=Array.from(sparks.geometry.attributes.aLife.array);
   c.updateSmoke(2.25);const b=Array.from(sparks.geometry.attributes.position.array),lifeB=Array.from(sparks.geometry.attributes.aLife.array);
   c.updateSmoke(0);const stillA=Array.from(sparks.geometry.attributes.position.array);c.updateSmoke(0);const stillB=Array.from(sparks.geometry.attributes.position.array);
   const point=emitter.getWorldPosition(p.camera.position.clone());c.group.worldToLocal(point);
   const result={layers,visible:fire.visible,origin:fire.position.toArray(),emitter:point.toArray(),count:sparks.geometry.attributes.position.count,states,a,b,lifeA,lifeB,stillA,stillB,depthWrite:sparks.material.depthWrite};
   c.setWarmth(saved);c.updateSmoke(p.sceneTime);return result;
  });
  assert.equal(result.layers.length,3);assert.deepEqual(result.layers.map(l=>l.color),['ff5a18','ffb830','fff7c2']);
  assert.ok(result.layers.every(l=>l.shader&&l.side===2&&l.transparent&&!l.depthWrite&&l.aoSkipped&&!l.casts&&!l.occluder));
  assert.ok(result.visible);assert.deepEqual(result.origin,[-.95,.78,-.65]);assert.equal(result.count,15);assert.equal(result.depthWrite,false);
  for(let k=0;k<3;k++)assert.ok(Math.abs(result.emitter[k]-(manifest.hearth.runtimeAnchor[k]-(k===1?.045:0)))<1e-6,'Emitter must sit on the existing ember bed inside the masonry');
  for(const s of result.states){const expected=(.18+1.55*s.warmth)*(1+.05*Math.sin(s.t*7.3)+.025*Math.sin(s.t*19.1));assert.ok(Math.abs(s.emission-expected)<1e-10);assert.equal(s.porch,28*s.warmth);}
  assert.ok([...result.a,...result.b,...result.lifeA,...result.lifeB].every(Number.isFinite));assert.ok(result.lifeB.every(v=>v>=0&&v<=1));assert.notDeepEqual(result.a,result.b);assert.notDeepEqual(result.lifeA,result.lifeB);assert.deepEqual(result.stillA,result.stillB);
  observations.hearth=result;
 });
 async function aim(kind){
  await page.evaluate(kind=>{const p=window.__PU,c=p.cabin.group;p.scenicTour.stop();p.frame('hero');p.controls.minDistance=.1;
   const pos=kind==='piglet'?[1.13,1.32,1.4]:kind==='anatomy'?[.98,1.78,1.18]:[-.8,1.2,.6],target=kind==='hearth'?[-1.3,.95,-.85]:[1.28,.94,.4];
   p.camera.position.copy(c.localToWorld(p.camera.position.clone().set(...pos)));p.controls.target.copy(c.localToWorld(p.controls.target.clone().set(...target)));p.controls.update();p.camera.updateMatrixWorld(true);
  },kind);await page.evaluate(()=>new Promise(requestAnimationFrame));
 }
 for(const mode of ['day','sunset','night']){
  await page.evaluate(mode=>window.__PU.setAtmosphere(mode),mode);
  await page.waitForFunction(mode=>window.__PU.cabin.group.getObjectByName('porch-warm-light').intensity===28*({day:0,sunset:.63,night:1}[mode]),mode);
  await aim('piglet');await page.screenshot({path:`${out}/${mode}-piglet-detail.png`,style:'#garden-ui,#return-view,#object-hint{visibility:hidden!important}'});
  await aim('anatomy');await page.screenshot({path:`${out}/${mode}-piglet-anatomy.png`,style:'#garden-ui,#return-view,#object-hint{visibility:hidden!important}'});
  await aim('hearth');
  const before=await page.screenshot({path:`${out}/${mode}-hearth-detail.png`,style:'#garden-ui,#return-view,#object-hint{visibility:hidden!important}'});
  const clock=await page.evaluate(()=>window.__PU.cabin.group.getObjectByName('cabin-flame-outer').material.uniforms.uTime.value);
  await page.waitForTimeout(230);
  const after=await page.screenshot({path:`${out}/${mode}-hearth-motion.png`,style:'#garden-ui,#return-view,#object-hint{visibility:hidden!important}'});
  assert.ok(await page.evaluate(clock=>window.__PU.cabin.group.getObjectByName('cabin-flame-outer').material.uniforms.uTime.value>clock,clock));
  assert.notEqual(createHash('sha256').update(before).digest('hex'),createHash('sha256').update(after).digest('hex'),'GPU fire frames must visibly change');
 }
 await check('Day/sunset/night piglet and GPU fire detail captures; reduced-motion freezes fire and embers',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>window.__PU.cabin.group.getObjectByName('cabin-flame-outer').material.uniforms.uTime.value===0);
  const snapshot=()=>page.evaluate(()=>{const c=window.__PU.cabin.group;return {clock:c.getObjectByName('cabin-flame-outer').material.uniforms.uTime.value,positions:Array.from(c.getObjectByName('cabin-hearth-embers').geometry.attributes.position.array),emission:c.getObjectByName('cabin-interior-glow').material.emissiveIntensity};});
  const before=await snapshot();await page.waitForTimeout(250);assert.deepEqual(await snapshot(),before);assert.equal(before.emission,.18+1.55);
  await page.screenshot({path:`${out}/night-hearth-reduced-motion.png`,style:'#garden-ui,#return-view{visibility:hidden!important}'});
  await page.emulateMedia({reducedMotion:'no-preference'});
 });
}

export async function reviewCabinProduction(browser,errors,out){
 const {preview}=await import('vite');
 const server=await preview({preview:{host:'127.0.0.1',port:0,open:false}});
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),models=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.url().includes('/models/cabin-interior.glb'))models.push({url:r.url(),status:r.status()});});
 try{
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  await page.locator('#enter-direct').click({timeout:90000});await page.locator('#invitation').waitFor({state:'hidden'});
  await page.locator('#help-toggle').click();await page.locator('[data-place="cabin"]').click();
  assert.equal(await page.locator('#view-title').innerText(),'屋里炉火正旺，小猪在替我们守着这个家。');
  await page.waitForTimeout(2200);await page.screenshot({path:`${out}/production-cabin.png`});
  assert.equal(await page.evaluate(()=>window.__PU),undefined);assert.equal(models.length,1);assert.equal(models[0].status,200);assert.deepEqual(errors,[]);
  console.log('PASS production preview: split Three.js modules, cabin GLB and shaders load with no runtime errors');
  return {models,developmentHooks:false,errors:0};
 }finally{await context.close();server.httpServer.closeAllConnections();await new Promise(resolve=>server.httpServer.close(resolve));}
}
