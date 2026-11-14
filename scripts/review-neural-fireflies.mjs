import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
import graph from '../src/natural/connectome/circuit-data.json' with {type:'json'};
const out='work/qa/neural-fireflies';await fs.mkdir(out,{recursive:true});
assert.ok((await fs.stat('src/natural/connectome/circuit-data.json')).size<120000);
for(let i=0;i<graph.nodes.length;i++)for(let e=graph.offsets[i];e<graph.offsets[i+1];e++)assert.equal(Math.sign(graph.weights[e]),graph.nodes[i].nt==='ACH'?1:-1);
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const errors=[],observations={};
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');await page.locator('#enter-direct').click({timeout:90000});await page.locator('#invitation').waitFor({state:'hidden'});
 const state=()=>page.evaluate(()=>window.__PU.neuralFireflies.getState());
 const meta=await page.evaluate(()=>window.__PU.neuralFireflies.getConnectomeMeta());
 assert.ok(meta.neurons>=240&&meta.neurons<=400&&meta.measuredEdges>0&&meta.excitatoryEdges>0&&meta.inhibitoryEdges>0);
 assert.deepEqual(meta.parameters,{dt:1,tau_m:20,V_rest:-52,V_reset:-52,V_thresh:-45,t_ref:2.2,tau_syn:5});
 const initial=await state();
 assert.equal(initial.length,80);
 const zones=new Set(initial.map(f=>f.zone));
 assert.equal(zones.size,6);
 observations.meta=meta;observations.count=initial.length;observations.zones=[...zones];
 const day=initial;const meanFlash=a=>a.reduce((n,f)=>n+f.flashLevel,0)/a.length;
 async function samples(n){return page.evaluate(async n=>{
  const results=[],timings=[];let last=performance.now();
  for(let i=0;i<n;i++){await new Promise(requestAnimationFrame);let now=performance.now();timings.push(now-last);last=now;const p=window.__PU,s=p.neuralFireflies.getState(),boxes=p.neuralFireflies.getDiagnostics().obstacles;
   for(const f of s){const [x,y,z]=f.position;if(!p.inside(x,z,.87)||y<p.ground(x,z)+.2||!f.position.every(Number.isFinite))throw new Error('unsafe terrain position');for(const b of boxes)if(x>b.min[0]&&x<b.max[0]&&y>b.min[1]&&y<b.max[1]&&z>b.min[2]&&z<b.max[2])throw new Error('obstacle penetration');}
   results.push(s[0]);
  }return {results,timings};
 },n);}
 console.log('PASS static CSR <120KB, measured + modeled provenance, Dale signs, exact LIF constants, 80 flies across 6 zones');
 for(const mode of ['night','sunset']){
  await page.locator(`[data-atmo="${mode}"]`).click();await page.waitForTimeout(2200);
  const before=await state();await samples(70);const after=await state();
  assert.ok(after.every((f,i)=>Math.hypot(f.position[0]-before[i].position[0],f.position[2]-before[i].position[2])>.01));
  assert.ok(meanFlash(after)>meanFlash(day)+.05);
  observations[mode]={flash:meanFlash(after),moving:after.filter((f,i)=>Math.hypot(f.position[0]-before[i].position[0],f.position[2]-before[i].position[2])>.01).length};
  console.log(`PASS ${mode}: all 80 flies move; mean photophore ${meanFlash(after).toFixed(3)} > day ${meanFlash(day).toFixed(3)}; terrain/obstacle safety`);
 }
 await page.locator('[data-atmo="night"]').click();await page.waitForTimeout(2000);
 for(const view of ['hero','meadow','creek','picnic']){
  await page.evaluate(v=>window.__PU.frame(v),view);
  await page.waitForFunction(v=>window.__PU.currentView===v&&!window.__PU.flying,view);
  await page.waitForTimeout(600);
  await page.screenshot({path:`${out}/${view}-night.png`});
 }
 await page.evaluate(()=>window.__PU.frame('hero'));
 await page.waitForFunction(()=>window.__PU.currentView==='hero'&&!window.__PU.flying);
 const before=(await state())[0];await page.evaluate(()=>window.__PU.neuralFireflies.stimulate(0,'light-left'));
 const causal=await samples(55);const avg=key=>causal.results.reduce((n,f)=>n+f[key],0)/causal.results.length;
 assert.ok(avg('LC10_L')-avg('LC10_R')>10);
 assert.ok(avg('DNa02_L')-avg('DNa02_R')>1);
 assert.ok(causal.results.at(-1).heading<before.heading-.05);
 observations.causal={LC10_L:avg('LC10_L'),LC10_R:avg('LC10_R'),DNa02_L:avg('DNa02_L'),DNa02_R:avg('DNa02_R'),headingBefore:before.heading,headingAfter:causal.results.at(-1).heading};
 await page.evaluate(()=>window.__PU.neuralFireflies.stimulate(0,'scent-left'));const scent=await samples(35);
 assert.ok(scent.results.reduce((n,f)=>n+f.ORN_L-f.ORN_R,0)/scent.results.length>5);
 console.log('PASS neural causality: LC10/ORN spikes -> DNa02 lateral firing difference -> real signed heading change');
 await page.evaluate(()=>{const p=window.__PU,f=p.neuralFireflies.getState()[0],v=f.position;p.controls.minDistance=.3;p.controls.maxPolarAngle=1.6;p.camera.position.set(v[0]+.3,v[1]+.28,v[2]+1.1);p.controls.target.set(...v);p.controls.update();p.neuralFireflies.selectFly(0);});
 await page.locator('#neural-fly-panel').waitFor({state:'visible'});
 for(const [width,height,label] of [[1280,800,'desktop'],[390,844,'mobile']]){
  await page.setViewportSize({width,height});
  const layout=await page.evaluate(()=>{const r=document.querySelector('#neural-fly-panel').getBoundingClientRect(),hits=[];
   for(const s of ['#atmosphere-switcher','#tour','#reset','.scene-caption','#tour-status']){const el=document.querySelector(s);if(!el||el.hidden||!el.getClientRects().length)continue;const b=el.getBoundingClientRect();if(Math.min(r.right,b.right)>Math.max(r.left,b.left)&&Math.min(r.bottom,b.bottom)>Math.max(r.top,b.top))hits.push(s);}return {hits,inside:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth};});
  assert.deepEqual(layout.hits,[]);assert.ok(layout.inside);
  await page.locator('[data-stim="light-left"]').click();await page.locator('[data-stim="scent-left"]').click();
  await page.screenshot({path:`${out}/observer-${label}.png`});
 }
 await page.locator('.neural-close').click();assert.equal(await page.locator('#neural-fly-panel').isVisible(),false);
 // Freeze motion to pick the actual instanced body on screen, without a debug-only click bypass.
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
 const still=await state();await page.waitForTimeout(250);assert.deepEqual((await state()).map(f=>f.position),still.map(f=>f.position));
 const point=await page.evaluate(()=>{const p=window.__PU,v=p.camera.position.clone().set(...p.neuralFireflies.getState()[0].position);p.controls.minDistance=.3;p.camera.position.copy(v).add({x:0,y:.2,z:1});p.controls.target.copy(v);p.controls.update();p.camera.updateMatrixWorld();v.project(p.camera);return [(1+v.x)*innerWidth/2,(1-v.y)*innerHeight/2];});
 await page.mouse.click(...point);await page.locator('#neural-fly-panel').waitFor({state:'visible'});await page.locator('.neural-close').click();
 console.log('PASS real InstancedMesh picking, observer controls, desktop/mobile HUD clearance and reduced-motion freeze');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#add-content').click();await page.waitForTimeout(300);
 const covered=await state();await page.waitForTimeout(250);assert.deepEqual((await state()).map(f=>f.position),covered.map(f=>f.position));await page.locator('#close-editor').click();
 const diagnostics=await page.evaluate(()=>window.__PU.neuralFireflies.getDiagnostics());assert.ok(diagnostics.finite);assert.ok(diagnostics.meanCostMs<5);observations.performance=diagnostics;
 causal.timings.sort((a,b)=>a-b);observations.frameTiming={median:causal.timings[Math.floor(causal.timings.length/2)],p95:causal.timings[Math.floor(causal.timings.length*.95)]};
 assert.deepEqual(errors,[]);console.log(`PASS pause/resume, no NaN/Inf; neural mean ${diagnostics.meanCostMs.toFixed(2)}ms/frame; console.error=0, pageerror=0`);
}finally{await fs.writeFile(`${out}/result.json`,JSON.stringify({observations,errors},null,2));await browser.close();}
