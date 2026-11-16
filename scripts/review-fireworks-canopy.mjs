import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import * as THREE from 'three';
import { makeFireworks } from '../src/natural/fireworks.js';
import { RX } from '../src/natural/land.js';

const folder = 'work/qa/fireworks-canopy';
const releasePads = [[-16, 2], [2, -8], [15, -4]];
const observations = {}, errors = [], pageerrors = [];
await mkdir(folder, { recursive: true });

function checkOwnership() {
  const world = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 16/9, .15, 900);
  camera.position.set(3, 8, 33);
  camera.lookAt(-.4, 1.7, 0);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, .58), sounds = [];
  world.add(hemi);
  const show = makeFireworks(world, { sound: key => sounds.push(key) });
  // The renderer exists before either the group or its foliage: both early
  // launches must use the full-sized fallback. A late crown and a moved crown
  // must then affect framing, even though the fireworks instance is unchanged.
  const earlySeat=show.viewingSeat(camera);
  assert.ok(earlySeat);
  const tree=new THREE.Group(); tree.name='centerpiece-love-tree';world.add(tree);
  assert.deepEqual(show.viewingSeat(camera),earlySeat);
  const leaf=new THREE.Mesh(new THREE.BoxGeometry(6,6,6),new THREE.MeshBasicMaterial());
  leaf.name='Leaves_ContinuousUmbrella';tree.add(leaf);
  tree.position.set(150,20,0);
  assert.equal(show.viewingSeat(camera),null);
  tree.position.set(0,25,1);
  assert.ok(show.viewingSeat(camera));
  tree.removeFromParent();leaf.geometry.dispose();leaf.material.dispose();
  assert.equal(show.launch(camera), true);
  assert.equal(show.launch(camera), false);
  show.update(.3);
  show.update(.1, { covered: true });
  assert.equal(show.getState().age, .3);
  for (let i = 0; i < 111; i++) show.update(1/120);
  assert.ok(hemi.intensity > .59, 'Flash must pulse the existing hemisphere light');
  hemi.intensity = .72; // The atmosphere controller owns a new baseline mid-burst.
  show.update(.01);
  assert.ok(hemi.intensity > .72);
  show.clear();
  assert.ok(Math.abs(hemi.intensity - .72) < 1e-8);
  assert.equal(show.launch(camera, { reducedMotion: true, pattern: 'rings' }), true);
  show.update(.55, { reducedMotion: true });
  assert.equal(show.getState().phase, 'still-heart');
  const outline = show.group.getObjectByName('couple-firework-heart');
  assert.deepEqual(show.group.children.filter(o=>o.visible), [outline]);
  assert.ok(outline.geometry.getAttribute('aPad').array.every(pad=>pad===1));
  assert.deepEqual(sounds, ['launch', 'bloom']);
  const resources = new Set();
  show.group.traverse(o => {
    if (o.geometry) resources.add(o.geometry);
    if (o.material) {
      assert.equal(o.material.blending, THREE.AdditiveBlending);
      for (const material of [].concat(o.material)) resources.add(material);
    }
  });
  const freed = new Map([...resources].map(item => [item, 0]));
  for (const item of resources) item.addEventListener('dispose', () => freed.set(item, freed.get(item) + 1));
  show.dispose(); show.dispose();
  assert.ok([...freed.values()].every(count => count === 1));
  assert.equal(show.group.parent, null);
  assert.equal(show.launch(camera), false);
  return { sound: sounds, restoredLight: hemi.intensity, released: freed.size };
}

// Pausing only the fireworks clock keeps normal input and the exact garden
// renderer running, while exposing the same flash/afterglow on slow machines.
function installClock() {
  const show = window.__PU.fireworks, update = show.update.bind(show);
  window.advanceFireworksTo = age => {
    const start = show.getState().age;
    if (start === null || age < start - 1e-6) throw Error('Cannot seek this firework backwards');
    let left = age - start;
    while (left > .000001) {
      const step = Math.min(1/120, left);
      update(step);
      left -= step;
    }
  };
  show.update = () => {};
}

