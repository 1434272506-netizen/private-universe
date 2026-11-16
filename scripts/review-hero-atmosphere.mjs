import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';

const out='work/qa/hero-atmosphere';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try {
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout:90000});
  await page.evaluate(()=>window.__PU.frame('hero'));
  async function capture(mode){
    await page.locator('[data-atmo="'+mode+'"]').click();
    await page.waitForFunction(mode=>{
      const p=window.__PU, u=p.scene.getObjectByName('spring-sky').material.uniforms;
      return p.currentView==='hero' && !p.flying && p.getAtmosphere()===mode && u[mode==='sunset'?'dusk':'night'].value===1;
    },mode);
    let png=await page.screenshot({path:out+'/hero-'+mode+'.png'});
    if(mode==='night'){
      // The reference latitude describes spring-sky, not the separately tilted
      // aurora/Milky Way/cloud layers. Keep the composite shot above and measure
      // the real base sky alone so those layers cannot contaminate background samples.
      const base64=await page.evaluate(async()=>{
        const {Scene}=await import('/node_modules/three/build/three.module.js');
        const p=window.__PU, isolated=new Scene();
        isolated.add(p.scene.getObjectByName('spring-sky').clone());
        const captureSky=()=>{
          p.renderer.render(isolated,p.camera);
          return p.renderer.domElement.toDataURL('image/png').split(',')[1];
        };
        try{
          const before=captureSky();
          if(!p.fireworks.launch(p.camera,{pattern:'willow'})) throw Error('Sky review could not launch');
          p.fireworks.update(1.32);
          if(captureSky()===before) throw Error('Galaxy highlights did not respond during the burst');
          p.fireworks.update(8);
          const after=captureSky();
          if(after!==before) throw Error('The settled sky differs after fireworks');
          return after;
        } finally {
          p.fireworks.clear();
          p.lighting.render(0);
        }
      });
      png=Buffer.from(base64,'base64');await fs.writeFile(out+'/hero-night-base-sky.png',png);
    }
    return page.evaluate(async({base64,mode})=>{
      const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
      const canvas=document.createElement('canvas');
      canvas.width=img.width;canvas.height=img.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
      const data=ctx.getImageData(0,0,img.width,img.height).data;
      const {camera}=window.__PU;
      const ray=camera.position.clone(), lum=(r,g,b)=>.2126*r+.7152*g+.0722*b;
      const stripes=Array.from({length:3},()=>({band:[],background:[]}));
      let total=0,red=0,gold=0,coral=0;
      for(let y=2;y<img.height*.36;y+=3)for(let x=4;x<img.width-4;x+=3){
        const u=x/img.width,v=y/img.height;
        // Only the sunset uses the composite with HUD and tree in front of it.
        if(mode==='sunset' && ((v<.10 && (u<.26 || u>.79)) || (v>.13 && u<.70 && u>.31)))continue;
        const i=4*(y*img.width+x),[r,g,b]=data.subarray(i,i+3);
        if(mode==='sunset'){
          total++;red+=Number(r/(r+g+b)>=.45);
          gold+=Number(r>170 && g>b*1.18 && g>100);
          coral+=Number(r>g*1.15 && b>=g*.90);
        }else{
          ray.set(2*u-1,1-2*v,.5).unproject(camera).sub(camera.position).normalize();
          // Sample the luminous spine of the current northwest arc within
          // three angular degrees of its great circle, clear of its dust lanes.
          const lat=Math.abs((.80*ray.x+.58*(ray.y+.84)+.15*ray.z)/Math.hypot(ray.x,ray.y+.84,ray.z)/Math.hypot(.80,.58,.15));
          const zone=stripes[Math.min(2,Math.floor(u*3))];
          if(lat<Math.sin(3*Math.PI/180) && ray.y>-.2)zone.band.push(lum(r,g,b));
          if(lat>.24 || ray.y<-.37)zone.background.push(lum(r,g,b));
        }
      }
      if(mode==='sunset')return {red:red/total,gold:gold/total,coral:coral/total};
      const median=a=>a.length?a.sort((a,b)=>a-b)[Math.floor(a.length/2)]:null;
      return stripes.map(s=>({band:median(s.band),background:median(s.background),samples:s.band.length}));
    },{base64:png.toString('base64'),mode});
  }
  const sunset=await capture('sunset'), night=await capture('night');
  console.log({sunset,night});
  assert.ok(sunset.red>=.45 && sunset.gold>.035 && sunset.coral>.035,'Red, gold and coral horizon coverage');
  const background=night.filter(s=>s.background!==null).map(s=>s.background);
  assert.ok(background.length>0);
  const reference=Math.min(...background);
  assert.ok(night.filter(s=>s.samples>100 && s.band>reference+30).length>=2,'Luminous galactic band must span multiple sky regions');
  assert.deepEqual(errors,[]);
  console.log('PASS hero atmosphere enhancement verified: fiery sunset and vivid milky way clearly visible in hero view');
}finally{await browser.close();}
