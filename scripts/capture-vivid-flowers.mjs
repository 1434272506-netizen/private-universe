import { chromium } from 'playwright-core';
import fs from 'node:fs';

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
});

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({ timeout: 90000 });
  await page.waitForFunction(() => window.__PU && window.__PU.phase === 'exploring');

  const artifactDir = 'C:/Users/Administrator/.gemini/antigravity/brain/c9c5605b-e177-44be-bdff-6d0f7d74eb16';

  // 1. 向日葵花海近景特写 (Vivid Sunflowers Close-up)
  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(-16.8, 2.2, 4.2);
    controls.target.set(-18.5, 1.2, -0.5);
    controls.update();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/20-vivid-sunflowers-close-up.png' });
  fs.copyFileSync('screenshots/20-vivid-sunflowers-close-up.png', `${artifactDir}/20-vivid-sunflowers-close-up.png`);

  // 2. 普罗旺斯薰衣草梯田与木栅栏特写 (Vivid Lavender Terraces)
  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(-13.5, 2.5, 5.8);
    controls.target.set(-16.0, 1.2, 1.5);
    controls.update();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/21-vivid-lavender-terraces.png' });
  fs.copyFileSync('screenshots/21-vivid-lavender-terraces.png', `${artifactDir}/21-vivid-lavender-terraces.png`);

  // 3. 切换到 Night 模式：截取阿凡达发光风铃花与漫天夜光微粒微光 (Avatar Bioluminescent Fairyland)
  await page.locator('[data-atmo="night"]').click();
  await page.waitForTimeout(2200);

  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(-16.0, 3.2, 3.5);
    controls.target.set(-18.0, 1.2, -1.5);
    controls.update();
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'screenshots/22-avatar-bioluminescent-night-meadow.png' });
  fs.copyFileSync('screenshots/22-avatar-bioluminescent-night-meadow.png', `${artifactDir}/22-avatar-bioluminescent-night-meadow.png`);

  console.log('DONE capture vivid flower screenshots');
} finally {
  await browser.close();
}
