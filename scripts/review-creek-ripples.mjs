import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const out='work/qa/creek-ripples';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
  const page=await browser.newPage({viewport:{width:1120,height:740}});
  // Isolate pointer impulses from autonomous fish/turtle wakes before the first GPU step.
  await page.addInitScript(()=>Object.defineProperty(window,'__PU',{configurable:true,set(p){Object.defineProperty(window,'__PU',{value:p,writable:true,configurable:true});p.creekEcology.setCounts({silver:0,clown:0,turtle:0});p.koi.setWakesEnabled(false);}}));
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout:90000});
  await page.evaluate(()=>window.__PU.frame('creek'));
  await page.waitForFunction(()=>!window.__PU.flying);
  const point=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {creekX,waterY}=await import('/src/natural/land.js');
    const p=new THREE.Vector3(creekX(1),waterY(1),1).project(window.__PU.camera);
    return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
  });
  async function energy(){
    return page.evaluate(async()=>{
      const THREE=await import('/node_modules/three/build/three.module.js');
      const p=window.__PU,target=p.creekRipples.getTarget();
      const data=new Uint16Array(128*512*4);
      p.renderer.readRenderTargetPixels(target,0,0,128,512,data);
      let energy=0,foam=0;
      for(let i=0;i<data.length;i+=4){
        const h=THREE.DataUtils.fromHalfFloat(data[i]);
        if(!Number.isFinite(h))throw new Error('Nonfinite height');
        energy+=Math.abs(h);foam+=THREE.DataUtils.fromHalfFloat(data[i+2]);
      }
      return {energy,foam};
    });
  }
  assert.equal((await energy()).energy,0);
  await page.screenshot({path:out+'/before.png'});
  await page.mouse.click(point.x,point.y);
  await page.waitForTimeout(160);
  const click=await energy();
  assert.ok(click.energy>1&&click.foam>0,JSON.stringify({point,click,errors}));
  await page.screenshot({path:out+'/click.png'});
  for(let i=0;i<12;i++){await page.mouse.move(point.x-35+i*6,point.y+10);await page.waitForTimeout(55);}
  const sweep=await energy();assert.ok(sweep.energy>1);
  await page.screenshot({path:out+'/sweep.png'});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForTimeout(150);
  const frozen=await energy();await page.waitForTimeout(250);assert.deepEqual(await energy(),frozen);
  assert.deepEqual(errors,[]);
  await fs.writeFile(out+'/result.json',JSON.stringify({click,sweep,frozen,errors},null,2));
  console.log('PASS real mouse click and sweep produce finite GPU height/foam; reduced motion freezes simulation');
}finally{await browser.close();}
