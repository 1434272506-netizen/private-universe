import { chromium } from 'playwright-core';
import fs from 'node:fs';

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
});

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({ timeout: 90000 });
  await page.waitForFunction(() => window.__PU && window.__PU.phase === 'exploring' && !window.__PU.flying);
  await page.locator('[data-atmo="night"]').click();
  await page.waitForTimeout(2500);

  // Position camera similar to user's uploaded image:
  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(0.5, 3.2, 9.5);
    controls.target.set(-8.5, 6.5, -3.5);
    controls.update();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/10-user-perspective-new-aurora.png' });

  // Also copy to artifact directory
  const artifactDir = 'C:/Users/Administrator/.gemini/antigravity/brain/c9c5605b-e177-44be-bdff-6d0f7d74eb16';
  fs.copyFileSync('screenshots/10-user-perspective-new-aurora.png', `${artifactDir}/10-user-perspective-new-aurora.png`);

  console.log('DONE user perspective screenshot');
} finally {
  await browser.close();
}
