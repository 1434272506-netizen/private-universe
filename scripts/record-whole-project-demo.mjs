import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const outDir = path.resolve('work/qa/video-tour');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
});

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: outDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/');

  // Wait for scene ready
  await page.waitForSelector('#enter-direct:not([hidden])', { timeout: 90000 });
  await page.waitForTimeout(2000); // Admire opening wax seal invitation card

  // Enter the garden directly
  await page.locator('#enter-direct').click();
  await page.waitForFunction(() => window.__PU && !window.__PU.flying);

  // --- Scene 1: Floating Island Hero Overview & Sunset Burning Clouds (6s) ---
  await page.evaluate(() => window.__PU.frame('hero', true));
  await page.waitForTimeout(5500);

  // --- Scene 2: Memory Tree & Ribbon (6s) ---
  await page.evaluate(() => window.__PU.frame('tree', true));
  await page.waitForTimeout(5500);

  // --- Scene 3: Mailbox & Letters (6s) ---
  await page.evaluate(() => window.__PU.discover('mailbox'));
  await page.waitForTimeout(5500);
  await page.evaluate(() => {
    if (window.__PU.activePlace) window.__PU.returnToGarden();
  });
  await page.waitForTimeout(1500);

  // --- Scene 4: Sunset Bench & Fire Clouds (6s) ---
  await page.evaluate(() => window.__PU.frame('bench', true));
  await page.waitForTimeout(5500);

  // --- Scene 5: Creek & Ripples & Native Ecology (13s) ---
  await page.evaluate(() => window.__PU.frame('creek', true));
  await page.waitForTimeout(2000);

  // Click water to trigger ripples
  const ripplePoint = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { creekX, waterY } = await import('/src/natural/land.js');
    const p = new THREE.Vector3(creekX(0.8), waterY(0.8), 0.8).project(window.__PU.camera);
    return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
  });
  await page.mouse.click(ripplePoint.x, ripplePoint.y);
  await page.waitForTimeout(300);
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(ripplePoint.x - 24 + i * 6, ripplePoint.y + 10);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(1500);

  // Close up on Upstream Turtle & Clownfish
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { creekX } = await import('/src/natural/land.js');
    const p = window.__PU;
    const startPos = p.camera.position.clone();
    const startTarget = p.controls.target.clone();
    const endPos = new THREE.Vector3(creekX(-2.4) + 1.1, 1.4, -1.5);
    const endTarget = new THREE.Vector3(creekX(-2.4), 0.16, -2.4);
    const startTime = performance.now();
    const duration = 2000;
    return new Promise(resolve => {
      function glide() {
        const t = Math.min(1, (performance.now() - startTime) / duration);
        const ease = t * t * (3 - 2 * t);
        p.camera.position.lerpVectors(startPos, endPos, ease);
        p.controls.target.lerpVectors(startTarget, endTarget, ease);
        p.controls.update();
        if (t < 1) requestAnimationFrame(glide);
        else resolve();
      }
      requestAnimationFrame(glide);
    });
  });
  await page.waitForTimeout(3500);

  // Close up on Midstream Silver Fish School & Stepping Stones
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { creekX } = await import('/src/natural/land.js');
    const p = window.__PU;
    const startPos = p.camera.position.clone();
    const startTarget = p.controls.target.clone();
    const endPos = new THREE.Vector3(creekX(0.5) + 1.25, 1.35, 1.6);
    const endTarget = new THREE.Vector3(creekX(0.5), 0.12, 0.4);
    const startTime = performance.now();
    const duration = 2000;
    return new Promise(resolve => {
      function glide() {
        const t = Math.min(1, (performance.now() - startTime) / duration);
        const ease = t * t * (3 - 2 * t);
        p.camera.position.lerpVectors(startPos, endPos, ease);
        p.controls.target.lerpVectors(startTarget, endTarget, ease);
        p.controls.update();
        if (t < 1) requestAnimationFrame(glide);
        else resolve();
      }
      requestAnimationFrame(glide);
    });
  });
  await page.waitForTimeout(3500);

  // --- Scene 6: Waterfall into clouds with rainbow (5s) ---
  await page.evaluate(() => window.__PU.frame('waterfall', true));
  await page.waitForTimeout(5000);

  // --- Scene 7: Full Island Twilight Orbit (6s) ---
  await page.evaluate(() => {
    window.__PU.frame('hero', true);
    document.querySelector('#tour')?.click();
  });
  await page.waitForTimeout(6000);

  const video = page.video();
  await page.close();
  await context.close();

  if (video) {
    const videoPath = await video.path();
    console.log('Raw webm video recorded at:', videoPath);
    const mp4Path = path.resolve('work/qa/whole-project-demo.mp4');
    
    // Transcode to MP4 using ffmpeg
    try {
      execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 22 "${mp4Path}"`, { stdio: 'pipe' });
      console.log('Successfully transcoded whole project demo to MP4:', mp4Path);
    } catch (err) {
      console.error('ffmpeg transcoding note:', err.message);
    }
  }
} finally {
  await browser.close();
}
