import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { creekX, ground, waterY } from './land.js';

const { clamp } = THREE.MathUtils;
const up = new THREE.Vector3(0, 1, 0);

function colored(geometry, hex) {
  const color = new THREE.Color(hex), values = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < values.length; i += 3) color.toArray(values, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return geometry;
}

function oval(x, y, z, color, at = [0, 0, 0]) {
  return colored(new THREE.SphereGeometry(1, 10, 7).scale(x, y, z).translate(...at), color);
}

function rod(a, b, radius, color) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), axis = to.clone().sub(from);
  const geometry = new THREE.CylinderGeometry(radius * .65, radius, axis.length(), 5);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, axis.normalize()));
  geometry.translate(...from.lerp(to, .5));
  return colored(geometry, color);
}

function join(parts) {
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geometry;
}

function frogGeometry() {
  const body = [
    oval(.066, .045, .081, '#22c55e', [0, .060, -.022]),
    oval(.066, .032, .058, '#22c55e', [0, .089, .040]),
    oval(.050, .024, .054, '#fef08a', [0, .032, .012]),
    oval(.056, .002, .022, '#427644', [0, .074, .085]),
  ];
  const eyes = [], leg = [oval(.029, .034, .055, '#22c55e', [.010, .009, -.013]),
    rod([.018, .006, -.045], [.040, -.019, -.010], .013, '#42c970'),
    rod([.040, -.019, -.010], [.024, -.035, .052], .008, '#4ade80')];
  for (const sign of [-1, 1]) {
    body.push(oval(.029, .026, .029, '#36cf65', [sign * .046, .115, .061]),
      rod([sign * .049, .060, .038], [sign * .067, .021, .069], .011, '#22c55e'));
    eyes.push(oval(.020, .022, .022, '#111f1b', [sign * .047, .120, .077]),
      oval(.006, .007, .005, '#fffde3', [sign * .047 - .006, .129, .095]));
    for (let toe = -1; toe <= 1; toe++) {
      body.push(rod([sign * .067, .019, .068], [sign * (.067 + toe * .009), .012, .093], .0035, '#86da77'));
    }
  }
  for (let toe = -1; toe <= 1; toe++) leg.push(rod([.024, -.035, .052], [.024 + toe * .013, -.036, .081], .0035, '#9de484'));
  for (let i = 0; i < 5; i++) body.push(oval(.007, .002, .013, '#149c50', [(i % 2 ? 1 : -1) * .027, .102 - i * .004, -.054 + i * .017]));
  return {body: join(body), eyes: join(eyes), leg: join(leg), throat: oval(.036, .018, .028, '#fef08a')};
}

