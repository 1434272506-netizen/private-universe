import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';
import {waitForContentReady} from './review-fixture-storage.mjs';
import {waitForPhotoPage,currentPhoto} from './review-photo-helpers.mjs';
import {clickTreeRibbon} from './review-ribbon-helpers.mjs';

const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173/';
const production=process.env.PRODUCTION_REVIEW==='1';
const out='work/qa/lanterns-album'+(production?'-preview':'');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
try{
  const page=await context.newPage(),errors=[],badResponses=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)badResponses.push(r.url());});
  await page.goto(base);await page.locator('#enter-direct').click({timeout:90000});await waitForContentReady(page);
  await page.locator('#invitation').waitFor({state:'hidden'});
  const shot=name=>page.screenshot({path:`${out}/${name}.png`});
  const closeAlbum=async()=>{await page.locator('#memory-dialog .close-story').click();await page.locator('#memory-dialog').waitFor({state:'hidden'});};
  const hud=async()=>{
    const result=await page.evaluate(()=>{
      const selectors=['.masthead','#tour','#reset','#atmosphere-switcher','#tour-status','#telescope-gaze'];
      const boxes=selectors.map(s=>[s,document.querySelector(s)]).filter(([,e])=>e&&!e.hidden&&e.getClientRects().length)
        .map(([s,e])=>[s,e.getBoundingClientRect()]);
      const overlaps=[];
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
        const [a,r]=boxes[i],[b,t]=boxes[j];if(Math.min(r.right,t.right)-Math.max(r.left,t.left)>1&&Math.min(r.bottom,t.bottom)-Math.max(r.top,t.top)>1)overlaps.push([a,b]);
      }
      return {overlaps,inside:boxes.every(([,r])=>r.width>0&&r.left>=0&&r.right<=innerWidth+.5&&r.top>=0&&r.bottom<=innerHeight+.5)};
    });assert.deepEqual(result.overlaps,[]);assert.equal(result.inside,true);assert.equal(await page.locator('#open-album,#album-photo-count').count(),0);assert.equal(await page.getByRole('button',{name:/回忆相册/}).count(),0);
  };
  await hud();
  await clickTreeRibbon(page);await page.locator('#memory-dialog[open]').waitFor();
  for(let n=1;n<=10;n++){
    await waitForPhotoPage(page,n,10);
    assert.equal(await currentPhoto(page).evaluate(el=>el.complete&&el.naturalWidth>0),true);
    assert.equal(await page.locator('.album-page .photo-unavailable').count(),0);
    if([1,10].includes(n))await shot(`album-${n}-desktop`);
    if(n<10)await page.locator('.album-next').click();
  }
  console.log(`PASS ${production?'preview':'dev'}: hidden album opened by a real 3D ribbon click, pages 1 / 10 through 10 / 10, no broken images`);
  await closeAlbum();
  if(!production){
    const details=await page.evaluate(()=>{
      const p=window.__PU,l=p.estateFeatures.lanterns;
      const maxError={};
      for(const name of ['lantern-stake-posts','lantern-caps','lantern-stone-bases']){
        const pos=l.group.getObjectByName(name).geometry.attributes.position;let error=0;
        for(let i=0;i<pos.count;i++)error=Math.max(error,Math.min(...l.sites.map(([x,y,z])=>Math.hypot(pos.getX(i)-x,pos.getZ(i)-z))));
        maxError[name]=error;
      }
      return {count:l.count,sites:l.sites,maxError,sprites:l.group.children.filter(c=>c.isSprite).length};
    });
    assert.equal(details.count,21);assert.equal(details.sprites,21);
    for(const value of Object.values(details.maxError))assert.ok(value<.19,'all lamp components stay aligned to their own site');
    for(const [x,y,z] of details.sites){
      assert.ok(!(x>=16.65&&x<=19.75&&z>=.65&&z<=3.35),'lamp outside deck');
      assert.ok(Math.hypot(x+12,z+1.5)>1.2,'lamp outside astrolabe base');
      const dx=x-13.2,dz=z-.8,lx=Math.cos(.24)*dx-Math.sin(.24)*dz,lz=Math.sin(.24)*dx+Math.cos(.24)*dz;
      assert.ok(Math.abs(lx)>1.08||Math.abs(lz)>.92,'lamp outside picnic blanket');
    }
    for(const mode of ['day','night']){
      await page.locator(`[data-atmo="${mode}"]`).click();
      await page.evaluate(()=>{const p=window.__PU,[x,y,z]=p.estateFeatures.lanterns.sites[19];p.controls.minDistance=.2;p.controls.maxPolarAngle=1.6;p.camera.position.set(x+.7,y+1.15,z+1.7);p.controls.target.set(x,y+.4,z);p.controls.update();});
      await page.waitForFunction(mode=>{const m=window.__PU.scene.getObjectByName('lantern-luminous-cores').material;return mode==='day'?m.emissiveIntensity<.01:m.emissiveIntensity>1.5;},mode);
      await shot(`lantern-deck-${mode}`);
      await hud();
    }
    console.log('PASS 21 locally aligned lamps; deck/picnic/astrolabe clearance; day/night closeups');
    // Exercise real mesh picking for BOTH red ties, using visible points on each ribbon.
    for(let i=0;i<2;i++){
      await page.evaluate(i=>{
        const p=window.__PU,ties=[];p.treeAsset.tree.traverse(o=>{if(o.name==='branch-red-silk')ties.push(o);});
        const tie=ties[i],v=tie.getWorldPosition(p.camera.position.clone());
        p.camera.position.copy(v).add({x:0,y:.4,z:3});p.controls.target.copy(v);p.controls.minDistance=.2;p.controls.update();p.camera.updateMatrixWorld(true);p.scene.updateMatrixWorld(true);
      },i);
      await page.waitForFunction(()=>!window.__PU.flying);
      const points=await page.evaluate(i=>{
        const p=window.__PU,ties=[];p.treeAsset.tree.traverse(o=>{if(o.name==='branch-red-silk')ties.push(o);});
        const tie=ties[i],g=tie.geometry.attributes.position,points=[];
        for(let k=0;k<g.count;k+=Math.max(1,Math.floor(g.count/35))){const v=p.camera.position.clone().fromBufferAttribute(g,k);tie.localToWorld(v);v.project(p.camera);if(v.z>0&&v.z<1)points.push([(1+v.x)*innerWidth/2,(1-v.y)*innerHeight/2]);}return points;
      },i);
      let hit;
      for(const point of points){await page.mouse.move(...point);if(await page.locator('#app > canvas').getAttribute('data-hover')==='ribbon'){hit=point;break;}}
      assert.ok(hit,`red ribbon ${i+1} has visible clickable geometry`);
      await page.mouse.click(...hit);await page.locator('#memory-dialog[open]').waitFor();await waitForPhotoPage(page,10,10);
      await shot(`red-ribbon-${i+1}-album`);await closeAlbum();
    }
    console.log('PASS both red ribbons open the same ten-photo album by real canvas clicks');
    await page.locator('#add-content').click();await page.locator('#content-dialog[open]').waitFor();
    assert.equal(await page.locator('#saved-memories .saved-item').count(),10);
    assert.doesNotMatch(await page.locator('#saved-memories').innerText(),/一张照片|日期留白/);
    await page.locator('#saved-memories .saved-item').first().getByRole('button',{name:/^编辑/}).click();
    await page.locator('#memory-caption').fill('隔离验收：本地配文应优先');
    await page.locator('#memory-date').fill('2026-11-11');await page.locator('#memory-alt').fill('隔离验收画面描述');
    await page.locator('#memory-form [type=submit]').click();
    await page.waitForFunction(()=>document.querySelector('#memory-feedback').textContent.includes('已放到白丝带上'));
    // Add a genuinely new eleventh image through the file input, in this isolated context only.
    const response=await context.request.get(new URL('/memories/photo-01-original.jpg',base).href);
    await page.locator('#memory-file').setInputFiles({name:'isolated-eleventh.jpg',mimeType:'image/jpeg',buffer:await response.body()});
    await page.locator('#memory-caption').fill('隔离验收：第十一张照片');await page.locator('#memory-form [type=submit]').click();
    await page.waitForFunction(()=>document.querySelectorAll('#saved-memories .saved-item').length===11);
    await page.locator('#close-editor').click();await page.waitForFunction(()=>window.__PU.controls.enabled);
    await clickTreeRibbon(page);await page.keyboard.press('Home');await waitForPhotoPage(page,1,11);
    assert.equal(await currentPhoto(page).getAttribute('alt'),'隔离验收画面描述');
    assert.match(await page.locator('.album-caption').innerText(),/隔离验收：本地配文应优先/);
    await page.locator('.photo-flip-trigger').click();assert.equal(await page.locator('.photo-edit-note-trigger').isVisible(),true);
    await page.locator('.photo-flip-back-trigger').click();await page.keyboard.press('End');await waitForPhotoPage(page,11,11);
    assert.equal(await currentPhoto(page).evaluate(el=>el.complete&&el.naturalWidth>0),true);
    await closeAlbum();
    await page.reload();await page.locator('#enter-direct').click({timeout:90000});await waitForContentReady(page);
    await clickTreeRibbon(page);await page.keyboard.press('Home');await waitForPhotoPage(page,1,11);
    assert.match(await page.locator('.album-caption').innerText(),/隔离验收：本地配文应优先/);await closeAlbum();
    console.log('PASS editable merged captions/alt/date, readable manager, eleventh upload and persistence after reload');
  }
  for(const mode of ['day','night']){
    await page.locator(`[data-atmo="${mode}"]`).click();
    for(const [width,height,label] of [[1280,800,'desktop'],[390,844,'mobile']]){
      await page.setViewportSize({width,height});await hud();await shot(`hud-${mode}-${label}`);
      await clickTreeRibbon(page);await page.locator('#memory-dialog[open]').waitFor();
      await page.keyboard.press('Home');await waitForPhotoPage(page,1,production?10:11);
      assert.equal(await currentPhoto(page).evaluate(el=>el.complete&&el.naturalWidth>0),true);
      await shot(`album-${mode}-${label}`);await closeAlbum();
    }
  }
  if(!production){
    for(const [width,height,label] of [[1280,800,'desktop'],[390,844,'mobile']]){
      await page.setViewportSize({width,height});
      await page.evaluate(()=>window.__PU.scenicTour.start(6));
      await page.locator('#tour-status').waitFor({state:'visible'});
      await hud();await shot(`tour-hud-${label}`);
      await page.evaluate(()=>window.__PU.scenicTour.stop());
      await page.locator('#telescope-gaze').waitFor({state:'visible'});
      await hud();await shot(`telescope-hud-${label}`);
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
  console.log(`PASS ${production?'preview':'dev'}: desktop/mobile day/night HUD; console.error=0, pageerror=0, HTTP errors=0`);
}finally{await browser.close();}
