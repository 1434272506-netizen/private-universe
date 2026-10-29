import * as THREE from 'three';
import {mesh, rng, fbm} from './shared.js';
import {material} from './materials.js';
import {creekX, waterY, creekWidth, WATER_END, ground, inside} from './land.js';

// Channel coordinates keep the current flowing towards +z while orbiting.
export function makeWater(parent, time) {
  let start = -4.8;
  while (!inside(creekX(start), start, .995)) start += .01;
  const positions = [], uvs = [], depths = [], indices = [], rows = 180, columns = 18;
  for (let j = 0; j <= rows; j++) {
    const z = start + (WATER_END - start) * j / rows;
    const halfWidth = creekWidth(z);
    for (let i = 0; i <= columns; i++) {
      const u = i / columns;
      const width = halfWidth * 2 + .045 * Math.sin(z * 13) + .02 * Math.cos(z * 27);
      const x = creekX(z) + (u - .5) * width;
      positions.push(x, waterY(z), z);
      depths.push(Math.max(0, waterY(z) - ground(x, z)));
      uvs.push(u, z);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const a = j * (columns + 1) + i, b = a + columns + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const creekGeometry = geometry(positions, uvs, indices);
  creekGeometry.setAttribute('waterDepth', new THREE.Float32BufferAttribute(depths, 1));
  const surface = mesh(parent, creekGeometry, currentMaterial(time));
  surface.name = 'creek-surface';
  surface.castShadow = false;
  surface.renderOrder = 2;

  // Shared geometry/material replaces hundreds of pebble draw calls.
  const random = rng(881), dummy = new THREE.Object3D(), colour = new THREE.Color();
  const pebbleMaterial = material('rock', '#b3c0b7');
  pebbleMaterial.roughness = .9;
  pebbleMaterial.bumpScale = .014;
  const pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), pebbleMaterial, 500);
  pebbles.name = 'creek-pebble-bed';
  let count = 0;
  for (let i = 0; i < 500; i++) {
    const z = start + random() * (WATER_END - start);
    const x = creekX(z) + (random() - .5) * 1.8;
    if (!inside(x, z, .99)) continue;
    const size = .018 + random() * .046;
    dummy.position.set(x, ground(x, z) + size * .24, z);
    dummy.rotation.set(random() * 2, random() * Math.PI * 2, random() * 2);
    dummy.scale.set(size * (1 + random() * .45), size * .46, size * (.85 + random() * .5));
    dummy.updateMatrix();
    pebbles.setMatrixAt(count, dummy.matrix);
    colour.setHSL(.12 + random() * .07, .025 + random() * .08, .37 + random() * .16);
    pebbles.setColorAt(count++, colour);
  }
  pebbles.count = count;
  pebbles.receiveShadow = true;
  pebbles.castShadow = false;
  parent.add(pebbles);

  const stepMaterial = material('rock', '#c2c3b5');
  stepMaterial.roughness = .82;
  stepMaterial.bumpScale = .017;
  for (let i = 0; i < 5; i++) {
    const z = -.25 - (i - 2) * .085;
    const x = creekX(-.25) + (i - 2) * .31;
    const stone = new THREE.SphereGeometry(1, 18, 10), p = stone.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const shape = .91 + .14 * fbm(p.getX(k) * 4 + i, p.getZ(k) * 4 + 5);
      p.setXYZ(k, p.getX(k) * shape * .135, p.getY(k) * .095, p.getZ(k) * shape * .23);
    }
    stone.computeVertexNormals();
    const step = mesh(parent, stone, stepMaterial, x, waterY(z) + .075, z);
    step.rotation.y = i * .83;
    step.name = `stepping-stone-${i + 1}`;
  }

  makeWaterfall(parent, time);
  return {pebbles: count, steppingStones: 5};
}

