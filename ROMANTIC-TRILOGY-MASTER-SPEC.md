# Private Universe · 浪漫三部曲：琴音水波、射手金牛专属星空与时光铭牌技术规范 (v5.1)

> **文档标识**：`ROMANTIC-TRILOGY-MASTER-SPEC`  
> **设计架构师**：Antigravity (AI Design Architect)  
> **执行工程团队**：Codex / GPT (Executor)  
> **核心变更**：
> 1. **移除** 42 盏孔明灯升空系统（精简聚焦，消除冗余）；
> 2. **深度定制长椅【仰望星空】系统**：摄像机平滑仰角 $75^\circ$，在银河中精准点亮 **射手座 (Sagittarius ♐)** 与 **金牛座 (Taurus ♉)**，并以柔光星轨连成跨越银河的几何爱心与双星依偎；
> 3. **时光铭牌与星空联动**：古树下时光年轮铭牌计算相爱天数，点击一键唤醒两人专属星空。

---

## 🌸 一、 总体系统模块拓扑 (System Topology)

```
                            ┌───────────────────────────────────┐
                            │    Private Universe 浪漫三部曲     │
                            └─────────────────┬─────────────────┘
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         │                                    │                                    │
┌────────▼────────────────────────┐  ┌────────▼────────────────────────┐  ┌────────▼────────────────────────┐
│ 篇章一：【琴音水波与留声机旋律】 │  │ 篇章二：【射手座与金牛座专属星空】│  │ 篇章三：【古树年轮相恋时光铭牌】 │
├─────────────────────────────────┤  ├─────────────────────────────────┤  ├─────────────────────────────────┤
│ • Web Audio 原生五音风铃合成器   │  │ • 长椅一键仰望星空模式 (75° 仰角)│  │ • 古树年轮时光雕刻木桩 (Plaque) │
│ • 溪水纵轴空间音律映射 (C-D-E-G-A)│ │ • 射手座 (Sagittarius) 茶壶星官 │  │ • 实时相爱天数动态精准计算    │
│ • 水花晶莹光晕微粒 (Sparkles)   │  │ • 金牛座 (Taurus) 毕宿五与昴星团│  │ • 羊皮纸时光纪念卡与深情寄语  │
│ • 长椅黑胶旋动与金色音符漂浮    │  │ • 跨越银河拱桥的爱心星桥连线   │  │ • 一键联动仰望专属星空        │
└─────────────────────────────────┘  └─────────────────────────────────┘  └─────────────────────────────────┘
```

---

## 🎵 二、 篇章一：【琴音水波与留声机旋律】(Musical Creek & Gramophone)

### 1. Web Audio 原生物理风铃合成器 (`src/natural/chimes-audio.js`)
- **五度音阶频率池 (Pentatonic Scale)**：
  `PENTATONIC_FREQS = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]`（$C_5, D_5, E_5, G_5, A_5, C_6$）。
- **声学结构**：正弦基频 + 2.756 倍弱金属泛音，叠加 4ms 极速起振与 0.85s 指数阻尼衰减；
- **总线关联**：连接至 `garden-audio.js` 的 `natureBus` 或 `masterBus`，静音时自动静止。

### 2. 小溪触碰空间映射 (`src/natural/engine.js`)
- 在 `disturbCreek(event, strength)` 中：
  - 计算点击点在小溪纵轴（$Z$ 轴）的投影比例，映射为音阶索引：
    $$\text{pitchIndex} = \text{clamp}\left(\left\lfloor \frac{hit.point.z - z_{\min}}{z_{\max} - z_{\min}} \times 5 \right\rfloor, 0, 5\right)$$
  - 顺着水流点触自然奏响清脆音律，单次触发节流 $\ge 65\text{ ms}$；
  - 碰撞点触发 3~6 颗晶莹水花金粉粒子（Sparkles）。

### 3. 长椅留声机黑胶旋动与金色音符粒子 (`src/natural/listening-player.js`)
- 在长椅留声机上添加微型黑胶转盘；
- 播放音乐时以 $3.5\text{ rad/s}$ 匀速自转，并向上袅袅升起金色微光音符粒子，随风飘向古树枝桠。

---

## 🌌 三、 篇章二：【长椅仰望星空 · 射手座与金牛座专属星空】(Sagittarius & Taurus Stargazing)

