import * as THREE from 'three';
import {fbm, noise, hash, mesh} from './shared.js';
import {material, rockMaterial} from './materials.js';

export const RX = 9.5, RZ = 5.35;
export const boundary = a => 1 + .075 * Math.sin(a * 3 + .4) + .058 * Math.cos(a * 5 - 1) + .025 * Math.sin(a * 9 + .7);
export const inside = (x, z, margin = 1) => Math.hypot(x / RX, z / RZ) < boundary(Math.atan2(z / RZ, x / RX)) * margin;
export const creekX = z => .15 + z * .73 + .65 * Math.sin(z * .82);
export const waterY = z => .20 - z * .018;
export const creekWidth = z => .43 + .08 * Math.sin(z * 1.4);

// Shared with roots, grass, furniture and water; keep their ground contacts exact.
export function ground(x, z) {
  const d = Math.abs(x - creekX(z)) / 1.2, w = creekWidth(z);
  const bank = THREE.MathUtils.smoothstep(d, w * .6, w + 1.05);
  const terrain = .45 + fbm(x * .45 + 10, z * .45) * .55 + .09 * Math.sin(x * .7 + z * .4);
  return THREE.MathUtils.lerp(waterY(z) - .19, terrain, bank) + .014 * noise(x * 13, z * 13);
}

let exitZ = 3;
while (inside(creekX(exitZ), exitZ, .999)) exitZ += .005;
export const WATER_END = exitZ;

