import * as THREE from 'three';

/**
 * 🌌 翡翠紫晶极光天幕 (Emerald & Amethyst Boreal Aurora)
 * 
 * 基于 GitHub 顶流开源项目 candpixie/gliss 与 nimitz's "Auroras" (Shadertoy XtGGRt) 移植。
 * 采用三频程序化三角波噪声 (Tri-Noise & mm2 旋转变换)，0MB 外部贴图，纯 GPU 数学渲染。
 * 
 * - 底部：代表她的翡翠碧绿 (#10b981)
 * - 顶部：代表你的紫罗兰晶紫 (#c084fc)
 * - 波峰交汇处：超热电离冷白光冕
 */
export function makeAurora(time) {
  const radius = 58, height = 30;
  // 构建横跨北天低空地平线的圆弧面片 (约 150 度展角，面向浮岛中心)
  const geometry = new THREE.CylinderGeometry(
    radius, radius, height, 48, 8, true, Math.PI * 0.65, Math.PI * 0.85
  );

  const uniforms = {
    uTime: time,
    uOpacity: { value: 0 } // 由氛围系统 (benchAtmosphere) 在进入 night 时余弦插值至 0.85
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

      // --- nimitz Tri-Noise 极光波纹核心算法 ---
      mat2 mm2(in float a) {
        float c = cos(a), s = sin(a);
        return mat2(c, s, -s, c);
      }

      float tri(in float x) {
        return clamp(abs(fract(x) - 0.5), 0.01, 0.49);
      }

      vec2 tri2(in vec2 p) {
        return vec2(tri(p.x) + tri(p.y), tri(p.y + tri(p.x)));
      }

      float triNoise2d(in vec2 p, float spd) {
        float z = 1.6;
        float z2 = 2.4;
        float rz = 0.0;
        p *= mm2(p.x * 0.05);
        vec2 bp = p;
        for (float i = 0.0; i < 3.0; i++) {
          vec2 dg = tri2(bp * 1.75) * 0.72;
          dg *= mm2(uTime * spd);
          p -= dg / z2;
          bp *= 1.35;
          z2 *= 0.46;
          z *= 0.44;
          p *= 1.22 + (rz - 1.0) * 0.02;
          rz += tri(p.x + tri(p.y)) * z;
          p *= -mm2(uTime * spd * 0.25);
        }
        return clamp(1.0 / pow(rz * 26.0, 1.25), 0.0, 0.65);
      }

      void main() {
        if (uOpacity <= 0.001) {
          discard;
        }

        // 沿天际线流转的极光坐标
        vec2 p = vec2(vUv.x * 7.5, vUv.y * 3.2);
        
        // 纵向丝幔折叠与微澜
        float curtain = triNoise2d(p + vec2(uTime * 0.04, 0.0), 0.08);
        float wisp = triNoise2d(p * 1.8 + vec2(-uTime * 0.025, uTime * 0.015), 0.05);
        float auroraPattern = curtain * 0.72 + wisp * 0.28;

        // 柔和边缘衰减：底部近地平线羽化、顶部深空羽化、左右两侧弧形羽化
        float yFade = smoothstep(0.02, 0.28, vUv.y) * smoothstep(0.98, 0.55, vUv.y);
        float xFade = smoothstep(0.0, 0.20, vUv.x) * smoothstep(1.0, 0.80, vUv.x);
        float alphaMask = yFade * xFade;

        // 浪漫双星命定色谱：
        // 底部翡翠碧绿 (#10b981) -> 顶部紫罗兰晶紫 (#c084fc) -> 核心交汇处纯白电离光冕
        vec3 emeraldColor = vec3(0.06, 0.75, 0.52); // 翡翠碧绿
        vec3 amethystColor = vec3(0.76, 0.52, 0.98); // 紫罗兰晶紫
        vec3 coronaWhite = vec3(1.15, 1.25, 1.35);   // 冷白高温光冕

        // 垂直高度色谱映射
        vec3 auroraColor = mix(emeraldColor, amethystColor, smoothstep(0.20, 0.75, vUv.y));
        // 在强折叠光束波峰处融入高温白光
        auroraColor = mix(auroraColor, coronaWhite, pow(auroraPattern, 2.5) * 1.8);

        float finalAlpha = auroraPattern * alphaMask * uOpacity * 1.6;
        gl_FragColor = vec4(auroraColor * (1.2 + auroraPattern), clamp(finalAlpha, 0.0, 1.0));
      }
    `
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'emerald-amethyst-aurora';
  // 悬挂于浮岛后方地平线高度
  mesh.position.set(0, 15, -4);
  mesh.rotation.y = -0.32; // 对齐长椅北向视野

  return {
    mesh,
    material,
    uniforms,
    update(timeVal) {
      // timeVal 传入已在引擎主循环统一处理
    }
  };
}
