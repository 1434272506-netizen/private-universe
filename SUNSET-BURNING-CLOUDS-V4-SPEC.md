# Private Universe · 晚霞与火烧云艺术级重构与优化技术架构规范 (v4.0)

> **文档标识**：`SUNSET-BURNING-CLOUDS-V4-SPEC`  
> **设计架构师**：Antigravity (AI Design Architect)  
> **执行工程团队**：Codex / GPT (Executor)  
> **核心目标**：彻底消除晚霞背景中的“大理石油彩拉花 / 荧光粉紫”不真实感，重构为具备水平层叠层积构造、温润熔金轮廓、新海诚/吉卜力唯美治愈系色彩与全视角立体光影的顶级晚霞火烧云系统。

---

## 🌸 一、 现状缺陷与视觉根因诊断 (Visual Root Cause Analysis)

经过全景 Hero 视角与长椅 Bench 视角的实景渲染捕获（`hero-sunset-verified.png`、`live-bench-sunset.png`、`live-bench-sunset-sunward.png`），当前晚霞存在以下三大核心缺陷：

| 缺陷表现 | 物理/数学根因 (Shader Root Cause) | 优化方向 (V4.0 Target) |
| :--- | :--- | :--- |
| **1. 大理石拉花/油彩旋转纹 (Marble Swirl Artifacts)** | `atmosphere.js` 中使用了两层大幅度的双重坐标域扭曲：`warpedUV = cUV + warp1 * 0.70; detailedUV = warpedUV + warp2 * 0.30;`，导致二维噪声自身回环，产生如同咖啡拉花、液体大理石的同心同向漩涡。 | **水平各向异性拉伸 + 温和单层风场漂移**：限制域扭曲幅度（降至 $0.16 \sim 0.18$），引入水平各向异性（$X$ 轴拉长、$Y$ 轴压缩），呈现真实层积云与高积云的水平延展感。 |
| **2. 刺眼荧光粉紫/洋红失真 (Neon Magenta Discoloration)** | 着色器中对天幕与云层叠加了强烈的绿通道抑制与蓝通道放大：`texColor = mix(texColor, duskSky * vec3(0.88, 0.27, 0.45), dusk);`，且背阳地平定义为高饱和洋红。$G=0.27$ 相比 $B=0.45$ 严重偏低，导致 $R+B$ 形成大面积荧光芭比粉（#E64C8E / #FF3388）。 | **新海诚/吉卜力治愈系温润晚霞光谱**：去除人工绿通道削弱，以**深邃皇家暮紫（高空天顶） $\rightarrow$ 蜜桃肉粉与杏粉（中天） $\rightarrow$ 暖阳熔金与琥珀霞光（地平与朝阳面）** 为骨干，背阳维纳斯带改为粉黛烟霞（Dusty Rose）。 |
| **3. 缺乏云层立体自阴影 (Lack of 3D Volumetric Depth)** | 云朵边缘与内部色彩对比生硬，云底缺乏大气质感阴影，高空与地平缺乏透视压缩感。 | **三层渐进式立体光照模型**：<br>① 日落向阳向散射熔金轮廓（Sunlit Rim）；<br>② 透光云腹温润珊瑚霞红（Subsurface Core）；<br>③ 背阳深黛暮紫自阴影（Atmospheric Ambient Shade）。 |

---

## 🎨 二、 色彩与光学数学模型 (Color & Optical Mathematical Formulation)

### 1. 治愈系天幕色彩渐变系统 (Romantic Dusk Sky Canvas)

在天顶至地平方向（$elev = \text{clamp}(direction.y + 0.32, 0.0, 1.0)$），构建物理散射与艺术调色完美融合的四阶大跨度色谱：

