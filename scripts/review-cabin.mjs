import assert from 'node:assert/strict';
import {mkdir,writeFile,stat} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import baseline from './fixtures/cabin-structure-baseline.json' with {type:'json'};
import interiorManifest from '../public/models/cabin-interior.manifest.json' with {type:'json'};
import {reviewCabinInteractions} from './review-cabin-interactions.mjs';
import {reviewCabinHearth,reviewCabinProduction} from './review-cabin-hearth.mjs';
import {reviewCabinArtistry} from './review-cabin-artistry.mjs';
import {reviewCabinCozy} from './review-cabin-cozy.mjs';
const hasParts=await stat('public/models/cabin-parts.glb').then(()=>true,()=>false);
const out='work/qa/cabin';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const errors=[],observations={},checks=[];let failure;
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');await page.locator('#enter-direct').click({timeout:90000});await page.locator('#invitation').waitFor({state:'hidden'});
 async function check(name,action){await action();checks.push(name);console.log('PASS',name);}
 await check('makeCabin interface, fixed name, exact warmth equation and deterministic reduced-motion chime',async()=>{
  const result=await page.evaluate(async()=>{
   const {makeCabin}=await import('/src/natural/cabin.js'),c=makeCabin(),light=c.group.getObjectByName('porch-warm-light'),values=[];
   for(const amount of [0,.2,.63,1]){c.setWarmth(amount);values.push(light.intensity);}
   c.updateSmoke(0);const chime=c.group.getObjectByName('porch-brass-wind-chime'),a=chime.quaternion.toArray();c.updateSmoke(0);const b=chime.quaternion.toArray();c.updateSmoke(2);const moving=chime.quaternion.toArray();
   return {keys:Object.keys(c).sort(),name:c.group.name,walls:c.walls.every(o=>o.isMesh),values,a,b,moving};
  });
  for(const key of ['group','setWarmth','updateSmoke','walls'])assert.ok(result.keys.includes(key));assert.ok(result.keys.includes('loadParts'));assert.equal(result.name,'secret-haven-cabin');assert.ok(result.walls);
  assert.deepEqual(result.values,[0,28*.2,28*.63,28]);assert.deepEqual(result.a,result.b);assert.ok(result.moving.every(Number.isFinite));assert.notDeepEqual(result.a,result.moving);observations.interface=result;
 });
 await check('21 ground-fitted lamps clear the expanded porch footprint and telescope deck',async()=>{
  const result=await page.evaluate(async()=>{
   const {onCabinFloor,ground,creekX,creekWidth}=await import('/src/natural/land.js'),p=window.__PU,l=p.estateFeatures.lanterns;
   return {count:l.count,sites:l.sites,clashes:l.sites.filter(([x,y,z])=>onCabinFloor(x,z,.45)),groundErrors:l.sites.map(([x,y,z])=>Math.abs(y-ground(x,z))),wet:l.sites.filter(([x,y,z])=>Math.abs(x-creekX(z))<creekWidth(z)),deck:l.sites.filter(([x,y,z])=>x>=16.65&&x<=19.75&&z>=.65&&z<=3.35)};
  });assert.equal(result.count,21);assert.deepEqual(result.clashes,[]);assert.deepEqual(result.deck,[]);assert.deepEqual(result.wet,[]);assert.ok(result.groundErrors.every(e=>e<1e-9));assert.deepEqual(result.sites,baseline.sites);observations.lamps=result;
 });
 await check('All cabin vertices are finite; structural feet and stone landing meet real terrain; stairs stay within the original footprint',async()=>{
  const result=await page.evaluate(async()=>{
   const {CABIN_SITE,ground}=await import('/src/natural/land.js'),p=window.__PU,c=p.scene.getObjectByName('secret-haven-cabin'),f=c.userData.architecture;
   let vertices=0,finite=true,triangles=0;const names=[];
   c.updateWorldMatrix(true,true);c.traverse(o=>{if(!o.matrixWorld.elements.every(Number.isFinite))finite=false;if(o.isMesh){names.push(o.name);const g=o.geometry,a=g.attributes.position;vertices+=a.count;triangles+=(g.index?.count||a.count)/3;for(let i=0;i<a.array.length;i++)if(!Number.isFinite(a.array[i]))finite=false;}});
   const groundAt=(x,z)=>{const world=c.localToWorld(p.camera.position.clone().set(x,0,z));return ground(world.x,world.z)-c.position.y;};
   const feet=f.supports.map(({x,z,bottom,top})=>({depth:groundAt(x,z)-bottom,top,bottom}));
   const landing=f.steps.at(-1);
   const obstacles=p.neuralFireflies.getDiagnostics().obstacles,cabinBox=obstacles.at(-1);
   return {finite,vertices,triangles,names,feet,windowPanes:f.windowPanes,stringBulbs:f.stringBulbs,steps:f.steps,landingDepth:groundAt(0,landing.z)-landing.bottom,worldPosition:c.position.toArray(),yaw:c.rotation.y,box:cabinBox};
  });assert.ok(result.finite);assert.ok(result.vertices>50000);assert.ok(result.feet.every(f=>f.depth>=0&&f.depth<.1&&f.top>f.bottom));
  assert.ok(result.landingDepth>=0&&result.landingDepth<.1);assert.ok(result.steps.every(s=>s.z+s.depth/2<=3.620001));
  assert.equal(result.stringBulbs,11);assert.equal(result.windowPanes,16);assert.deepEqual(result.steps,baseline.steps);assert.deepEqual(result.feet,baseline.feet);
  assert.ok(result.steps[0].top>result.steps[1].top&&result.steps[1].top>result.steps[2].top);
  assert.equal(result.worldPosition[0],-6.5);assert.equal(result.worldPosition[2],.5);assert.equal(result.yaw,Math.PI/3);
  for(const name of ['cabin-bronze-trim','cabin-log-end-grain','cabin-iron-and-cables','cabin-recessed-window-glass','cabin-interior-furniture','cabin-interior-glow'])assert.ok(result.names.includes(name));
  observations.structure=result;
 });
 await check('Physical clear glass and separate frosted glass, with no transmission pass',async()=>{
  const result=await page.evaluate(()=>{
   const c=window.__PU.scene.getObjectByName('secret-haven-cabin'),g=c.getObjectByName('cabin-recessed-window-glass').material,f=c.getObjectByName('cabin-frosted-and-lantern-glass').material;
   return {glass:{physical:g.isMeshPhysicalMaterial,ior:g.ior,reflectivity:g.reflectivity,clearcoat:g.clearcoat,roughness:g.roughness,coatRoughness:g.clearcoatRoughness,metalness:g.metalness,transmission:g.transmission,normalMap:!!g.normalMap,normalScale:g.normalScale.toArray(),depthWrite:g.depthWrite,color:g.color.getHexString(),environmentBound:g.envMap===window.__PU.scene.environment},frost:{physical:f.isMeshPhysicalMaterial,ior:f.ior,clearcoat:f.clearcoat,roughness:f.roughness,transmission:f.transmission,normalMap:!!f.normalMap},oldPlaneAbsent:!c.getObjectByName('cabin-warm-room-layers')};
  });
  assert.ok(result.glass.physical&&result.glass.clearcoat>=.8&&result.glass.ior>=1.45);assert.equal(result.glass.ior,1.52);assert.equal(result.glass.roughness,.028);assert.equal(result.glass.coatRoughness,.02);assert.equal(result.glass.metalness,0);assert.equal(result.glass.transmission,0);assert.equal(result.glass.depthWrite,false);assert.ok(result.glass.environmentBound);assert.equal(result.glass.color,'f0f6f8');assert.deepEqual(result.glass.normalScale,[.035,.035]);
  assert.ok(result.glass.normalMap&&result.frost.physical&&result.frost.normalMap&&result.oldPlaneAbsent);assert.equal(result.frost.transmission,0);assert.equal(result.frost.roughness,.24);observations.materials=result;
 });
 if(hasParts)await check('GLB artisan parts loaded once, correct Y-up attachment positions and under 5000 triangles',async()=>{
  const result=await page.evaluate(()=>{
   const p=window.__PU,c=p.scene.getObjectByName('secret-haven-cabin'),parts=c.getObjectByName('cabin-artisan-parts');if(!parts)return {loaded:false};
   let triangles=0,finite=true,allExcluded=true,shadowsDisabled=true,vertexTintsValid=true;parts.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v))finite=false;allExcluded&&=!p.occluders.includes(o);shadowsDisabled&&=!o.castShadow&&o.receiveShadow;if(o.material.vertexColors)vertexTintsValid&&=!!o.geometry.attributes.color&&o.geometry.attributes.color.array.every(v=>v===1);}});
   const marker=parts.getObjectByName('porch-lamp-wick'),v=marker.getWorldPosition(p.camera.position.clone());c.worldToLocal(v);
   const door=parts.getObjectByName('door-hardware');const vertices=[];door.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const q=p.camera.position.clone().fromBufferAttribute(a,i);o.localToWorld(q);c.worldToLocal(q);vertices.push(q.toArray());}});
   return {loaded:true,triangles,finite,allExcluded,shadowsDisabled,vertexTintsValid,groups:['door-hardware','window-hardware','chimney-cap-detail','porch-hanging-lamp'].map(n=>!!parts.getObjectByName(n)),marker:v.toArray(),doorBounds:[Math.min(...vertices.map(v=>v[0])),Math.max(...vertices.map(v=>v[0]))],fallbacks:[c.getObjectByName('cabin-door-hardware-fallback').visible,c.getObjectByName('cabin-hanging-lantern-fallback').visible]};
  });
  assert.ok(result.loaded&&result.finite&&result.allExcluded&&result.shadowsDisabled&&result.vertexTintsValid);assert.ok(result.triangles<5000&&result.triangles>1000);assert.ok(result.groups.every(Boolean));assert.deepEqual(result.fallbacks,[false,false]);
  for(const [i,v] of [-.88,1.952,2.47].entries())assert.ok(Math.abs(result.marker[i]-v)<1e-5);assert.ok(result.doorBounds[0]>.20&&result.doorBounds[1]<.38);
  const repeat=await page.evaluate(async()=>{const {makeCabin}=await import('/src/natural/cabin.js'),c=makeCabin();await Promise.all([c.loadParts(),c.loadParts()]);await c.loadParts();return c.group.children.filter(o=>o.name==='cabin-artisan-parts').length;});assert.equal(repeat,1);observations.parts=result;
 });
 await check('True 3D room: two RGB/RGBA-compatible meshes, correct local bounds, tinted emission, no additional lights or occluders',async()=>{
  const result=await page.evaluate(async()=>{
   const p=window.__PU,c=p.scene.getObjectByName('secret-haven-cabin'),room=c.getObjectByName('cabin-interior-room');
   const meshes=[],bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];let triangles=0,excluded=true,shadows=true,rgba=true;
   room.traverse(o=>{if(!o.isMesh)return;meshes.push(o.name);const a=o.geometry.attributes.position;triangles+=(o.geometry.index?.count||a.count)/3;excluded&&=!p.occluders.includes(o);shadows&&=!o.castShadow&&o.receiveShadow;rgba&&=[3,4].includes(o.geometry.attributes.color?.itemSize);
    for(let i=0;i<a.count;i++){const v=c.worldToLocal(o.localToWorld(p.camera.position.clone().fromBufferAttribute(a,i))).toArray();for(let k=0;k<3;k++){bounds[k]=Math.min(bounds[k],v[k]);bounds[k+3]=Math.max(bounds[k+3],v[k]);}}
   });
   let lights=0;p.scene.traverse(o=>{if(o.isPointLight)lights++;});
   const furniture=room.getObjectByName('cabin-interior-furniture').material,glow=room.getObjectByName('cabin-interior-glow').material;
   const shader={fragmentShader:'#include <emissivemap_fragment>'};furniture.onBeforeCompile(shader);
   const {makeCabin}=await import('/src/natural/cabin.js'),fresh=makeCabin();await fresh.loadParts();
   const f=fresh.group.getObjectByName('cabin-interior-furniture').material,g=fresh.group.getObjectByName('cabin-interior-glow').material,curves=[];
   for(const amount of [0,.2,.63,1]){fresh.setWarmth(amount);fresh.updateSmoke(0);curves.push([f.emissiveIntensity,g.emissiveIntensity]);}
   // Ray through open pane centres must reach the real room, not a timber backplate.
   const {Raycaster,Vector3}=await import('/node_modules/three/build/three.module.js'),rays=[];
   c.updateMatrixWorld(true);
   for(const [origin,direction] of [1.08,1.20,1.50,1.65].flatMap(x=>[1.10,1.32,1.72,1.90].map(y=>[[x,y,2.50],[0,0,-1]]))){
    const ray=new Raycaster(c.localToWorld(new Vector3(...origin)),new Vector3(...direction).transformDirection(c.matrixWorld),0,6);
    const wall=ray.intersectObject(c.getObjectByName('cabin-crafted-timber'),false)[0],inside=ray.intersectObject(room,true)[0];
    rays.push({wall:wall?.distance??null,inside:inside?.distance??null});
   }
   return {meshes,triangles,bounds,excluded,shadows,rgba,lights,extraLight:!!c.getObjectByName('artisan-lamp-wick-light'),occluders:p.occluders.filter(o=>{let a=o;while(a){if(a===c)return true;a=a.parent;}return false;}).map(o=>o.name),shader:shader.fragmentShader,vertexColors:furniture.vertexColors&&glow.vertexColors,curves,rays};
  });
  observations.interior=result;assert.deepEqual(result.meshes.sort(),['cabin-interior-furniture','cabin-interior-glow']);assert.equal(result.triangles,interiorManifest.totalTriangles);assert.ok(result.triangles<6000);
  assert.equal(interiorManifest.drawCallMeshes,2);assert.equal(interiorManifest.theme,'forest-green-and-lavender / sleepy-pink-piglet');assert.ok(interiorManifest.layout.piglet[2]>interiorManifest.layout.sofa[2]);
  assert.ok(result.excluded&&result.shadows&&result.rgba&&result.vertexColors);assert.equal(result.lights,4);assert.equal(result.extraLight,false);
  assert.deepEqual(result.occluders.sort(),['Our Secret Haven · 2025.09.23','cabin-crafted-timber','cabin-log-end-grain','cabin-stonework'].sort());
  assert.ok(result.bounds[0]>=-1.960001&&result.bounds[3]<=1.960001&&result.bounds[1]>=.349&&result.bounds[4]<=3.635&&result.bounds[2]>=-1.575&&result.bounds[5]<=1.675);
  assert.ok(result.shader.includes('USE_COLOR_ALPHA')&&result.shader.includes('totalEmissiveRadiance *= vColor.rgb'));
  for(const [i,a] of [0,.2,.63,1].entries())assert.deepEqual(result.curves[i],[.13+.13*a,.18+1.55*a]);
  assert.ok(result.rays.every(r=>r.wall===null||r.wall>1.0));assert.ok(result.rays.some(r=>r.inside!==null&&r.inside<r.wall));observations.interior=result;
 });
 await check('Missing interior independently preserves artisan parts; all load calls deduplicate both roots',async()=>{
  await page.route('**/models/cabin-interior.glb',r=>r.fulfill({status:200,contentType:'model/gltf-binary',body:'invalid interior'}));
  const result=await page.evaluate(async()=>{const {makeCabin}=await import('/src/natural/cabin.js'),c=makeCabin(),a=c.loadParts(),b=c.loadParts();const parts=await a;await b;return {same:a===b,parts:!!parts,partsCount:c.group.children.filter(o=>o.name==='cabin-artisan-parts').length,room:!!c.group.getObjectByName('cabin-interior-room'),status:c.group.userData};});
  assert.ok(result.same&&result.parts&&!result.room);assert.equal(result.partsCount,1);assert.equal(result.status.partsStatus,'ready');assert.equal(result.status.interiorStatus,'unavailable');await page.unroute('**/models/cabin-interior.glb');
 });
 await check('Hover leading/trailing coalescing and pointer leave/down cancellation',async()=>{
  const result=await page.evaluate(async()=>{
   const p=window.__PU,canvas=p.renderer.domElement;const enabled=p.controls.enabled;p.controls.enabled=false;const send=(type,x=640,buttons=0,button=0)=>canvas.dispatchEvent(new PointerEvent(type,{clientX:x,clientY:450,buttons,bubbles:true,pointerId:90,button})),sleep=()=>new Promise(r=>setTimeout(r,90));
   send('pointerleave');const before=p.hoverDiagnostics.runs;send('pointermove');const leading=p.hoverDiagnostics.runs-before;
   for(let i=0;i<29;i++)send('pointermove',641+i);const pending=p.hoverDiagnostics.pending;await sleep();const burst=p.hoverDiagnostics.runs-before;
   send('pointerleave');send('pointermove');send('pointermove');const atLeave=p.hoverDiagnostics.runs;send('pointerleave');await sleep();const cancelledLeave=p.hoverDiagnostics.runs===atLeave&&!p.hoverDiagnostics.pending;
   send('pointermove');send('pointermove');const atDown=p.hoverDiagnostics.runs;send('pointerdown',640,1);await sleep();const cancelledDown=p.hoverDiagnostics.runs===atDown&&!p.hoverDiagnostics.pending;send('pointerup',640,0,2);
   p.controls.enabled=enabled;return {leading,pending,burst,cancelledLeave,cancelledDown};
  });
  assert.equal(result.leading,1);assert.ok(result.pending);assert.equal(result.burst,2);assert.ok(result.cancelledLeave&&result.cancelledDown);observations.hover=result;
 });
 async function aim(view){await page.evaluate(view=>{
  const p=window.__PU,c=p.scene.getObjectByName('secret-haven-cabin');p.scenicTour.stop();p.frame('hero');p.controls.minDistance=.25;p.controls.maxPolarAngle=1.7;
  const positions={front:[0,3.4,12.2],oblique:[7.2,6.2,9.5],window:[2.65,1.85,4.4],porch:[3.2,2.2,6.0],cross:[3.4,1.85,4.2],side:[4.4,1.75,.1],room:[1.65,2.0,2.7]},targets={front:[0,1.9,1.2],oblique:[0,2,.7],window:[0,.95,-.35],porch:[0,.9,2.65],cross:[1.36,1.52,1.89],side:[2.27,1.52,.1],room:[.4,.9,-.1]};
  const position=c.localToWorld(p.camera.position.clone().set(...positions[view])),target=c.localToWorld(p.controls.target.clone().set(...targets[view]));p.camera.position.copy(position);p.controls.target.copy(target);p.controls.update();p.camera.updateMatrixWorld(true);p.renderer.shadowMap.needsUpdate=true;
 },view);await page.waitForFunction(()=>!window.__PU.flying);await page.evaluate(()=>new Promise(requestAnimationFrame));}
 for(const [mode,intensity] of [['day',0],['sunset',28*.63],['night',28]]){
  await page.evaluate(mode=>window.__PU.setAtmosphere(mode),mode);
  await page.waitForFunction(intensity=>window.__PU.scene.getObjectByName('porch-warm-light').intensity===intensity,intensity);
  await check(`${mode}: exact porch intensity ${intensity} and front / 45-degree architectural captures`,async()=>{
   for(const view of ['front','oblique','window','porch','cross','side','room']){await aim(view);await page.screenshot({path:`${out}/${mode}-${view}.png`,style:'#garden-ui,#object-hint{visibility:hidden!important}'});}
   observations[mode]=await page.evaluate(()=>{const c=window.__PU.scene.getObjectByName('secret-haven-cabin'),glass=c.getObjectByName('cabin-recessed-window-glass').material;return {porch:c.getObjectByName('porch-warm-light').intensity,glassEmission:glass.emissiveIntensity,glassOpacity:glass.opacity,envMapIntensity:glass.envMapIntensity};});
  });
  const amount=mode==='day'?0:mode==='sunset'?.63:1;assert.ok(Math.abs(observations[mode].glassOpacity-(.05+.035*amount))<1e-10);assert.ok(Math.abs(observations[mode].glassEmission-(.002+.014*amount))<1e-10);assert.ok(Math.abs(observations[mode].envMapIntensity-(1.85-.85*amount))<1e-10);
 }
 await reviewCabinHearth(page,check,observations,out);
 await reviewCabinArtistry(page,check,observations,out);
 await reviewCabinCozy(page,check,observations,out);
 await check('Malformed optional GLB degrades to the procedural cabin without runtime errors',async()=>{
  await page.route('**/models/cabin-parts.glb',route=>route.fulfill({status:200,contentType:'model/gltf-binary',body:'deliberately invalid optional asset'}));
  const result=await page.evaluate(async()=>{const {makeCabin}=await import('/src/natural/cabin.js'),c=makeCabin();const result=await c.loadParts();c.setWarmth(1);return {missing:result===null,fallback:c.group.getObjectByName('cabin-door-hardware-fallback').visible&&c.group.getObjectByName('cabin-hanging-lantern-fallback').visible,intensity:c.group.getObjectByName('porch-warm-light').intensity,roomLoaded:!!c.group.getObjectByName('cabin-interior-room')};});
  assert.ok(result.missing&&result.fallback&&result.roomLoaded);assert.equal(result.intensity,28);await page.unroute('**/models/cabin-parts.glb');
 });
 await page.close();observations.interactions=await reviewCabinInteractions(browser,errors,out);
 observations.production=await reviewCabinProduction(browser,errors,out);
 assert.ok(observations.night.glassEmission<.5);assert.deepEqual(errors,[]);console.log('PASS window emission controlled; console.error=0, pageerror=0');
}catch(e){failure=e;console.error(e);}
finally{await writeFile(`${out}/result.json`,JSON.stringify({checks,observations,errors,failure:failure?.stack||null},null,2));await browser.close();}
if(failure)process.exitCode=1;
