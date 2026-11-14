# Private Universe · 浪漫夜空全景重构与深空天幕升级白皮书 (v14.0 Master Spec)

> **文档标识**：`NIGHT-SKY-COSMIC-UPGRADE-SPEC`  
> **设计架构师**：Antigravity (AI Design Architect)  
> **执行团队**：GPT / Codex (Executor)  
> **核心破局**：针对当前夜幕模式下“东北侧天幕大面积死黑空旷、极光边缘切割生硬、缺乏视觉锚点与浪漫焦点”的视觉缺陷，全方位打造**“新海诚式极美梦幻夜空”**，构建月华、银河、极光、星云、流星四位一体的沉浸式星空天幕！

---

## 🌌 一、 当前夜空视觉痛点诊断与重构架构

```
【当前夜空空洞 vs 重构后新海诚式梦幻夜空】
  ┌────────────────────────────────────┬────────────────────────────────────────────────────────┐
  │ 🔴 当前夜空缺陷                    │ 🟢 重构后全天穹浪漫生态 (4-in-1 Celestial Canvas)       │
  ├────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ 1. 东北侧天幕大面积死黑空旷        │ ✦ 挂置一轮新海诚式银白娥眉月 (Crescent Moon & Earthshine)│
  │    无月亮、无星团，视线空洞冷清    │   伴随柔和多层呼吸月华晕光 (Volumetric Lunar Halo)     │
  ├────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ 2. 极光仅覆盖 158°，边缘刀切断层   │ ✦ 横跨天顶的璀璨银河拱桥星带 (Arching Milky Way Belt)   │
  │    旋转视角时瞬间看到生硬截断面    │   深紫罗兰、洋红星云与孔雀蓝星尘，填补全天穹深空空洞   │
  ├────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ 3. 极光光幕缺乏柔和羽化消隐        │ ✦ 极光边缘余弦高阶平滑羽化 (Smoothstep Cosine Falloff) │
  │    与纯黑背景交界处反差过大生硬    │   光幕如天鹅绒薄纱自然融入深空星海，消除所有切割感     │
  ├────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ 4. 流星频次过低 (12~24s 仅单颗)    │ ✦ 双子座浪漫流星雨群 (Dynamic Meteor Showers)           │
  │    空旷处难以捕捉，缺乏互动许愿感  │   每 4~8s 间歇划破暗空，留下长达 18 距离的离子发光尾迹 │
  └────────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 📜 二、 供 GPT 一键执行的终极提示词 (Turnkey Prompt for GPT)

可以直接将以下文本完整复制给 GPT 执行：

```markdown
### 🎯 任务背景与核心目标
在三维浪漫悬浮岛项目 `private-universe` 中，用户反馈“夜晚的天空有一部分有点空，后面的光幕过渡不好”。经架构审查，当前夜晚模式（Night）下存在两大视觉硬伤：
1. 天幕缺少月亮，东北天穹缺乏视觉锚点，呈大面积单调死黑；
2. 极光网格仅覆盖 158°，边缘没有柔和渐隐，视角转动时边缘如同刀切。

请根据以下架构设计，对夜空系统进行全景重构升级！

---

### 📂 涉及文件与改动清单
1. **新建** `src/natural/moon.js`：构建拟真娥眉月与多层月华辉光。
2. **新建** `src/natural/milky-way.js`：构建横跨天穹的璀璨银河星带与深空星云。
3. **修改** `src/natural/aurora.js`：在着色器中注入边缘角度余弦柔和羽化（Smoothstep Cosine Feathering），消除边界切割感。
4. **修改** `src/natural/shooting-stars.js`：优化流星出现频率与轨迹跨度，增加群星划空的浪漫密度。
5. **修改** `src/natural/bench-atmosphere.js`：引入月亮与银河模块，将其纳入白昼/黄昏/夜晚多通道渐变联动。

---

### 🛠️ 具体实施代码规范

#### 1. 新建 `src/natural/moon.js` (浪漫银月与月华光晕)
```javascript
import * as THREE from 'three';

/**
 * 🌙 新海诚式银白娥眉月与立体月华光晕 (Crescent Moon & Lunar Halo)
 * - 位于东北偏东天穹高空 (azimuth ~ 1.25 rad, elevation ~ 42°)
 * - 包含两部分：
 *   1. 娥眉月轮 (Crescent Mesh)：正向发光月牙，带有微弱地球灰光反照 (Earthshine)
 *   2. 月华晕轮 (Lunar Halo Billboard)：多层径向高斯光晕，随时间微弱呼吸
 */
export function makeMoon(time) {
  const group = new THREE.Group();
  group.name = 'celestial-moon-group';

  const distance = 165;
  const azimuth = 1.35;    // 东北偏东方位
  const elevation = 0.68;  // 约 39° 仰角
  const pos = new THREE.Vector3(
    distance * Math.cos(elevation) * Math.sin(azimuth),
    distance * Math.sin(elevation),
    distance * Math.cos(elevation) * Math.cos(azimuth)
  );
  group.position.copy(pos);
  group.lookAt(0, 0, 0);

  // A. 娥眉月盘材质与着色器
  const moonRadius = 6.2;
  const moonGeom = new THREE.PlaneGeometry(moonRadius * 2, moonRadius * 2);
  const moonMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: time,
      uOpacity: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;

        float edge = smoothstep(1.0, 0.94, r);
        vec2 shadowOffset = vec2(0.38, 0.18);
        float shadowR = length(p - shadowOffset);
        float crescent = smoothstep(0.78, 0.88, shadowR) * edge;
        float earthshine = (1.0 - crescent) * edge * 0.14;

        vec3 crescentColor = vec3(1.0, 0.98, 0.92) * 1.6;
        vec3 earthshineColor = vec3(0.42, 0.55, 0.75);
        vec3 finalColor = crescent * crescentColor + earthshine * earthshineColor;

        float alpha = (crescent + earthshine) * uOpacity;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `
  });
  const moonMesh = new THREE.Mesh(moonGeom, moonMat);
  moonMesh.name = 'crescent-lunar-disc';
  group.add(moonMesh);

  // B. 月华呼吸光晕
  const haloRadius = 24.0;
  const haloGeom = new THREE.PlaneGeometry(haloRadius * 2, haloRadius * 2);
  const haloMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: time,
      uOpacity: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float dist = length(p);
        if (dist > 1.0) discard;

        float breathe = 1.0 + sin(uTime * 1.5) * 0.06;
        float innerGlow = exp(-dist * 4.2 * breathe);
        float outerGlow = exp(-dist * 1.8) * 0.45;
        float glow = (innerGlow + outerGlow) * smoothstep(1.0, 0.4, dist);

        vec3 glowColor = mix(vec3(0.9, 0.95, 1.0), vec3(0.45, 0.65, 0.95), dist);
        gl_FragColor = vec4(glowColor, glow * uOpacity * 0.65);
      }
    `
  });
  const haloMesh = new THREE.Mesh(haloGeom, haloMat);
  haloMesh.position.z = -0.1;
  haloMesh.name = 'lunar-ambient-halo';
  group.add(haloMesh);

  return {
    group,
    uniforms: {
      uOpacity: {
        set value(v) {
          moonMat.uniforms.uOpacity.value = v;
          haloMat.uniforms.uOpacity.value = v;
        },
        get value() {
          return moonMat.uniforms.uOpacity.value;
        }
      }
    }
  };
}
```

