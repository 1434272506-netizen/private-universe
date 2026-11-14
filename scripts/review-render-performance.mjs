import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const label=process.argv[2]||'after',out='work/qa/render-optimization';
await mkdir(out,{recursive:true});
const results=[];
// Every view starts a fresh browser process/context. Compare device DPR=1.75;
// the effective renderer DPR is recorded so the authorised cap is explicit.
for(const scenario of ['hero-day','hero-night','cabin-night-settled']){
 const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--disable-frame-rate-limit','--disable-gpu-vsync']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.75});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');await page.locator('#enter-direct').click({timeout:90000});
  await page.waitForFunction(()=>window.__PU?.phase==='exploring'&&!window.__PU.flying);
  await page.evaluate(scenario=>{
   const p=window.__PU;p.frame('hero');p.setAtmosphere(scenario==='hero-day'?'day':'night');p.controls.autoRotate=false;
   if(scenario==='cabin-night-settled'){
    const c=p.scene.getObjectByName('secret-haven-cabin');p.controls.minDistance=.25;
    p.camera.position.copy(c.localToWorld(p.camera.position.clone().set(0,3.4,12.2)));
    p.controls.target.copy(c.localToWorld(p.controls.target.clone().set(0,1.9,1.2)));p.controls.update();
   }
  },scenario);
  await page.waitForFunction(mode=>window.__PU?.scene.getObjectByName('porch-warm-light').intensity===(mode==='hero-day'?0:28),scenario);
  await page.waitForTimeout(3500);
  const measurement=await page.evaluate(async()=>{
   const p=window.__PU,times=[],drawCalls=[],triangles=[];let previous=performance.now();
   for(let i=0;i<250;i++){
    await new Promise(requestAnimationFrame);const now=performance.now();
    if(i>=10){times.push(now-previous);drawCalls.push(p.renderer.info.render.calls);triangles.push(p.renderer.info.render.triangles);}previous=now;
   }
   const mean=a=>a.reduce((s,x)=>s+x,0)/a.length,quantile=(a,q)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*q)];
   const transmission=[],foliage=[],lights=[];p.scene.traverse(o=>{
    if(o.isPointLight)lights.push(o.name);
    if(o.userData.gardenFoliage)foliage.push(o.name);
    for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.transmission>0)transmission.push({object:o.name,value:m.transmission});
   });
   return {phase:p.phase,atmosphere:p.getAtmosphere(),quality:p.lighting.quality,frameMs:mean(times),fps:1000/mean(times),medianMs:quantile(times,.5),p95Ms:quantile(times,.95),drawCalls:quantile(drawCalls,.5),triangles:quantile(triangles,.5),samples:times.length,deviceDpr:devicePixelRatio,renderDpr:p.renderer.getPixelRatio(),occluders:p.occluders.length,lights,transmission,foliage,rawFrameMs:times};
  });
  const pointer=await page.evaluate(async()=>{
   const p=window.__PU,canvas=p.renderer.domElement;canvas.dispatchEvent(new PointerEvent('pointerleave'));
   const before={...p.hoverDiagnostics},start=performance.now();
   for(let i=0;i<30;i++)canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:580+i*3,clientY:440+i%5,buttons:0,bubbles:true,pointerId:91}));
   const burstMs=performance.now()-start;await new Promise(r=>setTimeout(r,100));
   return {events:30,burstMs,runs:p.hoverDiagnostics.runs-before.runs,rayGroupCpuMs:p.hoverDiagnostics.totalMs-before.totalMs,pending:p.hoverDiagnostics.pending};
  });
  assert.equal(measurement.phase,'exploring');assert.equal(measurement.atmosphere,scenario==='hero-day'?'day':'night');
  await page.screenshot({path:`${out}/${label}-${scenario}.png`});assert.deepEqual(errors,[]);
  const result={scenario,...measurement,pointer,errors};results.push(result);
  console.log(JSON.stringify({label,...result,rawFrameMs:undefined,foliage:undefined}));
 }finally{await browser.close();}
 await writeFile(`${out}/${label}.json`,JSON.stringify({label,results},null,2));
}
