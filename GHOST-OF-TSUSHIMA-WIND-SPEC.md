# 🍃 《对马岛之魂》导引之风与落樱/落叶粒子系统设计规约 (Ghost of Tsushima Wind & Foliage Spec)

> **设计灵感**：PlayStation 3A 巨作《对马岛之魂》（Ghost of Tsushima）与 Sucker Punch GDC 2021《Blowing from the West》技术分享  
> **设计架构师**：Antigravity  
> **代码执行方**：Codex / GPT  
> **对标开源库**：`danmana/sakura-idle`, `momentchan/r3f-procedural-grass`, `Jumballaya/Threejs-Grass`, `gianlucatruda/falling-leaves`

---

## 🗡️ 一、为什么《对马岛之魂》的落花落叶让人如此沉醉？

在《对马岛之魂》中，落花与落叶不是死板地从天上往下掉，**“风（Guiding Wind）”才是整个世界真正的主角与灵魂**：

```mermaid
flowchart LR
    A["🍃 母树树梢发源<br/>(集中群集，拒绝乱撒)"] --> B["🌪️ 阵风脉冲 (Wind Surge)<br/>(每隔 6~8 秒掀起气流波浪)"]
    B --> C["🕊️ 升力托举 (Aerodynamic Lift)<br/>(花瓣被风卷起向前疾驰)"]
    C --> D["🌸 镜头景深特写 (Near-Camera Swoop)<br/>(近景大花瓣掠过玩家眼前)"]
    D --> E["🌿 沿溪流与长椅盘旋沉降<br/>(优雅消散并无感循环)"]
```

### 对马岛四大核心视觉法则：
1. **群集风带（Leaf Ribbons / Flurries）**：花瓣绝不是孤立分散的，而是成群结队、形成一条如同丝带般掠过屏幕的**“气流花海通道”**；
2. **强阵风周期脉冲（Gust Pulses & Airflow Lift）**：风速有呼吸感！平时是微风浮动，每隔 6~8 秒爆发一次**呼啸而过的强阵风**，将花瓣猛烈推向前方并向上卷起（升力）；
3. **多重视距纵深（Cinematic Depth）**：少数几片花瓣故意贴着镜头超近距离掠过（带来强烈的 3D 景深），中景花瓣成群飞跃溪流，远景微粒点缀树梢；
4. **高饱和东方美学（Saturated Japanese Palette）**：告别发灰的米白！采用极具张力的**水润绯樱粉（`#ff2a6d` / `#ff758f`）**或**金秋枫红（`#d90429` / `#ffb703`）**，在背光下透出鲜活的通透微光。

---

## 🌪️ 二、数学与物理动力学建模 (Mathematical Modeling)

### 1. 导引之风主风场与阵风脉冲 (The Guiding Wind Pulse)
设浮岛主风道方向从母树树冠（西南）吹向长椅与玩家镜头方向（东北）：

$$\vec{w}_{dir} = \text{normalize}(0.85, -0.08, 0.52)$$

周期性强阵风函数（周期 $T = 7.5\text{s}$，阵风持续 $2.2\text{s}$）：

$$g(t) = \max\left(0, \sin\left(\frac{2\pi t}{7.5}\right)\right)^5$$

- **常态微风速**：$v_{base} = 0.45 \text{ m/s}$；
- **阵风暴发速**：$v_{gust} = 3.2 \text{ m/s} \times g(t)$；
- **气流向上托举升力 (Lift)**：当阵风爆发时，产生抗衡重力的上升气流：
  $$v_y(t) = -v_{fall} + 0.42 \times g(t)$$
  *（花瓣在阵风到来时不是下坠，而是随风向上卷起扬起，阵风过后才翩翩沉降！）*

### 2. 空气动力学三轴翻滚 (Sucker Punch Tumble)
花瓣在空中翻滚的角速度直接与风速耦合：
- **Roll（沿风向旋转）**：风速越快，左右摆动频率越高：
  $$\omega_{roll} = (1.5 + 4.0 \cdot g(t)) \cdot \sin(3.5 \cdot t + \phi_i)$$
