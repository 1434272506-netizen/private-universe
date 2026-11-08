# 更新日志 (CHANGELOG)

所有关于 **Private Universe（私人爱情花园）** 项目的重要设计重构、功能演进与视觉优化记录于此。

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
