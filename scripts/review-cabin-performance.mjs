import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const label=process.argv[2]||'after',out='work/qa/cabin';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--disable-frame-rate-limit','--disable-gpu-vsync']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.75});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');
 await page.locator('#enter-direct').click({timeout:90000});await page.waitForFunction(()=>window.__PU?.phase==='exploring'&&!window.__PU.flying);
 await page.evaluate(()=>{const p=window.__PU,c=p.scene.getObjectByName('secret-haven-cabin');p.frame('hero');p.setAtmosphere('night');p.controls.autoRotate=false;p.camera.position.copy(c.localToWorld(p.camera.position.clone().set(0,3.4,12.2)));p.controls.target.copy(c.localToWorld(p.controls.target.clone().set(0,1.9,1.2)));p.controls.update();});
 await page.waitForFunction(()=>window.__PU.scene.getObjectByName('porch-warm-light').intensity===28&&!window.__PU.flying);
 await page.waitForTimeout(3000);
 const render=await page.evaluate(async()=>{
  const p=window.__PU,original=p.lighting.render,frames=[],cpu=[],calls=[],gpu=[],gl=p.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[];
  let previous=performance.now();
  p.lighting.render=function(...args){
   const now=performance.now();frames.push(now-previous);previous=now;
   let query;if(ext){query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);}
   const start=performance.now();original.apply(this,args);cpu.push(performance.now()-start);calls.push(p.renderer.info.render.calls);
   if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(query);}
   while(pending.length&&gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)){
    const q=pending.shift();if(!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);
   }
  };
  try{while(frames.length<180)await new Promise(requestAnimationFrame);}finally{p.lighting.render=original;for(const q of pending)gl.deleteQuery(q);}
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length,median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
  return {scenario:'cabin-night-settled',viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,samples:frames.length,frameMs:mean(frames.slice(10)),medianFrameMs:median(frames.slice(10)),fps:1000/mean(frames.slice(10)),renderCpuMs:mean(cpu.slice(10)),gpuMs:gpu.length?mean(gpu.slice(10)):null,drawCalls:median(calls),occluders:p.occluders.length,pointLights:(()=>{let n=0;p.scene.traverse(o=>{if(o.isPointLight)n++;});return n;})()};
 });
 // Optional paired ablation keeps the room/camera/device unchanged and isolates
 // the old fifth light. ABBA order helps reveal clock/background-load drift.
 const lightAblation=process.argv.includes('--light-ablation')?await page.evaluate(async()=>{
  const p=window.__PU,wick=p.scene.getObjectByName('porch-lamp-wick'),extra=p.scene.getObjectByName('porch-warm-light').clone(false),rounds=[];
  extra.name='benchmark-legacy-fifth-light';extra.position.set(0,0,0);extra.intensity=.32;extra.distance=.85;
  const waitFrames=async n=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
  try{
   for(const enabled of [true,false,false,true]){
    if(enabled)wick.add(extra);else extra.removeFromParent();
    await p.renderer.compileAsync(p.scene,p.camera);await waitFrames(80);
    const times=[];let previous=performance.now();
    for(let i=0;i<180;i++){await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-previous);previous=now;}
    const mean=times.slice(10).reduce((s,v)=>s+v,0)/170;
    rounds.push({fifthLight:enabled,frameMs:mean,fps:1000/mean,drawCalls:p.renderer.info.render.calls});
   }
  }finally{extra.removeFromParent();extra.dispose();}
  return rounds;
 }):null;
 const pointer=await page.evaluate(async()=>{
  const p=window.__PU,canvas=p.renderer.domElement,before=p.hoverDiagnostics?{...p.hoverDiagnostics}:null;
  const start=performance.now();for(let i=0;i<30;i++)canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:580+i*3,clientY:440+i%5,buttons:0,bubbles:true,pointerId:91}));
  const burstMs=performance.now()-start;await new Promise(r=>setTimeout(r,100));
  return {events:30,burstMs,groupRuns:before?p.hoverDiagnostics.runs-before.runs:null,rayGroupCpuMs:before?p.hoverDiagnostics.totalMs-before.totalMs:null,pending:p.hoverDiagnostics?.pending??null};
 });
 assert.deepEqual(errors,[]);
 const result={label,render,pointer,lightAblation,errors};await writeFile(`${out}/performance-${label}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
