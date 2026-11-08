import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const out='work/qa/creek-ecology';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout:90000});
  await page.evaluate(()=>window.__PU.frame('creek'));
  const result=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {ground,waterY}=await import('/src/natural/land.js');
    const {channelBounds}=await import('/src/natural/water.js');
    const e=window.__PU.creekEcology;
    const require=(ok,message)=>{if(!ok)throw Error(message);};
    require(!!e,'factory missing');
    require(JSON.stringify(e.getCounts())===JSON.stringify({silver:18,clown:5,turtle:1}),'default counts');
    const mesh=e.fishMesh,m=new THREE.Matrix4(),v=new THREE.Vector3();
    function checkMatrix(matrix){
      require(matrix.elements.every(Number.isFinite),'nonfinite matrix');
      v.setFromMatrixPosition(matrix);
      const b=channelBounds(v.z);
      require(v.z<=4.4&&v.x>b.left&&v.x<b.right,'outside channel');
      require(v.y<waterY(v.z)-.02&&v.y>=ground(v.x,v.z)+.03,'outside water depth');
    }
    for(const geometry of [mesh.geometry,e.turtleMesh.geometry]){
      require([...geometry.attributes.position.array].every(Number.isFinite),'nonfinite geometry');
    }
    for(let frame=0;frame<2400;frame++){
      e.update(1/30,frame/30);
      for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);checkMatrix(m);}
      checkMatrix(e.turtleMesh.matrix);
    }
    for(const counts of [{silver:0,clown:0,turtle:0},{silver:30,clown:10,turtle:1},{silver:18,clown:5,turtle:1}]){
      e.setCounts(counts);
      require(e.fishMesh===mesh,'batch replaced');
      require(mesh.count===counts.silver+counts.clown,'batch count wrong');
      require(e.turtleMesh.visible===Boolean(counts.turtle),'turtle visibility wrong');
      require(JSON.stringify(e.getCounts())===JSON.stringify(counts),'setCounts wrong');
    }
    return e.getCounts();
  });
  assert.deepEqual(result,{silver:18,clown:5,turtle:1});
  await page.screenshot({path:out+'/overview.png'});
  for(const [name,z] of [['upstream-turtle',-2.5],['midstream-silver',.6]]){
    await page.evaluate(async z=>{
      const {creekX}=await import('/src/natural/land.js');
      const p=window.__PU;
      p.controls.minDistance=.4;p.controls.maxPolarAngle=Math.PI/2;
      p.controls.target.set(creekX(z),.1,z);
      p.camera.position.set(creekX(z)+.5,2.7,z+1.2);
      p.controls.update();
    },z);
    await page.waitForTimeout(200);
    await page.screenshot({path:out+'/'+name+'.png'});
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  const before=await page.evaluate(()=>Array.from(window.__PU.creekEcology.fishMesh.instanceMatrix.array));
  await page.waitForTimeout(300);
  const after=await page.evaluate(()=>Array.from(window.__PU.creekEcology.fishMesh.instanceMatrix.array));
  assert.notDeepEqual(after,before);
  assert.deepEqual(errors,[]);
  await fs.writeFile(out+'/result.json',JSON.stringify({counts:result,simulatedSeconds:80,errors},null,2));
  console.log('PASS creek ecology verified: silver fish, clownfish, green turtle active with zero errors');
}finally{await browser.close();}
