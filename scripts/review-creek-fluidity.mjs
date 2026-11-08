import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {STEPPING_STONES,WATER_DYNAMICS,waterBankX} from '../src/natural/water.js';
import {creekX,ground,waterY} from '../src/natural/land.js';
const out='work/qa/creek-fluidity',checks=[],errors=[];let browser,failure;
await fs.mkdir(out,{recursive:true});
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
try{
  await check('Current rates and actual shoreline support the five staggered stone wakes',()=>{
    assert.equal(STEPPING_STONES.length,5);assert.equal(WATER_DYNAMICS.mainSpeed,.78);assert.equal(WATER_DYNAMICS.detailSpeed,1.35);assert.equal(WATER_DYNAMICS.amplitude,.022);
    for(let z=-3.5;z<4;z+=.1)for(const side of [-1,1]){
      const x=waterBankX(z,side);assert.ok((x-creekX(z))*side>0);
      assert.ok(ground(x,z)>=waterY(z)-.002);
      assert.ok(ground(x-side*.021,z)<waterY(z)+.025);
    }
  });
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5173/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await page.locator('#enter-direct').click();await page.locator('#invitation').waitFor({state:'hidden'});
  await check('Compiled shader wake coordinates match every visible stepping stone',async()=>{
    const data=await page.evaluate(()=>{
      const p=window.__PU,s=p.scene.getObjectByName('creek-surface'),u=s.material.userData.currentUniforms;
      return u.uStonePositions.value.map((v,i)=>{const stone=p.scene.getObjectByName('stepping-stone-'+(i+1));return {wake:v.toArray(),stone:[stone.position.x,stone.position.z]};});
    });
    for(const row of data)assert.deepEqual(row.wake,row.stone);
  });
  let metrics;
  await check('GPU pixels show moving ripples, downstream foam, crest surge and sunlight glints',async()=>{
    metrics=await page.evaluate(async()=>{
      const THREE=await import('/node_modules/three/build/three.module.js');
      const p=window.__PU,water=p.scene.getObjectByName('creek-surface'),u=water.material.userData.currentUniforms;
      const scene=new THREE.Scene(),copy=new THREE.Mesh(water.geometry,water.material);scene.add(copy);
      scene.add(new THREE.HemisphereLight('#ffffff','#608578',1.2));
      const sun=new THREE.DirectionalLight('#ffffff',2);sun.position.set(-11,10.5,7.5);scene.add(sun);
      const w=256,h=256,target=new THREE.WebGLRenderTarget(w,h),camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,20);
      camera.up.set(0,0,-1);
      const renderer=p.renderer,oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha(),oldTime=u.uTime.value;
      const saved={wake:u.uWakeStrength.value,crest:u.uCrestStrength.value,glint:u.uGlintStrength.value};
      const render=(x,z)=>{
        camera.position.set(x,8,z);camera.lookAt(x,0,z);camera.updateMatrixWorld();
        renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);
        const pixels=new Uint8Array(w*h*4);renderer.readRenderTargetPixels(target,0,0,w,h,pixels);return pixels;
      };
      const difference=(a,b)=>{let sum=0,changed=0;for(let i=0;i<a.length;i+=4){let d=0;for(let c=0;c<3;c++)d+=Math.abs(a[i+c]-b[i+c]);sum+=d;if(d>12)changed++;}return {sum,changed};};
      try{
        u.uWakeStrength.value=0;u.uCrestStrength.value=0;u.uGlintStrength.value=0;u.uTime.value=2;
        const still=render(0,0);u.uTime.value=2.4;const moved=render(0,0);
        const movement=difference(still,moved);
        u.uGlintStrength.value=1;const sparkling=render(0,0),glints=difference(moved,sparkling);u.uGlintStrength.value=0;
        const wakeBase=render(0,0);u.uWakeStrength.value=1;const wake=render(0,0),wakes=difference(wakeBase,wake);
        let upstream=0,downstream=0;
        const direction=new THREE.Vector2(.73+.533*Math.cos(-.25*.82),1).normalize(),origin=u.uStonePositions.value[2];
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const i=(y*w+x)*4,d=Math.abs(wake[i]-wakeBase[i])+Math.abs(wake[i+1]-wakeBase[i+1])+Math.abs(wake[i+2]-wakeBase[i+2]);
          if(d<12)continue;
          const point=new THREE.Vector2((x+.5)/w*4-2,2-(y+.5)/h*4).sub(origin);
          if(point.dot(direction)>.1)downstream++;else upstream++;
        }
        u.uWakeStrength.value=0;
        const end=u.uWaterEnd.value,endX=.15+end*.73+.65*Math.sin(end*.82);
        const noCrest=render(endX,end-.25);u.uCrestStrength.value=1;const crest=difference(noCrest,render(endX,end-.25));
        let visible=0,transparent=0;for(let i=3;i<still.length;i+=4){if(still[i]>0){visible++;if(still[i]<150)transparent++;}}
        return {movement,glints,wakes,crest,downstream,upstream,visible,transparent};
      }finally{
        u.uTime.value=oldTime;u.uWakeStrength.value=saved.wake;u.uCrestStrength.value=saved.crest;u.uGlintStrength.value=saved.glint;
        renderer.setRenderTarget(oldTarget);renderer.setClearColor(oldColor,oldAlpha);target.dispose();
      }
    });
    assert.ok(metrics.movement.changed>100,JSON.stringify(metrics));
    assert.ok(metrics.glints.sum>100,JSON.stringify(metrics));
    assert.ok(metrics.wakes.changed>100&&metrics.downstream>metrics.upstream*2,JSON.stringify(metrics));
    assert.ok(metrics.crest.changed>50,JSON.stringify(metrics));
    assert.ok(metrics.transparent/metrics.visible>.8,JSON.stringify(metrics));
    await fs.writeFile(out+'/gpu-metrics.json',JSON.stringify(metrics,null,2));
  });
  await check('Creek detail and waterfall render without shader errors',async()=>{
    await page.evaluate(()=>window.__PU.frame('creek'));await page.waitForTimeout(400);await page.screenshot({path:out+'/creek-detail.png'});
    await page.waitForTimeout(500);await page.screenshot({path:out+'/creek-detail-later.png'});
    await page.evaluate(()=>window.__PU.frame('hero'));await page.waitForTimeout(150);await page.screenshot({path:out+'/overview.png'});
    assert.deepEqual(errors,[]);
  });
  const clock=()=>page.evaluate(()=>window.__PU.scene.getObjectByName('creek-surface').material.userData.currentUniforms.uTime.value);
  await check('Reading pauses water time and reduced motion freezes the complete water shader',async()=>{
    await page.evaluate(()=>window.__PU.discover('mailbox'));await page.locator('#letter-dialog').waitFor({state:'visible'});
    await page.waitForFunction(()=>window.__PU.overlayRenderPaused,null,{timeout:15000});
    const reading=await clock();await page.waitForTimeout(300);assert.equal(await clock(),reading);
    await page.keyboard.press('Escape');await page.locator('#letter-dialog').waitFor({state:'hidden'});
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);
    const frozen=await clock();await page.waitForTimeout(300);assert.equal(await clock(),frozen);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(150);assert.notEqual(await clock(),frozen);
  });
  assert.deepEqual(errors,[]);
}catch(e){failure=e;console.error(e);}
finally{await browser?.close();await fs.writeFile(out+'/result.json',JSON.stringify({checks,errors,failure:failure?.stack||null},null,2));}
if(failure)process.exitCode=1;
