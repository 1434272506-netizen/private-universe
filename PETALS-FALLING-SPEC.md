# 🌸 落花与落叶灵动系统设计规约 (Petals & Falling Foliage Design Specification)

> **设计版本**：v1.0  
> **设计架构师**：Antigravity  
> **代码执行方**：Codex / GPT  
> **对标开源库**：`danmana/sakura-idle`, `PabloMesquida/tree-demo`, `billpwchan/sakura-fantasy`, `gianlucatruda/falling-leaves`

---

## 🍃 一、核心痛点与升级目标 (Problem & Objectives)

### 现有实现痛点
当前序章中的花瓣引导（`src/natural/ceremony.js` 中的 `guidingPetals`）采用压扁的球体（`THREE.SphereGeometry(.065, 10, 6)`）与不受光照影响的基础材质（`MeshBasicMaterial`）：
1. **形态僵硬**：缺乏花瓣真实的双曲凹面与花瓣凹口，视觉上更像粉色小豆子/药丸；
2. **动态单一**：仅沿固定贝塞尔曲线滑行，缺乏落叶落花特有的空气阻力、三轴摇曳（Flutter & Tumble）与风场轻摆；
3. **缺少常驻生机**：全岛仅在入场 9 秒有 3 瓣引导花瓣，随后全岛花木静止，缺乏春日微风徐徐、花瓣与嫩叶在树冠溪流间随风散落的生命力。

### 升级核心目标
1. **微凹有机曲面建模**：程序化生成微弯曲碗状（Cupped Curvature）的真实花瓣与微折叶片；
2. **三轴空气动力学模拟**：引入轻柔重力、空气阻尼、左右滚转摇摆（Rocking Roll）与顺风偏航；
3. **双层粒子系统架构**：
   - **层级 1：浮岛常驻微风落花絮系统 (Ambient Wind Foliage)**：30~50 片花瓣与初春嫩叶在母树与溪流上空循环飘落；
   - **层级 2：序章灵动引导花瓣 (Ceremony Guidance)**：升级形态与翻滚质感，优雅环绕引向记忆缎带。

---

## 🔍 二、GitHub 顶级开源项目研究与借鉴矩阵

