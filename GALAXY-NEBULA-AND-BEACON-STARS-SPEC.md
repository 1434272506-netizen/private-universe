# Private Universe · 银河深空星云与翡翠紫晶双星跃迁规范 (v8.0 Spec)

> **文档标识**：`GALAXY-NEBULA-AND-BEACON-STARS-SPEC`  
> **设计架构师**：Antigravity (AI Design Architect)  
> **执行工程团队**：Codex / GPT (Executor)  
> **核心改进**：
> 1. **剔除突兀大光团**：全面移除生硬的几何光球与突兀粗体标牌，回归天体真实的空灵星空美学；
> 2. **深空宇宙星云层 (Volumetric Interstellar Nebulae)**：在 3D 旋转银河系中注入多层高斯星际气体与彩色星云漫射薄纱，呈现哈勃/韦伯望远镜级别的深邃星河；
> 3. **全天最耀眼指引双星 (Emerald & Amethyst Beacon Stars)**：
>    - ♐ **射手座**：以全天最璀璨的**翡翠翠绿恒星 (`#10b981`)** 为引路基准，带晶莹四芒衍射星芒；
>    - ♉ **金牛座**：以全天最绚丽的**紫罗兰晶紫恒星 (`#c084fc`)** 为守望基准，带梦幻紫晶星芒；
> 4. **无缝光速跃迁 (Seamless Warp-in)**：点击翠绿或紫晶星芒，触发 1.8 秒极速穿梭飞入微观星座秘境，配备【🌌 返回银河全景】平滑拉回。

---

## 🌌 一、 银河系深空星云系统架构 (`src/natural/spiral-galaxy.js`)

在原 48,000 粒子星点的基础上，注入**星际气体与星云薄雾层 (Volumetric Cosmic Dust & Nebulae)**，彻底告别单调噪点感：

### 1. 软边缘高斯星云精灵 (Soft Gaussian Nebula Sprites)
- 动态生成一张 128×128 的高斯柔光径向渐变纹理（Radial Gaussian Falloff）；
- 沿 3 条主对数旋臂散布 36 ~ 42 团半透明体积极光/星云云气（Quad Billboard Sprites）：
  - **银心与射手方向**：温暖的熔金、玫瑰粉与宇宙洋红（`#ff8c5a`, `#e84393`, `#f59e0b`），模拟 M8 礁湖星云与银心气态核；
  - **旋臂外侧与金牛方向**：深邃的宇宙青蓝与紫罗兰星纱（`#6c5ce7`, `#38bdf8`, `#a29bfe`），模拟昴宿星团反射星云；
- 材质属性：
  ```javascript
  new THREE.SpriteMaterial({
    map: nebulaTexture,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.16, // 轻盈柔和，绝不遮挡后方星空
    depthWrite: false
  });
  ```
- 随银河系盘面以 $0.0003\text{ rad/frame}$ 缓慢自转，并在每帧保持轻微的余弦缩放呼吸，呈现宇宙气体生命的脉动感。

---

## 🌟 二、 射手翡翠星与金牛紫晶星架构 (`src/natural/galaxy-art.js`)

全面淘汰突兀的大光团几何球体，替换为天穹中最闪烁的恒星尖峰：

### 1. 恒星耀芒生成器 (`createBeaconStar(color, size)`)
一颗真实的耀眼恒星由三层纯天体视觉构成：
1. **纯白超热核 (White-Hot Core)**：极小的高亮度白色球心（`size: 0.28`）；
2. **彩色衍射十字星芒 (4-Point Diffraction Cross Spikes)**：
   - 采用专业天文摄影的四芒星尖峰，缓慢旋转并随时间闪烁（Twinkle）；
3. **主色调透镜星晕 (Tinted Lens Halo)**：柔和的径向光晕（`radius: 2.5 ~ 3.5`），具有柔和的呼吸频率。

