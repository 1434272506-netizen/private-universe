import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {AdditiveBlending} from 'three';

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
});

try {
  const page = await browser.newPage({viewport: {width: 1000, height: 760}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout: 90000});

  // 1. 验证 Day 模式下丁达尔神圣光束 (Volumetric God Rays) 激活
  const dayBeams = await page.evaluate(() => {
    const {scene} = window.__PU;
    const beams = scene.getObjectByName('volumetric-godrays');
    const aurora = scene.getObjectByName('emerald-amethyst-aurora');
    return {
      beamsFound: Boolean(beams),
      motes: beams.getObjectByName('drifting-gold-motes').geometry.attributes.position.count,
      canopyTop: beams.getObjectByName('canopy-light-veils').geometry.attributes.position.array
        .filter((_,i)=>i%3===1).reduce((a,b)=>Math.max(a,b),0),
      beamCount: beams?.children?.length,
      beamVisible: beams?.visible,
      beamOpacity: beams?.children[0]?.material?.uniforms?.uOpacity?.value,
      beamBlending: beams?.children[0]?.material?.blending,
      auroraVisible: aurora?.visible,
      auroraOpacity: aurora?.material?.uniforms?.uOpacity?.value
    };
  });

  assert.equal(dayBeams.beamsFound, true);
  assert.equal(dayBeams.beamCount, 3);
  assert.equal(dayBeams.beamVisible, true);
  assert.equal(dayBeams.beamOpacity,.22);
  assert.equal(dayBeams.motes,24);
  assert.ok(dayBeams.canopyTop>=10 && dayBeams.canopyTop<=15.5);
  assert.equal(dayBeams.beamBlending, AdditiveBlending);
  assert.equal(dayBeams.auroraVisible, false);
  assert.ok(dayBeams.auroraOpacity < 0.05);

  // 截取春日暖阳下的丁达尔光束
  await page.waitForFunction(()=>window.__PU.phase==='exploring'&&!window.__PU.flying);
  await page.locator('#invitation').waitFor({state:'hidden'});
  assert.equal(await page.locator('dialog[open], #help-panel:visible').count(),0);
  await page.screenshot({path:'screenshots/04-crepuscular-godrays-day.png'});
  await page.locator('[data-atmo="sunset"]').click();
  await page.waitForFunction(()=>Math.abs(window.__PU.scene.getObjectByName('volumetric-godrays').children[0].material.uniforms.uOpacity.value-.065)<1e-8);

  // 2. 切换至 Night 模式，验证极光天幕 (Emerald & Amethyst Aurora) 激活
  await page.locator('[data-atmo="night"]').click();
  // 等待 1.8 秒余弦过渡平稳完成
  await page.waitForFunction(()=>window.__PU.scene.getObjectByName('volumetric-godrays').children[0].material.uniforms.uOpacity.value===0);

  const nightState = await page.evaluate(() => {
    const {scene} = window.__PU;
    const beams = scene.getObjectByName('volumetric-godrays');
    const aurora = scene.getObjectByName('emerald-amethyst-aurora');
    return {
      beamsVisible: beams?.visible,
      beamOpacity: beams?.children[0]?.material?.uniforms?.uOpacity?.value,
      auroraFound: Boolean(aurora),
      auroraVisible: aurora?.visible,
      auroraOpacity: aurora?.material?.uniforms?.uOpacity?.value,
      auroraBlending: aurora?.material?.blending
    };
  });

  assert.equal(nightState.auroraFound, true);
  assert.equal(nightState.auroraVisible, true);
  assert.ok(nightState.auroraOpacity > 0.8);
  assert.equal(nightState.auroraBlending, AdditiveBlending);
  assert.equal(nightState.beamsVisible, false);
  assert.ok(nightState.beamOpacity < 0.05);

  // 坐上长椅，截取翡翠紫晶极光夜景
  await page.evaluate(() => window.__PU.frame('bench'));
  await page.waitForTimeout(1000);
  if(process.env.CAPTURE_AURORA)await page.screenshot({path:'screenshots/05-aurora-borealis-night.png'});

  assert.deepEqual(errors, []);
  console.log('PASS canopy light, komorebi patches, 24 motes and sunset/night aurora transitions');
} finally {
  await browser.close();
}
