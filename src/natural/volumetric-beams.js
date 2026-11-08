import * as THREE from 'three';

/**
 * ☀️ 晨曦丁达尔神圣光束 (Crepuscular Volumetric Beams)
 * 
 * 基于 GitHub 顶流开源项目 TrentSterling/threejs-volumetric-beam 与 Passivestar 的
 * 极简圆柱体看板 (Cylindrical Billboarding & Soft Depth Fade) 算法移植。
 * 
 * 0MB 外部贴图，纯 GPU 菲涅尔衰减与程序化尘埃漂浮计算，无需沉重昂贵的全屏后处理光线步进。
 * 阳光穿透母树树冠，温柔倾泻在春日草甸与潺潺小溪之上。
 */
export function makeVolumetricBeams(time) {
  const group = new THREE.Group();
  group.name = 'volumetric-godrays';

  const uniforms = {
    uTime: time,
    uOpacity: { value: 0.85 }, // 由氛围系统 (benchAtmosphere) 联动：Day=0.85, Sunset=0.25, Night=0.0
    uColor: { value: new THREE.Color('#fff2cf') }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormalWorld;
      void main() {
        vUv = uv;
        vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormalWorld;

      void main() {
        if (uOpacity <= 0.001) {
          discard;
        }

        // 1. 视线菲涅尔柔和衰减 (防止视线切角时产生生硬多边形边缘)
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float rim = pow(1.0 - abs(dot(viewDir, vNormalWorld)), 1.35);

        // 2. 沿光束纵向自然淡入与淡出 (顶部树隙小、底部地面大)
        float lengthFade = smoothstep(0.01, 0.22, vUv.y) * smoothstep(0.99, 0.65, vUv.y);

        // 3. 沿径向 (环状截面) 柔化
        float radialFade = sin(vUv.x * 3.14159265);

        // 4. 程序化微光微尘 (Drifting Dust Motes) 浮动拟真
        float dust1 = sin(vWorld.y * 2.8 + uTime * 0.45) * cos(vWorld.x * 2.1 - uTime * 0.35);
        float dust2 = cos(vWorld.z * 3.2 - uTime * 0.55) * sin(vWorld.y * 1.8 + uTime * 0.25);
        float dust = 0.82 + 0.18 * (dust1 * dust2);

        float alpha = rim * lengthFade * radialFade * dust * uOpacity * 0.48;

        // 暖杏金色朝阳，核心略带乳白高亮
        vec3 beamCore = mix(uColor, vec3(1.15, 1.12, 1.05), pow(rim * lengthFade, 2.0));

        gl_FragColor = vec4(beamCore, clamp(alpha, 0.0, 1.0));
      }
    `
  });

  // 阳光主入射向量：从 Sun (-11, 10.5, 7.5) 投向地面 (0, 0, 0)
  const sunPos = new THREE.Vector3(-11, 10.5, 7.5);
  const targetDir = new THREE.Vector3().sub(sunPos).normalize();
  const upVec = new THREE.Vector3(0, 1, 0);
  const rotationQuaternion = new THREE.Quaternion().setFromUnitVectors(upVec, targetDir);

  // 布局 3 束错落穿透母树枝叶的自然体积光柱
  const beamConfigs = [
    // [radiusTop, radiusBottom, height, posX, posY, posZ]
    { rt: 0.65, rb: 3.8, h: 22, pos: [-3.2, 5.5, 1.8] }, // 穿透树心，洒向小溪与踏石
    { rt: 0.50, rb: 2.8, h: 20, pos: [-1.5, 5.8, 3.2] }, // 拂过长椅与纪念碑侧翼
    { rt: 0.55, rb: 3.2, h: 21, pos: [-4.8, 5.0, 0.2] }  // 洒向草甸野花丛
  ];

  for (const cfg of beamConfigs) {
    const geo = new THREE.CylinderGeometry(cfg.rt, cfg.rb, cfg.h, 24, 1, true);
    const mesh = new THREE.Mesh(geo, material);
    mesh.quaternion.copy(rotationQuaternion);
    mesh.position.set(...cfg.pos);
    group.add(mesh);
  }

  return {
    group,
    material,
    uniforms,
    update(timeVal) {
      // 引擎每帧传递 timeVal
    }
  };
}