function currentMaterial(time) {
  const water = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', metalness: 0, roughness: .17, ior: 1.333,
    transparent: true, opacity: 1, envMapIntensity: 1.15,
    clearcoat: .38, clearcoatRoughness: .17,
    side: THREE.DoubleSide, depthWrite: false,
  });
  water.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float waterDepth;varying float vWaterDepth;varying vec2 vCurrentUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCurrentUv = uv;vWaterDepth=waterDepth;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
varying vec2 vCurrentUv;
varying float vWaterDepth;
float currentHeight(vec2 p) {
  float flow = p.y - uTime * .24;
  return .0060 * sin(flow * 15.0 + sin(p.x * 8.0 + flow * 2.0))
       + .0026 * sin(flow * 31.0 - p.x * 15.0 + uTime * .17)
       + .0017 * sin(p.x * 22.0 + flow * 7.0);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float edgeDistance = min(vCurrentUv.x, 1.0 - vCurrentUv.x);
float smallCurrent = sin(vCurrentUv.y * 17.0 - uTime * 3.2 + vCurrentUv.x * 9.0);
float bankFoam = (1.0 - smoothstep(.008, .065, edgeDistance))
               * smoothstep(.15, .98, .5 + .5 * smallCurrent) * .18;
float reflectiveThread = pow(.5 + .5 * sin(vCurrentUv.y * 12.0 - uTime * 2.1
  + sin(vCurrentUv.x * 11.0 + vCurrentUv.y * 2.0)), 12.0);
// Independently adapted from napali's water-column attenuation principle;
// the garden uses its actual shallow creek bed, in local scene units.
float normalView=max(abs(dot(normalize(vNormal),normalize(vViewPosition))),.28);
float opticalDepth=vWaterDepth/normalView;
float absorption=1.0-exp(-opticalDepth*3.6);
float deepening=1.0-exp(-vWaterDepth*6.0);
diffuseColor.rgb=mix(vec3(.31,.48,.40),vec3(.065,.24,.235),deepening);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.58,.72,.69),bankFoam*.5);
diffuseColor.rgb*=.98+.035*reflectiveThread;
// Three's physical material supplies Fresnel lighting; alpha only represents
// absorption through the water, with a small reflection floor at grazing angles.
float fresnel=.0204+.9796*pow(1.0-normalView,5.0);
diffuseColor.a=clamp(.08+absorption*.55+fresnel*.20,.08,.78)
  *smoothstep(.0,.024,vWaterDepth);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// Derivatives convert a world-scale height to a camera-independent normal.
float rippleHeight = currentHeight(vec2(vCurrentUv.x * 1.1, vCurrentUv.y));
vec3 currentDx = dFdx(-vViewPosition), currentDy = dFdy(-vViewPosition);
vec3 currentR1 = cross(currentDy, normal), currentR2 = cross(normal, currentDx);
float currentDet = dot(currentDx, currentR1);
vec3 currentGradient = sign(currentDet) *
  (dFdx(rippleHeight) * currentR1 + dFdy(rippleHeight) * currentR2);
