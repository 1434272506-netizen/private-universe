# Private Universe · 琴音水波与时光天灯祈福系统技术架构规范 (v1.0)

> **文档标识**：`MUSICAL-RIPPLES-AND-ANNIVERSARY-LANTERNS-SPEC`  
> **设计架构师**：Antigravity (AI Design Architect)  
> **执行工程团队**：Codex / GPT (Executor)  
> **核心目标**：融合“五音阶琴音水波互动”与“古树相恋时光铭牌 + 银河天灯祈福群”，为私人爱情花园注入听觉上的灵动治愈与视觉神圣感。

---

## 🌸 一、 系统整体架构概览 (System Overview)

本系统由四大相互协同的模块构成：

```
                    ┌───────────────────────────────┐
                    │  私人爱情花园交互升级 (1 & 3)     │
                    └──────────────┬────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         │                                                   │
┌────────▼────────────────────┐             ┌────────────────▼────────────────────┐
│ 模块一：琴音水波与风铃合成器   │             │ 模块二：古树时光铭牌与天灯祈福群       │
├─────────────────────────────┤             ├─────────────────────────────────────┤
│ • 原生 Web Audio 五音物理合成 │             │ • 树下原木雕花年轮铭牌 (Anniversary)  │
│ • 小溪触碰音高纵轴映射       │             │ • 实时相恋天数动态计算与情话卡片       │
│ • 水花光晕粒子 (Sparkle)    │             │ • 42 盏暖光孔明灯 (Sky Lanterns)     │
│ • 长椅黑胶旋动与金色音符漂浮 │             │ • 银河拱桥升空动力学 (Buoyant Draft) │
└─────────────────────────────┘             └─────────────────────────────────────┘
```

---

## 🎵 二、 模块一：琴音水波与风铃合成器 (Musical Creek Chimes)

### 1. 物理纯音合成算法 (`src/natural/chimes-audio.js`)
无需引入任何外部大型音频资源，基于 Web Audio API 实现纯净空灵的五度物理风铃合成器：

```javascript
// 五度音阶频率池 (Pentatonic Scale: C5, D5, E5, G5, A5, C6)
const PENTATONIC_FREQS = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

export function createChimesSynthesizer(audioContext, masterGainNode) {
  return {
    playChime(pitchIndex = 0, volume = 0.28) {
      if (!audioContext || audioContext.state !== 'running') return;
      const now = audioContext.currentTime;
      const freq = PENTATONIC_FREQS[pitchIndex % PENTATONIC_FREQS.length];

      // 双振荡器：基波正弦 + 2.76 倍谐波（金属风铃/空灵水滴物理泛音）
      const oscBase = audioContext.createOscillator();
      const oscHarmonic = audioContext.createOscillator();
      const chimeGain = audioContext.createGain();

      oscBase.type = 'sine';
      oscBase.frequency.setValueAtTime(freq, now);

      oscHarmonic.type = 'sine';
      oscHarmonic.frequency.setValueAtTime(freq * 2.756, now);

      // 阻尼敲击包络：瞬时起振 (Attack 4ms) + 指数柔和衰减 (Decay 0.85s)
      chimeGain.gain.setValueAtTime(0.001, now);
      chimeGain.gain.linearRampToValueAtTime(volume, now + 0.004);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

      oscBase.connect(chimeGain);
      oscHarmonic.connect(chimeGain);
      chimeGain.connect(masterGainNode);

      oscBase.start(now);
      oscHarmonic.start(now);
      oscBase.stop(now + 0.86);
      oscHarmonic.stop(now + 0.86);
    }
  };
}
```

### 2. 小溪触碰音高空间映射 (`src/natural/engine.js`)
- 在用户鼠标点击或连续划过小溪水面时：
  - 计算点击点在小溪源头至瀑布边缘的相对位置 $t \in [0, 1]$：
    $$\text{pitchIndex} = \text{clamp}\left(\lfloor (hit.point.z - z_{\min}) / (z_{\max} - z_{\min}) \times 5 \rfloor, 0, 5\right)$$
  - 顺着水流点触自然奏出起伏流转的五度旋律；
  - 限制触发节流间隔（$\ge 65\text{ ms}$），防止密集划动过载。

### 3. 长椅留声机动效强化 (`src/natural/listening-player.js`)
- 当个人音乐或自然背景音播放时，长椅上的复古磁带/黑胶滚轴以恒速平滑旋转；
- 伴随向天际缓慢飘升的微光金色粒子，赋予长椅听歌时极其细腻的生命力。

---

## ⏳ 三、 模块二：古树相恋时光铭牌 (Anniversary Milestone)

