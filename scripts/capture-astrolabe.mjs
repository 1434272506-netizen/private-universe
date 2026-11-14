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

  // 1. 白昼近景特写：星轨时光浑天日晷 (Celestial Brass Astrolabe Day Macro)
  await page.evaluate(() => {
    const { camera, controls, scene } = window.__PU;
    const m = scene.getObjectByName('anniversary-milestone');
    const p = m.position;
    camera.position.set(p.x - 1.1, p.y + 0.75, p.z + 1.3);
    controls.target.set(p.x, p.y + 0.45, p.z);
    controls.update();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/36-astrolabe-day-close-up.png' });
  fs.copyFileSync('screenshots/36-astrolabe-day-close-up.png', `${artifactDir}/36-astrolabe-day-close-up.png`);

  // 2. 晚霞逆光近景 (Sunset Golden Hour)
  await page.locator('[data-atmo="sunset"]').click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/37-astrolabe-sunset-view.png' });
  fs.copyFileSync('screenshots/37-astrolabe-sunset-view.png', `${artifactDir}/37-astrolabe-sunset-view.png`);

  // 3. 夜幕发光水晶星核特写 (Night Luminous Core under Aurora & Milky Way)
  await page.locator('[data-atmo="night"]').click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'screenshots/38-astrolabe-night-luminous-core.png' });
  fs.copyFileSync('screenshots/38-astrolabe-night-luminous-core.png', `${artifactDir}/38-astrolabe-night-luminous-core.png`);

  // 4. 打开周年纪念日卡片 (Open Milestone Dialog)
  await page.evaluate(() => {
    window.__PU.discover('anniversary');
  });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'screenshots/39-astrolabe-dialog-card.png' });
  fs.copyFileSync('screenshots/39-astrolabe-dialog-card.png', `${artifactDir}/39-astrolabe-dialog-card.png`);

  console.log('DONE capture astrolabe screenshots');
} finally {
  await browser.close();
}
