import * as THREE from 'three';
import { WATER_START, WATER_END } from './land.js';
import { channelBounds } from './water.js';

export function makeCreekRipples(renderer, time) {
  const SIM_W = 128, SIM_H = 512;
  const START_Z = WATER_START, END_Z = WATER_END;
  const LENGTH_Z = END_Z - START_Z;

  // 1. Dual-Buffer Ping-Pong Render Targets
  const rtOptions = {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
  };
  let simRT0 = new THREE.WebGLRenderTarget(SIM_W, SIM_H, rtOptions);
  let simRT1 = new THREE.WebGLRenderTarget(SIM_W, SIM_H, rtOptions);

  const MAX_IMPULSES = 16;
  const impulseQueue = [];
  const impulseUniforms = Array.from({ length: MAX_IMPULSES }, () => new THREE.Vector4(0, 0, 0, 0));

  // 2. Coordinate Conversion: World (x, z) <-> UV (u, v)
  function worldToUv(x, z) {
    const v = THREE.MathUtils.clamp((z - START_Z) / LENGTH_Z, 0, 1);
    const {left,right} = channelBounds(z);
    const width = Math.max(0.2, right - left);
    const u = THREE.MathUtils.clamp((x - left) / width, 0, 1);
    return { u, v };
  }

  function addImpulseUv(u, v, radiusUv = 0.035, strength = -0.45) {
    if (impulseQueue.length < MAX_IMPULSES) {
      impulseQueue.push({
        u: THREE.MathUtils.clamp(u, 0.01, 0.99),
        v: THREE.MathUtils.clamp(v, 0.01, 0.99),
        r: THREE.MathUtils.clamp(radiusUv, 0.01, 0.12),
        s: THREE.MathUtils.clamp(strength, -1.2, 1.2),
      });
    }
  }

  function addImpulseWorld(x, z, radiusWorld = 0.28, strength = -0.45) {
    const { u, v } = worldToUv(x, z);
    const bounds=channelBounds(z);
    if(z<START_Z||z>END_Z||x<bounds.left||x>bounds.right)return;
    const rUv = radiusWorld / (bounds.right-bounds.left); // normalized to channel width
    addImpulseUv(u, v, rUv, strength);
  }

  // 3. Orthographic Simulation Scene
  const simScene = new THREE.Scene();
  const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const simMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uPrevState: { value: null },
      uTexel: { value: new THREE.Vector2(1.0 / SIM_W, 1.0 / SIM_H) },
      uImpulses: { value: impulseUniforms },
      uImpulseCount: { value: 0 },
      uDamping: { value: 0.985 },
      uFlowSpeed: { value: 0.024 }, // stream carry
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uPrevState;
      uniform vec2 uTexel;
      uniform vec4 uImpulses[${MAX_IMPULSES}];
      uniform int uImpulseCount;
      uniform float uDamping;
      uniform float uFlowSpeed;

      void main() {
        // Natural stream flow advection: ripples drift slightly downstream
        vec2 advectUv = vUv - vec2(0.0, uFlowSpeed * uTexel.y);
        vec4 cur = texture2D(uPrevState, advectUv);
        float h = cur.r;
        float v = cur.g;
        float foam = cur.b;

        // 8-neighbor discrete Laplacian
        float n  = texture2D(uPrevState, advectUv + vec2(0.0, uTexel.y)).r;
        float s  = texture2D(uPrevState, advectUv - vec2(0.0, uTexel.y)).r;
        float e  = texture2D(uPrevState, advectUv + vec2(uTexel.x, 0.0)).r;
        float w  = texture2D(uPrevState, advectUv - vec2(uTexel.x, 0.0)).r;
        float ne = texture2D(uPrevState, advectUv + vec2(uTexel.x, uTexel.y)).r;
        float nw = texture2D(uPrevState, advectUv + vec2(-uTexel.x, uTexel.y)).r;
        float se = texture2D(uPrevState, advectUv + vec2(uTexel.x, -uTexel.y)).r;
        float sw = texture2D(uPrevState, advectUv + vec2(-uTexel.x, -uTexel.y)).r;

        float avg = (n + s + e + w) * 0.20 + (ne + nw + se + sw) * 0.05;
        float laplacian = avg - h;

        // Velocity evolution with restorative force
        v += laplacian * 0.42 - h * 0.0065;

        // Apply external impulses (Ricker Wavelet)
        for (int i = 0; i < ${MAX_IMPULSES}; i++) {
          if (i >= uImpulseCount) break;
          vec4 imp = uImpulses[i];
          // Account for aspect ratio (SIM_W / SIM_H = 1/4) so ripples remain circular in world space
          vec2 d = (vUv - imp.xy) * vec2(1.0, 4.0);
          float dist2 = dot(d, d);
          float r2 = max(imp.z * imp.z, 0.00004);
          if (dist2 < r2 * 5.0) {
            float radial = sqrt(dist2 / r2);
            float waveProfile = (1.0 - radial * radial * 0.85) * exp(-radial * radial * 0.95);
            v += imp.w * waveProfile;
            foam = min(1.5, foam + abs(imp.w) * exp(-radial * radial * 1.2) * 0.65);
          }
        }

        // Absorbing sponge boundary at riverbanks and waterfall
        float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float edgeSponge = smoothstep(0.0, 0.065, edgeDist);
        float edgeDamp = mix(0.72, uDamping, edgeSponge);

        h = (h + v) * edgeDamp;
        v *= edgeDamp;
        foam = max(0.0, (foam - 0.004) * 0.985);

        gl_FragColor = vec4(h, v, foam, 1.0);
      }
    `,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
  simScene.add(quad);

  const savedTarget=renderer.getRenderTarget(),savedColor=renderer.getClearColor(new THREE.Color()),savedAlpha=renderer.getClearAlpha();
  renderer.setClearColor(0,0);
  for(const target of [simRT0,simRT1]){renderer.setRenderTarget(target);renderer.clear();}
  renderer.setRenderTarget(savedTarget);renderer.setClearColor(savedColor,savedAlpha);
  let accumulator=0,disposed=false;
  function step() {
      // 1. Pack impulses into uniforms
      const count = Math.min(impulseQueue.length, MAX_IMPULSES);
      simMaterial.uniforms.uImpulseCount.value = count;
      for (let i = 0; i < count; i++) {
        const imp = impulseQueue[i];
        impulseUniforms[i].set(imp.u, imp.v, imp.r, imp.s);
      }
      impulseQueue.length = 0;

      // 2. Ping-Pong Step
      simMaterial.uniforms.uPrevState.value = simRT0.texture;
      const prevRT = renderer.getRenderTarget();
      renderer.setRenderTarget(simRT1);
      renderer.render(simScene, simCamera);
      renderer.setRenderTarget(prevRT);

      // Swap targets
      const tmp = simRT0;
      simRT0 = simRT1;
      simRT1 = tmp;
  }
  return {
    worldToUv,addImpulseWorld,addImpulseUv,
    pulse(x,z,strength=.15){if(!disposed && strength>0)addImpulseWorld(x,z,.11,-strength);},
    getTexture(){return simRT0.texture;},
    getTarget(){return simRT0;},
    update(delta){
      if(disposed||!Number.isFinite(delta)||delta<=0)return;
      accumulator+=Math.min(delta,.1);
      while(accumulator>=1/60){step();accumulator-=1/60;}
    },
    dispose() {
      if(disposed)return;
      disposed=true;
      impulseQueue.length=0;
      simRT0.dispose();
      simRT1.dispose();
      quad.geometry.dispose();
      simMaterial.dispose();
    }
  };
}
