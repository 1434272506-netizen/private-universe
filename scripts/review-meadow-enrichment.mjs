import * as THREE from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {makeMeadowEcology} from '../src/natural/plants.js';
import {createButterflies} from '../src/natural/butterflies.js';
import {ground,inside,waterY,creekX} from '../src/natural/land.js';

const checks=[],errors=[],out='work/qa/meadow-enrichment';let browser,failure;
await fs.mkdir(out,{recursive:true});
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
const scene=new THREE.Scene(),meadow=makeMeadowEcology(scene),butterflies=createButterflies(scene,meadow.perches);
const meshes=meadow.group.children,byName=name=>meadow.group.getObjectByName(name);
try{
  await check('Meadow has exact habitat counts and stays under the 8000-triangle budget',()=>{
    assert.equal(byName('white-dandelion-seedheads').count,21);assert.equal(byName('golden-dandelions').count,14);
    assert.equal(byName('creek-forget-me-nots').count,150);assert.equal(byName('wet-creek-pebbles').count,12);
    assert.ok(meadow.statistics.triangles+butterflies.group.userData.triangles<8000);
    assert.ok(butterflies.group.userData.triangles/2<60);
    const mat=new THREE.Matrix4(),p=new THREE.Vector3();let left=0,right=0;
    for(const mesh of meshes){
      assert.ok(mesh.isInstancedMesh);assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
      for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,mat);assert.ok(mat.elements.every(Number.isFinite));p.setFromMatrixPosition(mat);
        assert.ok(inside(p.x,p.z));assert.ok(p.y>=waterY(p.z)-.03,mesh.name+' stays out of deep water');
        if(mesh.name==='creek-forget-me-nots'){
          assert.ok(Math.abs(p.y-ground(p.x,p.z))<1e-6);
          const side=p.x<creekX(p.z)?-1:1;if(side<0)left++;else right++;
          let edge=Math.abs(p.x-creekX(p.z));
          while(edge>0&&ground(creekX(p.z)+side*edge,p.z)>waterY(p.z)+.025)edge-=.005;
          const bank=Math.abs(p.x-creekX(p.z))-edge;
          assert.ok(bank>=.24&&bank<=.64,bank);
        }
      }
    }
    assert.equal(left,75);assert.equal(right,75);
    assert.equal(byName('wet-creek-pebbles').material.roughness,.16);
    assert.equal(byName('pebble-moss-caps').material.color.getHexString(),'2d6a4f');
    const m=byName('white-dandelion-seedheads').material;assert.equal(m.emissive.getHexString(),'ffffff');assert.equal(m.emissiveIntensity,.22);assert.equal(m.opacity,.88);
  });
  const step=(dt,options={})=>{meadow.update(dt,options);butterflies.update(dt,{...options,windTime:meadow.clock});};
  const transforms=()=>({matrices:meshes.map(m=>Array.from(m.instanceMatrix.array)),butterflies:butterflies.getState(),wings:butterflies.group.children.map(b=>b.children.slice(1).map(w=>w.rotation.z))});
  await check('Resting butterflies breathe at 1.2Hz and remain on actual swaying flower tips',()=>{
    const wing=butterflies.group.children[0].children[1],initial=wing.rotation.z;
    for(let i=0;i<25;i++)butterflies.update(1/30,{windTime:0});
    assert.ok(Math.abs(wing.rotation.z-initial)<1e-8);
    step(.03);
    for(const b of butterflies.getState().states){
      const p=meadow.perches[b.perch].getPoint(new THREE.Vector3());p.y+=.018;
      assert.ok(p.distanceTo(new THREE.Vector3(...b.position))<1e-8);assert.equal(b.state,'perched');
    }
  });
  await check('Gust edge triggers one spiral, followed by a smooth landing on a different flower in 3–4 seconds',()=>{
    const old=butterflies.getState().states.map(b=>b.perch);
    let previous=butterflies.getState().states.map(b=>new THREE.Vector3(...b.position)),landings=[0,0],highest=[0,0];
    for(let i=0;i<260;i++){
      const before=butterflies.getState();step(.02);const state=butterflies.getState();
      state.states.forEach((b,j)=>{
        const p=new THREE.Vector3(...b.position);assert.ok(p.distanceTo(previous[j])<.16,'flight remains continuous');previous[j]=p;
        highest[j]=Math.max(highest[j],p.y-ground(p.x,p.z));
        if(before.states[j].state==='flying'&&b.state==='perched')landings[j]=b.age;
      });
    }
    butterflies.getState().states.forEach((b,j)=>{assert.equal(b.flights,1);assert.equal(b.state,'perched');assert.notEqual(b.perch,old[j]);assert.ok(landings[j]>=3&&landings[j]<=4);assert.ok(highest[j]>.5);});
  });
  await check('Reading freezes every habitat transform and reduced motion keeps butterflies perched',()=>{
    const before=transforms();for(let i=0;i<40;i++)step(.06,{covered:true});assert.deepEqual(transforms(),before);
    step(.02);butterflies.disturb(new THREE.Vector3(...butterflies.getState().states[0].position));assert.equal(butterflies.getState().states[0].state,'flying');
    butterflies.setReducedMotion(true);assert.ok(butterflies.getState().states.every(b=>b.state==='perched'));
    const still=transforms();for(let i=0;i<30;i++)step(.06,{reducedMotion:true});assert.deepEqual(transforms(),still);
    step(.02);assert.notDeepEqual(transforms(),still);
  });
  await check('Habitat and butterfly resources dispose exactly once',()=>{
    const resources=new Set();scene.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);if(o.isInstancedMesh)resources.add(o);}});
    const disposed=new Map();for(const r of resources)r.addEventListener('dispose',()=>disposed.set(r,(disposed.get(r)||0)+1));
    meadow.dispose();butterflies.dispose();meadow.dispose();butterflies.dispose();
    assert.equal(scene.children.length,0);for(const r of resources)assert.equal(disposed.get(r),1);
  });
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5173/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await page.locator('#enter-direct').click();await page.locator('#invitation').waitFor({state:'hidden'});
  const snapshot=()=>page.evaluate(()=>({clock:window.__PU.meadow.clock,versions:window.__PU.meadow.group.children.map(m=>m.instanceMatrix.version),butterflies:window.__PU.butterflies.getState()}));
  await check('Real WebGL habitat renders, butterflies take flight and screenshots show creek detail',async()=>{
    await page.waitForFunction(()=>window.__PU.butterflies.getState().states.some(b=>b.state==='flying'),null,{timeout:20000});
    assert.equal(await page.evaluate(()=>window.__PU.statistics.forgetMeNots),150);
    await page.screenshot({path:out+'/meadow-overview.png'});
    await page.evaluate(()=>{const p=window.__PU;p.controls.minDistance=2;p.camera.position.set(3.2,2.8,5.8);p.controls.target.set(.6,.6,1.3);p.controls.update();});
    await page.waitForTimeout(200);await page.screenshot({path:out+'/creek-detail.png'});
  });
  await check('Actual mailbox freezes ecology uploads and butterflies, then resumes on close',async()=>{
    await page.evaluate(()=>window.__PU.discover('mailbox'));await page.locator('#letter-dialog').waitFor({state:'visible'});
    const before=await snapshot();await page.waitForTimeout(500);assert.deepEqual(await snapshot(),before);
    await page.keyboard.press('Escape');await page.locator('#letter-dialog').waitFor({state:'hidden'});await page.waitForTimeout(200);assert.notDeepEqual(await snapshot(),before);
  });
  await check('Live reduced motion rests both butterflies and freezes ecology',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);
    const before=await snapshot();assert.ok(before.butterflies.states.every(b=>b.state==='perched'));
    await page.waitForTimeout(300);assert.deepEqual(await snapshot(),before);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(150);assert.notDeepEqual(await snapshot(),before);
  });
  assert.deepEqual(errors,[]);
}catch(e){failure=e;console.error(e);}
finally{meadow.dispose();butterflies.dispose();await browser?.close();await fs.writeFile(out+'/result.json',JSON.stringify({checks,errors,failure:failure?.stack||null},null,2));}
if(failure)process.exitCode=1;