### 1. 3D 实体模型与场景布局 (`src/natural/anniversary-milestone.js`)
- **位置**：坐落于古树根系左侧微凸的苔藓草坡上（坐标约 $x=-1.55, y=1.18, z=0.55$）；
- **外观**：带有天然树皮边缘的斜切年轮原木牌，表面雕刻暖金色微光文字：“✦ OUR TIME ✦”；
- **交互检测**：赋予 `userData.interaction = 'anniversary'`，纳入 `engine.js` 现有的拾取光标和提示系统（悬停提示：“翻看我们的时光”）。

### 2. 动态相恋天数计算与时间基准
- 基准日期配置在 `src/personal-content.js` 中（默认支持配置起始相爱日期，如 `"2024-05-20"`）；
- 动态获取当前时间，计算真实相恋天数：
  $$\text{days} = \max\left(1, \left\lfloor \frac{\text{Date.now}() - \text{startDate.getTime}()}{1000 \times 60 \times 60 \times 24} \right\rfloor\right)$$

### 3. 唯美时光浮层卡片 UI
- 点击时光铭牌，镜头平滑微移至树下特写，弹出羊皮纸质感时光弹窗：
  - **主标题**：“与你相恋的第 {days} 天”
  - **副标题**：“一隅春天 · 朝暮与年岁并往”
  - **专属寄语**：“走过四季流转，这里永远保留着我们最初的春日。”
  - **祈愿按钮**：【🏮 放飞心愿天灯 (Release Lanterns)】。

---

## 🏮 四、 模块三：银河天灯祈福群 (Romantic Sky Lanterns)

### 1. GPU InstancedMesh 极高性能架构 (`src/natural/sky-lanterns.js`)
- 采用单次 Draw Call 实例化网格（`InstancedMesh`），创建 42 盏纸灯笼；
- 几何体：轻量级六棱柱纸灯笼（顶部微微收拢，底部留空，内置烛火点光源模拟）；
- 材质：暖调半透宣纸材质，内发光 Emissive（`#ff8e36`），支持轻微烛火明暗呼吸（$1.8\text{ Hz}$）。

### 2. 空气浮力与微风矢量动力学 (Flight Dynamics)
- 初始分布：从浮岛四周边缘草甸与小溪溪谷升起；
- 上升运动：
  - 垂直上升速度：$v_y = 0.55 \sim 1.15\text{ m/s}$（带微小个体随机差异）；
  - 侧向漂移：受草甸风场与微弱余弦摆动驱动，向上空银河大拱门方向缓缓汇聚；
  - 持续时间：升空后持续漂浮 $40\text{ 秒}$，逐渐缩小并融入天穹星光。

### 3. 昼夜联动与触发时机
- **主动触发**：在时光铭牌卡片中点击【放飞心愿天灯】随时放飞；
- **氛围联动**：当用户切换到“银河萤火（Night）”模式时，支持伴随轻量天灯自动升起，浪漫氛围感拉满。

---

## 🔍 五、 自动化回归测试与验收指标 (Acceptance Standards)

1. **琴音水波测试 (`scripts/review-musical-ripples.mjs`)**：
   - 验证小溪点击后 Web Audio 振荡器正确建立；
   - 验证五音阶频率准确度与 0.85s 优雅包络衰减；
   - 验证全局静音时合成器无声。
2. **时光铭牌与天灯测试 (`scripts/review-anniversary-lanterns.mjs`)**：
   - 验证树下时光铭牌能够被准确 Raycast 拾取并触发弹窗；
   - 验证相恋天数计算无 NaN / 无跨时区偏差；
   - 验证 42 盏天灯 InstancedMesh 在场景中正确渲染并稳定上升。
3. **全套自动化测试回归 (`npm test`)**：
   - 全部自动化测试用例 100% PASS，0 内存泄漏，0 控制台错误。

---

## 🤖 六、 致 Codex / GPT 执行团队的工程实施指令 (Prompt for GPT)

请 Codex/GPT 仔细阅读 `MUSICAL-RIPPLES-AND-ANNIVERSARY-LANTERNS-SPEC.md`，执行以下落地步骤：
1. 新建 `src/natural/chimes-audio.js`（Web Audio 五音琴音合成）；
2. 新建 `src/natural/anniversary-milestone.js`（树下原木时光铭牌实体与弹窗卡片）；
3. 新建 `src/natural/sky-lanterns.js`（42 盏 InstancedMesh 银河升空孔明灯）；
4. 在 `src/natural/engine.js` 中集成水面点击弹奏、铭牌拾取与天灯动画更新；
5. 编写测试脚本并运行 `npm test`，确保全部自动化回归测试 100% 通过。
