import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { creekX, ground, waterY } from './land.js';
import { rng } from './shared.js';

const TAU = Math.PI * 2;
const up = new THREE.Vector3(0, 1, 0);
const vec = (x, y, z) => new THREE.Vector3(x, y, z);

function paint(geometry, hex) {
  const {r, g, b} = new THREE.Color(hex);
  const count = geometry.attributes.position.count, colors = new Float32Array(count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = r; colors[i + 1] = g; colors[i + 2] = b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function join(parts) {
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geometry;
}

function oval(x, y, z, color) {
  return paint(new THREE.SphereGeometry(1, 8, 5).scale(x, y, z), color);
}

function stem(a, b, base, tip, color, sides = 5) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const shape = new THREE.CylinderGeometry(tip, base, direction.length(), sides, 1, true);
  return paint(shape.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()))
    .translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), color);
}

function padGeometry() {
  const leaf = paint(new THREE.CircleGeometry(1, 25, .24, TAU - .48).rotateX(-Math.PI / 2), '#46845d');
  const positions = leaf.attributes.position, parts = [leaf];
  positions.setY(0, .025);
  for (let i = 1; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    positions.setY(i, .033 + .025 * Math.sin(4 * Math.atan2(z, x)));
    if (i % 3 === 1) parts.push(stem(vec(0, .036, 0), vec(x * .84, positions.getY(i) + .011, z * .84), .013, .003, '#85aa70', 3));
  }
  leaf.computeVertexNormals();
  return join(parts);
}

function flowerGeometry() {
  const parts = [oval(.027, .019, .027, '#ffc966').translate(0, .027, 0)];
  for (let row = 0; row < 2; row++) {
    const count = row ? 7 : 9;
    for (let i = 0; i < count; i++) {
      parts.push(oval(row ? .014 : .018, .009, row ? .032 : .048, row ? '#fff4ed' : '#f4b4c7')
        .rotateX(row ? -.86 : -.41).translate(0, row ? .026 : .018, row ? .024 : .037)
        .rotateY(TAU * i / count + row * .31));
    }
  }
  return join(parts);
}

function flyBody(color) {
  return join([
    stem(vec(0, 0, -.16), vec(0, 0, .016), .004, .012, color, 7),
    oval(.021, .019, .040, color).translate(0, 0, .030),
    oval(.021, .016, .018, '#444b45').translate(0, .003, .072),
    ...[-1, 1].map(side => oval(.012, .012, .011, '#78aa96').translate(side * .016, .006, .073)),
  ]);
}

function flyWings() {
  const parts = [];
  for (let pair = 0; pair < 2; pair++) {
    const yaw = pair ? .35 : -.30, z = pair ? .015 : .041, span = pair ? .141 : .155;
    const leaf = oval(span * .52, .0022, pair ? .022 : .017, '#c9e8e0');
    parts.push(leaf.translate(span * .52, 0, 0).rotateY(yaw).translate(.008, .011, z));
    parts.push(stem(vec(.008, .014, z), vec(.008 + Math.cos(yaw) * span, .014, z - Math.sin(yaw) * span),
      .0018, .0006, '#729b92', 3));
  }
  return join(parts);
}

function parachute() {
  const hub = vec(0, .029, 0);
  const parts = [oval(.003, .010, .003, '#bba67c').translate(0, -.007, 0),
    stem(vec(0, 0, 0), hub, .0012, .0009, '#f4e9d0', 3)];
  for (let i = 0; i < 10; i++) {
    const a = TAU * i / 10, r = .024 + .003 * Math.sin(i * 7);
    const knuckle = vec(r * .74 * Math.cos(a), .044, r * .74 * Math.sin(a));
    parts.push(stem(hub, knuckle, .00135, .0009, '#fffaf0', 3));
    for (const spread of [-.09, .09]) {
      parts.push(stem(knuckle, vec(r * Math.cos(a + spread), .045, r * Math.sin(a + spread)),
        .0009, .00035, '#f9f8ff', 3));
    }
  }
  return join(parts);
}

function seedhead(seed) {
  const center = vec(.022, .37, 0), root = vec(0, 0, 0), parts = [
    stem(root, center, .0075, .004, '#578449'), oval(.018, .018, .018, '#e7debf').translate(...center),
  ];
  for (let j = 0; j < 7; j++) {
    parts.push(oval(.023, .008, .075, j % 2 ? '#4a8044' : '#73965a')
      .rotateX(-.22).translate(0, .02, .066).rotateY(j * 2.4));
  }
  for (let i = 0; i < 36; i++) {
    const y = 1 - 2 * (i + .5) / 36, r = Math.sqrt(1 - y * y), a = i * 2.399963;
    const dir = vec(r * Math.cos(a), y, r * Math.sin(a));
    const base = center.clone().addScaledVector(dir, .036);
    parts.push(seed.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir)).translate(...base));
  }
  return join(parts);
}

