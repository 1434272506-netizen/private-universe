# 更新日志 (CHANGELOG)

所有关于 **Private Universe（私人爱情花园）** 项目的重要设计重构、功能演进与视觉优化记录于此。

---

## [1.3.0] - 2026-11-08

### 🚀 新增特性 (Features)
- **翡翠紫晶极光天幕 (Emerald & Amethyst Boreal Aurora)**：
  - 复用 GitHub 顶流开源项目 `candpixie/gliss` 与 `nimitz`'s "Auroras" (`XtGGRt`) 算法。
  - 基于三频程序化三角波噪声（Tri-Noise）与 `mm2` 旋转矩阵，0MB 外部贴图，纯 GPU 数学渲染起伏丝幔与微澜。
  - 绑定专属命定双星色谱：底部为代表她的翡翠碧绿 (`#10b981`)，顶部为代表你的紫罗兰晶紫 (`#c084fc`)，强折叠处迸发纯白高温光冕。
  - 自动无缝接入 `benchAtmosphere` 氛围系统：在深夜（Night）平滑过渡点亮，为夜幕地平线注入深空神圣之美。
- **晨曦丁达尔神圣光束 (Crepuscular Volumetric Beams)**：
  - 复用 GitHub 顶流开源项目 `TrentSterling/threejs-volumetric-beam` 与 Passivestar 算法。
  - 采用极简圆柱体看板与菲涅尔视线边缘软化（Fresnel Falloff），无需昂贵的全屏后处理光线步进，保持 60 FPS 丝滑性能。
  - 3 束温润暖金（`#fff2cf`）体积光柱穿透中心母树枝桠，倾泻在春日草甸、长椅与小溪水面上，伴随程序化浮尘微粒（Drifting Dust Motes）。
  - 联动昼夕夜三态：春日暖阳（Day）全开，蜜桃晚霞（Sunset）渐变为暖橙微光，深夜（Night）自然隐退。

### 🧪 工程与测试基建 (Testing & Infrastructure)
- **新增全流程专项评测脚本**：
  - `scripts/review-aurora-and-beams.mjs`：验证昼间丁达尔光束激活、夜间极光天幕点亮、平滑过渡及 0 报错。
- **生成双态实机截图**：
  - `screenshots/04-crepuscular-godrays-day.png`：记录母树春日暖阳下的丁达尔神圣光柱。
  - `screenshots/05-aurora-borealis-night.png`：记录长椅夜幕下北天长卷的翡翠紫晶双色极光。
- **全量回归保障**：
  - 项目全套 20 项端到端与集成测试 100% 全部通过（PASS），保持零控制台错误与零显存泄漏。

---

## [1.2.0] - 2026-11-08

### 🚀 新增特性 (Features)
- **3D 程序化螺旋银河系 (Procedural 3D Spiral Galaxy)**：
  - 基于对数螺旋线算法实时生成 48,000+ 颗晶莹自转星辰，0MB 外部包体，0 秒加载，60 FPS 丝滑运行。
  - 在长椅仰角 75° 仰望星空时无缝覆盖天穹顶，银心呈现暖金核球，外旋渐变至深邃宇宙蓝。
- **A+B 双模星云与星际尘埃系统 (Hybrid Volumetric Cosmic Dust & Nebulae)**：
  - **宏观流派 A (程序化星际气体)**：内存生成多层高斯柔光径向纹理，沿 3 条螺旋臂散布 36 团半透明云气精灵，呈现宇宙生命的缓慢自转与周期呼吸。
  - **微观流派 B (NASA 真实星云切片)**：在射手座方位锚定 M8 礁湖星云（H-alpha 玫瑰深红与熔金），在金牛座方位锚定 M45 昴宿星团（电光冰蓝与紫罗兰丝状气体），真实还原天文摄影质感。
- **天幕最耀眼双星宿替代大光团 (Emerald & Amethyst Beacon Stars)**：
  - 彻底淘汰生硬实心几何球体与粗暴字标，回归空灵天体美学。
  - **♐ 射手座**：以全天最璀璨的**翡翠翠绿恒星 (`#10b981`)** 为引路星宿，带纯白超热核与旋转四芒衍射星尖（Diffraction Spikes）。
  - **♉ 金牛座**：以全天最绚丽的**紫罗兰晶紫恒星 (`#c084fc`)** 为守望星宿，带紫晶四芒衍射星尖。
  - 两大耀星之间以贝塞尔星际爱心光桥（Inter-Galactic Love Arc）牵引，64 颗晶莹星尘沿星轨缓缓流动。
- **1.8 秒余弦光速跃迁与深空秘境 (Cinematic Hyperspace Warp & Mythic Realms)**：
  - 点击绿星/紫星触发镜头光速穿透星云，平滑飞入微观星座秘境，呈现古典人马神祇/昂首天牛图腾与专属爱情信笺。
  - 右上角常驻【🌌 返回银河全景】按钮，随时平滑拉回复位。
- **411 天纪念日自适应演算 (411-Day Dynamic Anniversary Milestone)**：
  - 纪念日基准日锚定为 `2025-09-23`，引入时间戳毫秒差自适应向下取整公式，截止今日精准为 411 天，明日自动 412 天，永久动态更新。
  - 长椅旁立有一枚温润雕花橡木纪念碑（Anniversary Plaque），轻触即可展开爱情纪念手账卡片。