/** The host owns every resource added to root. Construct after the wetland's lily pads. */
export function makeFrogs(root, island, creekRipples) {
  const geometry = frogGeometry();
  const skin = new THREE.MeshStandardMaterial({vertexColors:true, roughness:.39, flatShading:true});
  const glass = new THREE.MeshStandardMaterial({vertexColors:true, roughness:.10});
  const group = new THREE.Group(); group.name = 'pond-frogs'; root.add(group);
  const picker = new THREE.Raycaster(), matrix = new THREE.Matrix4();
  const point = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const worldDown = new THREE.Vector3(), hits = [];
  const water = island.getObjectByName('paddy-sky-mirrors');
  const bunds = island.getObjectByName('paddy-earthen-bunds');
  const pads = island.getObjectByName('backwater-lily-pads');

  function localMatrix(object) {
    root.updateWorldMatrix(true, false); object.updateWorldMatrix(true, false);
    return matrix.copy(root.matrixWorld).invert().multiply(object.matrixWorld);
  }

  function heightAt(object, x, z, fallback) {
    if (!object) return fallback;
    object.updateWorldMatrix(true, false);
    point.set(x, 10, z); root.localToWorld(point);
    worldDown.set(0, -1, 0).transformDirection(root.matrixWorld);
    picker.set(point, worldDown); picker.near = 0; picker.far = Infinity;
    hits.length = 0; picker.intersectObject(object, false, hits);
    return hits.length ? root.worldToLocal(hits[0].point).y : fallback;
  }

  function nearestBund() {
    const site = new THREE.Vector3(5.2, ground(5.2, -3.8), -3.8);
    if (!bunds) return site;
    localMatrix(bunds);
    const positions = bunds.geometry.attributes.position, uv = bunds.geometry.attributes.uv;
    let best = Infinity;
    for (let i = 0; i < positions.count; i++) {
      if (uv && uv.getY(i) < .80) continue;
      point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      const distance = (point.x - 5.2) ** 2 + (point.z + 3.8) ** 2;
      if (distance < best) { best = distance; site.copy(point); }
    }
    site.y += .004;
    return site;
  }

  function waterTarget(home, dx, dz) {
    const target = new THREE.Vector3(home.x + dx, waterY(home.z + dz), home.z + dz);
    if (!water) { target.x = creekX(target.z) + .08; return target; }
    localMatrix(water);
    const positions = water.geometry.attributes.position, index = water.geometry.index;
    let best = Infinity;
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(positions, index.getX(i)).applyMatrix4(matrix);
      b.fromBufferAttribute(positions, index.getX(i + 1)).applyMatrix4(matrix);
      c.fromBufferAttribute(positions, index.getX(i + 2)).applyMatrix4(matrix);
      point.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      const distance = (point.x - home.x) ** 2 + (point.z - home.z) ** 2;
      if (distance < .045 || distance > 1) continue;
      const score = (point.x - home.x - dx) ** 2 + (point.z - home.z - dz) ** 2;
      if (score < best) { best = score; target.copy(point); }
    }
    return target;
  }

  const bundHome = nearestBund();
  const creekHome = new THREE.Vector3(1.8, ground(1.8, .8), .8);
  const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({color:'#89958a',roughness:.58,flatShading:true}));
  stone.name = 'frog-creek-perch-stone'; stone.scale.set(.155, .061, .125);
  stone.position.copy(creekHome); stone.position.y += .037; stone.receiveShadow = true; root.add(stone);
  creekHome.y = heightAt(stone, creekHome.x, creekHome.z, creekHome.y + .10) + .003;
  const lilyHome = new THREE.Vector3(7.578, 0, -3.132);
  lilyHome.y = heightAt(water, lilyHome.x, lilyHome.z, waterY(3.37)) + .015;
  if (!pads && !water) lilyHome.set(creekX(3.37) + .21, waterY(3.37) + .012, 3.37);
  const homes = [bundHome, creekHome, lilyHome];
  const destinations = [waterTarget(bundHome, -.30, .26),
    new THREE.Vector3(creekX(.91) + .09, waterY(.91), .91), waterTarget(lilyHome, -.17, .20)];
  const ringGeometry = new THREE.RingGeometry(.91, 1, 36).rotateX(-Math.PI / 2);
  const frogs = homes.map((home, i) => {
    const frog = new THREE.Group(), pose = new THREE.Group(); frog.add(pose); group.add(frog);
    frog.name = ['paddy-pond-frog', 'creek-pond-frog', 'lily-pond-frog'][i];
    frog.scale.setScalar(i === 2 ? .57 : 1.24); frog.rotation.y = [-.55, -1.8, -.85][i];
    const body = new THREE.Mesh(geometry.body, skin), eyes = new THREE.Mesh(geometry.eyes, glass);
    const throat = new THREE.Mesh(geometry.throat, skin); throat.name = 'frog-vocal-sac'; throat.position.set(0, .061, .071);
    pose.add(body, eyes, throat);
    const legs = [-1, 1].map(sign => {
      const leg = new THREE.Mesh(geometry.leg, skin);
      leg.position.set(sign * .056, .048, -.025); leg.scale.x = sign; pose.add(leg); return leg;
    });
    pose.traverse(object => { if (object.isMesh) object.castShadow = object.receiveShadow = true; });
    const rings = [0, 1, 2].map(() => {
      const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({color:'#d5f4e6',transparent:true,
        opacity:0,depthWrite:false,side:THREE.DoubleSide}));
      ring.name = 'frog-splash-ring'; ring.visible = false; ring.renderOrder = 3; root.add(ring); return ring;
    });
    frog.position.copy(home); frog.userData.phase = 'rest';
    return {frog,pose,throat,legs,rings,home,target:destinations[i],start:home.clone(),age:Infinity,
      wet:false,ringAge:Infinity,yaw:frog.rotation.y,index:i};
  });
  let winter = 0, dormant = false;
  const targets = frogs.map(f => f.frog);

  function splash(f) {
    if (creekRipples?.pulse) creekRipples.pulse(f.target.x, f.target.z, .22);
    else creekRipples?.addImpulseWorld?.(f.target.x, f.target.z, .16, -.22);
    f.ringAge = 0;
    for (const ring of f.rings) ring.position.set(f.target.x, f.target.y + .009, f.target.z);
  }

  function update(delta, time, season, still = false) {
    if (!Number.isFinite(delta) || delta < 0) return;
    dormant = season === 'winter';
    winter += (Number(dormant) - winter) * (1 - Math.exp(-delta * 2.8));
    if (pads) {
      pads.getMatrixAt(2, matrix);
      point.set(0, .05, 0).applyMatrix4(matrix);
      pads.localToWorld(point); root.worldToLocal(point); frogs[2].home.copy(point);
    }
    for (const f of frogs) {
      f.age += delta; f.ringAge += delta;
      const outbound = still ? .40 : .76, hiddenUntil = outbound + 1.6, finish = hiddenUntil + outbound;
      if (dormant) { f.age = Infinity; f.wet = false; f.ringAge = Infinity; }
      if (Number.isFinite(f.age) && f.age >= outbound && !f.wet) { splash(f); f.wet = true; }
      f.frog.visible = winter < .995;
      let air = 0, flight = false;
      if (f.age < outbound) {
        const u = clamp((f.age / outbound - .12) / .88, 0, 1); air = 4 * u * (1 - u); flight = true;
        f.frog.position.lerpVectors(f.start, f.target, u);
        f.frog.position.y += air * (still ? .08 : .34);
        f.frog.rotation.y = Math.atan2(f.target.x - f.start.x, f.target.z - f.start.z);
        f.frog.userData.phase = 'jump';
      } else if (f.age < hiddenUntil) {
        f.frog.position.copy(f.target); f.frog.position.y -= Math.min(.16, (f.age - outbound) * .65);
        f.frog.visible = f.age - outbound < .26;
        f.frog.userData.phase = 'submerged';
      } else if (f.age < finish) {
        const u = (f.age - hiddenUntil) / outbound; air = 4 * u * (1 - u); flight = true;
        f.frog.position.lerpVectors(f.target, f.home, u); f.frog.position.y += air * (still ? .08 : .29);
        f.frog.rotation.y = Math.atan2(f.home.x - f.target.x, f.home.z - f.target.z);
        f.frog.userData.phase = 'return';
      } else {
        f.frog.position.copy(f.home); f.frog.rotation.y = f.yaw; f.age = Infinity;
        f.frog.userData.phase = dormant ? 'dormant' : 'rest';
      }
      f.frog.position.y -= winter * .16;
      const activity = still ? 0 : (season === 'summer' ? 1 : .38) * (1 - winter);
      const croak = activity * Math.max(0, Math.sin(time * 2.5 + f.index * 1.8)) ** 3;
      f.throat.scale.y = 1 + .4 * croak * Number(!flight);
      f.throat.scale.x = f.throat.scale.z = 1 + .10 * croak * Number(!flight);
      const load = flight && f.age < outbound * .12 ? Math.sin(f.age / (outbound * .12) * Math.PI) : 0;
      f.pose.scale.set(1 + .08 * load, 1 - .18 * load + .09 * air, 1 + .12 * air);
      f.pose.rotation.x = flight ? -.23 * air : 0;
      for (const leg of f.legs) { leg.rotation.x = -.73 * air; leg.scale.z = 1 + .40 * air; }
      for (let i = 0; i < f.rings.length; i++) {
        const age = f.ringAge - i * .13, ring = f.rings[i];
        ring.visible = !dormant && !still && age >= 0 && age < .85;
        if (ring.visible) { ring.scale.setScalar(.025 + age * .22); ring.material.opacity = .48 * (1 - age / .85) ** 2; }
      }
    }
  }

  function interact(worldPoint, ray) {
    if (dormant || winter > .5) return false;
    let object;
    if (ray) {
      picker.ray.copy(ray.ray || ray); picker.near = ray.near ?? 0;
      picker.far = Math.min(ray.far ?? Infinity, worldPoint ? picker.ray.origin.distanceTo(worldPoint) + .008 : Infinity);
      group.updateWorldMatrix(true, true); hits.length = 0;
      picker.intersectObjects(targets.filter(target => target.visible), true, hits);
      object = hits[0]?.object;
      while (object && !targets.includes(object)) object = object.parent;
    } else if (worldPoint) {
      object = targets.find(target => {
        if (!target.visible) return false;
        point.copy(worldPoint); target.worldToLocal(point); point.y -= .07;
        return point.lengthSq() < .024;
      });
    }
    const f = frogs.find(candidate => candidate.frog === object);
    if (!f) return false;
    if (Number.isFinite(f.age)) return true;
    f.start.copy(f.frog.position); f.age = 0; f.wet = false;
    f.frog.userData.phase = 'jump';
    return true;
  }
  update(0, 0, 'spring', false);
  return {update, interact, targets};
}
