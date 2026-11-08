import * as THREE from 'three';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import {createCurvedPetalGeometry,createLeafGeometry,createFallingFoliage,guidingWindGust} from '../src/natural/falling-foliage.js';
import {guidingPetals} from '../src/natural/ceremony.js';

const checks=[],errors=[];let browser,failure;
const out='work/qa/falling-foliage';await fs.mkdir(out,{recursive:true});
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
try{
  await check('Petals and leaves are finite curved indexed surfaces with a notch and pointed leaf tips',()=>{
    for(const geometry of [createCurvedPetalGeometry(),createLeafGeometry()]){
      const {position,normal}=geometry.attributes;
      assert.equal(position.count,49);assert.equal(normal.count,49);assert.ok(geometry.index.count>0);
      assert.ok([...position.array,...normal.array].every(Number.isFinite));
      assert.ok(geometry.boundingBox.max.z-geometry.boundingBox.min.z>.02);
      geometry.dispose();
    }
    const leaf=createLeafGeometry(),p=leaf.attributes.position;
    for(const row of [0,6])assert.ok(Math.abs(p.getX(row*7)-p.getX(row*7+6))<1e-6);
    leaf.dispose();
    const petal=createCurvedPetalGeometry(),v=petal.attributes.position;
    assert.ok(v.getY(3)<v.getY(2));petal.dispose();
  });
  await check('60 world-space particles start at canopy and actual grass heights, recycle and release resources',()=>{
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,12,30);
    const ground=(x,z)=>.8+Math.sin(x)*.1;
    const system=createFallingFoliage(scene,{ground,camera,textureFactory:()=>new THREE.Texture()});
    const {mesh}=system,g=mesh.geometry,m=mesh.material,matrix=mesh.instanceMatrix;
    assert.equal(mesh.count,60);assert.equal(mesh.instanceColor.version,1);
    const kinds=Array.from(g.attributes.foliageKind.array);assert.equal(kinds.filter(k=>k===0).length,32);
    const mat=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
    for(let i=32;i<60;i++){mesh.getMatrixAt(i,mat);position.setFromMatrixPosition(mat);assert.ok(Math.abs(position.y-ground(position.x,position.z)-.05)<1e-6);}
    const canopy=[];
    for(let i=0;i<32;i++){
      mesh.getMatrixAt(i,mat);position.setFromMatrixPosition(mat);canopy.push(position.clone());
      assert.ok(position.x>=-4.5&&position.x<=.5&&position.y>=3.8&&position.y<=7.8&&position.z>=-1.2&&position.z<=3.2);
    }
    for(const [axis,span] of [['x',4],['y',3.2],['z',3.5]])assert.ok(Math.max(...canopy.map(p=>p[axis]))-Math.min(...canopy.map(p=>p[axis]))>span,`${axis} fills the canopy`);
    const before=Array.from(matrix.array);camera.position.set(30,4,-10);system.update(0);
    assert.deepEqual(Array.from(matrix.array),before);
    // Identical seeds and time, different cameras: every matrix component agrees.
    const other=createFallingFoliage(new THREE.Scene(),{ground,textureFactory:()=>new THREE.Texture()});
    system.update(.02);other.update(.02);
    assert.deepEqual(Array.from(matrix.array),Array.from(other.mesh.instanceMatrix.array));other.dispose();
    for(let i=0;i<9000;i++)system.update(.06);
    assert.ok(system.getState().recycles>100);assert.equal(mesh.geometry,g);assert.equal(mesh.material,m);assert.equal(mesh.instanceMatrix,matrix);
    for(let i=0;i<60;i++){mesh.getMatrixAt(i,mat);assert.ok(mat.elements.every(Number.isFinite));const alpha=g.attributes.foliageFade.getX(i);assert.ok(alpha>=0&&alpha<=1);}
    const frozen=Array.from(matrix.array),clock=system.getState().clock;
    system.update(.06,{covered:true});assert.deepEqual(Array.from(matrix.array),frozen);assert.equal(system.getState().clock,clock);
    system.update(.06,{reducedMotion:true});assert.equal(mesh.visible,false);assert.deepEqual(Array.from(matrix.array),frozen);
    system.update(.016);assert.equal(mesh.visible,true);assert.ok(system.getState().clock-clock<.02);
    const released=[0,0,0,0];[g,m,mesh,m.map].forEach((o,i)=>o.addEventListener('dispose',()=>released[i]++));system.dispose();system.dispose();assert.deepEqual(released,[1,1,1,1]);assert.equal(scene.children.length,0);
  });
  await check('Ground seeds rest without a gust, then lift several metres during repeated wind pulses',()=>{
    assert.equal(guidingWindGust(5),0);assert.ok(Math.abs(guidingWindGust(1.875)-1)<1e-9);
    const system=createFallingFoliage(new THREE.Scene(),{textureFactory:()=>new THREE.Texture()});
    const fades=system.mesh.geometry.attributes.foliageFade;
    for(let i=32;i<60;i++)assert.equal(fades.getX(i),0);
    for(let i=0;i<10;i++)system.update(.015);
    for(let i=32;i<60;i++)assert.equal(fades.getX(i),0);
    assert.equal(system.getState().airborne,0);assert.ok(Math.abs(system.getState().meanLift)<1e-9);
    for(let i=0;i<125;i++)system.update(.015);assert.equal(system.getState().airborne,28);assert.ok(system.getState().meanVy>.3);
    for(let i=32;i<60;i++)assert.ok(fades.getX(i)>.5);
    let maxLift=0;for(let i=0;i<1300;i++){system.update(.015);maxLift=Math.max(maxLift,system.getState().meanLift);}assert.ok(maxLift>2);system.dispose();
  });
  await check('Independent three-axis tumbling exposes both faces and wind speeds spread the canopy',()=>{
    const system=createFallingFoliage(new THREE.Scene(),{textureFactory:()=>new THREE.Texture()}),mat=new THREE.Matrix4();
    const initial=[],normals=[],crossed=new Set(),displacements=[];
    for(let i=0;i<32;i++){system.mesh.getMatrixAt(i,mat);initial.push(new THREE.Vector3().setFromMatrixPosition(mat));normals.push(new THREE.Vector3(0,0,1).transformDirection(mat));}
    for(let tick=0;tick<200;tick++){
      system.update(.03);
      for(let i=0;i<32;i++){
        system.mesh.getMatrixAt(i,mat);
        const normal=new THREE.Vector3(0,0,1).transformDirection(mat);
        if(normal.dot(normals[i])<-.5)crossed.add(i);
        if(tick===59)displacements.push(new THREE.Vector3().setFromMatrixPosition(mat).sub(initial[i]));
      }
    }
    assert.ok(crossed.size>=24,`${crossed.size} leaves expose the opposite face`);
    const xs=displacements.map(p=>p.x),zs=displacements.map(p=>p.z);
    assert.ok(Math.max(...xs)/Math.min(...xs)>1.6,'horizontal speed varies across leaves');
    assert.ok(Math.max(...zs)-Math.min(...zs)>.3,'crosswind trajectories diverge');
    system.dispose();
  });
  await check('Ceremony uses three lit curved petals and releases their shared geometry exactly once',()=>{
    const scene=new THREE.Scene(),guide=guidingPetals(scene,new THREE.Vector3(-2,3,1)),group=scene.children[0];
    assert.equal(group.children.length,3);assert.ok(group.children.every(p=>p.material.isMeshStandardMaterial&&p.material.side===THREE.DoubleSide));
    assert.equal(group.children[0].geometry.attributes.position.count,49);
    let freed=0;group.children[0].geometry.addEventListener('dispose',()=>freed++);
    guide.update(2);assert.ok(group.children.every(p=>p.material.opacity>0));guide.update(6);guide.dispose();assert.equal(freed,1);assert.equal(scene.children.length,0);
  });
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5173/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
  await page.locator('#enter-direct').click();await page.locator('#invitation').waitFor({state:'hidden'});
  const snapshot=()=>page.evaluate(()=>{const m=window.__PU.scene.getObjectByName('ambient-falling-foliage');return {matrix:Array.from(m.instanceMatrix.array),version:m.instanceMatrix.version,fadeVersion:m.geometry.attributes.foliageFade.version,visible:m.visible};});
  await check('Canvas atlas contains green veined leaves, white seed fluff and white petals with no pink light',async()=>{
    const result=await page.evaluate(async()=>{
      const m=window.__PU.scene.getObjectByName('ambient-falling-foliage').material,canvas=m.map.image,ctx=canvas.getContext('2d');
      const data=ctx.getImageData(0,0,384,128).data;let green=0,white=0,soft=0;
      for(let i=0;i<data.length;i+=4){if(data[i+3]>30&&data[i+1]>data[i]+20)green++;if(data[i+3]>20&&data[i]>220&&data[i+1]>220&&data[i+2]>200)white++;if(data[i+3]>0&&data[i+3]<240)soft++;}
      const small=document.createElement('canvas');small.width=small.height=16;
      const tiny=small.getContext('2d');tiny.drawImage(canvas,128,0,128,128,0,0,16,16);
      const pixels=tiny.getImageData(0,0,16,16).data;let visibleTuft=0;
      for(let i=0;i<pixels.length;i+=4)if(pixels[i]>220&&pixels[i+1]>220&&pixels[i+3]>70)visibleTuft++;
      const blob=canvas.convertToBlob?await canvas.convertToBlob():await new Promise(r=>canvas.toBlob(r));return {width:canvas.width,green,white,soft,visibleTuft,emissive:m.emissive.getHexString(),intensity:m.emissiveIntensity,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))};
    });assert.equal(result.width,384);assert.ok(result.green>1000&&result.white>1000&&result.soft>1000);assert.equal(result.emissive,'ffffff');assert.equal(result.intensity,.28);assert.ok(result.bytes.length>100);assert.ok(result.visibleTuft>=35,`Fluffy silhouette survives minification: ${result.visibleTuft} pixels`);
    await fs.writeFile(`${out}/green-meadow-texture.png`,Buffer.from(result.bytes));
  });
  await check('Leaves and luminous meadow fluff share one instanced draw call',async()=>{
    const calls=await page.evaluate(()=>{
      const p=window.__PU,scene=new p.scene.constructor(),mesh=p.scene.getObjectByName('ambient-falling-foliage').clone();
      scene.add(mesh);for(const light of p.scene.children.filter(o=>o.isLight))scene.add(light.clone());
      p.renderer.info.reset();p.renderer.render(scene,p.camera);const calls=p.renderer.info.render.calls;
      mesh.dispose();return calls;
    });assert.equal(calls,1);
    const before=await snapshot();await page.waitForTimeout(350);assert.notDeepEqual((await snapshot()).matrix,before.matrix);
    await page.waitForFunction(()=>{const wind=window.__PU.scene.getObjectByName('ambient-falling-foliage').userData.wind;return wind.clock>=8&&wind.gust>.9;},null,{timeout:25000});
    await page.screenshot({path:`${out}/ambient-garden.png`});
    await page.evaluate(()=>window.__PU.frame('tree'));await page.waitForTimeout(250);
    await page.screenshot({path:`${out}/wind-ribbon-tree.png`});
  });
  await check('Real ribbon and mailbox reading freeze foliage GPU uploads and resume on close',async()=>{
    for(const kind of ['ribbon','mailbox']){
      await page.evaluate(kind=>window.__PU.discover(kind),kind);
      const dialog=page.locator(kind==='ribbon'?'#memory-dialog':'#letter-dialog');await dialog.waitFor({state:'visible'});
      const before=await snapshot();await page.waitForTimeout(500);assert.deepEqual(await snapshot(),before);
      await page.waitForFunction(()=>window.__PU.overlayRenderPaused,null,{timeout:15000});
      await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
      await page.waitForFunction(()=>!window.__PU.flying);assert.notDeepEqual((await snapshot()).matrix,before.matrix);
    }
  });
  await check('Live reduced-motion changes hide and freeze ambient foliage, then resume gently',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
    const before=await snapshot();assert.equal(before.visible,false);await page.waitForTimeout(350);assert.deepEqual(await snapshot(),before);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(150);assert.equal((await snapshot()).visible,true);
    assert.notDeepEqual((await snapshot()).matrix,before.matrix);
  });
  assert.deepEqual(errors,[]);
}catch(error){failure=error;console.error(error);}
finally{await fs.writeFile(`${out}/result.json`,JSON.stringify({checks,errors,failure:failure?.stack||null},null,2));await browser?.close();}
if(failure)process.exitCode=1;
