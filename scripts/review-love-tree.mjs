import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173/';
const outputDirectory=process.env.LOVE_TREE_QA_DIR||'work/qa/love-tree';
await fs.mkdir(outputDirectory,{recursive:true});
const checks=[],observations={},errors=[],expectedFailureErrors=[];
let failure=null;
const browser=await chromium.launch({
  executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless:true
});
const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
async function check(name,fn){
  const evidence=await fn();
  checks.push(name);
  if(evidence!==undefined)observations[name]=evidence;
  console.log('PASS',name);
}
async function settled(targetPage=page){
  await targetPage.waitForFunction(()=>window.__PU&&!window.__PU.flying,null,{timeout:30000});
  await targetPage.waitForTimeout(180);
}
async function capture(name,targetPage=page){
  await targetPage.screenshot({path:path.join(outputDirectory,`${name}.png`)});
}
try{
  const responsePromise=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/models/love-tree.glb'),{timeout:60000});
  await page.goto(base,{waitUntil:'networkidle'});
  const response=await responsePromise;
  const glb=await response.body();
  await check('A real GLB 2.0 asset loads before the invitation becomes ready',async()=>{
    assert.equal(response.status(),200);
    assert.ok(glb.length>10000,'The asset must contain actual geometry, not an empty placeholder.');
    assert.equal(glb.readUInt32LE(0),0x46546c67,'The response must be GLB binary, not the Vite HTML fallback.');
    assert.equal(glb.readUInt32LE(4),2);
    assert.equal(glb.readUInt32LE(8),glb.length);
    await page.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
    assert.equal(await page.locator('#enter').isEnabled(),true);
    assert.equal(await page.evaluate(()=>window.__PU.phase),'invitation');
    return {url:response.url(),bytes:glb.length};
  });
  await check('Loaded tree has real finite world bounds and geometry within the design scale',async()=>{
    const result=await page.evaluate(()=>{
      const {treeAsset:asset}=window.__PU;
      const actual=asset.bounds.clone().setFromObject(asset.tree);
      const size=actual.getSize(window.__PU.anchors.ribbon.clone());
      let meshes=0,triangles=0;
      asset.tree.traverse(object=>{
        if(!object.isMesh||object===asset.ribbon)return;
        meshes++;
        triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;
      });
      return {min:actual.min.toArray(),max:actual.max.toArray(),size:size.toArray(),
        recordedMin:asset.bounds.min.toArray(),recordedMax:asset.bounds.max.toArray(),meshes,triangles,
        inScene:!!asset.tree.parent};
    });
    assert.equal(result.inScene,true);
    assert.ok(result.meshes>=2);
    assert.ok(result.triangles>10000);
    assert.ok([...result.min,...result.max].every(Number.isFinite));
    for(let axis=0;axis<3;axis++){
      assert.ok(result.max[axis]>result.min[axis]);
      assert.ok(Math.abs(result.min[axis]-result.recordedMin[axis])<.001);
      assert.ok(Math.abs(result.max[axis]-result.recordedMax[axis])<.001);
    }
    assert.ok(result.size[0]>=18&&result.size[0]<=21,`Tree width outside the intended 18–21m range: ${result.size[0]}`);
    assert.ok(result.size[1]>=14.5&&result.size[1]<=15.5,`Tree height outside the intended 14.5–15.5m range: ${result.size[1]}`);
    return result;
  });
  await check('Unique exported RibbonAnchor, ribbon and scene interaction coordinates agree',async()=>{
    const result=await page.evaluate(()=>{
      const {treeAsset:asset,anchors}=window.__PU;
      const matches=[];
      asset.tree.traverse(object=>{if(object.name==='RibbonAnchor')matches.push(object);});
      const anchorPosition=asset.anchor.getWorldPosition(anchors.ribbon.clone());
      const ribbonPosition=asset.ribbon.getWorldPosition(anchors.ribbon.clone());
      const lineage=[];
      for(let object=asset.ribbon;object;object=object.parent)lineage.push(object.uuid);
      return {anchorCount:matches.length,anchorInTree:lineage.includes(asset.tree.uuid),
        ribbonParentIsAnchor:asset.ribbon.parent===asset.anchor,
        anchor:anchorPosition.toArray(),ribbon:ribbonPosition.toArray(),interaction:anchors.ribbon.toArray(),
        anchorRibbonDistance:anchorPosition.distanceTo(ribbonPosition),
        interactionRibbonDistance:anchors.ribbon.distanceTo(ribbonPosition),
        name:asset.ribbon.name,interactionKind:asset.ribbon.userData.interaction};
    });
    assert.equal(result.anchorCount,1);
    assert.equal(result.anchorInTree,true);
    assert.equal(result.ribbonParentIsAnchor,true);
    assert.ok(result.anchorRibbonDistance<.001);
    assert.ok(result.interactionRibbonDistance<.001);
    assert.equal(result.name,'memory-ribbon');
    assert.equal(result.interactionKind,'ribbon');
    return result;
  });
  await check('Every loaded trunk mesh participates in the scene occlusion registry',async()=>{
    const result=await page.evaluate(()=>{
      const {treeAsset:asset,occluders,interactive}=window.__PU;
      if(!Array.isArray(occluders)||!Array.isArray(interactive))return {registryExposed:false};
      return {registryExposed:true,count:asset.trunkMeshes.length,
        missing:asset.trunkMeshes.filter(object=>!occluders.includes(object)).map(object=>object.name),
        allMeshes:asset.trunkMeshes.every(object=>object.isMesh),
        foliageRegistered:occluders.some(object=>object.userData.gardenFoliage),
        ribbonRegistered:interactive.includes(asset.ribbon)};
    });
    assert.equal(result.registryExposed,true,'Expose the development-only occluders and interactive arrays for this integration check.');
    assert.ok(result.count>0);
    assert.deepEqual(result.missing,[]);
    assert.equal(result.allMeshes,true);
    assert.equal(result.foliageRegistered,false);
    assert.equal(result.ribbonRegistered,true);
    return result;
  });
  await check('Leaf materials use alpha cutout and foliage is excluded from the actual GTAO visibility pass',async()=>{
    const result=await page.evaluate(()=>{
      const {treeAsset:asset,lighting}=window.__PU;
      const foliage=[];
      asset.tree.traverse(object=>{
        if(!object.isMesh)return;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        if(materials.some(material=>/leaves|foliage/i.test(material.name))||/leaves|foliage/i.test(object.name))foliage.push(object);
      });
      const materialProblems=[];
      for(const object of foliage){
        for(const material of Array.isArray(object.material)?object.material:[object.material]){
          if(material.transparent||material.alphaTest<=0||!material.depthWrite)materialProblems.push(material.name);
        }
      }
      const original=foliage.map(object=>object.visible);
      let excluded=false;
      try{
        lighting.contact._overrideVisibility();
        excluded=foliage.every(object=>!object.visible);
      }finally{
        lighting.contact._restoreVisibility();
      }
      return {foliageMeshes:foliage.length,materialProblems,excluded,
        restored:foliage.every((object,index)=>object.visible===original[index])};
    });
    assert.ok(result.foliageMeshes>0);
    assert.deepEqual(result.materialProblems,[]);
    assert.equal(result.excluded,true);
    assert.equal(result.restored,true);
    return result;
  });
  await page.locator('#enter-direct').click();
  await settled();
  await page.locator('#invitation').waitFor({state:'hidden'});
  for(const view of ['hero','side','overhead','opposite']){
    await page.evaluate(which=>window.__PU.frame(which),view);
    await settled();
    await check(`The ${view} overview contains the complete island and authored tree bounds`,async()=>{
      const result=await page.evaluate(()=>{
        const {points,camera,treeAsset:asset,anchors}=window.__PU;
        const corners=[];
        for(const x of [asset.bounds.min.x,asset.bounds.max.x])
          for(const y of [asset.bounds.min.y,asset.bounds.max.y])
            for(const z of [asset.bounds.min.z,asset.bounds.max.z])corners.push(anchors.ribbon.clone().set(x,y,z));
        const projected=[...points,...corners].map(point=>point.clone().project(camera));
        return {samples:projected.length,outside:projected.filter(point=>Math.abs(point.x)>=1||Math.abs(point.y)>=1||point.z<=0||point.z>=1).map(point=>point.toArray()),
          maxX:Math.max(...projected.map(point=>Math.abs(point.x))),maxY:Math.max(...projected.map(point=>Math.abs(point.y)))};
      });
      assert.deepEqual(result.outside,[]);
      return result;
    });
    await capture(`tree-${view}`);
  }
  await page.evaluate(()=>window.__PU.frame('hero'));
  await settled();
  const originalCamera=await page.evaluate(()=>({position:window.__PU.camera.position.toArray(),target:window.__PU.controls.target.toArray()}));
  await check('Clicking the projected physical ribbon opens the memory scroll',async()=>{
    const point=await page.evaluate(()=>{
      const p=window.__PU.anchors.ribbon.clone().project(window.__PU.camera);
      return {x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight,z:p.z};
    });
    assert.ok(point.x>0&&point.x<1600&&point.y>0&&point.y<1000&&point.z>0&&point.z<1);
    await page.mouse.move(point.x,point.y);
    await page.mouse.click(point.x,point.y);
    await page.locator('#memory-dialog').waitFor({state:'visible',timeout:10000});
    assert.equal(await page.evaluate(()=>window.__PU.activePlace),'ribbon');
    assert.equal(await page.evaluate(()=>window.__PU.controls.enabled),false);
    await capture('tree-memory-scroll');
    return point;
  });
  await check('Closing the memory scroll restores the exact previous camera view',async()=>{
    await page.keyboard.press('Escape');
    await page.locator('#memory-dialog').waitFor({state:'hidden'});
    await settled();
    const restored=await page.evaluate(()=>({position:window.__PU.camera.position.toArray(),target:window.__PU.controls.target.toArray()}));
    for(const key of ['position','target'])for(let axis=0;axis<3;axis++){
      assert.ok(Math.abs(restored[key][axis]-originalCamera[key][axis])<.002,`${key}[${axis}] was not restored.`);
    }
    return restored;
  });
  await check('The normal loading and interaction path has no JavaScript or WebGL errors',async()=>assert.deepEqual(errors,[]));

  await check('Manor layout and porch lighting follow the three atmosphere modes',async()=>{
    const layout=await page.evaluate(()=>{
      const {scene,props,treeAsset}=window.__PU;
      const cabin=scene.getObjectByName('secret-haven-cabin');
      const porch=scene.getObjectByName('porch-warm-light');
      return {tree:treeAsset.tree.position.toArray(),cabin:cabin.position.toArray(),
        distance:cabin.position.distanceTo(props.bench.position),daylight:porch.intensity};
    });
    assert.equal(layout.tree[0],-11);assert.equal(layout.tree[2],-4.5);
    assert.equal(layout.cabin[0],-6.5);assert.equal(layout.cabin[2],.5);
    assert.ok(layout.distance>17.5&&layout.distance<18);
    assert.equal(layout.daylight,0);
    await page.setViewportSize({width:1920,height:1080});
    await page.locator('[data-atmo="sunset"]').click();
    await page.waitForFunction(()=>window.__PU.scene.getObjectByName('porch-warm-light').intensity>17.63);
    await page.screenshot({path:'screenshots/07-millennial-tree-and-cabin.png',
      style:'#garden-ui,#loading,#object-hint{visibility:hidden!important}'});
    await page.locator('[data-atmo="night"]').click();
    await page.waitForFunction(()=>window.__PU.scene.getObjectByName('porch-warm-light').intensity===28);
    return layout;
  });

  const failureContext=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  const failurePage=await failureContext.newPage();
  const failurePageErrors=[];
  failurePage.on('pageerror',error=>failurePageErrors.push(error.message));
  failurePage.on('console',message=>{if(message.type()==='error')expectedFailureErrors.push(message.text());});
  const assetPattern='**/models/love-tree.glb';
  await failurePage.route(assetPattern,route=>route.fulfill({status:503,contentType:'text/plain',body:'Deliberate tree asset outage for retry verification.'}));
  await check('A failed tree request keeps the garden unready and offers an explicit retry',async()=>{
    await failurePage.goto(base,{waitUntil:'networkidle'});
    await failurePage.getByRole('button',{name:'重新打开',exact:true}).waitFor({state:'visible'});
    const state=await failurePage.evaluate(()=>({ready:document.documentElement.dataset.sceneReady,
      loading:document.querySelector('#loading').textContent,
      directHidden:document.querySelector('#enter-direct').hidden,
      gardenInert:document.querySelector('#garden-ui').inert}));
    assert.notEqual(state.ready,'true');
    assert.equal(state.directHidden,true);
    assert.equal(state.gardenInert,true);
    assert.match(state.loading,/重试/);
    assert.equal(await failurePage.getByRole('button',{name:'重新打开',exact:true}).isEnabled(),true);
    assert.deepEqual(failurePageErrors,[]);
    await capture('tree-request-failed',failurePage);
    return state;
  });
  await failurePage.unroute(assetPattern);
  const expectedErrorCount=expectedFailureErrors.length;
  await check('Retry recovers after the real GLB request becomes available',async()=>{
    const recoveryResponse=failurePage.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/models/love-tree.glb')&&response.status()===200,{timeout:60000});
    await failurePage.getByRole('button',{name:'重新打开',exact:true}).click();
    await recoveryResponse;
    await failurePage.waitForFunction(()=>document.documentElement.dataset.sceneReady==='true',null,{timeout:90000});
    assert.equal(await failurePage.locator('#enter').isEnabled(),true);
    assert.equal(await failurePage.evaluate(()=>window.__PU.phase),'invitation');
    await failurePage.locator('#enter-direct').click();
    await settled(failurePage);
    assert.equal(await failurePage.evaluate(()=>window.__PU.phase),'exploring');
    assert.deepEqual(failurePageErrors,[]);
    assert.deepEqual(expectedFailureErrors.slice(expectedErrorCount),[],'Retry introduced browser errors after the expected outage.');
    await capture('tree-request-recovered',failurePage);
  });
  await failureContext.close();
}catch(error){
  failure={message:error.message,stack:error.stack};
  throw error;
}finally{
  await fs.writeFile(path.join(outputDirectory,'love-tree-review.json'),JSON.stringify({
    status:failure?'FAIL':'PASS',url:base,checks,errors,expectedFailureErrors,observations,failure
  },null,2));
  await browser.close();
}
