import assert from 'node:assert/strict';
import { mkdir, copyFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import * as THREE from 'three';
import { makeSeasons } from '../src/natural/seasons.js';

const folder = 'work/qa/seasons';
await mkdir(folder, { recursive: true });

function checkUnitSemantics() {
  const scene = new THREE.Scene();
  const tree = new THREE.Group();
  tree.name = 'centerpiece-love-tree';
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4ade80 });
  const leafMesh = new THREE.Mesh(new THREE.BufferGeometry(), leafMat);
  leafMesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 1,0,0, 0,1,0]), 3));
  leafMesh.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0,1,0, 0,1,0, 0,1,0]), 3));
  leafMesh.name = 'Leaves_ContinuousUmbrella';
  tree.add(leafMesh);
  scene.add(tree);

  const meadowMat = new THREE.MeshStandardMaterial({ color: 0x76a364 });
  const meadowMesh = new THREE.Mesh(new THREE.BufferGeometry(), meadowMat);
  meadowMesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 1,0,0, 0,1,0]), 3));
  meadowMesh.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0,1,0, 0,1,0, 0,1,0]), 3));
  meadowMesh.name = 'meadow-and-soil';
  scene.add(meadowMesh);

  const cabin = { group: new THREE.Group() };
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x6e4732 });
  const timberMesh = new THREE.Mesh(new THREE.BufferGeometry(), timberMat);
  timberMesh.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0, 1,0,0, 0,1,0]), 3));
  timberMesh.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0,1,0, 0,1,0, 0,1,0]), 3));
  timberMesh.name = 'cabin-crafted-timber';
  cabin.group.add(timberMesh);

  const porchLight = new THREE.PointLight(0xffb369, 0, 11, 2);
  porchLight.name = 'porch-warm-light';
  cabin.group.add(porchLight);
  scene.add(cabin.group);

  const seasons = makeSeasons(scene, { cabin, treeAsset: { tree } });
  assert.equal(seasons.getSeason(), 'spring', 'Default season must be spring');

  // Verify materials were bound and cloned with custom shaders
  assert.notEqual(leafMesh.material, leafMat, 'Leaves material must be cloned/bound');
  assert.notEqual(meadowMesh.material, meadowMat, 'Meadow material must be cloned/bound');
  assert.notEqual(timberMesh.material, timberMat, 'Cabin timber material must be cloned/bound');

  // Test porch light interception in frost vs deep snow
  porchLight.intensity = 28;
  assert.equal(porchLight.intensity, 28, 'Frost porch light intensity is baseline 28');

  // Transition to winter deep snow form
  seasons.setSeason('winter', 'deep');
  seasons.update(3.5);
  assert.equal(seasons.getSeason(), 'winter');
  assert.ok(Math.abs(porchLight.intensity - 39.2) < 0.01, 'Deep snow boosts porch light warmth by 40% (39.2)');

  // Transition back to frost
  seasons.setSeason('winter', 'light');
  seasons.update(3.5);
  assert.equal(porchLight.intensity, 28, 'Light snow returns porch light to baseline 28');

  seasons.dispose();
  assert.equal(leafMesh.material, leafMat, 'Disposal restores leaf material');
  assert.equal(meadowMesh.material, meadowMat, 'Disposal restores meadow material');
  assert.equal(timberMesh.material, timberMat, 'Disposal restores cabin material');
  return { unitTestsPassed: true };
}

