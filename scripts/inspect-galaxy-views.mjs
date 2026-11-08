import {chromium} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
});

try {
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({timeout: 90000});
  await page.evaluate(() => window.__PU.frame('bench'));
  await page.locator('[data-atmo="night"]').click();
  await page.locator('#stargaze').click();
  
  const settle = () => page.waitForFunction(() => !window.__PU.flying);
  await settle();
  await page.waitForTimeout(1000);

  const outDir = path.resolve('screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true});

  // 1. Capture Macro Panorama
  const macroPath = path.join(outDir, '01-galaxy-stargazing-panorama.png');
  await page.screenshot({path: macroPath});
  console.log('Captured:', macroPath);

  // 2. Warp into Sagittarius (Emerald Beacon)
  const sagCoord = await page.evaluate(() => {
    const {scene, camera} = window.__PU;
    const v = scene.getObjectByName('sagittarius-portal').getWorldPosition(camera.position.clone()).project(camera);
    return [(1 + v.x) * innerWidth / 2, (1 - v.y) * innerHeight / 2];
  });
  await page.mouse.move(...sagCoord);
  await page.waitForTimeout(300);
  await page.mouse.click(...sagCoord);
  await page.locator('#galaxy-return').waitFor({timeout: 10000});
  await page.waitForTimeout(1000);
  const sagPath = path.join(outDir, '02-sagittarius-emerald-warp.png');
  await page.screenshot({path: sagPath});
  console.log('Captured:', sagPath);

  // Return to galaxy
  await page.locator('#galaxy-return').click();
  await settle();
  await page.waitForTimeout(800);

  // 3. Warp into Taurus (Amethyst Beacon)
  const tauCoord = await page.evaluate(() => {
    const {scene, camera} = window.__PU;
    const v = scene.getObjectByName('taurus-portal').getWorldPosition(camera.position.clone()).project(camera);
    return [(1 + v.x) * innerWidth / 2, (1 - v.y) * innerHeight / 2];
  });
  await page.mouse.move(...tauCoord);
  await page.waitForTimeout(300);
  await page.mouse.click(...tauCoord);
  await page.locator('#galaxy-return').waitFor({timeout: 10000});
  await page.waitForTimeout(1000);
  const tauPath = path.join(outDir, '03-taurus-amethyst-warp.png');
  await page.screenshot({path: tauPath});
  console.log('Captured:', tauPath);

  console.log('ALL SCREENSHOTS CAPTURED SUCCESSFULLY');
} finally {
  await browser.close();
}
