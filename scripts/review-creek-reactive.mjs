import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';

const out = 'work/qa/creek-reactive';
await fs.mkdir(out, {recursive:true});
const browser = await chromium.launch({executablePath:process.env.BROWSER_PATH ||
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try {
  const page = await browser.newPage({viewport:{width:960,height:640}, reducedMotion:'no-preference'});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout:90000});
  await page.evaluate(() => window.__PU.frame('creek'));
  await page.waitForFunction(() => !window.__PU.flying);
  await page.evaluate(async () => {
    const {Vector3, Raycaster} = await import('/node_modules/three/build/three.module.js');
    const {waterY,ground} = await import('/src/natural/land.js');
    const {channelBounds} = await import('/src/natural/water.js');
    const p = window.__PU, eco = p.creekEcology;
    const config = eco.getConfig();
    const frames = window.samples = [];
    const update = eco.update;
    eco.update = (delta,time) => {
      update(delta,time);
      const {silverFish,clownfish,turtle} = eco.getState();
      const entities = [...silverFish,...clownfish,...(turtle ? [turtle] : [])];
      for (const [i,f] of entities.entries()) {
        const t = f === turtle, margin = t ? 0.30 : 0.20;
        const zone = f.school || (t ? config.turtle : config.clownfish);
        const b = channelBounds(f.z);
        const y = t ? eco.turtleMesh.matrix.elements[13] : eco.fishMesh.instanceMatrix.array[i*16+13];
        if (!(f.z >= zone.zMin+margin && f.z <= zone.zMax-margin && f.z <= 4.4 &&
              f.x >= b.left+margin && f.x <= b.right-margin &&
              y >= ground(f.x,f.z)+(t ? .062 : f.scale*.25) &&
              y <= waterY(f.z)-(t ? .073 : f.scale*.41))) {
          throw Error('Unsafe pose '+JSON.stringify({i,x:f.x,y,z:f.z}));
        }
      }
      frames.push({time,delta,fish:silverFish,clown:clownfish.map(f=>f.excited)});
    };
    window.findTarget = () => {
      const fish = eco.getState().silverFish;
      const surface = p.scene.getObjectByName('creek-surface');
      let best, score = 0;
      for (const f of fish) {
        const pos = new Vector3(f.x,waterY(f.z),f.z).project(p.camera);
        const x = (1+pos.x)*innerWidth/2, y = (1-pos.y)*innerHeight/2;
        if (document.elementFromPoint(x,y) !== p.renderer.domElement) continue;
        const ray = new Raycaster();
        ray.setFromCamera(pos,p.camera);
        const hit = ray.intersectObject(surface,false)[0];
        if (!hit) continue;
        const block = ray.intersectObjects([...p.occluders,...p.interactive],true)[0];
        if (block && block.distance < hit.distance-.02) continue;
        const nearby = fish.filter(n => Math.hypot(n.x-hit.point.x,n.z-hit.point.z)<.39);
        if (nearby.length >= 3 && nearby.length > score) {
          best = {x,y}; score = nearby.length;
        }
      }
      return best;
    };
  });
  await page.waitForFunction(()=>window.samples.length >= 2);
  assert.ok(await page.evaluate(()=>samples.at(-1).fish.every(f=>f.excited===0)));
  await page.screenshot({path:out+'/before-disturb.png'});
  const target = await (await page.waitForFunction(()=>window.findTarget(),null,{timeout:90000})).jsonValue();
  await page.mouse.click(target.x,target.y);
  await page.waitForFunction(()=>samples.some(s=>s.fish.filter(f=>f.excited>.5).length>=3));
  await page.screenshot({path:out+'/scatter-peak.png'});
  await page.waitForFunction(()=>{
    const hit = samples.find(s=>s.fish.filter(f=>f.excited>.5).length>=3);
    return samples.at(-1).time >= hit.time+2.5;
  },null,{timeout:90000});
  const frames = await page.evaluate(()=>samples);
  const index = frames.findIndex(s=>s.fish.filter(f=>f.excited>.5).length>=3);
  assert.ok(index>0);
  const peak = frames[index], end = frames.at(-1);
  const nearby = peak.fish.map((f,i)=>f.excited>.5 ? i : -1).filter(i=>i>=0);
  const accelerated = nearby.filter(i=>frames.slice(index,index+6).some((s,k)=>{
    const a = frames[index+k-1].fish[i], b = s.fish[i];
    return Math.hypot(b.x-a.x,b.z-a.z) > s.delta*b.speed*1.4 &&
      b.phase-a.phase > s.delta*(8+b.speed*6)*1.5;
  }));
  assert.ok(accelerated.length>=3,'Measured speed and tail phase increased for '+accelerated.length+' fish');
  assert.ok(end.fish.every(f=>f.excited<.05) && end.clown.every(v=>v<.05));
  const aligned = nearby.filter(i=>end.fish.some((n,j)=>{
    const f = end.fish[i];
    return j!==i && n.school.id===f.school.id && Math.hypot(n.x-f.x,n.z-f.z)<.45 &&
      Math.cos(n.heading-f.heading)>.8;
  }));
  assert.ok(aligned.length>=2,'Affected fish must rejoin nearby, aligned schoolmates');
  await page.screenshot({path:out+'/regroup.png'});
  assert.deepEqual(errors,[]);
  console.log({nearby:nearby.length,accelerated:accelerated.length,aligned:aligned.length,frames:frames.length});
  console.log('PASS creek ecology reactive boids scatter and regroup verified with zero errors');
} finally {
  await browser.close();
}
