# Private Universe · 庄园地标交互觉醒与电影级 7 站故事巡游架构白皮书 (v15.0 Master Spec)

> **文档标识**：`ESTATE-INTERACTION-AND-CINEMATIC-TOUR-SPEC`  
> **设计架构师**：Antigravity (AI Design Architect)  
> **执行团队**：Codex (Executor)  
> **冲刺目标**：在 2026-11-19 一周年纪念日前夕，打通“全岛 8 大新建庄园地标静默孤立、浑天日晷被树根遮挡、`缓缓环游` 仅为机械原地自转”的核心体验断层，完成从**“静态精美观赏岛”**到**“可触碰、有回应、有电影感故事线”**的终极进化！

---

## 🔍 一、 当前架构深度体检与四大核心痛点

通过审查 `src/natural/engine.js`、`src/natural/estate-features.js`、`src/natural/anniversary-milestone.js` 与测试集 `scripts/review-stargazing-anniversary.mjs`，已精确诊断出以下 4 项必须优先打通的关键问题：

| 痛点 | 当前真实源码现状与现象 | 本次架构升级方案 |
| :--- | :--- | :--- |
| **1. 浑天日晷位置遮挡 Bug** | `anniversary-milestone.js` 位于 `TREE_SITE.x - 3, TREE_SITE.z + 0.5`（即 `(-14, -4)`），紧贴爱之树西侧粗大根系与北向日葵花海之间，点击后卡片特写镜头正前方被粗大树根与花茎严重遮挡。 | 迁移至前景开阔迎宾草坡 `(-12.0, ground, -1.5)`，并附加圆石镶边展台基盘；确保 `frame('tree')` 与弹窗特写镜头**零遮挡**，且严格保留 `children[1]` 供 Playwright 自动化点击测试通过。 |
| **2. 新建庄园地标“看得见、点不动”** | `estate-features.js` 耗费心血雕琢了双人秋千、红白野餐毯吉他、石砌暖意篝火、东崖黄铜望远镜、大片向日葵花田，但在 `engine.js` 的 `interactive` 与 `presets` 中全部缺席，鼠标悬停与点击完全无响应。 | 全面唤醒 `swing`、`picnic`、`campfire`、`telescope` 悬停提示与点击飞入交互，附带**秋千轻推振荡 (`swing.nudge()`)**、**篝火加柴升起金色火星粒子 (`campfire.stoke()`)**、**望远镜一键切换夜幕观星入口 (`#telescope-gaze`)**，以及 `meadow` 花海预设视角。 |
| **3. `缓缓环游` 仅是枯燥原地自转** | 点击页脚 `#tour`（缓缓环游）目前仅开启 `controls.autoRotate = true`，镜头停在 30 米外缓慢转圈，无法近距离欣赏花海、桥梁、篝火与望远镜细节。 | 新建 `src/natural/scenic-tour.js`，将 `#tour` 升级为 **7 站电影级故事巡游**：平滑飞掠花海 → 轻推秋千 → 浑天日晷与爱之树 → 木桥飞瀑彩虹 → 野餐篝火 → 悬崖望远镜 → 全景剪影，全程动态刷新诗意字幕与进度胶囊，用户随时拖拽或按 `Esc` 无缝接管控制权。 |
| **4. 夜景地面死黑与娥眉月仰角过高** | `moon.js` 坐标设在 `(48, 82, -88)` 仰角过高导致常规视角难以同框；`bench-atmosphere.js` 夜幕通道下草地与花海迎风面过暗，局部呈死黑剪影。 | 将月亮平滑调整至 `(44, 48, -94)` 使观星台与全岛低仰角即可浪漫同框；适度提升夜幕月华天光补光强度（`hemi` / `sun` / `fill` / `environmentIntensity`），在保持灯火对比度同时雕琢银蓝月色质感。 |

---

## 📂 二、 涉及改动文件清单

