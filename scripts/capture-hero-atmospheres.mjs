import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({ timeout: 90000 });
  await page.waitForFunction(() => window.__PU && !window.__PU.flying);

  // 1. Switch to sunset in hero view
  await page.evaluate(() => {
    window.__PU.frame('hero');
    window.__PU.setAtmosphere('sunset');
  });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'work/qa/global-atmosphere/hero-sunset.png' });

  // 2. Switch to night in hero view
  await page.evaluate(() => {
    window.__PU.setAtmosphere('night');
  });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'work/qa/global-atmosphere/hero-night-new.png' });
  console.log('Captured hero-sunset.png and hero-night-new.png');
} finally {
  await browser.close();
}
