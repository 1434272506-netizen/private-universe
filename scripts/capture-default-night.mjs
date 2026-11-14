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

  // 切换到 Night 银河萤火模式
  await page.locator('[data-atmo="night"]').click();
  await page.waitForTimeout(2500);

  // 1. 默认主视角 (Default Front Perspective)
  await page.screenshot({ path: 'screenshots/29-default-perspective-night-sky.png' });
  fs.copyFileSync('screenshots/29-default-perspective-night-sky.png', `${artifactDir}/29-default-perspective-night-sky.png`);

  // 2. 仰望天顶大广角 (Zenith Celestial View)
  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(0, 6, 4);
    controls.target.set(12, 45, -25);
    controls.update();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/30-zenith-sky-moon-galaxy.png' });
  fs.copyFileSync('screenshots/30-zenith-sky-moon-galaxy.png', `${artifactDir}/30-zenith-sky-moon-galaxy.png`);

  console.log('DONE capture default night screenshots');
} finally {
  await browser.close();
}
