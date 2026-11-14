import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const out='work/qa/render-optimization';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const errors=[],observations={};
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.75,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');await page.locator('#enter-direct').click({timeout:90000});await page.waitForFunction(()=>window.__PU?.phase==='exploring');
 observations.pipeline=await page.evaluate(()=>{
  const p=window.__PU,names=['sunflower-fields','lavender-terraces','lavender-meadow-patches','daisy-petals','daisy-centers','Leaves_ContinuousUmbrella','cabin-flowers-and-interior-detail'];
  const flowers=names.map(name=>p.scene.getObjectByName(name));
  const structure=['meadow-and-soil','cabin-crafted-timber','cabin-stonework',...p.treeAsset.trunkMeshes.map(o=>o.name)].map(name=>p.scene.getObjectByName(name));
  const original=flowers.map(o=>o?.visible);let skipped,solids;
  try{p.lighting.contact._overrideVisibility();skipped=flowers.every(o=>o&&!o.visible);solids=structure.every(o=>o.visible);}
  finally{p.lighting.contact._restoreVisibility();}
  const transmission=[];p.scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.transmission>0)transmission.push(o.name);});
  const wine=p.scene.getObjectByName('picnic-champagne-and-flutes').material;
  return {names,tagged:flowers.every(o=>o?.userData.gardenFoliage),skipped,solids,restored:flowers.every((o,i)=>o.visible===original[i]),occludersClean:!p.occluders.some(o=>o.userData.gardenFoliage),quality:p.lighting.quality,transmission,wine:{color:wine.color.getHexString(),opacity:wine.opacity,roughness:wine.roughness,clearcoat:wine.clearcoat,coatRoughness:wine.clearcoatRoughness,ior:wine.ior,depthWrite:wine.depthWrite},instances:flowers.slice(0,2).map(o=>({name:o.name,count:o.count,triangles:(o.geometry.index?.count||o.geometry.attributes.position.count)/3*o.count}))};
 });
 const r=observations.pipeline;assert.ok(r.tagged&&r.skipped&&r.solids&&r.restored&&r.occludersClean);assert.deepEqual(r.transmission,[]);
 assert.deepEqual(r.quality,{msaaSamples:2,gtaoSamples:8,denoiseSamples:8,pixelRatio:1.4,canvasAntialias:false});
 assert.deepEqual(r.wine,{color:'e5f2e6',opacity:.36,roughness:.08,clearcoat:1,coatRoughness:.04,ior:1.52,depthWrite:false});
 console.log('PASS no scene transmission; all seven flower/leaf batches excluded from GTAO, solids preserved, visibility restored; MSAA=2, GTAO=8, denoise=8, DPR=1.4');
 observations.halos=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),p=window.__PU,source=p.scene.getObjectByName('neural-fly-halos');
  const geometry=source.geometry.clone(),material=source.material.clone();material.onBeforeCompile=source.material.onBeforeCompile;material.customProgramCacheKey=source.material.customProgramCacheKey;
  const batch=new T.InstancedMesh(geometry,material,80),original=new T.Scene(),merged=new T.Scene(),dummy=new T.Object3D(),spriteMaterials=[];
  batch.frustumCulled=false;merged.add(batch);
  for(let i=0;i<80;i++){
   const opacity=(i%8)/8,size=.16+(i%5)*.06;
   dummy.position.set((i%10-4.5)*.26,(Math.floor(i/10)-3.5)*.23,(i%3)*.12);dummy.scale.setScalar(size);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);geometry.attributes.aHaloOpacity.setX(i,opacity);
   const m=new T.SpriteMaterial({map:material.map,color:material.color,opacity,blending:T.AdditiveBlending,depthWrite:false});spriteMaterials.push(m);
   const sprite=new T.Sprite(m);sprite.position.copy(dummy.position);sprite.scale.copy(dummy.scale);original.add(sprite);
  }
  const renderer=p.renderer,target=new T.WebGLRenderTarget(256,256),previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha(),camera=new T.PerspectiveCamera(34,1,.1,30),results=[];
  try{
   renderer.setClearColor('#000000',0);
   for(const position of [[0,0,5],[3,1,4],[-2,2,4]]){
    camera.position.set(...position);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    const pixels=[];
    for(const scene of [original,merged]){renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);const data=new Uint8Array(256*256*4);renderer.readRenderTargetPixels(target,0,0,256,256,data);pixels.push(data);}
    let maxError=0,changed=0,lit=0;for(let i=0;i<pixels[0].length;i++){const d=Math.abs(pixels[0][i]-pixels[1][i]);maxError=Math.max(maxError,d);if(d>0)changed++;if(pixels[0][i]>0)lit++;}
    results.push({position,maxError,changed,lit});
   }
  }finally{renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);target.dispose();batch.dispose();geometry.dispose();material.dispose();for(const m of spriteMaterials)m.dispose();}
  return {count:source.count,results};
 });
 assert.equal(observations.halos.count,80);assert.ok(observations.halos.results.every(r=>r.lit>100&&r.maxError<=2));
 console.log('PASS 80 batched halos match reference THREE.Sprite rendering from three camera angles (pixel error <= 2/255)');
 observations.sky=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),p=window.__PU,source=p.scene.getObjectByName('spring-sky');
  const reference=source.material.clone(),optimized=source.material.clone();reference.fragmentShader=source.material.userData.referenceFragmentShader;reference.customProgramCacheKey=()=> 'sky-reference-qa';optimized.customProgramCacheKey=()=> 'sky-optimized-qa';
  const scene=new T.Scene(),sky=new T.Mesh(source.geometry,optimized);sky.scale.copy(source.scale);scene.add(sky);
  const renderer=p.renderer,target=new T.WebGLRenderTarget(256,160),previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha(),camera=new T.PerspectiveCamera(65,256/160,.15,900),results=[];
  camera.position.set(3,2,6);camera.lookAt(0,8,-40);camera.updateMatrixWorld(true);
  try{
   renderer.setClearColor('#000000',0);
   for(const [dusk,night] of [[0,0],[1,0],[.37,.63],[0,1]]){
    const pixels=[];
    for(const material of [reference,optimized]){
     material.uniforms.dusk.value=dusk;material.uniforms.night.value=night;material.uniforms.time.value=10;sky.material=material;
     renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);const data=new Uint8Array(256*160*4);renderer.readRenderTargetPixels(target,0,0,256,160,data);pixels.push(data);
    }
    let maxError=0,changed=0;for(let i=0;i<pixels[0].length;i++){const d=Math.abs(pixels[0][i]-pixels[1][i]);maxError=Math.max(maxError,d);if(d>0)changed++;}results.push({dusk,night,maxError,changed});
   }
  }finally{renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);target.dispose();reference.dispose();optimized.dispose();}
  return results;
 });
 assert.ok(observations.sky.every(r=>r.maxError<=2));
 console.log('PASS sky endpoint culling matches the original day, sunset, transition and night shader (pixel error <= 2/255)');
 for(const mode of ['night','day','sunset','day']){
  await page.evaluate(mode=>window.__PU.setAtmosphere(mode),mode);await page.waitForFunction(mode=>window.__PU.scene.getObjectByName('porch-warm-light').intensity===(mode==='day'?0:mode==='night'?28:28*.63),mode);
  const result=await page.evaluate(()=>{
   const p=window.__PU,names=['star-dome','emerald-amethyst-aurora','celestial-moon-group','celestial-milky-way','meadow-fireflies','neural-fireflies','bioluminescent-floating-spores'];
   const objects=names.map(name=>p.scene.getObjectByName(name));if(objects.some(o=>!o))throw new Error('Missing named night decoration');return {states:objects.map(o=>({name:o.name,visible:o.visible}))};
  });
  for(const s of result.states){if(mode==='day')assert.equal(s.visible,false,s.name);if(mode==='night')assert.equal(s.visible,true,s.name);}
  observations[mode]=result;
 }
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>window.__PU.renderer.getPixelRatio()),1.4);
 assert.equal(await page.locator('#open-album,#album-photo-count').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS day/night/day restoration, desktop/mobile DPR cap, no permanent album entry; console.error=0, pageerror=0');
}finally{await writeFile(`${out}/pipeline.json`,JSON.stringify({observations,errors},null,2));await browser.close();}
