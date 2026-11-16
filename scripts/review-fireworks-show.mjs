import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const out = 'work/qa/fireworks-show';
await mkdir(out, { recursive: true });

const patterns = ['peony', 'willow', 'rings', 'chrysanthemum', 'heart'];
const observations = {};
const errors = [], pageerrors = [];
let browser, failure;

try {
  browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => pageerrors.push(e.message));

  await page.goto(process.env.REVIEW_URL || 'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({ timeout: 90000 });
  await page.locator('#invitation').waitFor({ state: 'hidden' });

  // Switch to night atmosphere and frame hero view
  await page.evaluate(() => {
    const p = window.__PU;
    p.camera.fov = 34;
    p.camera.updateProjectionMatrix();
    p.frame('hero');
    p.setAtmosphere('night');
  });
  await page.waitForTimeout(1600);

  const shot = name => page.screenshot({ path: `${out}/${name}.png`, style: '#object-hint{visibility:hidden!important}' });

  // Test and capture each pattern
  for (let idx = 0; idx < patterns.length; idx++) {
    const expectedPattern = patterns[idx];
    console.log(`Testing launch ${idx + 1}: pattern = ${expectedPattern}...`);

    // Click launch button or aim at sky
    const btn = page.locator('#launch-fireworks');
    await btn.waitFor({ state: 'visible' });
    await btn.click();

    // Verify rising phase
    await page.waitForFunction(() => window.__PU.fireworks.getState().phase === 'rising');
    if (idx === 0) {
      await shot('00-firework-golden-ascent');
    }

    // Verify burst phase
    await page.waitForFunction(() => window.__PU.fireworks.getState().phase === 'burst' && window.__PU.fireworks.getState().age > 2.0);

    const state = await page.evaluate(() => window.__PU.fireworks.getState());
    assert.equal(state.pattern, expectedPattern, `Pattern mismatch: expected ${expectedPattern}, got ${state.pattern}`);
    assert.equal(state.particleCount, 1536);
    observations[expectedPattern] = state;

    await shot(`0${idx + 1}-firework-${expectedPattern}`);

    // Wait until idle
    await page.waitForFunction(() => window.__PU.fireworks.getState().phase === 'idle');
    await page.waitForTimeout(400);
  }

  // Test reduced motion
  console.log('Testing reduced motion quiet heart...');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(200);
  await page.locator('#launch-fireworks').click();
  await page.waitForFunction(() => window.__PU.fireworks.getState().phase === 'still-heart');
  const stillState = await page.evaluate(() => window.__PU.fireworks.getState());
  assert.equal(stillState.pattern, 'heart');
  assert.equal(stillState.phase, 'still-heart');
  observations.reducedMotion = stillState;
  await shot('06-reduced-motion-heart');

  assert.deepEqual(errors, []);
  assert.deepEqual(pageerrors, []);
  console.log('PASS Fireworks show test completed for all 5 flower patterns!');
} catch (err) {
  failure = err;
  console.error(err);
} finally {
  await browser?.close();
  await writeFile(`${out}/result.json`, JSON.stringify({ pass: !failure, observations, errors, pageerrors, error: failure?.stack }, null, 2));
}

if (failure) process.exitCode = 1;