1. **修改** `src/natural/anniversary-milestone.js`：修正日晷安装坐标、增加开阔石砌展台并优化特写镜头路径。
2. **修改** `src/natural/estate-features.js`：为 `swing` 注入物理级轻推接口 `nudge()`；为 `campfire` 注入上升金色火星粒子系统与旺火接口 `stoke()`；为四大互动区域挂载 `userData.interaction` 标签。
3. **新建** `src/natural/scenic-tour.js`：电影级 7 站多航点漫游引擎（含五次/余弦缓动飞行、驻留微漂移、诗意章节字幕与进度条回调）。
4. **修改** `src/natural/moon.js` & `src/natural/bench-atmosphere.js`：优化娥眉月构图位置与夜幕月华补光参数。
5. **修改** `src/natural/engine.js` & `index.html` & `src/style.css`：整合全新 `presets`、`anchors`、`interactive` 拾取字典、`#help-panel` 快捷传送门、`#tour` 电影巡游调度、望远镜快捷观星胶囊 `#telescope-gaze` 与巡游状态提示条 `#tour-status`。
6. **新增测试** `scripts/review-interaction-and-tour.mjs`（并挂入 `package.json` 的 `test:tour`）：端到端 Playwright 验证四大新地标点击反馈、日晷无遮挡、7 站巡游及用户接管打断逻辑。

---

## 🛠️ 三、 核心模块技术设计规范

### 1. `src/natural/anniversary-milestone.js`（迁移无遮挡展台）
- **坐标迁移**：将 `x = TREE_SITE.x - 3, z = TREE_SITE.z + .5` 调整为 `const x = -12.0, z = -1.5;`（位于爱之树正前方偏左开阔草地，既避开树根板与 `sunflowerClusters` 花群碰撞，又依然处于 `frame('tree')` 前景可点击范围内）。
- **测试兼容性红线**：`scripts/review-stargazing-anniversary.mjs` 第 16 行硬性读取 `anniversary-milestone` 的 `.children[1]` 计算屏幕投影坐标！因此 `base1` (`children[0]`) 与 `base2` (`children[1]`) 顺序**严禁改变**。外圈扩展石板台面请放在最后 `plaque.add(patioRing)`。
- **镜头特写微调**：`open()` 中：
  ```javascript
  const focus = plaque.position.clone().add(new THREE.Vector3(0, 0.52, 0));
  moveTo(focus.clone().add(new THREE.Vector3(0.68, 0.68, 1.55)), focus, { duration: 1.0, min: 1 });
  ```

### 2. `src/natural/estate-features.js`（物理动画反馈与火星粒子）
- **保留所有现有 Mesh 名称**：严禁更改 `review-estate-features.mjs` 检查的 16 个对象 `name`。
- **`makeCouplesSwing`**：
  - `swingGroup.userData.interaction = 'swing';`
  - 记录 `let nudgeTime = -999, lastElapsed = 0;`
  - 暴露 `nudge()`：`nudgeTime = lastElapsed;`
  - 在 `update(elapsed)` 中计算：`const dtSinceNudge = Math.max(0, elapsed - nudgeTime); const boost = dtSinceNudge < 12 ? 0.24 * Math.exp(-dtSinceNudge * 0.42) : 0; seatRig.rotation.z = Math.sin(elapsed * 1.45) * (0.055 + boost);`
- **`makeCozyCampfire`**：
  - `fireGroup.userData.interaction = 'campfire';`
  - 添加 48 个上升火星微粒（`THREE.Points` + AdditiveBlending 暖橙金点，基于 `elapsed` 垂直循环漂移并随正弦螺旋摆动）。
  - 暴露 `stoke()`：`stokeTime = lastElapsed;`
  - 旺火期间（5 秒内衰减）：`emberMat.emissiveIntensity` 与 `fireLight.intensity` 获得柔和加倍暖脉冲，火星粒子上升速度略加快且透明度升高。
- **`makeRomanticPicnic`**：`picnicGroup.userData.interaction = 'picnic';`
- **`makeStargazingDeckAndTelescope`**：`deckGroup.userData.interaction = 'telescope';`