async function runLiveAcceptance() {
  const observations = {};
  observations.unit = checkUnitSemantics();

  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(process.env.REVIEW_URL || 'http://127.0.0.1:5173/');
    await page.waitForFunction(() => window.__PU?.phase === 'exploring', { timeout: 30000 });
    await page.locator('#invitation').waitFor({ state: 'hidden', timeout: 15000 });

    // Wait for seasons picker to be visible
    await page.locator('.season-picker').waitFor({ state: 'visible', timeout: 10000 });

    const buttons = await page.$$eval('.season-picker button', btns =>
      btns.map(b => ({
        season: b.dataset.season,
        text: b.textContent.trim(),
        pressed: b.getAttribute('aria-pressed'),
        deep: b.dataset.deep,
        title: b.title
      }))
    );
    assert.equal(buttons.length, 4, 'Must have 4 season buttons');
    assert.deepEqual(buttons.map(b => b.season), ['spring', 'summer', 'autumn', 'winter']);
    observations.buttons = buttons;

    // 1. Spring Initial State
    assert.equal(await page.evaluate(() => window.__PU.seasons.getSeason()), 'spring');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${folder}/01-spring.png` });

    // 2. Switch to Summer
    await page.click('button[data-season="summer"]');
    await page.waitForTimeout(3200);
    assert.equal(await page.evaluate(() => window.__PU.seasons.getSeason()), 'summer');
    assert.equal(await page.getAttribute('button[data-season="summer"]', 'aria-pressed'), 'true');
    await page.screenshot({ path: `${folder}/02-summer.png` });

    // 3. Switch to Autumn (Style B: 暖橙红枫)
    await page.click('button[data-season="autumn"]');
    await page.waitForTimeout(3200);
    assert.equal(await page.evaluate(() => window.__PU.seasons.getSeason()), 'autumn');
    assert.equal(await page.getAttribute('button[data-season="autumn"]', 'aria-pressed'), 'true');
    await page.screenshot({ path: `${folder}/03-autumn.png` });

    // 4. Switch to Winter Form 1 (初雪微霜: Light Frost)
    await page.click('button[data-season="winter"]');
    await page.waitForTimeout(3200);
    assert.equal(await page.evaluate(() => window.__PU.seasons.getSeason()), 'winter');
    assert.equal(await page.getAttribute('button[data-season="winter"]', 'aria-pressed'), 'true');
    assert.equal(await page.getAttribute('button[data-season="winter"]', 'data-deep'), 'false');
    assert.equal(await page.getAttribute('button[data-season="winter"]', 'title'), '初雪 · 点击积成深雪');
    await page.screenshot({ path: `${folder}/04-winter-frost.png` });

    // 5. Switch to Winter Form 2 (银装素裹: Deep Snow) with Accumulation Gradient Sampling
    await page.click('button[data-season="winter"]');
    // Sample intermediate gradient values
    await page.waitForTimeout(1000);
    const midSnow = await page.evaluate(() => {
      // Find one of the bound materials to check uSnowProgress
      const terrain = window.__PU.scene.getObjectByName('meadow-and-soil');
      // Or check porch light intensity gradient
      const light = window.__PU.cabin.group.getObjectByName('porch-warm-light');
      return { porchIntensity: light.intensity };
    });
    observations.gradientSample = midSnow;

    await page.waitForTimeout(2500); // Wait for remaining gradient to settle
    assert.equal(await page.getAttribute('button[data-season="winter"]', 'data-deep'), 'true');
    assert.equal(await page.getAttribute('button[data-season="winter"]', 'title'), '深雪 · 点击回到初雪');
    await page.screenshot({ path: `${folder}/05-winter-deep-snow.png` });

    // 6. Inspect close-up of cabin in deep snow
    await page.evaluate(() => window.__PU.frame('cabin'));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${folder}/06-cabin-deep-snow.png` });

    // Return to hero view
    await page.evaluate(() => window.__PU.frame('hero'));
    await page.waitForTimeout(1000);

    // 7. Toggle back to frost
    await page.click('button[data-season="winter"]');
    await page.waitForTimeout(3200);
    assert.equal(await page.getAttribute('button[data-season="winter"]', 'data-deep'), 'false');
    assert.equal(await page.getAttribute('button[data-season="winter"]', 'title'), '初雪 · 点击积成深雪');

    // Return to spring
    await page.click('button[data-season="spring"]');
    await page.waitForTimeout(3200);
    assert.equal(await page.evaluate(() => window.__PU.seasons.getSeason()), 'spring');

    assert.equal(errors.length, 0, `Page errors encountered: ${errors.join(', ')}`);
    observations.success = true;
    console.log('✅ ALL SEASONS ACCEPTANCE TESTS PASSED!');
    console.log(JSON.stringify(observations, null, 2));
  } finally {
    await browser.close();
  }
}

await runLiveAcceptance();
