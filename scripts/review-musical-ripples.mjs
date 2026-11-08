import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {WATER_END} from '../src/natural/land.js';
import {creekPitch} from '../src/natural/chimes-audio.js';
const hz=[523.25,587.33,659.25,783.99,880,1046.5];
hz.forEach((f,i)=>assert.equal(creekPitch(i===5?WATER_END:-4.8+(i+.1)*(WATER_END+4.8)/5),f));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{
    window.voices=[];
    const proto=OscillatorNode.prototype, stop=proto.stop, start=proto.start;
    proto.start=function(t){this.startedAt=t;return start.call(this,t);};
    proto.stop=function(t){window.voices.push([this.frequency.value,t-this.startedAt]);return stop.call(this,t);};
  });
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout:90000});
  await page.evaluate(()=>window.__PU.frame('creek'));
  const point=await page.evaluate(async()=>{
    const {creekX,waterY}=await import('/src/natural/land.js');
    const {Raycaster}=await import('/node_modules/three/build/three.module.js');
    const p=window.__PU,ray=new Raycaster(),surface=p.scene.getObjectByName('creek-surface');
    p.camera.updateMatrixWorld();
    for(let z=.8;z<3.5;z+=.1){
      const v=p.camera.position.clone().set(creekX(z),waterY(z),z).project(p.camera);
      const x=(1+v.x)*innerWidth/2,y=(1-v.y)*innerHeight/2;
      if(document.elementFromPoint(x,y)!==p.renderer.domElement)continue;
      ray.setFromCamera(v,p.camera);
      const hit=ray.intersectObject(surface,false)[0];
      const block=ray.intersectObjects([...p.occluders,...p.interactive],true)[0];
      if(hit&&(!block||block.distance>=hit.distance-.02))return [x,y];
    }
    throw Error('No unobstructed creek point');
  });
  await page.mouse.click(...point);
  await page.waitForFunction(()=>voices.length>=2);
  const [base,partial]=await page.evaluate(()=>voices);
  assert.ok(hz.some(f=>Math.abs(f-base[0])<.01));
  assert.ok(Math.abs(partial[0]/base[0]-2.756)<.001);
  assert.ok(Math.abs(base[1]-.85)<.001 && Math.abs(partial[1]-.85)<.001);
  await page.evaluate(()=>{window.__PU.discover('sound');});
  const wav=Buffer.alloc(44+8000*12*2);
  wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);
  wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
  wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
  await page.locator('#music-file').setInputFiles({name:'test.wav',mimeType:'audio/wav',buffer:wav});
  await page.locator('#music-play').click();
  await page.evaluate(()=>window.__PU.gardenAudio.close());
  await page.waitForFunction(()=>window.__PU.listeningPlayer.getObjectByName('listening-vinyl').rotation.y>.1);
  assert.deepEqual(errors,[]);
  console.log('PASS musical creek chimes and spinning vinyl');
}finally{await browser.close();}
