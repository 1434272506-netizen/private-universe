import { chromium } from 'playwright-core';
import fs from 'node:fs';

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
});

try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({ timeout: 90000 });
  await page.waitForFunction(() => window.__PU && window.__PU.phase === 'exploring');

  const artifactDir = 'C:/Users/Administrator/.gemini/antigravity/brain/c9c5605b-e177-44be-bdff-6d0f7d74eb16';

  // 1. 白昼特写 (Day Macro Close-up)
  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(-17.2, 2.1, 0.5);
    controls.target.set(-18.5, 1.8, -0.8);
    controls.update();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/23-sunflower-botanical-macro.png' });
  fs.copyFileSync('screenshots/23-sunflower-botanical-macro.png', `${artifactDir}/23-sunflower-botanical-macro.png`);

  // 2. 晚霞金色逆光特写 (Golden Hour Backlight)
  await page.locator('[data-atmo="sunset"]').click();
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(-19.5, 2.2, -1.8);
    controls.target.set(-18.0, 1.8, 0.2);
    controls.update();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/24-sunflower-golden-hour-macro.png' });
  fs.copyFileSync('screenshots/24-sunflower-golden-hour-macro.png', `${artifactDir}/24-sunflower-golden-hour-macro.png`);

  console.log('DONE capture sunflower macro screenshots');
} finally {
  await browser.close();
}
