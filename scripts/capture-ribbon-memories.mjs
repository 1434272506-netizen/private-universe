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

  // 1. 展开白丝带：打开记忆相册
  await page.evaluate(() => {
    window.__PU.discover('ribbon');
  });
  // 等待运镜及丝带展开动画完成
  await page.waitForTimeout(2800);
  await page.waitForSelector('#memory-dialog[open]');
  await page.waitForTimeout(1000);

  // 截图：第 1 张照片卡片正面
  await page.screenshot({ path: 'screenshots/31-ribbon-memory-photo-front.png' });
  fs.copyFileSync('screenshots/31-ribbon-memory-photo-front.png', `${artifactDir}/31-ribbon-memory-photo-front.png`);

  // 2. 翻转卡片：查看背面手写小注与浪漫邮戳
  await page.locator('.photo-flip-trigger').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/32-ribbon-memory-photo-back.png' });
  fs.copyFileSync('screenshots/32-ribbon-memory-photo-back.png', `${artifactDir}/32-ribbon-memory-photo-back.png`);

  // 3. 翻到第 2 页 (下一页)
  await page.locator('.photo-flip-back-trigger').click();
  await page.waitForTimeout(600);
  await page.locator('.album-next').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/33-ribbon-memory-photo-next.png' });
  fs.copyFileSync('screenshots/33-ribbon-memory-photo-next.png', `${artifactDir}/33-ribbon-memory-photo-next.png`);

  // 4. 关闭相册，走向木屋信箱，查看专属周年纪念情书
  await page.locator('#memory-dialog .close-story').click();
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    window.__PU.discover('mailbox');
  });
  await page.waitForTimeout(2800);
  await page.waitForSelector('#letter-dialog[open]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/34-mailbox-anniversary-letter.png' });
  fs.copyFileSync('screenshots/34-mailbox-anniversary-letter.png', `${artifactDir}/34-mailbox-anniversary-letter.png`);

  // 5. 关闭信箱，查看古树旁的年轮纪念日木桩
  await page.locator('#letter-dialog .close-story').click();
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    window.__PU.discover('anniversary');
  });
  await page.waitForTimeout(2400);
  await page.screenshot({ path: 'screenshots/35-anniversary-milestone-plaque.png' });
  fs.copyFileSync('screenshots/35-anniversary-milestone-plaque.png', `${artifactDir}/35-anniversary-milestone-plaque.png`);

  console.log('DONE capture ribbon memories and anniversary letter screenshots');
} finally {
  await browser.close();
}
