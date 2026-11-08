import {chromium} from 'playwright-core';

const browser = await chromium.launch({executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page = await browser.newPage({viewport: {width: 1280, height: 800}});

page.on('console', m => console.log('CONSOLE:', m.type(), m.text()));
page.on('pageerror', e => console.log('PAGE ERROR:', e.message));

await page.goto('http://127.0.0.1:5173/');
await page.locator('#enter-direct').click();
await page.locator('#help-toggle').click();
await page.locator('[data-place="bench"]').click();
await page.waitForTimeout(1000);

// Click sunset
await page.locator('[data-atmo="sunset"]').click();
await page.waitForTimeout(2500);

// Capture bench sunset view
await page.screenshot({path: 'work/qa/bench-atmosphere/live-bench-sunset.png'});

// Look around - look slightly up and left towards the sun and sky
await page.evaluate(() => {
  const {camera, controls} = window.__PU;
  // Let's rotate camera slightly left towards the sunset sun
  controls.target.set(-4.5, 1.8, -1.5);
  camera.position.set(4.2, 1.89, 2.7);
  controls.update();
});
await page.waitForTimeout(1000);
await page.screenshot({path: 'work/qa/bench-atmosphere/live-bench-sunset-sunward.png'});

// Look up at the sky
await page.evaluate(() => {
  const {camera, controls} = window.__PU;
  controls.target.set(-2.0, 5.0, -1.0);
  controls.update();
});
await page.waitForTimeout(1000);
await page.screenshot({path: 'work/qa/bench-atmosphere/live-bench-sunset-skyward.png'});

// Back to overview
await page.locator('#back-to-garden').click();
await page.waitForTimeout(1500);
await page.screenshot({path: 'work/qa/bench-atmosphere/live-overview-sunset.png'});

await browser.close();
console.log('INSPECT SUNSET DONE');
