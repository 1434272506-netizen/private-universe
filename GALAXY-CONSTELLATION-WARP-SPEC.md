# Private Universe · 3D 银河系穹顶与射手金牛星系跃迁技术规范 (v7.0 Master Spec)

> **文档标识**：`GALAXY-CONSTELLATION-WARP-SPEC`  
> **设计架构师**：Antigravity (AI Design Architect)  
> **执行工程团队**：Codex / GPT (Executor)  
> **核心目标**：
> 1. **3D 螺旋银河穹顶**：在长椅仰望星空 75° 视野中，直接覆盖一套源自 GitHub 顶流（Three.js Journey / Bruno Simon 开源架构）的 **3D 程序化粒子螺旋银河系 (Spiral Galaxy Simulation)**，0MB 本地极速生成，50,000+ 动态自转星辰；
> 2. **两大星座发光星云团 (Dual Constellation Portals)**：在银河旋臂与银心两侧呈现 **射手座金色星团 (Sagittarius Portal)** 与 **金牛座冰蓝/火红星团 (Taurus Portal)**；
> 3. **点击光速飞跃穿梭 (Cinematic Warp Transition)**：点击任意光团，镜头平滑极速飞跃穿透星云，进入该星座的**专属深空微观宇宙空间**查看神话图腾与浪漫寄语，并支持一键返回宏观银河！

---

## 🌌 一、 3D 螺旋银河系数学与粒子架构 (`src/natural/spiral-galaxy.js`)

无需下载 40MB 的低性能静态 `.glb` 模型，基于开源经典对数螺线粒子算法，纯前端数学即时生成，0 网络延迟、60 FPS 丝滑运行：

### 1. 对数螺旋臂生成参数
```javascript
const GALAXY_CONFIG = {
  count: 48000,          // 星辰粒子总数 (极高性能平衡)
  radius: 65,            // 银河系整体展开半径
  branches: 3,           // 3条优美主旋臂
  spin: 1.25,            // 旋臂扭曲对数回旋角
  randomness: 0.45,      // 旋臂星尘弥散扩散度
  randomnessPower: 3.5,  // 越靠近旋臂中心星尘越致密
  insideColor: '#ffe094',// 银心核球温暖金辉 (Golden Amber Core)
  outsideColor: '#2b448a'// 旋臂外缘深邃宇宙蓝 (Deep Cosmic Indigo)
};
```

### 2. 几何与着色实现
- 使用 `THREE.BufferGeometry` 存储 `position` 与 `color` 属性；
- 材质采用 `THREE.PointsMaterial({ size: 0.22, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false })`；
- 每帧绕银盘中心轴平滑自转（$0.0003\text{ rad/frame}$），呈现宇宙宏大的物理运动感。

---

## 🌟 二、 射手座与金牛座“两大星座光团”架构 (Constellation Portals)

在银河系的两个天文学精确区域，构建两团引人注目的巨大脉动星云团：

### 1. 射手座星系光团 (Sagittarius Portal)
- **空间位置**：紧邻银河系中心黄金核球（人马座 A* 银心方向，坐标约 $x \approx -18, y \approx 14, z \approx -22$）；
- **光影材质**：
  - 核心发光体：半透温暖熔金与洋红光球（`#ff9e42` 与 `#e85d75`），模拟真实的 M8 礁湖星云与银心星团；
  - 伴随向外扩散的微光光晕与星尘自转脉动（$1.2\text{ Hz}$）；
  - 悬浮半透明微光标识：“♐ 射手座星系 (点击探索)”。

### 2. 金牛座星系光团 (Taurus Portal)
- **空间位置**：位于银河外缘反银心旋臂（坐标约 $x \approx 22, y \approx 18, z \approx -16$）；
- **光影材质**：
  - 核心发光体：由两部分构成：一团是 M45 昴宿星团的**电光冰蓝星纱 (`#60a5fa`)**，另一侧是毕宿五巨星的**炽热火红光球 (`#ff6b3d`)**；
  - 形成冰与火交织的梦幻星云团；
  - 悬浮半透明微光标识：“♉ 金牛座星系 (点击探索)”。

### 3. 爱心星轨光桥 (Inter-Galactic Love Arc)
- 在射手座与金牛座两大光团之间，构建一条横跨数万光年银河的淡粉金色流光星轨（Bézier Spline）；
- 64 颗晶莹星尘沿星轨缓缓流动，在银河中央交织成唯美的几何爱心，象征两人跨越星海相依。

---

## 🚀 三、 点击飞跃穿梭与微观宇宙视界 (Cinematic Warp & Deep Realm)

