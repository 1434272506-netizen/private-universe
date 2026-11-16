import * as THREE from 'three';
import {FIREWORK_BACKDROP, makeFireworkBackdropUniforms} from './fireworks.js';

/**
 * 🌌 梦幻全天穹银河拱桥与深空星云天带 (Arching Milky Way Galaxy & Cosmic Nebula)
 * - 采用天球大圆弧曲面带 (Ribbon Arc)，从西南地平线跨越天顶至东北
 * - 结合深空多色多频噪声：深紫罗兰、深空孔雀蓝、玫瑰星云与星尘暗带 (Dust Lanes)
 * - 填补极光之外所有纯黑空洞区域，带来置身深邃宇宙的无尽诗意
 */
export function makeMilkyWay(time) {
  const radius = 210;
  // 天穹大圆带几何体：聚拢于西北天际
  const geometry = new THREE.CylinderGeometry(
    radius, radius, 130, 96, 24, true, Math.PI * 0.95, Math.PI * 0.55
  );

  const uniforms = {
    ...makeFireworkBackdropUniforms(),
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
      ${FIREWORK_BACKDROP}
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
        // 银河带沿纵向居中收束
        float centerDist = abs(vUv.y - 0.5) * 2.0;
        float coreProfile = exp(-pow(centerDist * 2.6, 2.0));

        // 银河星云流动微澜与暗物质裂谷 (Dark Rift Dust Lanes)
        vec2 st = vec2(vUv.x * 7.5, vUv.y * 3.5);
        float cloud1 = fbm(st + vec2(uTime * 0.008, 0.0));
        float cloud2 = fbm(st * 2.1 - vec2(0.0, uTime * 0.005));
        float dustLane = 1.0 - smoothstep(0.42, 0.65, fbm(st * 1.6 + 2.5)) * 0.72;

        float nebula = (cloud1 * 0.65 + cloud2 * 0.35) * coreProfile * dustLane;

        // 细腻密集的银河微星尘 (Micro Stardust flecks)
        float stars = pow(hash(vUv * 850.0 + fract(uTime * 0.01)), 26.0) * coreProfile * 4.5;

        // 色彩阶梯：深紫晶 -> 宇宙孔雀蓝 -> 玫瑰星云粉 -> 柔和星光核心
        vec3 colViolet = vec3(0.24, 0.10, 0.52);
        vec3 colCyan   = vec3(0.05, 0.38, 0.65);
        vec3 colRose   = vec3(0.65, 0.16, 0.40);
        vec3 colCore   = vec3(0.85, 0.95, 1.15);

        vec3 nebulaColor = mix(colViolet, colCyan, cloud1);
        nebulaColor = mix(nebulaColor, colRose, cloud2 * 0.55);
        nebulaColor += stars * colCore;

        // 沿天际线与横向曲面边缘进行双向高阶余弦平滑羽化，彻底杜绝生硬切割切面
        float horizonFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        float edgeFadeX = smoothstep(0.0, 0.32, vUv.x) * smoothstep(1.0, 0.68, vUv.x);
        float finalAlpha = nebula * horizonFade * edgeFadeX * uOpacity * 0.70;

      gl_FragColor = vec4(exposeGalaxy(nebulaColor,normalize(vWorld-cameraPosition)), finalAlpha);
      }
    `
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'celestial-milky-way';
  mesh.rotation.z = 0.25; // 优雅倾斜跨越天穹
  mesh.rotation.y = 0.25; // 旋转对准西北神木区域，为右侧留出纯净深邃夜空

  return {
    mesh,
    uniforms
  };
}