### 1. 长椅仰望星空运镜模式 (`src/natural/constellations.js`)
- **交互入口**：在长椅模式（Bench View）下，HUD 界面右下角浮现优雅的【✨ 仰望星空 (Stargaze)】按钮（支持在夜晚或黄昏模式唤起）；
- **运镜动力学**：
  - 摄像机目标点向天穹正上方微调，摄像机视角平滑上仰至 $75^\circ$（俯仰角极大开阔化，全画幅迎对银河拱桥与银心）；
  - 进入全沉浸式观星状态，背景环境光柔和变暗 15%，凸显星芒。

### 2. 真实星座三维星表与骨架连线 (Star Coordinates & Lines)

在天顶天球坐标系中，分别构建**射手座 (人马座)** 与 **金牛座** 的经典星官拓扑：

#### (A) 射手座 (Sagittarius ♐) —— 银心茶壶星群 (The Teapot)
- **位置**：位于银河明亮核球（Galactic Core）近旁的天空区域；
- **核心星辰**：
  - $\gamma$ Sgr (Alnasl - 壶嘴尖)
  - $\delta$ Sgr (Kaus Media - 弓中星)
  - $\epsilon$ Sgr (Kaus Australis - 弓底最亮主星，璀璨金芒)
  - $\lambda$ Sgr (Kaus Borealis - 壶盖顶)
  - $\zeta$ Sgr (Ascella - 壶柄底)
  - $\sigma$ Sgr (Nunki - 壶柄顶)
  - $\phi$ Sgr (壶盖中)
  - $\tau$ Sgr (壶柄中)
- **连线骨架 (`LineSegments`)**：壶嘴到弓身、弓身到壶盖、壶盖到壶柄闭合，形成清晰可辨认的射手座茶壶骨架。

#### (B) 金牛座 (Taurus ♉) —— 毕宿五与牛角 V 姿态
- **位置**：沿银河大拱桥对侧延伸，正对射手座；
- **核心星辰**：
  - $\alpha$ Tau (毕宿五 Aldebaran - 巨大璀璨的橙红巨星，爱之主星)
  - $\epsilon$ Tau (Ain - 牛眼)
  - $\gamma, \delta, \theta$ Tau (毕宿星团 V 形头部)
  - $\beta$ Tau (Elnath - 北牛角尖)
  - $\zeta$ Tau (天关 Tianguan - 南牛角尖)
  - 昴宿星团 (Pleiades M45 - 6 颗簇拥微闪的淡蓝星钻)
- **连线骨架 (`LineSegments`)**：清晰勾勒出金牛座经典的 V 字牛首与冲天双角。

#### (C) 跨越银河的爱心星桥 (Celestial Heart & Love Bridge)
- **几何构造**：
  - 从射手座主星（Nunki / Kaus Australis）与金牛座主星（Aldebaran 毕宿五）之间，延伸出两条优雅的淡粉金色弧形星轨；
  - 两条星轨在天穹正中（银河中央）交汇并交织出一个**微光闪烁的几何爱心 (Starlight Heart)**；
  - 构成“射手与金牛跨越银河相拥”的专属情感叙事。

### 3. 星象光影与微交互效果
- **呼吸发光**：射手主星与金牛毕宿五以 $1.2\text{ Hz}$ 频率柔和交替呼吸；
- **星象浮标标签**：星座旁漂浮半透明雅致文字“♐ 射手座”、“♉ 金牛座”与中间的“✦ 心宿相依 ✦”；
- **退回长椅**：再次点击按钮或按键盘 ESC 键，镜头以平滑余弦缓动无缝回落至长椅坐姿视角。

---

## ⏳ 四、 篇章三：【古树相恋时光年轮铭牌】(Anniversary Milestone Plaque)

### 1. 3D 实体模型与场景布局 (`src/natural/anniversary-milestone.js`)
- **位置**：位于古树根系左侧微凸的青苔草坡（坐标约 $x=-1.55, y=1.18, z=0.55$）；
- **外观**：带有天然树皮凹凸的斜切年轮原木牌，表面雕刻暖金色微光文字：“✦ OUR TIME ✦”；
- **交互检测**：赋予 `userData.interaction = 'anniversary'`，悬停提示：“翻看我们的时光”。

### 2. 动态相恋天数计算与时间基准
- 基准日期配置于 `src/personal-content.js`（默认 `"2024-05-20"`，可随时自定义）；
- 动态获取当前时间，计算真实相恋天数：
  $$\text{days} = \max\left(1, \left\lfloor \frac{\text{Date.now}() - \text{startDate.getTime}()}{1000 \times 60 \times 60 \times 24} \right\rfloor\right)$$