```glsl
// 天幕四阶垂直色系
vec3 colZenith    = vec3(0.09, 0.13, 0.28);  // 深邃皇家暮蓝 (Royal Twilight Navy)
vec3 colUpperSky  = vec3(0.36, 0.19, 0.38);  // 暮霭紫罗兰 (Twilight Violet)
vec3 colMidSky    = vec3(0.78, 0.38, 0.32);  // 蜜桃晚霞 (Warm Peach Rose)
vec3 colHorizonSun = vec3(1.22, 0.78, 0.26); // 地平熔金霞辉 (Molten Gold Horizon)
vec3 colHorizonAnti = vec3(0.86, 0.48, 0.46); // 背阳维纳斯粉霞 (Powdery Belt of Venus)

// 随太阳方位角平滑插值地平线色彩 (360度全视角温润环绕)
vec3 horizonBase = mix(colHorizonAnti, colHorizonSun, clamp(sunAzimuth * 0.5 + 0.5, 0.0, 1.0));

// 垂直天穹多阶指数混合
vec3 duskSky = mix(colZenith, colUpperSky, exp(-elev * 1.8));
duskSky = mix(duskSky, colMidSky, exp(-elev * 4.6));
duskSky = mix(duskSky, horizonBase, horizonFactor * 0.95);
```

### 2. 水平层积火烧云形态生成 (Stratified Cloud Morphology)

彻底重构 `atmosphere.js` 中 `cUV` 坐标与噪声采样结构：

```glsl
// 天穹透视映射：地平压缩与水平风向拉伸
vec2 domeUV = direction.xz / (0.35 + elev * 0.60);
// 水平拉伸系数：X轴0.55形成开阔层层叠叠的积云带，Y轴1.35压缩
vec2 cUV = vec2(domeUV.x * 0.55, domeUV.y * 1.25) + vec2(time * 0.000022, time * 0.000008);

// 单层极温和有机风场微扰 (幅度由 0.70 降低至 0.16，彻底杜绝大理石回环拉花)
vec2 gentleWarp = vec2(
  fbm(cUV * 1.1 + vec2(1.7, 9.2), 0.0),
  fbm(cUV * 1.1 + vec2(8.3, 2.8), 0.0)
) * 0.16;
vec2 cloudCoords = cUV + gentleWarp;

// 宏观积云体 (Low-frequency Stratocumulus Body)
float macro1 = fbm(cloudCoords * 0.82, 0.0) * 0.55 + 0.50;
float macro2 = fbm(cloudCoords * 1.75 + vec2(4.2, 1.5), 0.0) * 0.55 + 0.50;
float macroNoise = clamp(macro1 * 0.65 + macro2 * 0.35, 0.0, 1.0);
float macroDensity = smoothstep(0.32, 0.68, macroNoise);

// 卷云柔和羽状边缘 (Feathered Cirrus Tendrils)
float cirrusNoise = fbm(cloudCoords * 3.4 + vec2(2.1, 7.3), 0.0) * 0.55 + 0.50;
float cirrusDensity = smoothstep(0.40, 0.76, cirrusNoise) * 0.30;

// 综合云密度
float cloudDensity = clamp(macroDensity + cirrusDensity, 0.0, 1.0);
```

### 3. 三阶立体熔金与云腹通透光照 (3-Tier Volumetric Cloud Lighting)