// The six pockets are between the last rice rows on the easternmost terrace.
// Read its actual built elevation once; isolated ecology previews use the creek.
function baySites(island) {
  const water = island.getObjectByName('paddy-sky-mirrors');
  if (water) {
    water.updateWorldMatrix(true, false);
    const top = island.localToWorld(vec(7.45, 8, -2.9)), below = island.localToWorld(vec(7.45, 0, -2.9));
    const hit = new THREE.Raycaster(top, below.sub(top).normalize()).intersectObject(water, false)[0];
    if (hit) {
      const level = island.worldToLocal(hit.point).y;
      return {level: () => level, sites: [[7.187,-2.796],[7.391,-3.272],[7.578,-3.132],
        [7.646,-2.880],[7.255,-3.006],[7.799,-3.244]], contacts: [[7.425,-2.866],[7.782,-3.034]]};
    }
  }
  const creek = (z, offset) => [creekX(z) + offset, z];
  return {level: waterY, sites: [creek(2.9,.24),creek(3.2,-.08),creek(3.37,.21),
    creek(3.62,.0),creek(3.81,.22),creek(4.04,-.14)], contacts: [creek(3.1,.10),creek(3.78,-.12)]};
}

export function makeWetland(root, island, creekRipples) {
  const random = rng(38127), pose = new THREE.Object3D(), bay = baySites(island);
  const lit = new THREE.MeshStandardMaterial({vertexColors:true, side:THREE.DoubleSide, roughness:.75});
  const wingMat = new THREE.MeshStandardMaterial({vertexColors:true, transparent:true, opacity:.60,
    roughness:.32, metalness:.12, depthWrite:false, side:THREE.DoubleSide, forceSinglePass:true});
  function batch(name, geometry, material, count) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name; root.add(mesh); return mesh;
  }
  const pads = batch('backwater-lily-pads', padGeometry(), lit, 6);
  const flowers = batch('backwater-lily-blossoms', flowerGeometry(), lit, 2);
  const wing = flyWings(), circle = new THREE.RingGeometry(.88, 1, 32).rotateX(-Math.PI / 2);
  const flies = ['#c84443', '#4b9fbf'].map((color, i) => {
    const fly = new THREE.Group(); fly.name = i ? 'blue-dragonfly' : 'scarlet-dragonfly'; root.add(fly);
    const body = new THREE.Mesh(flyBody(color), lit); fly.add(body); fly.rotation.order = 'YXZ';
    const wings = [-1, 1].map(sign => {
      const mesh = new THREE.Mesh(wing, wingMat); mesh.scale.x = sign; fly.add(mesh); return mesh;
    });
    const ring = new THREE.Mesh(circle, new THREE.MeshBasicMaterial({
      color:'#d3f3e6', transparent:true, depthWrite:false, opacity:0, side:THREE.DoubleSide,
    }));
    ring.name = 'dragonfly-contact-ripple'; ring.visible = false; ring.renderOrder = 3; root.add(ring);
    return {fly, wings, ring, age:2, touching:false};
  });
  const seed = parachute(), heads = batch('meadow-edge-dandelions', seedhead(seed), lit, 3);
  const seeds = batch('drifting-dandelion-parachutes', seed,
    new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, emissive:'#f8f3dc', emissiveIntensity:.14}), 48);
  const sources = [[4.05,-1.79],[4.68,-1.76],[4.38,-1.42]].map(([x,z],i) => {
    const s = .94 + .14 * i;
    pose.position.set(x, ground(x,z), z); pose.rotation.set(0, i * 1.8, 0); pose.scale.setScalar(s);
    pose.updateMatrix(); heads.setMatrixAt(i, pose.matrix);
    return vec(.022,.37,0).applyMatrix4(pose.matrix);
  });
  heads.computeBoundingSphere();
  const paths = Array.from({length:48}, (_,i) => ({
    origin:sources[i%3], phase:random(), duration:11+random()*9,
    width:3.2+random()*3, depth:1.8+random()*2, height:1.2+random()*1.6, size:.85+random()*.65,
  }));
  for (const mesh of [pads, flowers, seeds]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
  }
  let winter = 0, bloom = .4, seedTime = 0;
  function update(delta, time, season, reducedMotion) {
    const cold = season === 'winter', summer = season === 'summer', autumn = season === 'autumn';
    const follow = 1 - Math.exp(-delta * 3.5), t = reducedMotion ? 0 : time;
    winter += ((cold ? 1 : 0) - winter) * follow;
    bloom += ((summer ? 1 : autumn ? .28 : .50) - bloom) * follow;
    const wasAfloat = pads.visible;
    pads.visible = flowers.visible = winter < .99;
    if (pads.visible || wasAfloat) {
      let blossom = 0;
      for (let i = 0; i < 6; i++) {
        const [x,z] = bay.sites[i], r = .075 + .012 * (i % 3), y = bay.level(z) + .010 - .22 * winter;
        pose.position.set(x, y + Math.sin(t * .86 + i) * .002, z);
        pose.rotation.set(.014 * Math.sin(.65*t+i), 2.39*i+.02*Math.sin(.8*t+i), 0);
        pose.scale.set(r,r,r*.91); pose.updateMatrix(); pads.setMatrixAt(i,pose.matrix);
        if (i === 0 || i === 3) {
          pose.position.y += .010; pose.position.x += .018;
          pose.scale.set(.38+.62*bloom, 1.23-.23*bloom, .38+.62*bloom);
          pose.updateMatrix(); flowers.setMatrixAt(blossom++,pose.matrix);
        }
      }
      pads.instanceMatrix.needsUpdate = flowers.instanceMatrix.needsUpdate = true;
    }
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i], [cx,cz] = bay.contacts[i], active = !cold && !reducedMotion;
      f.fly.visible = !cold;
      if (cold) {
        f.touching = false; f.ring.visible = false; f.age = 2;
        continue;
      }
      const cycle = t / (i ? 5.9 : 6.8) + .43 * i, phase = cycle - Math.floor(cycle);
      const distance = Math.abs(phase - .58);
      const dip = summer && active ? 1 - THREE.MathUtils.smoothstep(distance,.025,.145) : 0;
      const yaw = .75 + .64 * Math.sin(.65*t+i*2), pitch = -.07-.82*dip;
      const tx = cx + (.14*Math.cos(t*.84+i)+.06*Math.sin(t*1.3))*(1-dip);
      const tz = cz + .17*Math.sin(t*.77+i*2)*(1-dip);
      const clearance = (.30+.05*Math.sin(t*1.9+i))*(1-dip), level = bay.level(tz);
      // Local tail end is (0,0,-.16). Anchor that point to the surface at full dip.
      f.fly.position.set(tx+.16*Math.sin(yaw)*Math.cos(pitch), level+clearance-.16*Math.sin(pitch),
        tz+.16*Math.cos(yaw)*Math.cos(pitch));
      f.fly.rotation.set(pitch, yaw, 0);
      const beat = active ? Math.sin(time*42+i)*.48 : 0;
      f.wings[0].rotation.z = -.12-beat; f.wings[1].rotation.z = .12+beat;
      f.age += delta;
      const touching = dip === 1;
      if (touching && !f.touching) {
        if (creekRipples?.pulse) creekRipples.pulse(tx,tz,.15);
        else creekRipples?.addImpulseWorld?.(tx,tz,.15,-.035);
        f.ring.position.set(tx,level+.008,tz); f.age = 0;
      }
      f.touching = touching;
      f.ring.visible = active && f.age < .83;
      if (f.ring.visible) {
        f.ring.scale.setScalar(.023+.102*f.age/.83);
        f.ring.material.opacity = .48*(1-f.age/.83)**2;
      }
    }
    seeds.visible = !cold && !reducedMotion;
    heads.visible = !cold;
    if (seeds.visible) {
      seedTime += delta * (autumn ? 1.12 : summer ? .80 : .64);
      for (let i = 0; i < paths.length; i++) {
        const p = paths[i], u = (p.phase + seedTime / p.duration) % 1, a = TAU*p.phase;
        const envelope = THREE.MathUtils.smoothstep(u,0,.09)*(1-THREE.MathUtils.smoothstep(u,.83,1));
        pose.position.set(p.origin.x+u*p.width+.26*u*Math.sin(t*1.1+a),
          p.origin.y+u*p.height+.14*u*Math.sin(t*.73+a), p.origin.z+u*p.depth+.34*u*Math.cos(t*.78+a));
        pose.rotation.set(.26*Math.sin(t+a), a+t*.55, -.27+.23*Math.cos(t*.86+a));
        pose.scale.setScalar(p.size*envelope); pose.updateMatrix(); seeds.setMatrixAt(i,pose.matrix);
      }
      seeds.instanceMatrix.needsUpdate = true;
    }
  }
  update(0, 0, 'spring', false);
  return {update};
}
