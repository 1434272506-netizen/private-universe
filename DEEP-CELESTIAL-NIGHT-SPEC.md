# 🌌 私人爱情宇宙：深空天幕细节升级设计规约
## (DEEP-CELESTIAL-NIGHT-SPEC.md)

> **设计架构师**：Antigravity  
> **代码执行方**：Codex / GPT  
> **制定时间**：2026-11-03  
> **规约定位**：针对长椅夜景氛围的细节深化专项（模块一：深空天幕）。彻底解决当前“月亮太假像贴纸、星空死板单调、缺少层次”的硬伤，重构**「月华光晕与地球反照光」、「深空银河星云织锦」、「分级多频微闪星斗」**，并新增**「偶遇许愿流星系统」**，确保全项目 17 组自动化回归测试 100% 绿灯。

---

## 🔍 GitHub 优质开源可复用参考 (GitHub Open-Source Benchmarks)

执行方无需从零盲目编写，已从 GitHub 检索出以下久经实战检验的轻量着色器模式可直接借鉴：

1. **流星与彗星生命周期 (Shooting Stars / Meteors Lifecycle)**：
   - 标杆项目：[`CK42BB/procedural-stars-threejs`](https://github.com/CK42BB/procedural-stars-threejs)
   - 可复用模式：基于时间步长的 `flare-and-fade` 飞行生命周期与衰减透明度拖尾算法；
2. **月晕与天体外光晕 (Moon Halo & Atmospheric Corona)**：
   - 标杆项目：[`stemkoski/Three.js-Examples` (Shader-Glow)](https://github.com/stemkoski/stemkoski.github.io)
   - 可复用模式：基于视线法线内积的边缘 Fresnel 漫射模型（`AdditiveBlending`, `depthWrite: false`）；
3. **真实恒星星图与分级频闪 (Starmap & Multi-tier Stars)**：
   - 标杆项目：[`mathiasbno/three-starmap`](https://github.com/mathiasbno/three-starmap)
   - 可复用模式：利用顶点属性（`size`, `speed`, `phase`）驱动非均匀恒星呼吸闪烁。

---

## 🌸 一、四大天幕细节重塑目标 (Detailed Goals)

```
   [ 剪纸硬边白月牙 ]    ───升级───►    [ 柔光月牙 + 地球反照光 + 双层月华光晕 ]
   [ 单色死黑夜空 ]      ───升级───►    [ 紫黛青金多阶银河星云织锦 ]
   [ 粗糙等大随机白点 ]  ───升级───►    [ 三等亮星星斗 + 独立频率呼吸微闪 ]
   [ 无动态空旷夜幕 ]    ───升级───►    [ 偶遇许愿流星 (15~25s 划过天际) ]
```

---

## 🎨 二、核心算法与着色器重构规范

### 1. 柔美月牙、地球反照光与双层月晕 (`src/natural/atmosphere.js`)

#### 现状硬伤
原着色器使用两个圆硬性相减，边缘锯齿严重，月晕衰减极快且只有单层极弱光斑，导致月亮像贴在黑布上的硬边剪纸。

#### 重构规范与 GLSL 参数
```glsl
// 月球中心指向与角距离计算
vec3 moonDir = normalize(vec3(-.88, .165, -.72));
float m = length(direction - moonDir);

// 1. 柔和抗锯齿月牙轮廓 (Soft Anti-aliased Crescent)
float moonDisc = 1.0 - smoothstep(0.0235, 0.0255, m);
float shadowDisc = 1.0 - smoothstep(0.0225, 0.0248, length(direction - normalize(moonDir + vec3(0.010, 0.008, -0.010))));
float crescent = clamp(moonDisc - shadowDisc, 0.0, 1.0);

// 2. 达芬奇光辉/地球反照光 (Earthshine - 暗部幽微轮廓)
float earthshine = moonDisc * (1.0 - crescent) * 0.12;
vec3 moonBodyColor = vec3(0.98, 0.96, 0.91) * crescent * 2.2 + vec3(0.42, 0.52, 0.68) * earthshine;

// 3. 双层月晕光华 (借鉴 stemkoski 经典光晕衰减模型)
// 内晕 (Inner Corona)：贴身温暖柔光
float innerCorona = exp(-m * 14.0) * 0.55;
// 外晕 (Outer Atmospheric Halo)：大范围冷月银蓝漫射
float outerHalo = exp(-m * 3.8) * 0.28;
vec3 haloColor = vec3(1.0, 0.94, 0.85) * innerCorona + vec3(0.55, 0.72, 0.95) * outerHalo;

// 合成月光总输出
vec3 totalMoonlight = (moonBodyColor + haloColor) * night;
```

---

### 2. 深空银河星云织锦 (Milky Way Nebula Dust Band)

#### 现状硬伤
原星云带最大亮度仅 `0.055`，在夜空中几乎不可见，缺少宇宙的深邃与色彩层次。

#### 重构规范
在 `atmosphere.js` 中将银河带重构为双重噪声扰动的多阶色带：
- **星云空间主轴**：`normalize(vec3(.38, .78, -.45))`，斜贯天际；
- **色彩渐变阶梯**：
  - 核心尘埃区：浅银紫星尘 (`vec3(.085, .072, .135)`)；
  - 外围云气：深海靛蓝 (`vec3(.035, .058, .105)`) 与暗绯云雾 (`vec3(.065, .035, .068)`)；
- **高频扰动星尘 (Stardust Clumping)**：
  ```glsl
  float bandCore = exp(-pow(dot(direction, normalize(vec3(.38, .78, -.45))) * 6.5, 2.0));
  float cloudNoise = sin(direction.x * 22.0 + direction.y * 31.0) * cos(direction.z * 27.0);
  float stardust = clamp(bandCore * (0.65 + 0.35 * cloudNoise), 0.0, 1.0);
  vec3 nebulaColor = mix(vec3(0.035, 0.055, 0.11), vec3(0.095, 0.075, 0.14), stardust) * stardust * 1.6;
  ```

---

### 3. 三等星斗与独立频率微闪 (`src/natural/celestial.js`)

#### 现状硬伤
1200 颗星星大小完全一致、闪烁频率相同，像网格撒点。

#### 重构规范（借鉴 mathiasbno/three-starmap 模式）
- **星等分级 (Three Stellar Magnitudes)**：
  - **特等/一等亮星 (60 颗)**：尺寸 `4.2px`，明亮清冽（`vec3(0.95, 0.98, 1.0)`），带十字星芒感；
  - **二等星 (280 颗)**：尺寸 `2.6px`，中等亮度（`vec3(0.85, 0.90, 0.98)`）；
  - **三等细弱星尘 (900 颗)**：尺寸 `1.4px`，作为背景深空微光；
- **独立时间相位与频闪**：
  - 顶点属性注入 `attribute float aPhase; attribute float aTwinkleSpeed;`；
  - 闪烁公式：`float twinkle = 0.55 + 0.45 * sin(uTime * aTwinkleSpeed + aPhase);`；
  - 杜绝全局同步闪烁，呈现真正夜空星辰的错落呼吸感。

---

### 4. 偶遇许愿流星系统 (`src/natural/shooting-stars.js` - 新增)

#### 核心表现与生命周期（借鉴 CK42BB/procedural-stars-threejs 模式）
- **触发节拍**：采用随机步长计时器（每隔 **18 秒 ± 6 秒** 随机触发一颗）；
- **飞行轨迹**：
  - 起点位于高空深邃处（如仰角 55°~70°），以约 45° 倾角向地平线方向飞掠；
  - 飞掠全程耗时 **0.9 ~ 1.2 秒**；
- **流星材质与渐隐尾迹**：
  - 流星头部是纯白高光微粒（`#ffffff`，强耀眼度）；
  - 尾部采用长度约 12~16 米的半透明线段/带状网格，尾端透明度渐变至 0（`alpha = pow(tailProgress, 1.8)`）；
  - 飞行结束时尾迹迅速弥散淡出，不留痕迹；
- **资源安全**：仅在夜景模式（`night > 0.1`）下触发，白天与夕阳阶段完全停止循环，对象池复用，零内存泄漏。

---

## 🛡️ 三、工程质量与自动化回归基准

1. **测试套件 100% 绿灯**：
   - 全项目 17 组回归测试（`npm test`）继续 100% 保持通过；
   - 专项测试 `node scripts/review-bench-atmosphere.mjs` 必须 100% 绿灯；
2. **视觉截图产出**：
   - 捕获夜景下清晰展示“月华光晕、银河星云、流星划过”的 QA 实景截图至 `work/qa/bench-atmosphere/deep-celestial.png`。

---

## 🚀 四、交接与执行分工

- **Antigravity (设计架构师)**：已完成算法矩阵与设计规约编写，并整合 GitHub 开源标杆；
- **Codex / GPT (代码执行方)**：
  1. 在 `src/natural/atmosphere.js` 中重构月牙抗锯齿、地球反照光、双层月晕与银河星云渐变；
  2. 在 `src/natural/celestial.js` 中重构三等星斗多频微闪；
  3. 创建并挂载 `src/natural/shooting-stars.js` 偶发许愿流星；
  4. 运行 `npm test`，确保 17 组回归测试全部通过，产出实景截图。
