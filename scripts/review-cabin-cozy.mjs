import assert from 'node:assert/strict';
import manifest from '../public/models/cabin-interior.manifest.json' with {type:'json'};

export async function reviewCabinCozy(page,check,observations,out){
 await check('Lifted compact pig: small attached crown ears, 22mm button snout and fine silk bow',async()=>{
  assert.equal(manifest.layout.piglet[1],.745);assert.equal(manifest.piglet.design,'compact-crown-button-nose-fine-ribbon-v2');
  const head=manifest.piglet.metrics.find(m=>m.name==='head'),nose=manifest.piglet.metrics.find(m=>m.name==='button-snout');
  const ears=manifest.piglet.metrics.filter(m=>m.name.startsWith('compact-ear'));
  assert.equal(ears.length,2);
  for(const ear of ears){assert.ok(ear.max[0]-ear.min[0]>.025&&ear.max[0]-ear.min[0]<.045);assert.ok(ear.max[1]-ear.min[1]>.04&&ear.max[1]-ear.min[1]<.06);assert.ok(Math.max(Math.abs(ear.min[0]),Math.abs(ear.max[0]))<head.max[0]);}
  assert.ok(nose.max[2]-nose.min[2]>.021&&nose.max[2]-nose.min[2]<.0245);assert.ok(nose.max[0]-nose.min[0]<.082);
  assert.ok(manifest.piglet.optimizedParts.filter(p=>p.name.startsWith('compact-ear')).every(p=>p.embeddedVertices>=1));
  assert.ok(manifest.piglet.optimizedParts.find(p=>p.name==='head').triangles>=260);assert.ok(manifest.piglet.features.includes('fine-silk-bow'));
  observations.pigletShape={ears,nose,parts:manifest.piglet.optimizedParts};
 });
 await check('Requested Kenney tea, cookies, radio, succulents, paired wall lamps, three floor plants and bolster are present',async()=>{
  const counts={};for(const asset of manifest.assets)counts[asset.asset]=(counts[asset.asset]||0)+1;
  for(const name of ['food/cup-saucer.glb','food/cookie.glb','furniture/radio.glb','furniture/plantSmall2.glb','furniture/plantSmall3.glb','furniture/lampWall.glb','furniture/pottedPlant.glb','furniture/pillowLong.glb'])assert.ok(counts[name],name);
  assert.equal(counts['furniture/lampWall.glb'],2);assert.equal(counts['furniture/pottedPlant.glb'],3);assert.equal(counts['food/cookie.glb'],3);
  assert.ok(manifest.totalTriangles>=5400&&manifest.totalTriangles<=5950);assert.equal(manifest.drawCallMeshes,2);assert.ok(manifest.optimization.hiddenSurfaceTrianglesRemoved>=400);
  observations.cozyAssets=counts;
 });
 await check('Book pages, couple portrait and floor stay visible after surface optimization',async()=>{
  const result=await page.evaluate(async()=>{
   const {Vector3,Raycaster}=await import('/node_modules/three/build/three.module.js');const p=window.__PU,c=p.cabin.group,m=c.getObjectByName('cabin-interior-furniture'),hits=[];
   for(const x of [-.115,-.025]){
    const ray=new Raycaster(c.localToWorld(new Vector3(x,1.1,-.14)),new Vector3(0,-1,0),0,2),hit=ray.intersectObject(m,false)[0];
    hits.push({y:c.worldToLocal(hit.point.clone()).y,colour:[hit.face.a,hit.face.b,hit.face.c].map(i=>[m.geometry.attributes.color.getX(i),m.geometry.attributes.color.getY(i),m.geometry.attributes.color.getZ(i)])});
   }return hits;
  });
  assert.ok(result.every(hit=>hit.y>.751&&hit.y<.757&&hit.colour.every(c=>c[0]>.65&&c[1]>.5)));
  assert.ok(Math.abs(manifest.surfaceChecks.floorY-.376)<.00001);assert.ok(Math.abs(manifest.surfaceChecks.portraitDepth-.465)<.001);observations.paintedSurfaces=result;
 });
 const originalFov=await page.evaluate(()=>window.__PU.camera.fov);
 try{
  for(const mode of ['day','sunset','night']){
   await page.evaluate(mode=>window.__PU.setAtmosphere(mode),mode);await page.waitForFunction(mode=>window.__PU.cabin.group.getObjectByName('porch-warm-light').intensity===28*({day:0,sunset:.63,night:1}[mode]),mode);
   for(const [name,position,target,fov] of [
    ['pig-front',[1.27,1.35,1.25],[1.28,.99,.40],34],
    ['panorama',[.08,2.30,1.58],[.05,.95,-.30],64],
    ['radio',[.9,1.55,.05],[1.44,1.37,-1.2],34],
    ['tea-table',[-.16,1.35,.68],[-.17,.75,-.03],34]
   ]){
    await page.evaluate(({position,target,fov})=>{const p=window.__PU,c=p.cabin.group;p.scenicTour.stop();p.frame('hero');p.controls.minDistance=.1;p.controls.maxPolarAngle=1.7;p.camera.fov=fov;p.camera.updateProjectionMatrix();p.camera.position.copy(c.localToWorld(p.camera.position.clone().set(...position)));p.controls.target.copy(c.localToWorld(p.controls.target.clone().set(...target)));p.controls.update();p.camera.updateMatrixWorld(true);},{position,target,fov});
    await page.evaluate(()=>new Promise(requestAnimationFrame));await page.screenshot({path:`${out}/${mode}-cozy-${name}.png`,style:'#garden-ui,#return-view,#object-hint{visibility:hidden!important}'});
   }
  }
 }finally{await page.evaluate(fov=>{window.__PU.camera.fov=fov;window.__PU.camera.updateProjectionMatrix();},originalFov);}
 console.log('PASS day/sunset/night compact pig front, furnished panorama, vintage radio and tea table captures');
}