function inspectStage() {
  const { fireworks: show, camera, ground, scene } = window.__PU;
  const g = show.group;
  g.updateWorldMatrix(true, true); camera.updateWorldMatrix(true, false);
  const lift = g.getObjectByName('couple-firework-golden-trail');
  const silk = g.getObjectByName('couple-firework-brocade');
  const stars = g.getObjectByName('couple-firework-stardust');
  const heart = g.getObjectByName('couple-firework-heart');
  const perPad = (attr, begin, end) => {
    const out = [0,0,0];
    for (let i = begin; i < end; i++) out[attr.getX(i)]++;
    return out;
  };
  const counts = {};
  for (const obj of [lift, silk, stars, heart]) {
    const pad = obj.geometry.getAttribute('aPad');
    counts[obj.name] = perPad(pad, 0, pad.count);
  }
  const bases = lift.material.uniforms.uBases.value.map(v => {
    const p = g.localToWorld(v.clone());
    return { position: p.toArray(), turf: ground(p.x, p.z) };
  });
  const ends = lift.material.uniforms.uEnds.value.map(v => g.localToWorld(v.clone()));
  const origins = stars.material.uniforms.uOrigins.value.map(v => stars.localToWorld(v.clone()));
  let lights = 0;
  scene.traverse(object => { if (object.isPointLight) lights++; });
  return { counts, bases, lights, scale:silk.scale.x, ribbons: silk.geometry.instanceCount, instanced: silk.geometry.isInstancedBufferGeometry,
    centres: ends.map((end,i) => ({ world: end.toArray(), ndc: end.clone().project(camera).toArray(),
      depth:-end.clone().applyMatrix4(camera.matrixWorldInverse).z, distance: camera.position.distanceTo(end), mismatch: end.distanceTo(origins[i]) })) };
}

// Subtract the *same* composited frame with the show hidden. This rejects
// false positives from the bright galaxy, moving foliage and button artwork.
function measurePixels({ age, isolateCrackle, measureGalaxy, survey }) {
  window.advanceFireworksTo(age);
  const { lighting, renderer, scene, camera, fireworks: show } = window.__PU;
  const g = show.group, image = renderer.domElement;
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const read = () => {
    lighting.render(0);
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  };
  const stars = g.getObjectByName('couple-firework-stardust');
  const active = g.children.map(o => o.visible);
  const { start, count } = stars.geometry.drawRange;
  try {
    g.visible = false;
    const sky = read();
    let galaxy;
    if (measureGalaxy) {
      const amounts = new Map();
      scene.traverse(o => {
        const amount = o.material?.uniforms?.uFireworkAmount;
        if (amount) amounts.set(amount, amount.value);
      });
      try {
        for (const amount of amounts.keys()) amount.value = 0;
        const full = read();
        let changedPixels = 0, peak = 0;
        for (let i = 0; i < full.length; i += 4) {
          const reduction = Math.max(full[i]-sky[i], full[i+1]-sky[i+1], full[i+2]-sky[i+2]);
          if (reduction >= 10) changedPixels++;
          peak = Math.max(peak,reduction);
        }
        galaxy = { changedPixels, peak };
      } finally {
        for (const [amount, value] of amounts) amount.value = value;
      }
    }
    g.visible = true;
    if (isolateCrackle) {
      for (const obj of g.children) obj.visible = obj === stars;
      stars.geometry.setDrawRange(128 + 128*5, 32*16);
    }
    const actual = read();
    const centres = g.getObjectByName('couple-firework-golden-trail').material.uniforms.uEnds.value
      .map(end => g.localToWorld(end.clone()).project(camera));
    const splitA = (2 + centres[0].x + centres[1].x)*canvas.width/4;
    const splitB = (2 + centres[1].x + centres[2].x)*canvas.width/4;
    const wings = [0, 0, 0], contrast = [0, 0, 0];
    let clippedWhite = 0, edge = 0, minX=canvas.width, minY=canvas.height, maxX=0, maxY=0;
    const columns=new Set();
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const i = (y*canvas.width+x)*4;
      const diff = Math.max(actual[i]-sky[i],actual[i+1]-sky[i+1],actual[i+2]-sky[i+2]);
      if (diff < 15) continue;
      minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y);
      columns.add(x);
      const wing = x < splitA ? 0 : x < splitB ? 1 : 2;
      wings[wing]++;
      contrast[wing] = Math.max(contrast[wing], diff);
      if (Math.min(actual[i],actual[i+1],actual[i+2]) >= 250) clippedWhite++;
      if (x < 2 || y < 2 || x >= canvas.width-2 || y >= canvas.height-2) edge++;
    }
    const width=(maxX-minX+1)/canvas.width, height=(maxY-minY+1)/canvas.height;
    // An orthographic survey of the same GPU frame measures physical span in
    // metres. Perspective estimates overstate the reach of near-side willow tips.
    let spanMetres;
    if(survey){
      const surveyWidth=96, surveyHeight=surveyWidth*canvas.height/canvas.width;
      const lens=camera.clone();
      lens.projectionMatrix.makeOrthographic(-surveyWidth/2,surveyWidth/2,surveyHeight/2,-surveyHeight/2,lens.near,lens.far);
      lens.projectionMatrixInverse.copy(lens.projectionMatrix).invert();
      const scan=visible=>{
        g.visible=visible; renderer.render(g,lens);ctx.drawImage(image,0,0);
        return ctx.getImageData(0,0,canvas.width,canvas.height).data;
      };
      const dark=scan(false), light=scan(true);
      let left=canvas.width,right=-1;
      for(let i=0;i<light.length;i+=4){
        if(Math.max(light[i]-dark[i],light[i+1]-dark[i+1],light[i+2]-dark[i+2])<15)continue;
        const x=(i/4)%canvas.width;
        left=Math.min(left,x);right=Math.max(right,x);
      }
      spanMetres=(right-left+1)*surveyWidth/canvas.width;
      lighting.render(0);
    }
    return {age,wings,contrast,clippedWhite,edge,galaxy,width,height,area:width*height,
      top:minY/canvas.height,bottom:maxY/canvas.height,columnCoverage:columns.size/canvas.width,spanMetres};
  } finally {
    g.visible = true;
    g.children.forEach((o,i) => { o.visible = active[i]; });
    stars.geometry.setDrawRange(start,count);
  }
}