/** The distant option shares the silhouette without paying for hero geometry. */
export function makeLand(scene, {detail = 'hero'} = {}) {
  const distant = detail === 'distant';
  const group = new THREE.Group();
  group.name = distant ? 'distant-island' : 'island';
  group.userData.detail = detail;
  scene.add(group);
  const segments = distant ? 48 : 224, rings = distant ? 14 : 86;
  const v = [], uv = [], colors = [], idx = [];
  const c = new THREE.Color();
  const meadow = new THREE.Color('#497344'), meadowLight = new THREE.Color('#7e9c64');
  const silt = new THREE.Color('#747b64'), loam = new THREE.Color('#7a6d50');

  for (let j = 0; j <= rings; j++) {
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2, r = j / rings, b = boundary(a);
      const x = Math.cos(a) * RX * b * r, z = Math.sin(a) * RZ * b * r;
      v.push(x, ground(x, z), z);
      uv.push(x * .31, z * .31);
      const f = fbm(x * .68 + 6, z * .68 - 2);
      const turf = fbm(x * 3.7 + 31, z * 3.7 - 17);
      const wet = 1 - THREE.MathUtils.smoothstep(Math.abs(x - creekX(z)), .55, 1.22);
      // The broken, soft soil patch belongs to the tree's root plate, not a disk.
      const rootDistance = Math.hypot((x + 4.1) / 1.8, (z + .6) / 1.45);
      const rootSoil = 1 - THREE.MathUtils.smoothstep(rootDistance + (fbm(x * 2, z * 2) - .5) * .42, .36, 1.16);
      c.copy(meadow).lerp(meadowLight, f * .79 + turf * .21);
      c.multiplyScalar(.87 + turf * .23);
      c.lerp(silt, wet * .77).lerp(loam, rootSoil * .60);
      colors.push(c.r, c.g, c.b);
    }
  }
  connectRings(idx, rings, segments);
  const topMat = material('earth');
  topMat.vertexColors = true;
  const top = mesh(group, geometry(v, uv, idx, colors), topMat);
  top.name = 'meadow-and-soil';

  // A turf cap sits over a single heavy, fractured mass. Broad irregular planes
  // replace concentric shelves; the meadow's edge and ground contacts stay put.
  const rv = [], ruv = [], rc = [], ri = [], levels = distant ? 24 : 88;
  const soil = new THREE.Color('#77664f'), drySoil = new THREE.Color('#a18b68');
  const limestone = new THREE.Color('#b9b7a7'), coolStone = new THREE.Color('#9baba7');
  const deepStone = new THREE.Color('#8e9386'), edgeColor = new THREE.Color();
  const faults = Array.from({length:13}, (_, index) => ({
    angle: index / 13 * Math.PI * 2 + (hash(index,31) - .5) * .30,
    width: .028 + hash(index,47) * .043,
    depth: .030 + hash(index,59) * .055,
    lean: (hash(index,71) - .5) * .26,
  }));
  for (let j = 0; j <= levels; j++) {
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2, t = j / levels;
      const ca = Math.cos(a), sa = Math.sin(a), b = boundary(a);
      const envelope = Math.sin(Math.PI * t);
      const weather = fbm(ca * 2.9 + 19, sa * 2.9 + t * 1.3);
      const smallErosion = fbm(ca * 8 + 23, sa * 8 + t * 6) - .5;
      let fracture = 0;
      for (const fault of faults) {
        const centre = fault.angle + fault.lean * t;
        const distance = Math.abs(Math.atan2(Math.sin(a - centre), Math.cos(a - centre)));
        fracture += Math.exp(-Math.pow(distance / fault.width,2)) * fault.depth;
      }
      // Broad piecewise mineral faces avoid spherical or corrugated rock.
      const sector = i / segments * 23, block = Math.floor(sector), fraction = sector - block;
      const blockA = hash(block % 23,83), blockB = hash((block + 1) % 23,83);
      const plane = THREE.MathUtils.lerp(blockA,blockB,fraction) - .5;
      const cutMask = THREE.MathUtils.smoothstep(t,.025,.12) * Math.pow(Math.max(0,1 - t),.35);
      const erosion = ((weather - .5) * .070 + plane * .067 + smallErosion * .022) * envelope;
      const taper = Math.pow(Math.max(0,1 - Math.pow(t,2.3)),.80);
      const radius = Math.max(0,taper + erosion - fracture * cutMask) * b;
      let x = ca * RX * radius - .83 * t * t;
      let z = sa * RZ * radius + .32 * t * t;
      let y = ground(ca * RX * b,sa * RZ * b) - t * 5.65;
      y += (.19 * Math.sin(a * 3 + .8) + plane * .29 + (weather - .5) * .21) * envelope;
      if (j === levels) { x = -.83; z = .32; y = -4.98; }
      rv.push(x, y, z);
      ruv.push(a * 1.1, t * 1.4);
      const rockReveal = THREE.MathUtils.smoothstep(t, .052, .13);
      c.copy(soil).lerp(drySoil, weather).lerp(limestone, rockReveal);
      c.lerp(coolStone,rockReveal * (1 - weather) * .30);
      c.lerp(deepStone,THREE.MathUtils.smoothstep(t,.55,.98) * .24);
      c.multiplyScalar(1 - Math.min(.28,fracture * 2.5) * cutMask);
      if (t < .025) {
        const edgeIndex = (rings * segments + i) * 3;
        edgeColor.setRGB(colors[edgeIndex],colors[edgeIndex + 1],colors[edgeIndex + 2]);
        c.lerp(edgeColor,1 - THREE.MathUtils.smoothstep(t,0,.025));
      }
      rc.push(c.r, c.g, c.b);
    }
  }
  connectRings(ri, levels, segments);
  const rock = mesh(group, geometry(rv, ruv, ri, rc), rockMaterial({distant}));
  rock.name = 'weathered-limestone-and-topsoil';
  if (distant) group.traverse(object => {
    if (object.isMesh) object.castShadow = object.receiveShadow = false;
  });
  return group;
}

function connectRings(indices, count, segments) {
  for (let j = 0; j < count; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * segments + i, b = j * segments + (i + 1) % segments;
      const c = (j + 1) * segments + i, d = (j + 1) * segments + (i + 1) % segments;
      indices.push(a, b, c, b, d, c);
    }
  }
}

function geometry(v, uv, idx, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