### 2. 射手座翡翠星 (Sagittarius Emerald Beacon)
- **天球坐标**：位于银心金红星云深处（$x \approx -18, y \approx 14, z \approx -22$）；
- **核心色彩**：**纯净翡翠碧绿 (`#10b981` / `#34d399`)**，散发如切面白宝石折射的清冽绿芒；
- **隐形命中代理 (Hit-test Proxy)**：绑定一个半径为 2.2 的无形碰撞盒，确保点击判定轻松灵敏；
- **优雅浮标**：当鼠标掠过或在星空模式激活时，仅在星体侧方显示半透明雅致手账微光字标：`♐ 射手座 · 翡翠星`。

### 3. 金牛座紫晶星 (Taurus Amethyst Beacon)
- **天球坐标**：位于外旋臂紫蓝星纱之中（$x \approx 22, y \approx 18, z \approx -16$）；
- **核心色彩**：**梦幻紫罗兰晶紫 (`#a855f7` / `#c084fc`)**，散发如紫水晶般的瑰丽光泽；
- **隐形命中代理**：同样配置高灵敏度命中盒；
- **优雅浮标**：半透明雅致手账微光字标：`♉ 金牛座 · 紫晶星`。

### 4. 星际爱心星轨 (Inter-Stellar Starlight Heart Arc)
- 贝塞尔流光光桥从**翡翠绿星**起飞，穿透中央银河与星云，流经几何爱心，再缓缓汇入**紫晶星**；
- 64 颗晶莹星尘粒子沿线缓缓游弋，两端分别自然渐变融入绿紫双色，视觉浑然天成。

---

## 🚀 三、 交互跃迁与微观秘境体验 (`src/natural/constellations.js`)

1. **点击耀星跃迁**：
   - 用户的鼠标点击射手座翡翠星或金牛座紫晶星；
   - 目标星芒瞬间爆发出更耀眼的衍射芒光（Flare Burst）；
   - 摄像机以 $1.8\text{ 秒}$ 的余弦平滑曲线飞掠过银河星云，瞬移进该星座深空微观秘境。
2. **微观秘境与寄语**：
   - 射手秘境：金红星云环绕，星光长弓神祇图腾浮现，茶壶八星环绕，金色信笺呈现：*“一隅春天 · 射手的奔赴与自由”*；
   - 金牛秘境：冰蓝紫晶星纱环绕，昂首天牛图腾浮现，毕宿五巨星跳动，紫金信笺呈现：*“一隅春天 · 金牛的执着与长情”*；
3. **返回银河全景**：
   - 点击右上角【🌌 返回银河全景】，平滑拉回至长椅 75° 仰望星空视角。

---

## ⚡ 四、 Token 极度节约与高效实施指令 (Prompt for GPT)

请 Codex/GPT 仔细阅读 `GALAXY-NEBULA-AND-BEACON-STARS-SPEC.md`，执行以下极简改造：

1. **优化 `src/natural/spiral-galaxy.js`**：
   - 保留原 48,000 粒子；
   - 增加 36 团使用高斯柔光的半透明星云薄雾精灵（`THREE.AdditiveBlending`，粉金与紫蓝双色），沿旋臂融合排布（新增代码 <30 行）；
2. **重构 `src/natural/galaxy-art.js`**：
   - 彻底删除粗暴的 `SphereGeometry` 大光团与粗体标牌；
   - 实现 `beaconStar(color, size)`，渲染带四芒星尖峰的璀璨闪耀恒星（射手座翡翠绿 `#10b981`，金牛座紫罗兰 `#c084fc`）；
   - 保留高灵敏度的射线拾取代理；
3. **适配 `src/natural/constellations.js`**：
   - 将点击拾取目标绑定到两颗闪耀恒星的代理对象上；
   - 确保点击射手绿色星、金牛紫色星顺畅触发 1.8s 飞跃转场；
4. **运行回归测试并静默输出**：
   - 执行 `node scripts/review-galaxy-warp.mjs`，确保测试通过；
   - 严格遵循 Token 节约规范：汇报仅输出变更文件列表与 PASS 结论，严禁贴完整代码！
