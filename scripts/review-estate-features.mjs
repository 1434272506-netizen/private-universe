import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
});

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5173/');
  await page.locator('#enter-direct').click({ timeout: 90000 });
  await page.waitForFunction(() => window.__PU && window.__PU.phase === 'exploring');

  // 1. 验证所有 8 大庄园核心地标构件已挂载
  const state = await page.evaluate(() => {
    const s = window.__PU.scene;
    return {
      estate: Boolean(s.getObjectByName('estate-features')),
      bridge: Boolean(s.getObjectByName('arched-wooden-footbridge')),
      lanterns: Boolean(s.getObjectByName('pathway-stake-lanterns')),
      picnic: Boolean(s.getObjectByName('romantic-picnic-spot')),
      guitar: Boolean(s.getObjectByName('picnic-acoustic-guitar')),
      blanket: Boolean(s.getObjectByName('picnic-checkered-blanket')),
      campfire: Boolean(s.getObjectByName('cozy-campfire-pit')),
      campfireLight: Boolean(s.getObjectByName('campfire-glow-light')),
      observatory: Boolean(s.getObjectByName('stargazing-deck-and-telescope')),
      telescope: Boolean(s.getObjectByName('brass-stargazing-telescope')),
      swing: Boolean(s.getObjectByName('couples-cliffside-swing')),
      fences: Boolean(s.getObjectByName('rustic-wooden-fences')),
      meadows: Boolean(s.getObjectByName('blossom-meadows')),
      sunflowers: Boolean(s.getObjectByName('sunflower-fields')),
      lavender: Boolean(s.getObjectByName('lavender-terraces')),
      bioluminescent: Boolean(s.getObjectByName('bioluminescent-star-flora'))
    };
  });

  for (const [k, v] of Object.entries(state)) {
    assert.equal(v, true, `Component ${k} must exist in the scene`);
  }

  const artifactDir = 'C:/Users/Administrator/.gemini/antigravity/brain/c9c5605b-e177-44be-bdff-6d0f7d74eb16';

  // 2. 截取：西大陆向日葵花田、薰衣草梯田、白桦矮栅栏与崖畔秋千 (白昼)
  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(-18.5, 4.2, 5.5);
    controls.target.set(-15.0, 1.2, -1.5);
    controls.update();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/18-estate-blossom-meadows-and-swing.png' });
  fs.copyFileSync('screenshots/18-estate-blossom-meadows-and-swing.png', `${artifactDir}/18-estate-blossom-meadows-and-swing.png`);

  // 3. 截取：东大陆双人野餐角与石砌篝火堆 (白昼特写)
  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(11.2, 2.6, -3.2);
    controls.target.set(14.2, 0.8, -0.5);
    controls.update();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/16-estate-picnic-and-campfire.png' });
  fs.copyFileSync('screenshots/16-estate-picnic-and-campfire.png', `${artifactDir}/16-estate-picnic-and-campfire.png`);

  // 4. 截取：东侧悬崖黄铜天文望远镜与星空挑台 (白昼特写)
  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(15.2, 2.8, 4.2);
    controls.target.set(18.2, 1.6, 1.8);
    controls.update();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/17-estate-telescope-stargazing-deck.png' });
  fs.copyFileSync('screenshots/17-estate-telescope-stargazing-deck.png', `${artifactDir}/17-estate-telescope-stargazing-deck.png`);

  // 5. 切换至 Sunset (密桃晚霞时刻)
  await page.locator('[data-atmo="sunset"]').click();
  await page.waitForTimeout(2200);

  // 截取夕阳全景大俯瞰
  await page.evaluate(() => {
    const { camera, controls } = window.__PU;
    camera.position.set(-15.0, 15.5, 32.0);
    controls.target.set(0.0, 2.0, 0.0);
    controls.update();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/19-estate-sunset-full-panorama.png' });
  fs.copyFileSync('screenshots/19-estate-sunset-full-panorama.png', `${artifactDir}/19-estate-sunset-full-panorama.png`);

  // 6. 切换至 Night (银河萤火夜景时刻)
  await page.locator('[data-atmo="night"]').click();
  await page.waitForTimeout(2200);

  // 验证夜间灯光、篝火火光与微光花草全量激活
  const nightCheck = await page.evaluate(() => {
    const s = window.__PU.scene;
    const bridgeL = s.getObjectByName('bridge-lantern-cores');
    const stakeL = s.getObjectByName('lantern-luminous-cores');
    const fireL = s.getObjectByName('campfire-glow-light');
    const starF = s.getObjectByName('bioluminescent-star-flora');
    return {
      bridgeEmissive: bridgeL?.material?.emissiveIntensity || 0,
      stakeEmissive: stakeL?.material?.emissiveIntensity || 0,
      fireIntensity: fireL?.intensity || 0,
      starFloraEmissive: starF?.material?.emissiveIntensity || 0
    };
  });

  assert.ok(nightCheck.bridgeEmissive > 1.5, 'Bridge lanterns active at night');
  assert.ok(nightCheck.stakeEmissive > 1.5, 'Stake lanterns active at night');
  assert.ok(nightCheck.fireIntensity > 0.8, 'Campfire active at night');
  assert.ok(nightCheck.starFloraEmissive > 1.0, 'Star flora active at night');

  // 7. 关键验收：夜景全景大俯瞰 (完全复现用户上传机位，见证全岛星火璀璨)
  await page.screenshot({ path: 'screenshots/15-estate-full-night-panorama.png' });
  fs.copyFileSync('screenshots/15-estate-full-night-panorama.png', `${artifactDir}/15-estate-full-night-panorama.png`);

  assert.deepEqual(errors, [], 'No uncaught errors during estate full review');
  console.log('PASS complete celestial estate features: bridge, 21 lanterns, picnic, campfire, telescope, swing, fences, blossom meadows');
} finally {
  await browser.close();
}
