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
  await page.waitForTimeout(2200);

  // 1. 东北侧仰望：皎洁娥眉月与月华光晕特写 (Crescent Moon & Lunar Halo)
  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(5, 5.0, 5.0);
    controls.target.set(48, 82, -88);
    controls.update();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/25-night-crescent-moon-and-halo.png' });
  fs.copyFileSync('screenshots/25-night-crescent-moon-and-halo.png', `${artifactDir}/25-night-crescent-moon-and-halo.png`);

  // 2. 仰天大视角：横跨天穹的璀璨银河星带与深空星云 (Milky Way Galaxy Arch)
  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(-5, 3.5, 0);
    controls.target.set(0, 75, -5);
    controls.update();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/26-night-milky-way-galaxy-arch.png' });
  fs.copyFileSync('screenshots/26-night-milky-way-galaxy-arch.png', `${artifactDir}/26-night-milky-way-galaxy-arch.png`);

  // 3. 用户此前反馈视角复现：从树下仰望极光与深空平滑过渡 (Feathered Aurora & Seamless Cosmic Sky)
  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(6, 2.8, -12);
    controls.target.set(-15, 38, -35);
    controls.update();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/27-feathered-aurora-seamless-transition.png' });
  fs.copyFileSync('screenshots/27-feathered-aurora-seamless-transition.png', `${artifactDir}/27-feathered-aurora-seamless-transition.png`);

  // 4. 全岛远景夜空大俯瞰：悬浮岛、月夜、极光与银河全景 (Full Night Celestial Canvas)
  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(-28, 16, 42);
    controls.target.set(8, 22, -18);
    controls.update();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/28-night-full-island-celestial-canvas.png' });
  fs.copyFileSync('screenshots/28-night-full-island-celestial-canvas.png', `${artifactDir}/28-night-full-island-celestial-canvas.png`);

  console.log('DONE capture night sky screenshots');
} finally {
  await browser.close();
}