### 3. 羊皮纸时光纪念卡弹窗
- 点击时光铭牌，镜头特写平滑切入，弹出温润的羊皮纸卡片：
  - **主标题**：“与你相恋的第 {days} 天”
  - **副标题**：“一隅春天 · 朝暮与年岁并往”
  - **专属寄语**：“走过四季流转，这里永远保留着我们最初的春日。”
  - **快捷跳转按钮**：【✨ 仰望我们的星空】（直接触发长椅 75° 观星并点亮射手与金牛座！）。

---

## 🔍 五、 自动化回归测试与验收指标 (QA Acceptance Standards)

Codex / GPT 执行完毕后，必须运行以下两套专项测试：

1. **琴音与留声机测试 (`scripts/review-musical-ripples.mjs`)**：
   - 验证水面点击后 Web Audio 振荡器正确建立；
   - 验证五音阶频率准确性（$C_5 \sim C_6$）与 0.85s 优雅衰减；
   - 验证长椅黑胶转盘自转。
2. **射手金牛星空与时光铭牌测试 (`scripts/review-stargazing-anniversary.mjs`)**：
   - 验证时光铭牌点击拾取与相恋天数计算无 NaN；
   - 验证长椅仰角 75° 运镜平滑切换；
   - 验证场景中存在射手座（茶壶星官）、金牛座（毕宿五与 V 形星官）与爱心星桥连线，且星辰顶点数正常；
   - 验证再次点击或 ESC 能够安全恢复长椅视角。
3. **全套自动化测试回归 (`npm test`)**：
   - 全部自动化测试用例 100% PASS，0 内存泄漏，0 控制台错误。

---

## ⚡ 六、 Token 极致节约与高效执行守则 (Token Economy Guidelines)

为最大限度控制大模型上下文 Token 消耗，Codex / GPT 必须严格遵守以下五大节约准则：

1. **禁止全文件重写 (No Full-File Rewrites)**：
   - 严禁打印或重写 `engine.js` 等几百行的大型核心文件；
   - 只能在目标插入点（如 `disturbCreek` 或拾取注册区）执行**精准的增量式局部编辑 (Targeted Diffs)**。
2. **新建模块极致精炼 (Ultra-Lean New Files)**：
   - 新建的 `chimes-audio.js`、`constellations.js`、`anniversary-milestone.js` 代码追求极致紧凑、优雅，单文件代码量控制在 $80 \sim 130$ 行以内，杜绝冗余注释与死代码。
3. **静默测试，禁止大量倾倒日志 (Quiet Test Execution)**：
   - 编写的测试脚本必须保持安静，仅输出必要的单行 PASS 状态，严禁在控制台打印大块 JSON、Base64 或逐帧轮询数据。
4. **一次到位，消除低效往返 (One-Pass Implementation)**：
   - 充分理解本规范后一次性高质量完成编码与测试，避免反复修补产生的 Token 浪费。
5. **精炼精简的执行汇报 (Terse Final Summary)**：
   - 执行完成后仅需列出修改的文件与测试通过结论，严禁把已写入文件的完整代码重新复制打印到聊天回复中。

---

## 🤖 七、 致 Codex / GPT 执行团队的工程实施指令 (Prompt for GPT)

请 Codex/GPT 仔细阅读 `ROMANTIC-TRILOGY-MASTER-SPEC.md`，并在**严格遵循第六节 Token 极简守则**的前提下执行以下步骤：
1. 新建 `src/natural/chimes-audio.js`（Web Audio 五音琴音合成，<70行）；在 `src/natural/engine.js` 的 `disturbCreek` 中局部插入水面弹奏；
2. 更新 `src/natural/listening-player.js`（黑胶唱片自转动效与音符粒子）；
3. 新建 `src/natural/constellations.js`（长椅 75° 仰望星空运镜；射手座 ♐ 与金牛座 ♉ 3D 星辰连线；几何爱心星轨）；
4. 新建 `src/natural/anniversary-milestone.js`（古树旁年轮时光铭牌，动态计算相恋天数，并提供【✨ 仰望我们的星空】联动按钮）；
5. 编写静默测试脚本并运行 `npm test`，确保全套自动化回归测试 100% 通过（PASS）。
6. 回复仅需汇报：修改文件列表 + 测试 PASS 结果，禁止打印完整源码。
