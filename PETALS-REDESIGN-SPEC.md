# 🥀 验收复盘与重构设计规约：落花落叶视觉形态彻底修复

> **验收结论**：❌ **不予通过 (REJECTED)**  
> **核心痛点**：一没颜色渲染（灰白无光，形同杂色纸屑），二看不出是什么东西（尺寸过小、缺乏花瓣轮廓与纹理，像空中漂浮的头屑与灰尘）。  
> **设计架构师**：Antigravity  
> **代码执行方**：Codex / GPT  
> **修复基准文档**：`PETALS-REDESIGN-SPEC.md`

---

## 🔍 一、两大视觉致命伤的底层技术根因 (Root Cause Analysis)

经过深度审查 Codex 实现的 `src/natural/falling-foliage.js` 与真机渲染截图，这两大严重视觉缺陷的底层根因如下：

### 1. 为什么“一没颜色渲染”？（变灰、泛白、无色彩）
- **致命 Bug：未提交 GPU 颜色缓冲**  
  代码中虽调用了 `mesh.setColorAt(i, color)`，但**完全遗漏了 `mesh.instanceColor.needsUpdate = true`**！在 Three.js 中，没有此标记，WebGL 永远不会将实例色彩数组上传至显存，所有实例只能采用材质默认的纯白 `#ffffff`！
- **调色盘过于寡淡苍白**  
  选用了 `#fcefe8`（极近纯白）、`#eed9c4`（灰褐沙白）等极浅色，在浮岛午后 `3.65` 超高强度的直射阳光照耀下，被彻底曝死成惨白色；
- **背光面发黑变灰**  
  未设置自发光（`emissive`）与微透光度，一旦花瓣转到背光角度或母树阴影下，立即退化为毫无生气的脏灰色。

### 2. 为什么“二看不出来是什么东西”？（形同碎纸屑/灰尘）
- **尺寸严重偏小（尺度失调）**  
  代码中花瓣尺寸设定为 `width = 0.16, height = 0.24`。在整岛 30 个单位宽、相机距岛 30~35 个单位的全局视角下，一个粒子在屏幕上仅占 **4 ~ 8 个像素**！在这么小的像素点上，肉眼根本无法分辨任何凹凸曲率，只能看到一堆像杂讯、头屑或像素噪点的浮空微粒；
- **缺少 Alpha 轮廓贴图（裸露多边形网格）**  
  采用的是纯网格 `PlaneGeometry`，没有任何边缘羽化与樱花心形贴图。在远景下，三角网格的光栅化走样让它呈现为方棱四角的碎纸片；
- **全岛随机散落无序感**  
  花瓣是在整个天空包围盒里随机乱撒，没有源头也没有流向，缺乏“母树吹落樱花掠过长椅”的诗意轨迹。

---

## 🌸 二、视觉重构与解决方案 (Remediation Design)

### 1. 程序化 Canvas 高清樱花/嫩叶 Alpha 纹理 (零外部资源依赖)
通过内存 Canvas 动态生成一张 128x128 的高保真樱花贴图与嫩叶贴图：
- **花瓣轮廓**：优美的心形凹槽尖端（Notched Tip）与饱满圆弧，四周边缘自然 Alpha 柔化（Anti-aliasing）；
- **渐变色彩**：中心基底为珍珠粉白（`#fff0f5`），花瓣边缘与顶端凹槽浸染浓郁水润的樱花粉（`#ff4d79` ~ `#ff6584`）；
- **细腻脉络**：微弱透明的半透明放射状花丝纹理。

```javascript
// 动态生成高清樱花花瓣纹理示例
function createPetalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  // 绘制心形樱花花瓣路径
  ctx.translate(64, 64);
  ctx.beginPath();
  ctx.moveTo(0, 48); // 根部
  ctx.bezierCurveTo(-38, 20, -56, -20, -28, -50); // 左肩
  ctx.bezierCurveTo(-14, -62, -2, -45, 0, -38);   // 尖端凹槽中心
  ctx.bezierCurveTo(2, -45, 14, -62, 28, -50);    // 右尖
  ctx.bezierCurveTo(56, -20, 38, 20, 0, 48);      // 右肩回归
  ctx.closePath();
  
  // 珍珠粉白到浓郁樱粉的径向渐变
  const grad = ctx.createRadialGradient(0, 20, 5, 0, -10, 60);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, '#ffecf1');
  grad.addColorStop(0.7, '#ff7597');
  grad.addColorStop(1, '#ff3b6c');
  
  ctx.fillStyle = grad;
  ctx.fill();
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
```

### 2. 尺度放大（确保视距清晰可辨）
- 常驻落花落叶尺寸统一放大至：**宽度 0.38，长度 0.52**（约为原尺寸的 2.5 倍）；
- 序章引导花瓣特写放大至：**宽度 0.50，长度 0.70**；
- 在 35 视距的全岛概览下，每一片花瓣都具备清晰的樱花瓣剪影，肉眼立即可辨！

### 3. 色彩与光泽（杜绝泛白变灰）
- **实例颜色显式同步**：必须调用 `mesh.instanceColor.needsUpdate = true`；
- **自发光加持 (Emissive)**：
  - 材质加入 `emissive: '#ff4d79', emissiveIntensity: 0.22`；
  - 即使背对强光或在母树浓荫下，花瓣也保持温润通透的粉润感，绝不发灰发黑！
- **丰富多阶花瓣调色盘**：
  - 🌸 娇艳绯樱：`#ff4d6d`
  - 🌸 水润春樱：`#ff758f`
  - 🌸 珍珠白桃：`#ff8fa3`
  - 🍃 初春嫩芽：`#48bb78`（鲜活透亮，占比 15%~20%）

### 4. 母树风道生机流向 (Organic Wind Path)
- 80% 的花瓣从母树树冠（`[-2.1, 4.2 ~ 6.5, 1.3]` 范围内）发源；
- 沿西南往东北的风道主干线掠过溪流与长椅上空，如同春风轻轻拂过树冠扬起的阵阵花雨，极具浪漫生活气息。

---

## 📋 三、Codex / GPT 修复执行指令

```text
请阅读项目根目录下的 PETALS-REDESIGN-SPEC.md 设计规约，彻底修复落花与落叶的视觉缺陷：

1. 修复颜色渲染丢失：
   - 在 src/natural/falling-foliage.js 中，调用 mesh.setColorAt 后，必须显式设置 mesh.instanceColor.needsUpdate = true；
   - 材质加入 emissive 自发光（#ff4d79，强度 0.22），解决背光发灰变黑问题；
   - 调色盘换用鲜明温润的高饱和樱粉色系（#ff4d6d, #ff758f, #ff8fa3）与初春嫩叶绿（#48bb78）；

2. 修复“看不出是什么东西”的纸屑感：
   - 引入内存 Canvas 程序化绘制的樱花花瓣（带心形浅凹与粉白径向渐变）与嫩叶 Alpha 纹理；
   - 将粒子尺寸放大 2.5 倍至 width=0.38, height=0.52（序章特写引导花瓣放大至 width=0.50, height=0.70）；
   - 在双面材质中启用 map 与 transparent，确保无论翻滚到哪一面都是边缘柔和的自然花瓣；

3. 优化散布源头：
   - 粒子主要从母树树冠（x: -2.1, y: 4.5~6.5, z: 1.3）生成，沿微风掠过溪流与草坪；

4. 运行 npm test 确保所有测试全绿，且运行 node scripts/review-falling-foliage.mjs 更新验收截图。
```