// Compare the same GPU trajectories with and without the actual tree depth.
// Preserve alpha testing and leaf animation; discard only their colour.
function checkTreeDepth(age) {
  window.advanceFireworksTo(age);
  const {scene,renderer,camera,fireworks,treeAsset}=window.__PU;
  const tree=treeAsset.tree, g=fireworks.group, keep=new Set(), hidden=[], materials=new Map();
  for(const root of [g,tree]){
    root.traverse(o=>keep.add(o));
    for(let o=root.parent;o;o=o.parent) keep.add(o);
  }
  const oldBg=scene.background, clear=renderer.getClearColor({copy:colour=>colour.clone()});
  const alpha=renderer.getClearAlpha(), oldTarget=renderer.getRenderTarget(), wasVisible=tree.visible;
  const canvas=document.createElement('canvas'), image=renderer.domElement;
  canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  function read(){
    renderer.render(scene,camera);ctx.drawImage(image,0,0);
    return ctx.getImageData(0,0,canvas.width,canvas.height).data;
  }
  try {
    scene.traverse(o=>{if(o.visible && !keep.has(o) && !o.isLight){hidden.push(o);o.visible=false;}});
    tree.traverse(o=>{for(const m of [].concat(o.material||[])){
      if(!materials.has(m)) materials.set(m,m.colorWrite);m.colorWrite=false;
    }});
    renderer.setRenderTarget(null);scene.background=null;renderer.setClearColor(0,1);
    tree.visible=false;const unobstructed=read();
    tree.visible=true;const seen=read();
    let lit=0, blocked=0;
    for(let i=0;i<seen.length;i+=4){
      if(Math.max(unobstructed[i],unobstructed[i+1],unobstructed[i+2])<15) continue;
      lit++;
      if(Math.max(unobstructed[i]-seen[i],unobstructed[i+1]-seen[i+1],unobstructed[i+2]-seen[i+2])>=10) blocked++;
    }
    return {age,lit,blocked};
  } finally {
    for(const [m,v] of materials) m.colorWrite=v;
    for(const o of hidden)o.visible=true;
    scene.background=oldBg;tree.visible=wasVisible;
    renderer.setClearColor(clear,alpha);renderer.setRenderTarget(oldTarget);
  }
}

