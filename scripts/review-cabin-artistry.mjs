import assert from 'node:assert/strict';
import manifest from '../public/models/cabin-interior.manifest.json' with {type:'json'};

export async function reviewCabinArtistry(page,check,observations,out){
 await check('Ivory trim, layered floristry/ivy and woven textiles retain clear window apertures',async()=>{
  const result=await page.evaluate(()=>{
   const p=window.__PU,c=p.cabin.group,ivory=c.getObjectByName('cabin-ivory-painted-trim'),linen=c.getObjectByName('cabin-linen-sheer-curtains'),wool=c.getObjectByName('cabin-couple-plaid-wool');
   const pixel=ivory.material.map.image.getContext('2d').getImageData(64,64,1,1).data;
   let finite=true;c.updateWorldMatrix(true,true);c.traverse(o=>{finite&&=o.matrixWorld.elements.every(Number.isFinite);if(o.isMesh)finite&&=o.geometry.attributes.position.array.every(Number.isFinite);});
   return {finite,stats:c.userData.architecture.artistry,ivory:!!ivory,neutralGrain:Array.from(pixel),linen:{map:!!linen.material.map,opacity:linen.material.opacity,depthWrite:linen.material.depthWrite,foliage:linen.userData.gardenFoliage},wool:{map:!!wool.material.map,roughness:wool.material.roughness},panes:c.userData.architecture.windowPanes,decorOccluders:p.occluders.filter(o=>[ivory,linen,wool,c.getObjectByName('cabin-flowers-and-interior-detail')].includes(o)).length,carving:!!c.getObjectByName('sign-carved-brass-corners')};
  });
  assert.ok(result.finite&&result.ivory&&result.carving);assert.ok(result.neutralGrain.slice(0,3).every(n=>n>240));
  assert.ok(result.linen.map&&result.linen.opacity<.65&&!result.linen.depthWrite&&result.linen.foliage);
  assert.ok(result.wool.map&&result.wool.roughness>.9);assert.equal(result.panes,16);assert.equal(result.decorOccluders,0);
  assert.ok(Object.values(result.stats.flowers).every(n=>n>=30));assert.ok(result.stats.ivyLeaves>=50&&result.stats.foliageLeaves>=300);
  assert.ok(result.stats.chairBounds[3]<-.72&&result.stats.chairBounds[2]>=2.25&&result.stats.chairBounds[5]<2.96);assert.ok(result.stats.tableCentre[0]+.25<-.72);assert.ok(result.stats.chairBackPlaneZ-result.stats.sillBloomFrontZ>.015);
  observations.artistry=result;
 });
 await check('Two hot drinks animate softly; 11 additive halos disappear in daylight and freeze with reduced motion',async()=>{
  const result=await page.evaluate(()=>{
   const p=window.__PU,c=p.cabin,saved=c.group.getObjectByName('porch-warm-light').intensity/28,steam=c.group.getObjectByName('porch-tea-steam'),halo=c.group.getObjectByName('cabin-edison-soft-halos'),sign=c.group.getObjectByName('Our Secret Haven · 2025.09.23');
   c.setWarmth(0);c.updateSmoke(2);const dayVisible=halo.visible,a=Array.from(steam.geometry.attributes.position.array);
   c.updateSmoke(2.25);const b=Array.from(steam.geometry.attributes.position.array);
   c.setWarmth(1);c.updateSmoke(2);const nightVisible=halo.visible,glow=halo.material.opacity,emission=sign.material.emissiveIntensity;
   const f=c.group.getObjectByName('cabin-interior-furniture').material.emissiveIntensity;c.updateSmoke(2.25);const f2=c.group.getObjectByName('cabin-interior-furniture').material.emissiveIntensity;
   c.updateSmoke(0);const stillA=Array.from(steam.geometry.attributes.position.array);c.updateSmoke(0);const stillB=Array.from(steam.geometry.attributes.position.array);
   const r={a,b,stillA,stillB,dayVisible,nightVisible,glow,emission,f,f2,steamCount:steam.geometry.attributes.position.count,haloCount:halo.geometry.attributes.position.count,depthWrite:[steam.material.depthWrite,halo.material.depthWrite],alpha:Array.from(steam.geometry.attributes.color.array).filter((v,i)=>i%4===3)};c.setWarmth(saved);c.updateSmoke(p.sceneTime);return r;
  });
  assert.equal(result.steamCount,12);assert.equal(result.haloCount,11);assert.ok(!result.dayVisible&&result.nightVisible&&result.glow>.15&&result.emission>.15);
  assert.deepEqual(result.depthWrite,[false,false]);assert.ok([...result.a,...result.b].every(Number.isFinite));assert.ok(result.alpha.every(v=>v>=0&&v<=1));
  assert.notDeepEqual(result.a,result.b);assert.deepEqual(result.stillA,result.stillB);assert.notEqual(result.f,result.f2);observations.porchEffects=result;
 });
 for(const values of Object.values(manifest.keepsakes))assert.ok(values.length===3&&values.every(Number.isFinite));
 async function aim(position,target){
  await page.evaluate(({position,target})=>{const p=window.__PU,c=p.cabin.group;p.scenicTour.stop();p.frame('hero');p.controls.minDistance=.1;p.controls.maxPolarAngle=1.7;
   p.camera.position.copy(c.localToWorld(p.camera.position.clone().set(...position)));p.controls.target.copy(c.localToWorld(p.controls.target.clone().set(...target)));p.controls.update();p.camera.updateMatrixWorld(true);
  },{position,target});await page.evaluate(()=>new Promise(requestAnimationFrame));
 }
 for(const mode of ['day','sunset','night']){
  await page.evaluate(mode=>window.__PU.setAtmosphere(mode),mode);
  await page.waitForFunction(mode=>window.__PU.cabin.group.getObjectByName('porch-warm-light').intensity===28*({day:0,sunset:.63,night:1}[mode]),mode);
  for(const [name,position,target] of [
   ['artistry-front',[0,3.4,12.2],[0,1.9,1.2]],
   ['artistry-porch',[-2.8,2.2,5.8],[-.8,1.1,2.45]],
   ['artistry-textiles',[-2.05,1.65,3.5],[-1.55,.93,2.63]],
   ['artistry-sign',[.2,2.5,3.6],[0,2.30,2.016]],
   ['artistry-keepsake',[-.65,1.95,.6],manifest.keepsakes.portrait],
   ['artistry-journal',[.70,1.50,-.45],manifest.keepsakes.openJournal]
  ]){await aim(position,target);await page.screenshot({path:`${out}/${mode}-${name}.png`,style:'#garden-ui,#return-view,#object-hint{visibility:hidden!important}'});}
 }
 console.log('PASS day/sunset/night ivory facade, porch, gilded sign, couple keepsake and journal captures');
}
