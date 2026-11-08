import * as THREE from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {makeWaterfall,waterfallProfile,waterfallTravel,WATERFALL_DYNAMICS} from '../src/natural/water.js';
import {creekX,waterY,WATER_END} from '../src/natural/land.js';
const out='work/qa/waterfall-liveliness',checks=[],errors=[];let browser,failure;
await fs.mkdir(out,{recursive:true});
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
try{
  await check('Launch arc joins the crest and turns downward; transport accelerates without reversing',()=>{
    assert.ok(WATERFALL_DYNAMICS.speed>=5.8&&WATERFALL_DYNAMICS.speed<=6.5);
    assert.deepEqual(waterfallProfile(0),{drop:0,outward:0});
    let previous=waterfallProfile(0),travel=0;
    for(let i=1;i<=100;i++){
      const p=waterfallProfile(i/100),next=waterfallTravel(i/100);
      assert.ok(p.outward>previous.outward&&p.drop>previous.drop);assert.ok(next>travel);
      previous=p;travel=next;
    }
    assert.ok(waterfallProfile(.1).outward/waterfallProfile(.1).drop>waterfallProfile(1).outward/waterfallProfile(1).drop);
    const velocity=y=>1/((waterfallTravel(y+.001)-waterfallTravel(y-.001))/.002);
    assert.ok(velocity(.9)>velocity(.1)*1.45);
  });
  await check('Cascade geometry is finite, has 40 bounded mist sources and releases resources once',()=>{
    const scene=new THREE.Scene(),fall=makeWaterfall(scene,{value:0},{textureFactory:()=>new THREE.Texture()});
    assert.equal(fall.curtains.length,2);assert.equal(fall.mist.geometry.attributes.position.count,40);
    assert.equal(fall.mist.material.opacity,.44);assert.equal(fall.mist.material.depthWrite,false);
    for(const c of fall.curtains){
      assert.ok([...c.geometry.attributes.position.array,...c.geometry.attributes.normal.array].every(Number.isFinite));
      assert.ok(Math.abs(c.geometry.attributes.position.getY(0)-waterY(WATER_END))<1e-6);
      assert.ok(Math.abs(c.geometry.attributes.position.getZ(0)-(WATER_END-.018))<1e-6);
    }
    for(let i=0;i<40;i++)assert.ok(fall.mist.geometry.attributes.position.getY(i)>=-3.5&&fall.mist.geometry.attributes.position.getY(i)<=-1.8);
    const resources=[...fall.curtains.flatMap(c=>[c.geometry,c.material]),fall.mist.geometry,fall.mist.material,fall.mist.material.map],released=new Map();
    for(const r of resources)r.addEventListener('dispose',()=>released.set(r,(released.get(r)||0)+1));
    fall.dispose();fall.dispose();assert.equal(scene.children.length,0);for(const r of resources)assert.equal(released.get(r),1);
  });
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5173/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await page.locator('#enter-direct').click();await page.locator('#invitation').waitFor({state:'hidden'});
  await check('Actual WebGL water curtain moves and tears below a continuous upper lip',async()=>{
    const metrics=await page.evaluate(async()=>{
      const THREE=await import('/node_modules/three/build/three.module.js'),water=await import('/src/natural/water.js'),land=await import('/src/natural/land.js');
      const p=window.__PU,outer=p.scene.getObjectByName('waterfall-outer-curtain'),mist=p.scene.getObjectByName('waterfall-soft-mist');
      const scene=new THREE.Scene(),copy=new THREE.Mesh(outer.geometry,outer.material);scene.add(copy,new THREE.HemisphereLight('#ffffff','#9caeaf',2));
      const sun=new THREE.DirectionalLight('#ffffff',3);sun.position.set(-11,10.5,7.5);scene.add(sun);
      const width=256,height=384,target=new THREE.WebGLRenderTarget(width,height),endX=land.creekX(land.WATER_END),endY=land.waterY(land.WATER_END);
      const camera=new THREE.OrthographicCamera(-1.5,1.5,2.3,-2.3,.1,30);
      camera.position.set(endX,-1.7,land.WATER_END+8);camera.lookAt(endX,-1.7,land.WATER_END);camera.updateMatrixWorld();
      const renderer=p.renderer,oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha(),time=outer.material.userData.fallUniforms.uTime,oldTime=time.value;
      const render=(t,cam=camera)=>{time.value=t;renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,cam);const data=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,data);return data;};
      const diff=(a,b)=>{let changed=0;for(let i=0;i<a.length;i+=4){if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])+Math.abs(a[i+3]-b[i+3])>20)changed++;}return changed;};
      try{
        const a=render(2),b=render(2.22),movement=diff(a,b);
        const gaps=(start,end)=>{
          let empty=0,total=0;
          for(let y=0;y<24;y++)for(let x=0;x<24;x++){
            const depth=start+(end-start)*y/23,u=.2+.6*x/23,arc=water.waterfallProfile(depth);
            const point=new THREE.Vector3(endX+(u-.5)*land.creekWidth(land.WATER_END)*2*(1-depth*.22)+.018*Math.sin(depth*9),endY-arc.drop,land.WATER_END+arc.outward).project(camera);
            const px=Math.max(0,Math.min(width-1,Math.floor((point.x*.5+.5)*width))),py=Math.max(0,Math.min(height-1,Math.floor((point.y*.5+.5)*height)));
            if(a[(py*width+px)*4+3]<25)empty++;total++;
          }return empty/total;
        };
        const upperGaps=gaps(.04,.18),lowerGaps=gaps(.55,.80);
        copy.visible=false;const mistCopy=new THREE.Points(mist.geometry,mist.material);scene.add(mistCopy);
        const perspective=new THREE.PerspectiveCamera(32,width/height,.1,30);
        perspective.position.set(endX,-2.3,land.WATER_END+8);perspective.lookAt(endX,-2.3,land.WATER_END+.7);perspective.updateMatrixWorld();
        const puffA=render(3,perspective),puffB=render(5,perspective);
        let mistPixels=0;for(let i=3;i<puffA.length;i+=4)if(puffA[i]>5)mistPixels++;
        return {movement,upperGaps,lowerGaps,mistPixels,mistMovement:diff(puffA,puffB),mistCount:mist.geometry.attributes.position.count};
      }finally{time.value=oldTime;renderer.setRenderTarget(oldTarget);renderer.setClearColor(oldColor,oldAlpha);target.dispose();}
    });
    await fs.writeFile(out+'/gpu-metrics.json',JSON.stringify(metrics,null,2));
    assert.ok(metrics.movement>150,JSON.stringify(metrics));
    assert.ok(metrics.upperGaps<.05&&metrics.lowerGaps>metrics.upperGaps+.12,JSON.stringify(metrics));
    assert.equal(metrics.mistCount,40);assert.ok(metrics.mistPixels>200&&metrics.mistMovement>100,JSON.stringify(metrics));
  });
  await check('Waterfall detail and panorama show the cascade with its existing spray rainbow',async()=>{
    await page.evaluate(()=>window.__PU.frame('waterfall'));await page.waitForTimeout(200);await page.screenshot({path:out+'/waterfall-detail.png'});
    await page.waitForTimeout(350);await page.screenshot({path:out+'/waterfall-later.png'});
    assert.equal(await page.evaluate(()=>Boolean(window.__PU.scene.getObjectByName('waterfall-spray-rainbow'))),true);
    await page.evaluate(()=>window.__PU.frame('hero'));await page.waitForTimeout(150);await page.screenshot({path:out+'/overview.png'});
    assert.deepEqual(errors,[]);
  });
  const clock=()=>page.evaluate(()=>window.__PU.scene.getObjectByName('waterfall-outer-curtain').material.userData.fallUniforms.uTime.value);
  await check('Reading and reduced motion freeze both cascade and mist time without browser errors',async()=>{
    assert.equal(await page.evaluate(()=>window.__PU.scene.getObjectByName('waterfall-soft-mist').material.userData.mistUniforms.uTime===window.__PU.scene.getObjectByName('waterfall-outer-curtain').material.userData.fallUniforms.uTime),true);
    await page.evaluate(()=>window.__PU.discover('mailbox'));await page.locator('#letter-dialog').waitFor({state:'visible'});
    await page.waitForFunction(()=>window.__PU.overlayRenderPaused,null,{timeout:15000});
    const paused=await clock();await page.waitForTimeout(250);assert.equal(await clock(),paused);
    await page.keyboard.press('Escape');await page.locator('#letter-dialog').waitFor({state:'hidden'});
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);
    const still=await clock();await page.waitForTimeout(250);assert.equal(await clock(),still);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(150);assert.notEqual(await clock(),still);
    assert.deepEqual(errors,[]);
  });
}catch(e){failure=e;console.error(e);}
finally{await browser?.close();await fs.writeFile(out+'/result.json',JSON.stringify({checks,errors,failure:failure?.stack||null},null,2));}
if(failure)process.exitCode=1;