#### 2. 新建 `src/natural/milky-way.js` (横跨天穹璀璨银河拱桥与宇宙星云)
```javascript
import * as THREE from 'three';

/**
 * 🌌 梦幻全天穹银河拱桥与深空星云天带 (Arching Milky Way Galaxy & Cosmic Nebula)
 */
export function makeMilkyWay(time) {
  const radius = 210;
  const geometry = new THREE.CylinderGeometry(
    radius, radius, 120, 96, 24, true, -Math.PI * 0.35, Math.PI * 1.35
  );

  const uniforms = {
    uTime: time,
    uOpacity: { value: 0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vWorld;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int k = 0; k < 4; k++) {
          v += a * noise(p);
          p *= 2.08;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        float centerDist = abs(vUv.y - 0.5) * 2.0;
        float coreProfile = exp(-pow(centerDist * 2.6, 2.0));

        vec2 st = vec2(vUv.x * 7.5, vUv.y * 3.5);
        float cloud1 = fbm(st + vec2(uTime * 0.008, 0.0));
        float cloud2 = fbm(st * 2.1 - vec2(0.0, uTime * 0.005));
        float dustLane = 1.0 - smoothstep(0.42, 0.65, fbm(st * 1.6 + 2.5)) * 0.72;

        float nebula = (cloud1 * 0.65 + cloud2 * 0.35) * coreProfile * dustLane;
        float stars = pow(hash(vUv * 850.0 + fract(uTime * 0.01)), 26.0) * coreProfile * 4.5;

        vec3 colViolet = vec3(0.28, 0.12, 0.58);
        vec3 colCyan   = vec3(0.05, 0.42, 0.72);
        vec3 colRose   = vec3(0.72, 0.18, 0.45);
        vec3 colCore   = vec3(1.4, 1.5, 1.8);

        vec3 nebulaColor = mix(colViolet, colCyan, cloud1);
        nebulaColor = mix(nebulaColor, colRose, cloud2 * 0.55);
        nebulaColor += stars * colCore;

        float horizonFade = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
        float finalAlpha = nebula * horizonFade * uOpacity * 0.88;

        gl_FragColor = vec4(nebulaColor, finalAlpha);
      }
    `
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'celestial-milky-way';
  mesh.rotation.z = 0.48;
  mesh.rotation.y = 0.65;

  return {
    mesh,
    uniforms
  };
}
```

#### 3. 修改 `src/natural/aurora.js` (边缘余弦柔和羽化)
在片元着色器末尾输出颜色前增加：
```javascript
float edgeFeather = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
float heightFeather = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.70, vUv.y);
float finalMask = edgeFeather * heightFeather;

gl_FragColor = vec4(col, totalAurora * uOpacity * finalMask);
```

#### 4. 修改 `src/natural/bench-atmosphere.js` (接入新天象)
引入 `makeMoon` 与 `makeMilkyWay`：
```javascript
import { makeMoon } from './moon.js';
import { makeMilkyWay } from './milky-way.js';

// 在 benchAtmosphere 内实例化并添加到 scene：
const moon = makeMoon(time);
const milkyWay = makeMilkyWay(time);
scene.add(moon.group, milkyWay.mesh);

// 注册昼夜通道渐变联动：
channel([0, 0.35, 1.0], v => {
  moon.uniforms.uOpacity.value = v;
  moon.group.visible = v > 0.001;
});

channel([0, 0.05, 0.95], v => {
  milkyWay.uniforms.uOpacity.value = v;
  milkyWay.mesh.visible = v > 0.001;
});
```

---

### 🔍 验证与验收标准
1. `npm run build` 成功，0 错误；
2. `npm run test:estate` 通过；
3. 切换至“银河萤火 (Night)”模式：
   - 仰望夜空，东北高空清晰可见一轮带有柔美呼吸月华的银白娥眉月；
   - 一道绚烂唯美的银河星云拱带斜跨天际，与西侧极光交相辉映；
   - 极光边缘如烟似纱平滑消融在深空，无任何生硬裁切黑边！
```