let browser, failure;
try {
  observations.ownership = checkOwnership();
  browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const page = await browser.newPage({viewport: { width: 1280, height: 800 }});
  page.on('console', entry => { if (entry.type() === 'error') errors.push(entry.text()); });
  page.on('pageerror', error => pageerrors.push(error.message));
  await page.goto(process.env.REVIEW_URL || 'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout: 90000});
  await page.locator('#invitation').waitFor({state:'hidden'});
  await page.evaluate(() => window.__PU.setAtmosphere('night'));
  await page.waitForFunction(() => window.__PU.cabin.group.getObjectByName('porch-warm-light').intensity === 28);
  await page.evaluate(installClock);

  for (const [name, width, height, view] of [
    ['desktop', 1280, 720, 'hero'], ['portrait', 390, 844, 'hero'], ['observatory', 1280, 800, 'telescope'],
    ['ribbon',1280,800,'ribbon'], ['porch',1280,800,'cabin'], ['meadow',1280,800,'meadow']
  ]) {
    await page.setViewportSize({width, height});
    const initial=await page.evaluate(view => {
      const p=window.__PU;p.fireworks.clear();p.frame(view);
      return {eye:p.camera.position.toArray(),target:p.controls.target.toArray(),zoom:p.camera.zoom};
    }, view);
    await page.locator('#launch-fireworks').click();
    await page.waitForFunction(()=>!window.__PU.flying);
    const stage = await page.evaluate(inspectStage);
    observations[name] = stage;
    assert.equal(stage.lights, 4);
    assert.equal(stage.instanced, true);
    assert.equal(stage.ribbons, 128);
    for (const [i, base] of stage.bases.entries()) {
      assert.ok(Math.hypot(base.position[0]-releasePads[i][0],base.position[2]-releasePads[i][1]) < .02);
      assert.ok(Math.abs(base.position[1]-base.turf) < .21);
    }
    assert.equal(stage.bases.length,3);
    assert.equal(stage.centres.length,3);
    for (const c of stage.centres) {
      assert.ok(c.mismatch < .005, 'Comet must meet its actual burst origin');
      assert.ok(c.depth>=45 && c.depth<=60);
      assert.ok(stage.scale>=1 && stage.scale<=1.35);
      assert.ok(Math.abs(c.ndc[0]) < .97 && Math.abs(c.ndc[1]) < .97);
    }
    const [west,centre,east] = stage.centres.map(c => c.ndc);
    assert.ok(west[0] < centre[0]-.09 && centre[0] < east[0]-.09, 'Crowns overlap on screen');
    assert.ok(centre[1] > Math.max(west[1],east[1]), 'The centre crown must top the arch');
    for (const key of ['couple-firework-golden-trail','couple-firework-brocade','couple-firework-stardust']) {
      assert.ok(stage.counts[key].every(n=>n>0));
    }
    assert.equal(stage.counts['couple-firework-stardust'].reduce((a,b)=>a+b),1280);
    assert.equal(stage.counts['couple-firework-heart'].reduce((a,b)=>a+b),256);

    const shots = name === 'desktop'
      ? [['ascent',.82],['flash',1.20],['brocade',2.45],['crackle',2.65],['bloom',3.15],['rain',4.45]]
      : [['canopy',2.85]];
    stage.frames = {}; stage.treeDepth=[];
    for (const [label, age] of shots) {
      const counts = await page.evaluate(measurePixels, {age, isolateCrackle:label==='crackle', measureGalaxy:label==='flash', survey:label==='rain'});
      stage.frames[label] = counts;
      if(label==='rain'){
        assert.ok(counts.area>=.5 && counts.area<=.7, '16:9 rain envelope: '+counts.area);
        assert.ok(counts.columnCoverage>=.75,'Disconnected or narrow canopy');
        assert.ok(counts.spanMetres>=1.6*RX && counts.spanMetres<=2.4*RX,'Physical rain span: '+counts.spanMetres);
        assert.equal(counts.edge,0);
      }
      if(label==='canopy'||label==='brocade'){
        const sample=await page.evaluate(checkTreeDepth,age);
        stage.treeDepth.push(sample);
        assert.ok(sample.lit>0 && sample.blocked/sample.lit<.10, name+' burst occlusion: '+JSON.stringify(sample));
      }
      assert.ok(counts.wings.every(n=>n>2), `${name}/${label} has an invisible wing: ${counts.wings}`);
      if (counts.galaxy) assert.ok(counts.galaxy.changedPixels>50, 'Active crowns should attenuate nearby sky highlights');
      // The isolated daughters above are instrumentation. The keepsake always
      // contains the intact finished composition against the real island.
      await page.screenshot({path: `${folder}/${name}-${label}.png`, style: '#object-hint{visibility:hidden!important}'});
    }
    for(const age of [4.5,5.4]){
      const result=await page.evaluate(checkTreeDepth,age);
      stage.treeDepth.push(result);
      assert.ok(result.lit>0 && result.blocked/result.lit<.35, name+' tree occlusion: '+JSON.stringify(result));
    }
    if(name==='desktop'){
      // Positive control: deliberately put the real crown in front of the
      // central shower, then restore it before taking any keepsake frames.
      const saved=await page.evaluate(()=>{
        const {treeAsset:{tree,bounds},camera,fireworks}=window.__PU;
        const before=tree.position.toArray();
        const top=bounds.getCenter(camera.position.clone());top.y=bounds.max.y-2;
        const desired=camera.position.clone().lerp(fireworks.group.position,.45);
        tree.position.add(tree.parent.worldToLocal(desired).sub(tree.parent.worldToLocal(top)));
        tree.updateMatrixWorld(true);
        return before;
      });
      try{
        observations.depthControl=await page.evaluate(checkTreeDepth,5.4);
        assert.ok(observations.depthControl.blocked>100,'Depth comparison must detect a deliberately occluded burst');
      }finally{
        await page.evaluate(v=>window.__PU.treeAsset.tree.position.fromArray(v),saved);
      }
    }
    // The showcase borrows the camera; it must return the exact eye and orbit target.
    await page.evaluate(()=>window.advanceFireworksTo(8.1));
    await page.waitForFunction(pose=>{
      const p=window.__PU;
      return !p.flying && !p.fireworks.group.visible && Math.abs(p.camera.zoom-pose.zoom)<.00001 &&
        p.camera.position.distanceTo(p.camera.position.clone().fromArray(pose.eye))<.001 &&
        p.controls.target.distanceTo(p.controls.target.clone().fromArray(pose.target))<.001;
    },initial);
    console.log('PASS', name, stage.treeDepth);
  }
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>window.__PU.frame('hero'));
  // Six shows above leave the normal rotation on willow for launch seven.
  await page.locator('#launch-fireworks').click();
  await page.waitForFunction(()=>!window.__PU.flying);
  assert.equal(await page.evaluate(()=>window.__PU.fireworks.getState().pattern),'willow');
  observations.willow={};
  for(const [label,age] of [['bloom',3.50],['curtain',5.65],['afterglow',6.65]]){
    const frame=await page.evaluate(measurePixels,{age,survey:label==='curtain'});
    observations.willow[label]=frame;
    console.log('willow',label,JSON.stringify(frame));
    assert.ok(frame.wings.every(count=>count>2));
    if(label==='curtain'){
      assert.ok(frame.area>=.5 && frame.area<=.7, 'Willow rain frame coverage: '+frame.area);
      assert.ok(frame.spanMetres>=1.6*RX && frame.spanMetres<=2.4*RX,'Willow width: '+frame.spanMetres);
    }
    await page.screenshot({path:folder+'/desktop-willow-'+label+'.png'});
  }
  assert.deepEqual(errors, []); assert.deepEqual(pageerrors, []);
} catch (error) {
  failure = error;
  console.error(error);
} finally {
  await browser?.close();
  await writeFile(`${folder}/result.json`,JSON.stringify({pass:!failure, errors, pageerrors, observations, error:failure?.stack},null,2));
}
if (failure) process.exitCode = 1;
