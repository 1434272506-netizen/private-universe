import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const outDir = path.resolve('work/qa/creek-ecology/video');
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
  await page.locator('#enter-direct').click({ timeout: 90000 });

  // Start with creek overview
  await page.evaluate(() => window.__PU.frame('creek'));
  await page.waitForFunction(() => !window.__PU.flying);
  await page.waitForTimeout(1000);

  // 1. Water ripple interaction
  const ripplePoint = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { creekX, waterY } = await import('/src/natural/land.js');
    const p = new THREE.Vector3(creekX(0.8), waterY(0.8), 0.8).project(window.__PU.camera);
    return { x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 };
  });

  await page.mouse.click(ripplePoint.x, ripplePoint.y);
  await page.waitForTimeout(400);
  for (let i = 0; i < 10; i++) {
    await page.mouse.move(ripplePoint.x - 30 + i * 8, ripplePoint.y + 12);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1500);

  // 2. Camera glide to Upstream Pool (Turtle & Clownfish close-up)
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { creekX } = await import('/src/natural/land.js');
    const p = window.__PU;
    const startPos = p.camera.position.clone();
    const startTarget = p.controls.target.clone();
    const endPos = new THREE.Vector3(creekX(-2.4) + 1.1, 1.4, -1.5);
    const endTarget = new THREE.Vector3(creekX(-2.4), 0.16, -2.4);

    const startTime = performance.now();
    const duration = 2200;

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

  // Stay on Turtle & Clownfish for 4 seconds
  await page.waitForTimeout(4000);

  // 3. Camera glide along creek to Midstream Stepping Stones (Silver Fish School)
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { creekX } = await import('/src/natural/land.js');
    const p = window.__PU;
    const startPos = p.camera.position.clone();
    const startTarget = p.controls.target.clone();
    const endPos = new THREE.Vector3(creekX(0.5) + 1.25, 1.35, 1.6);
    const endTarget = new THREE.Vector3(creekX(0.5), 0.12, 0.4);

    const startTime = performance.now();
    const duration = 2500;

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

  // Watch Silver Fish School swim around stepping stones for 4.5 seconds
  await page.waitForTimeout(4500);

  // 4. Pull back to romantic elevated vista
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const p = window.__PU;
    const startPos = p.camera.position.clone();
    const startTarget = p.controls.target.clone();
    const endPos = new THREE.Vector3(5.2, 4.6, 6.8);
    const endTarget = new THREE.Vector3(0.5, 0.3, 0.2);

    const startTime = performance.now();
    const duration = 2400;

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

  await page.waitForTimeout(2000);

  // Obtain video file
  const video = page.video();
  await page.close();
  await context.close();

  if (video) {
    const videoPath = await video.path();
    console.log('Raw webm video recorded at:', videoPath);
    const mp4Path = path.resolve('work/qa/creek-ecology/creek-ecology-demo.mp4');
    
    // Transcode to MP4 using ffmpeg
    try {
      execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 22 "${mp4Path}"`, { stdio: 'pipe' });
      console.log('Successfully transcoded to MP4:', mp4Path);
    } catch (err) {
      console.error('ffmpeg transcoding note:', err.message);
    }
  }
} finally {
  await browser.close();
}
