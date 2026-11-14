import * as THREE from 'three';

/**
 * 🌌 翡翠紫晶丝滑极光天幕 (Emerald & Amethyst Silky Ribbon Aurora)
 * 
 * 采用多层正弦波折叠与垂向磁力线条纹算法 (Silky Harmonic Ray Curtains)，
 * 彻底消除焦散噪点块与生硬高光死白，呈现天鹅绒般丝滑、空灵、梦幻的双星命定极光！
 * 
 * - 底部：代表她的翡翠碧绿 (#10b981)
 * - 中部：流光碧青 (#06b6d4) 至浪漫薰衣草蓝 (#818cf8)
 * - 顶部：代表你的深空晶紫 (#c084fc)
 * - 纯净色温平滑过渡，无缝消隐于夜空深处
 */
export function makeAurora(time) {
  const radius = 115, height = 92;
  // 横跨北天低空至天顶深空的开阔弧形光幕 (约 175 度展角)
  const geometry = new THREE.CylinderGeometry(
    radius, radius, height, 64, 20, true, Math.PI * 0.55, Math.PI * 0.95
  );

  const uniforms = {
    uTime: time,
    uOpacity: { value: 0 } // 由 benchAtmosphere 控制昼夜淡入淡出
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

      void main() {
        if (uOpacity <= 0.001) {
          discard;
        }

        // 沿极光弧线的空灵波动位移
        float t = uTime * 0.022;
        float wave = sin(vUv.x * 5.2 + t * 1.5) * 0.09 
                   + sin(vUv.x * 11.4 - t * 0.9) * 0.045
                   + sin(vUv.x * 21.0 + t * 2.1) * 0.018;

        float u = vUv.x * 14.0 + t * 0.8;
        float v = vUv.y * 3.6;

        // 1. 丝绢主折叠光幔 (Primary Silky Folds)
        float fold1 = sin(u + sin(v * 1.4 + t * 1.2) * 1.85) * 0.5 + 0.5;
        fold1 = pow(fold1, 2.6);

        // 2. 磁力线垂向缕状细纹 (Vertical Magnetic Striations - 丝幔质感)
        float ray1 = sin(u * 2.8 - v * 0.75 - t * 0.7) * 0.5 + 0.5;
        ray1 = pow(ray1, 3.2);

        float ray2 = sin(u * 5.4 + v * 1.1 + t * 1.1) * 0.5 + 0.5;
        ray2 = pow(ray2, 2.4);

        // 3. 柔光底晕 (Ambient Undulating Haze)
        float haze = sin(u * 0.7 + v * 0.45 + t * 0.5) * 0.5 + 0.5;
        haze = pow(haze, 1.4);

        // 合成丝滑光幕强度
        float curtain = fold1 * 0.48 + ray1 * 0.28 + ray2 * 0.12 + haze * 0.22;

        // 4. 超柔和天鹅绒级边缘消隐与天顶平滑消融 (彻底消除生硬切边与截断感)
        float yFade = smoothstep(0.01, 0.20, vUv.y) * pow(1.0 - smoothstep(0.45, 0.96, vUv.y), 1.5);
        float xFade = sin(vUv.x * 3.14159265);
        xFade = pow(max(0.0, xFade), 1.6);
        float alphaMask = yFade * xFade;

        // 5. 纯净4阶双星命定色谱映射 (饱和鲜活，绝不发灰、绝无死白)
        vec3 cEmerald  = vec3(0.06, 0.85, 0.56);  // 底部：清透翡翠碧绿
        vec3 cTeal     = vec3(0.12, 0.78, 0.90);  // 中低：流光碧青
        vec3 cLavender = vec3(0.56, 0.54, 0.98);  // 中高：浪漫薰衣草蓝
        vec3 cAmethyst = vec3(0.78, 0.45, 0.96);  // 顶部：深空晶紫

        float curY = clamp(vUv.y + wave * 0.85, 0.0, 1.0);
        vec3 auroraColor;
        if (curY < 0.35) {
          auroraColor = mix(cEmerald, cTeal, smoothstep(0.06, 0.35, curY));
        } else if (curY < 0.68) {
          auroraColor = mix(cTeal, cLavender, smoothstep(0.35, 0.68, curY));
        } else {
          auroraColor = mix(cLavender, cAmethyst, smoothstep(0.68, 0.95, curY));
        }

        // 柔和光感辐射 (高光处更加通透晶莹，不失真成白斑)
        float radiance = curtain * alphaMask * uOpacity;
        vec3 finalColor = auroraColor * (radiance * 1.5 + pow(radiance, 2.0) * 0.55);

        gl_FragColor = vec4(finalColor, clamp(radiance * 1.15, 0.0, 1.0));
      }
    `
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'emerald-amethyst-aurora';
  // 悬挂于浮岛后方地平线高度至天顶
  mesh.position.set(0, 32, -15);
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