normal = normalize(max(abs(currentDet), .0000001) * normal - currentGradient);`);
  };
  return water;
}

function makeWaterfall(parent, time) {
  const endX = creekX(WATER_END), endY = waterY(WATER_END);
  const drop = 3.95, initialWidth = creekWidth(WATER_END) * 2;
  for (let layer = 0; layer < 2; layer++) {
    const positions = [], uvs = [], indices = [], rows = 72, columns = 16;
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      const width = initialWidth * (1 - t * .24) * (layer ? .80 : 1);
      for (let i = 0; i <= columns; i++) {
        const u = i / columns;
        positions.push(
          endX + (u - .5) * width + .022 * Math.sin(t * 6)
            + (u - .5) * .025 * Math.sin(t * 19 + u * 7),
          endY - drop * t,
          WATER_END - .018 + Math.sqrt(t) * .48
            + .054 * Math.sin(u * Math.PI) + layer * .065,
        );
        uvs.push(u, t);
      }
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i, b = a + columns + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const curtainMaterial = new THREE.MeshPhysicalMaterial({
      color: layer ? '#c0d7d0' : '#83b0ac', roughness: layer ? .23 : .17,
      metalness: 0, ior: 1.333, clearcoat: .65, clearcoatRoughness: .17,
      transparent: true, opacity: layer ? .42 : .66,
      side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.45,
    });
    curtainMaterial.onBeforeCompile = shader => {
      shader.uniforms.uTime = time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vFallUv;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vFallUv = uv;
transformed.x += sin(uv.y * 17.0 - uTime * 1.6 + uv.x * 8.0)
               * .008 * smoothstep(.0, .3, uv.y);`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vFallUv;')
        .replace('#include <color_fragment>', `#include <color_fragment>
float fold = .5 + .5 * sin(vFallUv.x * 37.0
  + sin(vFallUv.y * 6.0 - uTime * 1.8) * 1.3);
diffuseColor.rgb *= .78 + .22 * fold;`)
        .replace('#include <alphatest_fragment>', `
float curtainEdge = smoothstep(.0, .065, vFallUv.x) * (1.0 - smoothstep(.935, 1.0, vFallUv.x));
float curtainEnd = 1.0 - smoothstep(.78, 1.0, vFallUv.y);
float curtainThreads = .84 + .16 * sin(vFallUv.x * 79.0
  + sin(vFallUv.y * 7.0 - uTime * 2.7) * 1.2);
diffuseColor.a *= curtainEdge * curtainEnd * curtainThreads;
#include <alphatest_fragment>`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
float fallHeight = .0055 * sin(vFallUv.x * 51.0 + sin(vFallUv.y * 9.0 - uTime * 3.0))
  + .0018 * sin(vFallUv.y * 35.0 - uTime * 5.2 + vFallUv.x * 11.0);
vec3 fallDx = dFdx(-vViewPosition), fallDy = dFdy(-vViewPosition);
vec3 fallR1 = cross(fallDy, normal), fallR2 = cross(normal, fallDx);
float fallDet = dot(fallDx, fallR1);
vec3 fallGradient = sign(fallDet) * (dFdx(fallHeight) * fallR1 + dFdy(fallHeight) * fallR2);
normal = normalize(max(abs(fallDet), .0000001) * normal - fallGradient);`);
    };
    const curtain = mesh(parent, geometry(positions, uvs, indices), curtainMaterial);
    curtain.name = layer ? 'waterfall-inner-curtain' : 'waterfall-outer-curtain';
    curtain.castShadow = false;
    curtain.receiveShadow = false;
    curtain.renderOrder = 3 + layer;
  }

  // A faint soft veil where the falling water disperses, without bright specks.
  const random = rng(905), positions = [], seeds = [];
  for (let i = 0; i < 22; i++) {
    positions.push(endX + (random() - .5) * .62, endY - 2.85 - random() * .72,
      WATER_END + .43 + (random() - .5) * .24);
    seeds.push(random());
  }
  const mistGeometry = new THREE.BufferGeometry();
  mistGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  mistGeometry.setAttribute('aMistSeed', new THREE.Float32BufferAttribute(seeds, 1));
  const mistMaterial = new THREE.PointsMaterial({
    color: '#d5dfd8', map: mistTexture(), size: .33, sizeAttenuation: true,
    transparent: true, opacity: .13, depthWrite: false,
  });
  mistMaterial.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aMistSeed;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed.x += sin(uTime * .31 + aMistSeed * 6.28318) * .06;
transformed.y += sin(uTime * .43 + aMistSeed * 6.28318) * .055;`);
  };
  const mist = new THREE.Points(mistGeometry, mistMaterial);
  mist.name = 'waterfall-soft-mist';
  mist.renderOrder = 5;
  parent.add(mist);
}

function mistTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,.65)');
  gradient.addColorStop(.45, 'rgba(255,255,255,.25)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function geometry(positions, uvs, indices) {
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  result.setIndex(indices);
  result.computeVertexNormals();
  return result;
}