- **Pitch（迎风俯仰角）**：阵风吹起时，花瓣前端自然向上倾斜翘起（如同滑翔机翼）；
- **Yaw（随风转向）**：粒子航向角强行锁定并轻微摆动于主风向。

---

## 🎨 三、贴图与视觉质感重塑 (Canvas Procedural Shader)

### 1. Canvas 动态手绘级樱花 Alpha 贴图
完全由内存 Canvas 绘制（128x128），无需下载任何外部图片资产：
- **樱花花瓣轮廓**：双侧微鼓、顶端带有标志性圆润小 V 缺口（Notched Sakura Cleft）；
- **高阶水彩渐变**：
  - 核心基底：水润珍珠玉白（`#fff0f3`）；
  - 中段过渡：鲜嫩早樱粉（`#ff758f`）；
  - 边缘尖端：浓郁绯红樱雪（`#ff2a6d`）；
- **边缘柔和羽化**：Alpha 通道外圈平滑过渡，杜绝多边形硬边。

### 2. 双面透光物理材质 (`THREE.MeshStandardMaterial`)
```javascript
const material = new THREE.MeshStandardMaterial({
  map: petalTexture,
  alphaMap: petalTexture,
  transparent: true,
  opacity: 0.95,
  roughness: 0.32,
  metalness: 0.05,
  side: THREE.DoubleSide,
  depthWrite: false,
  emissive: new THREE.Color('#ff2a6d'),
  emissiveIntensity: 0.25, // 对马岛同款通透透光感，阴影下绝不发灰
  forceSinglePass: true
});
```

### 3. 三重视距纵深分级 (Depth Hierarchy)
总粒子数控制在 **55~65 片**（单次 `InstancedMesh` 渲染，手机端 60fps 毫无压力）：
- **近景掠镜组（5~8 片，特大尺寸 0.65 x 0.85）**：飞行轨迹故意靠近玩家镜头前方掠过，带来极致沉浸的电影感；
- **中景风带组（35~40 片，标准尺寸 0.38 x 0.52）**：群集掠过母树、溪流、草坪与长椅；
- **远景树梢组（15 片，轻灵尺寸 0.22 x 0.30）**：在母树高处树叶间若隐若现打旋。

---

## 📋 四、Codex / GPT 落地执行清单

```text
请阅读项目根目录下的 GHOST-OF-TSUSHIMA-WIND-SPEC.md 设计规约，实现《对马岛之魂》风格的落樱与导引之风系统：

1. 动态生成手绘级樱花 Alpha 贴图：
   - 在 src/natural/falling-foliage.js 中，使用内存 2D Canvas 绘制带心形圆润凹口（Notched Tip）、粉白水彩渐变（珍珠白 #fff0f3 到鲜亮绯红 #ff2a6d）与边缘柔和羽化的贴图；
   - 赋予 MeshStandardMaterial 材质 map 与 alphaMap，开启 side: THREE.DoubleSide，并注入 emissive: '#ff2a6d'（强度 0.25），确保强光通透、背光粉润；

2. 还原 Sucker Punch「导引之风 (Guiding Wind)」流线动力学：
   - 80% 粒子发源于母树树冠内部与迎风面（x: -2.5, y: 4.5~6.2, z: 1.2）；
   - 实现 7.5 秒周期的强阵风脉冲函数 gust(t) = max(0, sin(2*pi*t/7.5))^5；
   - 阵风爆发时，粒子获得水平强加速（vx, vz）与垂直升力托举（vy += 0.42*gust），形成一条如同丝带般掠过溪流与长椅的花瓣流（Leaf Ribbon）；

3. 构筑三重视距纵深感：
   - 设置 5~8 片大花瓣（尺寸 0.65x0.85）近距掠过玩家镜头前方；35 片中景花瓣（0.38x0.52）组成主风带；15 片远景花瓣（0.22x0.30）在树冠盘旋；
   - 显式执行 mesh.instanceColor.needsUpdate = true；

4. 运行 npm test 确保所有测试通过，并运行 node scripts/review-falling-foliage.mjs 更新验收截图。
```
