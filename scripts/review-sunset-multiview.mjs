import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';

const out = 'work/qa/sunset-multiview';
await fs.mkdir(out, {recursive: true});

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
});

try {
  const page = await browser.newPage({viewport: {width: 1280, height: 800}, reducedMotion: 'reduce'});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout: 90000});

  // 1. Switch to sunset atmosphere
  await page.locator('[data-atmo="sunset"]').click();
  await page.waitForFunction(() => {
    const p = window.__PU;
    const u = p.scene.getObjectByName('spring-sky').material.uniforms;
    return p.getAtmosphere() === 'sunset' && u.dusk.value === 1;
  });
  await page.waitForTimeout(600);

  // Capture Hero View
  await page.screenshot({path: `${out}/01-hero-sunset.png`});
  console.log('Captured 01-hero-sunset.png');

  // 2. Bench View
  await page.locator('#help-toggle').click();
  await page.locator('[data-place="bench"]').click();
  await page.waitForTimeout(1200);
  await page.screenshot({path: `${out}/02-bench-sunset.png`});
  console.log('Captured 02-bench-sunset.png');

  // 3. Bench Sunward View
  await page.evaluate(() => {
    const {camera, controls} = window.__PU;
    controls.target.set(-4.5, 1.8, -1.5);
    camera.position.set(4.2, 1.89, 2.7);
    controls.update();
  });
  await page.waitForTimeout(800);
  await page.screenshot({path: `${out}/03-bench-sunward.png`});
  console.log('Captured 03-bench-sunward.png');

  // 4. Creek View
  await page.locator('#return-view').click();
  await page.waitForTimeout(800);
  await page.locator('#help-toggle').click();
  await page.locator('[data-place="ribbon"]').click();
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const {camera, controls} = window.__PU;
    controls.target.set(-0.8, 0.4, 0.8);
    camera.position.set(-1.6, 1.2, 2.8);
    controls.update();
  });
  await page.waitForTimeout(800);
  await page.screenshot({path: `${out}/04-creek-sunset.png`});
  console.log('Captured 04-creek-sunset.png');

  assert.deepEqual(errors, []);
  console.log('PASS sunset multiview capture completed with 0 errors');
} finally {
  await browser.close();
}