```glsl
// 日落前向散射与全向夕阳泛光
float forwardScattering = pow(clamp(cosSun * 0.5 + 0.5, 0.0, 1.0), 2.2);
float omniGlow = 0.58 + 0.42 * forwardScattering;

// 向阳熔金滚边掩码 (Rim Lighting)
float rimMask = smoothstep(0.06, 0.28, cloudDensity) * (1.0 - smoothstep(0.28, 0.65, cloudDensity));

// 1. 云底背阳阴影：深黛暮紫，赋予云体真实厚重感 (非荧光粉)
vec3 colCloudShade = vec3(0.28, 0.18, 0.26);

// 2. 云腹透光红霞：温润暖杏与珊瑚橘红
vec3 colCloudBody = vec3(1.10, 0.48, 0.18);

// 3. 向阳高光与熔金镶边：极亮琥珀金辉
vec3 colCloudRim  = vec3(1.38, 1.05, 0.48);

vec3 cloudColor = mix(colCloudShade, colCloudBody, clamp(cloudDensity * 1.4, 0.0, 1.0));
cloudColor = mix(cloudColor, vec3(1.22, 0.72, 0.25), clamp(cloudDensity * omniGlow, 0.0, 1.0));
cloudColor += colCloudRim * rimMask * (0.8 + 1.6 * forwardScattering);

// 地平线淡出与云层透明度
float horizonFade = smoothstep(0.0, 0.12, elev);
float cloudAlpha = smoothstep(0.06, 0.42, cloudDensity) * 0.92 * horizonFade;

// 天幕与火烧云温润合成 (自然通透，杜绝颜色通道异化衰减)
texColor = mix(texColor, duskSky, dusk);
texColor = mix(texColor, cloudColor, cloudAlpha * dusk);
```

---

## ☁️ 三、 关联子系统协同优化 (Associated Subsystem Harmonization)

### 1. 3D 体积云光照微调 (`src/natural/clouds.js`)
在 `src/natural/clouds.js` 中，3D 体积云在日落模式下的 `duskSunlight` 需与新色谱统一：
- 原有：`mix(vec3(0.72, 0.22, 0.38), vec3(1.0, 0.65, 0.28), ...)`（暗部带粉紫偏色）
- 优化为：`mix(vec3(0.38, 0.22, 0.30), vec3(1.15, 0.72, 0.30), clamp(sunlight * 1.5 + forward * 0.5, 0.0, 1.0))`
- 使得浮岛下方的朵朵立体云在夕阳照射下如同柔软的金色棉花糖，背阳面保持柔和沉静的暮霭深紫。

### 2. 场景雾气与环境光微调 (`src/natural/bench-atmosphere.js`)
在 `src/natural/bench-atmosphere.js` 中：
- `scene.fog.color`：将 sunset 雾气由原灰紫偏色 `#8a6176` 优化为温润夕雾 `#a86c6a`（或 `#b07065`），使远景岛屿底部与地平线金红晚霞无缝融合。
- `sun.color`：维持 `#ff8b54` 或微调为 `#ff8e4e`。
- `hemi.groundColor`：维持温润草地阴影色 `#454f38`。

---

## 🔍 四、 自动化验收测试与验证标准 (QA Acceptance Standards)

Codex / GPT 执行完毕后，必须运行以下测试并输出验收结果：

1. **光度学色域测试 (`scripts/review-hero-atmosphere.mjs`)**：
   - `sunset.red >= 0.45` (红光充盈度)
   - `sunset.gold > 0.035` (熔金与琥珀比例，要求 $G > 1.18 B$ 且 $G > 100$)
   - `sunset.coral > 0.035` (珊瑚霞光比例)
2. **全景与长椅视觉无死角审查**：
   - 捕获 `hero-sunset.png` 与 `bench-sunset.png`；
   - 彻底告别大理石拉花同心环，呈现宏伟、自然、舒展的火烧云；
   - 告别荧光芭比粉，全景呈现温柔浪漫的金色与珊瑚色晚霞。
3. **全套自动化测试回归 (`npm test`)**：
   - 保证项目中全部 17 个 Playwright 测试套件 100% 通过（PASS）。

---

## 🤖 五、 致 Codex / GPT 执行团队的工程实施指令 (Prompt for Codex/GPT)

请 Codex/GPT 仔细阅读 `SUNSET-BURNING-CLOUDS-V4-SPEC.md`，执行以下两个步骤：
1. 编辑 `src/natural/atmosphere.js`（天幕着色器）、`src/natural/clouds.js`（体积云夕日光照）、`src/natural/bench-atmosphere.js`（夕阳雾色）；
2. 运行 `node scripts/review-hero-atmosphere.mjs` 以及 `npm test`，确保全部自动化回归测试通过。