| 开源项目 | GitHub 仓库 | 核心技术方案 | 本项目借鉴要点 |
| :--- | :--- | :--- | :--- |
| **`danmana/sakura-idle`** | [github.com/danmana/sakura-idle](https://github.com/danmana/sakura-idle) | GPU 驱动落樱系统、无散度 Curl Noise 扰动、3 轴空气动力学旋转矩阵 | **三轴耦合摇曳算法**：落花下落时沿行进轴左右钟摆式振荡与迎风旋转 |
| **`PabloMesquida/tree-demo`** | [github.com/PabloMesquida/tree-demo](https://github.com/PabloMesquida/tree-demo) | WebGPU/TSL 树木落叶模拟、随机风阵脉冲（Wind Gusts） | **双色系混合**：80% 樱粉/香槟落花 + 20% 初春浅嫩绿叶，丰富视觉层次 |
| **`billpwchan/sakura-fantasy`** | [github.com/billpwchan/sakura-fantasy](https://github.com/billpwchan/sakura-fantasy) | Three.js 四季河川落樱长廊（The Cherry Avenue） | **轻量化循环池 (Recycle Pool)**：落入地面或溪流下方时柔和渐隐并重置，零内存泄漏 |
| **`gianlucatruda/falling-leaves`** | [github.com/gianlucatruda/falling-leaves](https://github.com/gianlucatruda/falling-leaves) | 物理下落模拟、微凹曲面顶点偏移 | **顶点凹折公式**：基于 `PlaneGeometry` 的中心内凹与边缘微翘算法 |

---

## 🎨 三、三维造型与材质设计 (Geometry & Material)

### 1. 程序化微凹花瓣曲面几何体 (Curved Petal Geometry)
基于带细分的平面几何体（`PlaneGeometry(0.18, 0.26, 6, 6)`）进行顶点变形：

```javascript
// 构建具有天然杯状双曲面的樱花花瓣
export function createCurvedPetalGeometry(width = 0.16, height = 0.24) {
  const geometry = new THREE.PlaneGeometry(width, height, 6, 6);
  const pos = geometry.attributes.position;
  
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    
    // 1. 横向内凹杯状弧度（中心向后凹，边缘向前翘）
    const normX = Math.abs(x) / (width * 0.5);
    z -= Math.cos(normX * Math.PI * 0.5) * (width * 0.35);
    
    // 2. 纵向尖端微翘与根部收腰
    const vFactor = (y + height * 0.5) / height; // 0 底端, 1 顶端
    z += Math.pow(vFactor, 2) * (height * 0.2);
    if (y < 0) x *= (0.4 + 0.6 * (1 + y / (height * 0.5))); // 根部收窄
    
    pos.setXYZ(i, x, y, z);
  }
  geometry.computeVertexNormals();
  geometry.center();
  return geometry;
}
```

### 2. 春日嫩芽落叶几何体 (Spring Leaf Geometry)
采用狭长舟形曲面（Canoe Fold），中央脊线向下凹折，两端收尖，长宽比约为 $1 : 2.2$。

### 3. 微透光双面材质 (Double-Sided Translucent Material)
- 材质类型：`THREE.MeshStandardMaterial`；
- 双面渲染：`side: THREE.DoubleSide`（确保翻滚时正反两面均自然受光）；
- 柔和半透明：`transparent: true, opacity: 0.92, roughness: 0.38, metalness: 0.05`；
- 配色方案（支持实例化随机着色或顶点颜色）：
  - 🌸 **落花主色**：粉白樱雪 `#fcefe8`、淡粉玫瑰 `#f7cad0`、香槟金淡粉 `#eed9c4`；
  - 🍃 **落叶点缀**：初春嫩芽绿 `#c4dba8`、明润青碧 `#a3cb98`。

---

## 🌪️ 四、空气动力学与风场物理 (Aerodynamics & Wind Field)

落花在空中的运动由**三大矢量分量**叠加而成：

$$P(t) = P_{base} + \vec{V}_{fall} \cdot t + \vec{W}_{wind}(t) + \vec{D}_{flutter}(t)$$

### 1. 终端沉降与阻尼 (Descent & Drag)
- 垂直下落速度：极轻缓飘降，$V_y \approx -0.15 \sim -0.32 \text{ m/s}$；
- 空气托举浮力：落花截面与水平面夹角越平缓，下落速度越慢。

### 2. 左右钟摆摇曳 (Rocking Roll & Flutter)
参考 `danmana/sakura-idle` 的三轴耦合算法：
- **Roll (滚转)**：$\theta_{roll} = A_r \cdot \sin(\omega_r \cdot t + \phi_0)$，振幅约 $25^\circ \sim 40^\circ$；
- **Pitch (俯仰)**：$\theta_{pitch} = A_p \cdot \cos(\omega_r \cdot t + \phi_0) \cdot 0.5$；
- **Yaw (偏航)**：随着下落微风缓缓旋转 $\omega_y \cdot t$。

### 3. 全局微风与随机风阵 (Global Wind & Gusts)
- **主风向**：向东北微风矢量 $\vec{w}_{base} = (0.35, -0.05, 0.20)$；
- **风阵脉冲 (Wind Gusts)**：周期为 5.5 秒的低频脉冲函数，当风阵吹过时，水平位移加速，落花向上轻微浮起再缓缓飘落；
- **涡流打旋 (Tree Canopy Vortex)**：在母树周围引入微小的切向速度，形成轻柔的花瓣盘旋感。

---

## 🏗️ 五、双层系统工程架构 (Engineering Architecture)

### 1. 浮岛常驻落花池设计 (`src/natural/falling-foliage.js`)
- **实例管理**：使用 `THREE.InstancedMesh` 或轻量 Mesh 循环池，总数量 40~50 粒，单次 Draw Call 解决，性能消耗极低；
- **活动包围盒**：以母树树干 `[-2.1, 3.3, 1.3]` 为中心，在空间范围 $X \in [-10, 8], Y \in [0.8, 8.5], Z \in [-6, 10]$ 内生成；
- **休眠机制**：当打开照片画册或信箱阅读弹窗（`covered` 状态）时，自动休眠更新，保障阅读时 60fps 丝滑翻页。

### 2. 序章引导花瓣升级
- 将原先粗糙的 `SphereGeometry` 替换为新构建的 `createCurvedPetalGeometry`；
- 赋予真实的双面受光材质，让花瓣在阳光（`DirectionalLight`）与环境光交织下投映出真实的微阴影与温润光泽；
- 沿贝塞尔曲线飞向缎带时，叠加细微的自转翻滚动画。

---

## 📋 六、Codex / GPT 执行指令参考

```text
请根据 PETALS-FALLING-SPEC.md 设计规约，实现落花与落叶灵动粒子系统：
1. 新建 src/natural/falling-foliage.js，实现微凹花瓣与舟形嫩叶几何体，以及基于 InstancedMesh 的常驻落花系统；
2. 升级 src/natural/ceremony.js 中的 guidingPetals，改用微凹曲面花瓣与 MeshStandardMaterial；
3. 在 src/natural/engine.js 中集成常驻飘絮系统，随风场自然更新并在全屏阅读弹窗时休眠；
4. 运行 npm test 确保所有回归测试与仪式感测试均 100% 通过。
```
