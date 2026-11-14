import * as THREE from 'three';
import {WATER_START,WATER_END} from './land.js';

const pitches = [523.25, 587.33, 659.25, 783.99, 880, 1046.50];
export function creekPitch(z) {
  const step = Math.floor((z - WATER_START) / (WATER_END - WATER_START) * 5);
  return pitches[THREE.MathUtils.clamp(step, 0, 5)];
}

function soundVoice(context, bus, frequency, volume) {
  const start = context.currentTime, end = start + 0.85;
  for (const [ratio, gain] of [[1, 0.18], [2.756, 0.026]]) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.frequency.value = frequency * ratio;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain * volume, start + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(envelope);
    envelope.connect(bus);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(end);
  }
}

export function makeCreekChimes(scene, audio) {
  const size = 48;
  const positions = new Float32Array(size * 3);
  const velocities = new Float32Array(size * 3);
  const life = new Float32Array(size);
  positions.fill(-1000);
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  const material = new THREE.PointsMaterial({color:0xffdc8c, size:0.026, transparent:true, depthWrite:false});
  const particles = new THREE.Points(geometry, material);
  particles.name = 'creek-chime-sparkles';
  particles.frustumCulled = false;
  particles.visible = false;
  scene.add(particles);
  let cursor = 0, lastHit = -Infinity;
  function strike(point, showSparkles) {
    const now = performance.now();
    if (now-lastHit < 65) return;
    lastHit = now;
    const frequency = creekPitch(point.z);
    void audio.chimeOutput().then(output => {
      if (output) soundVoice(output.context, output.bus, frequency, output.volume);
    }).catch(() => {}); // The visual ripple also works without an audio device.
    if (!showSparkles) return;
    const count = 3 + Math.floor(Math.random()*4);
    for (let i=0; i<count; i++) {
      const j = cursor++ % size;
      attribute.setXYZ(j, point.x, point.y+0.025, point.z);
      velocities.set([(Math.random()-.5)*.32,.22+Math.random()*.25,(Math.random()-.5)*.32],j*3);
      life[j] = .35 + Math.random()*.18;
    }
    particles.visible = true;
    attribute.needsUpdate = true;
  }
  function update(delta) {
    if (!particles.visible) return;
    particles.visible = false;
    for (let j=0; j<size; j++) {
      if (life[j]<=0) continue;
      life[j]-=delta;
      if (life[j]<=0) { attribute.setXYZ(j,-1000,-1000,-1000); continue; }
      particles.visible = true;
      const k=j*3;
      velocities[k+1]-=delta*.7;
      for (let axis=0;axis<3;axis++) positions[k+axis]+=delta*velocities[k+axis];
    }
    attribute.needsUpdate = true;
  }
  return {strike, update};
}