### 1. 光速跃迁运镜 (Cinematic Warp Transition)
- 当用户在仰望星空模式下点击【射手座光团】或【金牛座光团】时：
  1. 目标光团产生极高亮度的透镜光芒爆发（Lens Bloom）；
  2. 摄像机启动 $1.8\text{ 秒}$ 的余弦缓动光速穿梭，直接极速飞跃进该光团的核心深处（`moveTo(targetPos, targetLookAt, { duration: 1.8 })`）；
  3. 背景星辰随飞入产生微妙的径向拉伸（Warp Speed Effect），沉浸感爆棚。

### 2. 射手座微观宇宙空间 (Sagittarius Realm)
飞入后，视角被漫天金红与粉紫的星云迷雾包裹：
- **近景巨幕**：近距离瞻仰人马天弓神祇的古典天球图腾，手持星光长弓指向银心；
- **真实星官**：茶壶星群八颗璀璨星辰（Nunki、Kaus Australis 等）近在咫尺；
- **星系爱情印记**：星云中央浮现金色信笺浮标：“一隅春天 · 射手的奔赴与自由”。

### 3. 金牛座微观宇宙空间 (Taurus Realm)
飞入后，视角被纯净通透的电光冰蓝星纱（昴宿星团 M45）与火红巨星环绕：
- **近景巨幕**：奔腾天牛的英伟图腾在星雾中浮现，毕宿五（Aldebaran）如火炬般在眼眸处跳动；
- **真实星官**：V 字毕宿星团与冲天牛角立体环绕；
- **星系爱情印记**：星云中央浮现冰蓝信笺浮标：“一隅春天 · 金牛的执着与长情”。

### 4. 返回宏观银河 (Return to Galaxy)
- 在任意星座微观宇宙中，HUD 右上角常驻轻盈按钮：【🌌 返回银河全景】；
- 点击后，摄像机平滑拉远后退，平稳回落至长椅 75° 仰望星空的宏观银河大宇宙视角。

---

## ⚡ 四、 Token 极度节约与高效执行守则 (Token Economy)

Codex / GPT 执行落地时必须严格遵循：
1. **模块高内聚与极简实现**：
   - `src/natural/spiral-galaxy.js` 仅用一个纯函数生成 `THREE.Points`，控制在 75 行以内；
   - `src/natural/constellations.js` 统一封装两大光团的拾取、跃迁运镜与返回逻辑，保持在 130 行以内；
2. **严禁全文件重写**：`engine.js` 仅局部注册点击拾取分支；
3. **静默测试**：更新测试脚本，仅打印单行 PASS，严禁输出大量数据；
4. **精炼汇报**：完成汇报控制在 10 行以内，严禁贴完整代码。

---

## 🔍 五、 自动化回归测试与验收指标 (QA Standards)

1. **螺旋银河粒子生成验证**：
   - 验证场景中存在 `spiral-galaxy` 几何体，顶点数 $\ge 40000$ 且具备 AdditiveBlending；
   - 验证银河系在每帧更新中具有旋转动能。
2. **两大星座光团与跃迁测试 (`scripts/review-galaxy-warp.mjs`)**：
   - 验证射手座与金牛座两大发光球体可通过 Raycast 正确拾取；
   - 验证点击光团后，摄像机发生飞跃位移，进入该微观宇宙视图；
   - 验证点击【返回银河全景】能够平滑拉回复位。
3. **全套自动化测试回归 (`npm test`)**：
   - 全部自动化测试 100% 全部通过（PASS）。

---

## 🤖 六、 致 Codex / GPT 执行团队的工程实施指令 (Prompt for GPT)

请 Codex/GPT 仔细阅读 `GALAXY-CONSTELLATION-WARP-SPEC.md`，执行以下四步：
1. 新建 `src/natural/spiral-galaxy.js`（基于 Three.js Journey 经典对数螺旋对数公式生成 48,000 颗粒子 3D 银河系，<75行）；并在仰望星空时叠加展示；
2. 升级 `src/natural/constellations.js`：
   - 在银河系中部署射手座金色光团（Sagittarius Portal）与金牛座冰蓝/火红光团（Taurus Portal）；
   - 实现点击光团触发 1.8 秒光速跃迁穿梭运镜，进入微观星座宇宙空间；
   - 提供【🌌 返回银河全景】按钮拉回镜头；
3. 编写静默测试脚本 `scripts/review-galaxy-warp.mjs` 并执行 `npm test`，确保 100% 全部通过；
4. 【重要】遵守 Token 节约守则：汇报仅输出修改文件列表与 PASS 结果，严禁打印完整源码！
