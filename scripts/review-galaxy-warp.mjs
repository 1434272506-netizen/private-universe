import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {AdditiveBlending} from 'three';
import {daysTogether} from '../src/natural/anniversary-milestone.js';

assert.equal(daysTogether(Date.parse('2026-11-08T00:00:00+08:00')),411);
assert.equal(daysTogether(Date.parse('2025-09-23T23:59:59+08:00')),0);
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try {
  const page=await browser.newPage({viewport:{width:1000,height:760}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout:90000});
  // Rare pooled effects (for example the 12–24s meteor) allocate their GPU
  // buffers on first draw. Warm every authored geometry offscreen once before
  // comparing portal visits; keep the strict no-growth checks below.
  await page.evaluate(async()=>{
    const {WebGLRenderTarget}=await import('/node_modules/three/build/three.module.js'),p=window.__PU,flags=[],target=new WebGLRenderTarget(2,2),previous=p.renderer.getRenderTarget();
    p.scene.traverse(o=>{flags.push([o,o.visible,o.frustumCulled]);o.visible=true;o.frustumCulled=false;});
    try{p.renderer.setRenderTarget(target);p.renderer.render(p.scene,p.camera);}
    finally{for(const [o,visible,culled]of flags){o.visible=visible;o.frustumCulled=culled;}p.renderer.setRenderTarget(previous);target.dispose();}
  });
  await page.evaluate(()=>window.__PU.frame('bench'));
  await page.locator('[data-atmo="night"]').click();
  await page.locator('#stargaze').click();
  const settle=()=>page.waitForFunction(()=>!window.__PU.flying);
  await settle();
  const snapshot=()=>page.evaluate(()=>{
    const {scene,camera,controls}=window.__PU,g=scene.getObjectByName('spiral-galaxy');
    return {position:camera.position.toArray(),look:controls.target.toArray(),count:g.geometry.attributes.position.count,
      colors:g.geometry.attributes.color.count,rotation:g.rotation.y,blend:g.material.blending};
  });
  const gas=await page.evaluate(()=>window.__PU.scene.getObjectByName('spiral-gas').children.map(s=>[
    s.isSprite,s.material.opacity,s.material.blending,s.material.map.image.width
  ]));
  assert.equal(gas.length,36);
  for(const cloud of gas)assert.deepEqual(cloud,[true,.16,AdditiveBlending,128]);
  const start=await snapshot();
  assert.equal(start.count,48000);assert.equal(start.colors,48000);assert.equal(start.blend,AdditiveBlending);
  await page.waitForFunction(r=>window.__PU.scene.getObjectByName('spiral-galaxy').rotation.y>r,start.rotation);
  const memory=new Map(),rates=[];
  for(const name of ['sagittarius-portal','taurus-portal','sagittarius-portal','taurus-portal']){
    const xy=await page.evaluate(name=>{
      const {scene,camera}=window.__PU,v=scene.getObjectByName(name).getWorldPosition(camera.position.clone()).project(camera);
      return [(1+v.x)*innerWidth/2,(1-v.y)*innerHeight/2];
    },name);
    const file=name.startsWith('sagittarius')?'m8-lagoon':'m45-pleiades';
    await page.waitForFunction(([name,file])=>{
      const portal=window.__PU.scene.getObjectByName(name),veil=portal.getObjectByName(file);
      return veil.isMesh && veil.material.uniforms.photo.value.image?.naturalWidth===512 && !window.__PU.scene.getObjectByName("ambient-falling-foliage").visible
        && portal.getObjectByName('hitProxy').material.visible===false;
    },[name,file]);
    await page.mouse.move(...xy);
    await page.waitForFunction(()=>document.querySelector('canvas[data-hover="star"]'));
    await page.mouse.click(...xy);
    await page.locator('#galaxy-return').waitFor({timeout:10000});
    assert.ok(await page.evaluate(name=>window.__PU.scene.getObjectByName(name+'-realm').visible,name));
    await page.waitForFunction(name=>window.__PU.scene.getObjectByName(name+'-realm')
      .getObjectByName('stellarium-figure').material.map.image?.naturalWidth===512,name);
    assert.equal(await page.locator('#atmosphere-switcher:visible,.scene-caption:visible,#stargaze:visible,#return-view:visible').count(),0);
    const layers=await page.evaluate(name=>{
      const realm=window.__PU.scene.getObjectByName(name+'-realm');
      const field=realm.getObjectByName('realm-starfield'),pos=field.geometry.attributes.position;
      const tiers=[0,0,0];
      for(const size of field.geometry.attributes.starScale.array)tiers[[.12,.18,.28].indexOf(Number((size*field.material.size).toFixed(4))) ]++;
      field.geometry.computeBoundingBox();
      const box=field.geometry.boundingBox;
      const veil=realm.getObjectByName(name.startsWith('sagittarius')?'m8-lagoon':'m45-pleiades');
      const stars=realm.getObjectByName(name.startsWith('sagittarius')?'sagittarius-teapot':'taurus-hyades');
      const main=realm.children.find(o=>o.isPoints&&o.geometry.attributes.position.count===1);
      const lines=realm.children.find(o=>o.isLineSegments);
      const eye=realm.getObjectByName('stellarium-figure').children[0];
      return {luminosity:[stars.material.size,stars.material.color.getHexString(),stars.material.toneMapped,
        main.material.size,lines.material.opacity,eye?.scale.x??null],count:pos.count,tiers,inside:box.min.x>=-26&&box.max.x<=26&&box.min.y>=-20&&box.max.y<=20
        &&box.min.z>=-32&&box.max.z<=-16,opacity:veil.material.uniforms.strength.value,z:veil.position.z,
        ordered:field.renderOrder<veil.renderOrder,background:realm.background};
    },name);
    assert.deepEqual(layers,{luminosity:[.36,name.startsWith("sagittarius")?"e0fbf0":"ffe2ba",false,.75,.55,name.startsWith("sagittarius")?null:.55],count:2000,tiers:[1400,500,100],inside:true,opacity:.35,z:-12,ordered:true,background:null});
    if(!memory.has(name)){
      const shot=name.startsWith('sagittarius')?'02-sagittarius-emerald':'03-taurus-amethyst';
      await page.screenshot({path:'screenshots/'+shot+'-warp.png'});
    }
    const stats=await page.evaluate(async()=>{
      let start=performance.now(),frames=0;
      await new Promise(resolve=>function sample(t){
        frames++;
        if(t-start>=1500)resolve();else requestAnimationFrame(sample);
      }(start));
      return {fps:Math.round((frames-1)*1000/(performance.now()-start)),...window.__PU.renderer.info.memory};
    });
    rates.push(stats.fps);
    console.log('GPU realm resources',name,JSON.stringify(stats));
    if(memory.has(name)){
      assert.ok(stats.textures<=memory.get('taurus-portal').textures);
      assert.ok(stats.geometries<=memory.get('taurus-portal').geometries);
    }else memory.set(name,stats);
    const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
    assert.ok(distance(start.position,(await snapshot()).position)>30);
    await page.locator('#galaxy-return').click();await settle();
    assert.equal(await page.locator('#atmosphere-switcher:visible,.scene-caption:visible').count(),2);
    const end=await snapshot();
    assert.ok(distance(start.position,end.position)<.001 && distance(start.look,end.look)<.001);
  }
  assert.deepEqual(errors,[]);console.log('PASS both 2000-star realms, luminous constellations, clean HUD, panorama return, stable GPU resource counts and zero console errors | measured FPS '+rates.join('/'));
} finally {await browser.close();}