- **溪流五音水韵编钟与黑胶留声机 (Musical Creek Chimes & Vinyl Player)**：
  - Web Audio 合成中国传统五正音（宫商角徵羽）纯净风铃编钟声，小溪涟漪扩散时飘散晶莹金粉。
  - 黑胶唱盘伴随音乐缓缓旋转，散落乐符星尘。

### 🧪 工程与测试基建 (Testing & Infrastructure)
- **新增回归测试套件**：
  - `scripts/review-musical-ripples.mjs`：小溪五音编钟与留声机旋转交互测试。
  - `scripts/review-stargazing-anniversary.mjs`：橡木纪念碑与 75° 仰望星空测试。
  - `scripts/review-galaxy-warp.mjs`：3D 螺旋银河、A+B 双模星云、双星拾取、光速跃迁与 411 天验证。
- **全量回归保障**：
  - 项目全部 19 项 Playwright 端到端与集成测试 100% 全部通过（PASS），保持零控制台错误。

---

## [1.1.0] - 2026-11-08

### 🚀 新增特性 (Features)
- **小溪生态与激扰散射系统 (Creek Ecology & Reactive Boids)**：
  - 植入 18 条白银小鱼群（分层巡游）、5 条热带小丑鱼群（色彩鲜明）、1 只漫游绿海龟（逼真摆鳍）。
  - 支持交互激扰机制：点击水面时鱼群以 $1.4 \sim 2.2\times$ 速度径向散开，摆尾频率提升，并在 $2.5$ 秒后平滑重新归队聚拢。
- **GPU 水面微波动力学 (Creek Fluidity & Interactive Ripples)**：
  - 引入 GPU 高度场高度扰动模拟，实现水流法线折射、动态水面微波与阳光粼粼波光。
  - 沿小溪 5 处踏脚石布局独立流体力学尾流波纹（Staggered Stone Wakes）与下游浪花。
- **全景三态氛围平滑切换 (Global 3-Tier Atmosphere)**：
  - 将昼夕夜氛围切换面板（`#atmosphere-switcher`）开放至全景（Hero）在内的全部视角。
  - 支持“春日暖阳（Day）”、“蜜桃晚霞（Sunset）”、“银河萤火（Night）”无缝一键切换，全局光照、环境反射、天空色调与流水反光以 $1.8$ 秒余弦平滑过渡。
- **天穹唯美银河与月相系统 (Romantic Milky Way Arch & Night Sky)**：
  - 针对 ACES 色调映射优化 HDR 辐射亮度，打造横跨古树与月梢的 360° 天穹银河拱桥。
  - 具备有机暗隙星云（Great Rift）、微闪星尘（Stardust Scintillation）与柔和月晕。
- **草甸微风、落瓣花雨与蝴蝶生态 (Lively Meadow & Dynamic Wind)**：
  - 引入对马岛之魂风格花雨与绿色嫩叶飘落系统，支持三轴翻滚与微风阵风扬起。
  - 浮岛草甸点缀栖息在花梢的呼吸拟真蝴蝶，遭遇阵风时盘旋起舞后重新落于不同花丛。

### 🎨 视觉缺陷重构与调优 (Refinements & Bug Fixes)
- **艺术级晚霞与火烧云重构 (Sunset Burning Clouds V4.0)**：
  - **消除拉花与油彩感**：移除双重强域坐标扭曲，引入风向水平各向异性（$X$ 轴水平延伸、$Y$ 轴压缩），呈现自然舒展的层积云（Stratocumulus）与柔羽卷云。
  - **根除荧光芭比粉色偏**：移除人工绿通道衰减矩阵，重构为新海诚/吉卜力治愈系四阶色谱（深蓝天顶 $\rightarrow$ 暮紫中天 $\rightarrow$ 蜜桃暖霞 $\rightarrow$ 地平熔金），背阳面柔化为粉黛烟霞（维纳斯带）。
  - **三阶立体光照与熔金镶边**：为云底赋予沉静暮黛深紫自阴影，向阳边缘迸发极高亮度熔金滚边，实现全视角无死角的暖心视觉体验。
- **浮岛 3D 体积云与夕雾融合**：
  - 体积云暗部与高光统一调整为温润夕阳光照，场景雾色优化为 `#a86c6a` 暖调夕雾，浮岛底座与晚霞天幕浑然天成。

### 🧪 工程与测试基建 (Testing & Infrastructure)
- **新增全套专项评测脚本**：
  - `scripts/review-creek-ecology.mjs`：小溪生态三物种游动与生命周期验证。
  - `scripts/review-creek-reactive.mjs`：鱼群受扰避障散射与平滑归队验证。
  - `scripts/review-hero-atmosphere.mjs`：全景模式红光、金光、珊瑚光与银河光度学色域验证。
  - `scripts/review-sunset-multiview.mjs`：全景、长椅近景、朝阳面多视角渲染捕获与评测。
- **持续集成与回归保障**：
  - 项目全部 17 套 Playwright 端到端与集成测试 100% 全部通过（PASS），保持零控制台错误与零显存泄漏。