### 3. `src/natural/scenic-tour.js`（7 站电影级故事巡游引擎）
导出 `createScenicTour({ camera, controls, moveTo, frame, caption, onArrive, onStateChange })`：
- **7 大航点定义**：
  1. `{ key: 'meadow', label: '01 / 07', title: '风过金浪，向日葵正仰望晨光。', note: 'Sunflowers & lavender in bloom.', pos: [-20.5, 2.35, 6.8], target: [-16.2, 1.35, 1.8], drift: [0.8, 0.25, -0.4], min: 3.8 }`
  2. `{ key: 'swing', label: '02 / 07', title: '秋千轻荡，春风都在耳畔。', note: 'Swaying in the breeze together.', pos: [-14.2, 2.6, 3.4], target: [-15.5, 1.9, -2.0], drift: [-0.6, 0.15, 0.3], min: 4.0 }`
  3. `{ key: 'tree', label: '03 / 07', title: '记忆系在枝头，星轨见证时光。', note: 'Astrolabe & the memory ribbon.', pos: [-8.2, 3.6, 5.2], target: [-11.5, 2.2, -3.2], drift: [0.6, 0.3, 0.2], min: 5.5 }`
  4. `{ key: 'waterfall', label: '04 / 07', title: '穿过木拱桥，水落进云里生出虹。', note: 'Where creek meets the clouds.', pos: [4.2, 1.2, 11.2], target: [0.8, -0.6, 3.5], drift: [-0.9, 0.3, -0.3], min: 3.5 }`
  5. `{ key: 'campfire', label: '05 / 07', title: '吉他、野餐毯与炉边微光。', note: 'Warm embers under our sky.', pos: [10.8, 2.2, 4.2], target: [14.1, 0.85, -0.4], drift: [0.5, 0.15, -0.5], min: 3.5 }`
  6. `{ key: 'telescope', label: '06 / 07', title: '顺着黄铜望远镜，仰望这片星海。', note: 'Toward the crescent moon and aurora.', pos: [17.4, 2.2, 2.6], target: [24.0, 12.0, -18.0], drift: [0.4, 0.6, -0.6], min: 1.8 }`
  7. `{ key: 'hero', label: '07 / 07', title: '风很轻，日子很慢。', note: 'Somewhere, just for us.', pos: 'hero', target: 'hero', drift: [0, 0, 0], min: 13 }`
- **生命周期控制**：
  - `start(startIndex = 0)`: 启动巡游并切到站点 0。
  - `next()`: 立即顺滑切至下一站。
  - `stop()`: 立即终止巡游（不强行弹回镜头），通知 UI 隐藏巡游进度条与复位按钮文案 `缓缓环游`。
  - 每站飞行约 `2.4s`，到达后触发 `onArrive(waypoint.key)` 并停留 `3.2s`（停留期间施加极温柔的微漂移防止死板僵硬），随后自动流转下一站，7 站循环一圈后回到全景或继续柔和循环。

### 4. `src/natural/engine.js` & UI 联动细节
- **严禁破坏**：
  - 当 `pendingPlacement === true` 时（正在草地放置气球），任何 `meadow` 快捷入口不可抢占地面点击。
  - 保留 `window.__PU` 调试接口，扩展 `scenicTour`、`discover` 与 `presets` 供 Playwright 验证。
  - 当用户手动拖动相机（`controls` `'start'` 事件）、触发 `discover()`、按 `Esc` / `R` 或打开弹窗时，自动调用 `scenicTour.stop()`！
- **`#help-panel .help-places`**：补充 5 个快捷漫游按钮（向日葵花田、双人秋千、草地野餐、暖意篝火、观星望远镜），并同步绑定 `data-place` 事件。
- **望远镜特写联动夜空观星**：在 `discover('telescope')` 到达后，显示轻盈玻璃态浮钮 `#telescope-gaze`（文案：在白昼时显示 `"🔭 切换夜幕 · 仰望星海"`，在黄昏/夜晚显示 `"🔭 透过望远镜观星"`），点击后自动开启夜幕并转入 `gazing.enter()` 75° 星海深空界！离开 `telescope` 视角（点击回到花园、拖动、切换视角或关闭）自动隐藏。

---

## ✅ 四、 强制性端到端验收标准 (Acceptance Criteria)

改动完成后，Codex **必须** 自行执行以下完整检查：
1. `npm run build` 无报错、无 Warning 阻断。
2. `npm run check:content` 验证通过。
3. `npm run test:estate` 与 `node scripts/review-stargazing-anniversary.mjs` 全部通过（确保日晷迁址后 `review-stargazing-anniversary` 依然 `PASS`！）。
4. 新增并运行 `scripts/review-interaction-and-tour.mjs`，验证：
   - 点击或调用 `discover('swing')`、`discover('campfire')`、`discover('picnic')`、`discover('telescope')`、`discover('meadow')` 均平滑到达目标且零报错；
   - 点击 `#tour` 启动 7 站巡游，`tour.active === true` 且进度标签更新，调用 `next()` 可切换下一站，模拟鼠标拖拽后 `tour.active` 自动变为 `false`（用户即刻接管控制权）；
   - `anniversary` 日晷弹窗展开后镜头前无树根遮挡。
5. 全程控制台 `console.error` 与 `pageerror` 为 **0**。
