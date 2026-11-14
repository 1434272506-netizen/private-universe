import * as THREE from 'three';

/**
 * 🌙 新海诚式银白娥眉月与立体月华光晕 (Crescent Moon & Lunar Halo)
 * - 位于东北偏东天穹高空 (方位角 ~ 1.35 rad, 仰角 ~ 39°)
 * - 包含两部分：
 *   1. 娥眉月轮 (Crescent Mesh)：正向发光月牙，带有微弱地球灰光反照 (Earthshine)
 *   2. 月华晕轮 (Lunar Halo Billboard)：多层径向高斯光晕，随时间微弱呼吸
 */
export function makeMoon(time) {
  const group = new THREE.Group();
  group.name = 'celestial-moon-group';

  // 悬挂于东北方天穹高空 (正对东侧观星挑台与黄铜望远镜的仰角视线)
  // 坐标方位：x: 48, y: 82, z: -88，在远景视角中完美平衡右侧空旷夜空
  group.position.set(44, 48, -94);
  group.lookAt(0, 0, 0);

  // A. 娥眉月盘材质与着色器 (精确数学裁切出月牙与灰光)
  const moonRadius = 8.5;
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

        // 主月轮边缘柔化
        float edge = smoothstep(1.0, 0.94, r);

        // 娥眉月裁切球体阴影 (偏移光源圆盘)
        vec2 shadowOffset = vec2(0.38, 0.18);
        float shadowR = length(p - shadowOffset);
        float crescent = smoothstep(0.78, 0.88, shadowR) * edge;

        // 月轮未受光部分的地球反照微光 (Earthshine / 暗部泛着幽蓝灰光)
        float earthshine = (1.0 - crescent) * edge * 0.16;

        // 辉光颜色：纯白月牙略带微暖乳金，背光面带冷银深空蓝
        vec3 crescentColor = vec3(1.0, 0.98, 0.92) * 1.8;
        vec3 earthshineColor = vec3(0.38, 0.52, 0.78);
        vec3 finalColor = crescent * crescentColor + earthshine * earthshineColor;

        float alpha = (crescent + earthshine) * uOpacity;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `
  });
  const moonMesh = new THREE.Mesh(moonGeom, moonMat);
  moonMesh.name = 'crescent-lunar-disc';
  group.add(moonMesh);

  // B. 月华呼吸光晕 (Volumetric Radial Moon Glow)
  const haloRadius = 36.0;
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

        // 柔和呼吸起伏
        float breathe = 1.0 + sin(uTime * 1.5) * 0.06;
        // 双层径向渐变
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
