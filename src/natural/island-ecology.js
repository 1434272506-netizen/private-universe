import { Group, Raycaster } from 'three';
import { makeCreekEcology } from './creek-ecology.js';
import { makeKoi } from './koi.js';
import { makeWildlife } from './ecology-wildlife.js';
import { makeWetland } from './ecology-wetland.js';
import { makeFrogs } from './ecology-frogs.js';
import { makeRiverbed, bedSampler } from './ecology-riverbed.js';
import { makeAquaticFauna } from './ecology-aquatic-fauna.js';

/** World-space point/ray for picking. Simulation time and delta are in seconds. */
export function makeIslandEcology(scene, island, {
  creekRipples, seasons, reducedMotion = false, camera = scene.getObjectByProperty('isCamera', true),
  creekEcology, koi,
} = {}) {
  const root = new Group();
  root.name = 'island-ecology';
  island.add(root);
  const still = typeof reducedMotion === 'function' ? reducedMotion : () => reducedMotion;
  const wildlife = makeWildlife(root, island, {camera, creekRipples, reducedMotion: still(), snowHeight: seasons?.getSnowHeight});
  const wetland = makeWetland(root, island, creekRipples);
  const frogs = makeFrogs(root,island,creekRipples), bed=bedSampler(island);
  const riverbed=makeRiverbed(root,island,bed), fauna=makeAquaticFauna(root,island,bed);
  const actors = [...frogs.targets,root.getObjectByName('meadow-white-bunny'),root.getObjectByName('wading-egret')];
  const picker = new Raycaster();
  const school = creekEcology ?? makeCreekEcology(island, {creekRipples, reducedMotion: still});
  const couple = koi ?? makeKoi(island, creekRipples);
  const casters = [];
  root.traverse(object => { if (object.isMesh && object.castShadow) casters.push(object); });
  const shadowTransforms = new Float64Array(casters.length * 16);
  const shadowVisible = new Uint8Array(casters.length);
  let shadowDelay = 0;
  const readSeason = () => seasons?.getSeason() ?? 'spring';
  let winter = Number(readSeason() === 'winter'), start = winter, target = winter;
  let progress = 1, clock = 0, disposed = false;

  function update(delta, time) {
    if (disposed || !Number.isFinite(delta) || delta < 0) return false;
    const season = readSeason(), next = Number(season === 'winter'), paused = still();
    if (target !== next) { start = winter; target = next; progress = 0; }
    const previous = winter;
    progress = Math.min(1, progress + delta / 3);
    winter = seasons?.getWinterWeight?.() ?? target + (start - target) * (1 - progress) ** 3;
    clock = Number.isFinite(time) ? time : clock + delta;
    wildlife.update(delta, clock, winter, paused);
    wetland.update(delta, clock, season, paused);
    frogs.update(delta,clock,season,paused);
    riverbed.update(delta,winter,paused);
    fauna.update(delta,winter,paused);
    if (!paused || previous !== winter || delta === 0) school.update(paused ? 0 : delta, clock, winter);
    couple.update(delta, {reducedMotion: paused, winterWeight: winter});
    // The host caches a large shadow map. Refresh only after a visible pose change,
    // at most six times a second, while rendering the animals at full frame rate.
    shadowDelay -= delta;
    if (shadowDelay > 0) return false;
    shadowDelay = 1 / 6;
    root.updateWorldMatrix(true, true);
    let changed = false;
    for (let i = 0; i < casters.length; i++) {
      const matrix = casters[i].matrixWorld.elements, offset = i * 16;
      let visible = true;
      for (let object=casters[i];object;object=object.parent) visible = visible && object.visible;
      if (shadowVisible[i] !== Number(visible)) changed = true;
      shadowVisible[i] = Number(visible);
      for (let j = 0; j < 16; j++) {
        if (Math.abs(matrix[j] - shadowTransforms[offset + j]) > .015) changed = true;
      }
    }
    if (changed) for (let i = 0; i < casters.length; i++) shadowTransforms.set(casters[i].matrixWorld.elements, i * 16);
    return changed;
  }

  function interact(point, ray) {
    if (disposed) return false;
    if (!ray) return frogs.interact(point) || wildlife.interact(point);
    picker.ray.copy(ray.ray || ray);
    picker.near = ray.near ?? 0;
    picker.far = Math.min(ray.far ?? Infinity,point ? picker.ray.origin.distanceTo(point)+.008 : Infinity);
    root.updateWorldMatrix(true,true);
    let actor=picker.intersectObjects(actors.filter(object=>object.visible),true)[0]?.object;
    while(actor && !actors.includes(actor)) actor=actor.parent;
    if(!actor)return false;
    return frogs.targets.includes(actor) ? frogs.interact(point,ray) : wildlife.interact(point,ray);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    root.removeFromParent();
    const resources = new Set();
    root.traverse(object => {
      if (object.geometry) resources.add(object.geometry);
      if (Array.isArray(object.material)) object.material.forEach(material => resources.add(material));
      else if (object.material) resources.add(object.material);
      if (object.isInstancedMesh) resources.add(object);
    });
    for (const resource of resources) resource.dispose();
    root.clear();
    if (creekEcology) school.update(0, clock, 0);
    else school.dispose();
    if (koi) couple.update(0, {winterWeight: 0});
    else couple.dispose();
  }

  update(0, 0);
  return {update, dispose, interact};
}
