import {CAMPFIRE_SITE, WATER_START, WATER_END, creekX, ground, waterY} from './land.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const fire = {...CAMPFIRE_SITE, y: ground(CAMPFIRE_SITE.x, CAMPFIRE_SITE.z) + .3};
const stream = Array.from({length: 49}, (_, i) => {
  const z = WATER_START + (WATER_END - WATER_START) * i / 48;
  return {x: creekX(z), y: waterY(z), z};
});
const distanceSquared = (a, b) => (a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2;

// The context and output belong to the garden mixer. Only nodes created here
// are stopped or disconnected here. No AudioContext is created on page load.
export function makeNatureSoundscape(audioContext, {
  seasons, camera, output = audioContext.destination, nightWeight = () => 1,
} = {}) {
  const ctx = audioContext, nodes = new Set(), sources = new Set(), voices = new Map();
  let muted = true, disposed = false, timer, nextBatch = 0, nextCroak = 0;
  let summerNight = 0;
  const targets = new Map();
  function own(node) { nodes.add(node); return node; }
  function gain(level, destination) {
    const node = own(ctx.createGain());
    node.gain.value = level;
    node.connect(destination);
    return node;
  }
  function filter(type, hz, q, destination) {
    const node = own(ctx.createBiquadFilter());
    node.type = type; node.frequency.value = hz; node.Q.value = q;
    node.connect(destination);
    return node;
  }
  function start(node, destination, offset = 0) {
    node.connect(destination); sources.add(node);
    if (node.buffer) node.start(0, offset); else node.start();
    return node;
  }
  function oscillator(hz, destination, type = 'sine') {
    const osc = own(ctx.createOscillator());
    osc.type = type; osc.frequency.value = hz;
    return start(osc, destination);
  }
  function modulate(param, hz, depth) { oscillator(hz, gain(depth, param)); }
  function follow(param, value, seconds = .32) {
    const last = targets.get(param);
    if (last !== undefined && Math.abs(last - value) < .0002) return;
    targets.set(param, value);
    // A season change can land in the same audio quantum as initialization.
    // Replace that target explicitly and carry the current level into the fade.
    const now = ctx.currentTime, level = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(level,now);
    param.setTargetAtTime(value,now,seconds);
  }

  const frames = Math.round(ctx.sampleRate * 2);
  const white = ctx.createBuffer(1, frames, ctx.sampleRate);
  const pink = ctx.createBuffer(1, frames, ctx.sampleRate);
  const w = white.getChannelData(0), p = pink.getChannelData(0);
  let low = 0, mid = 0, high = 0;
  for (let i = 0; i < frames; i++) {
    const sample = w[i] = Math.random() * 2 - 1;
    low = .99765 * low + sample * .099046;
    mid = .963 * mid + sample * .2965164;
    high = .57 * high + sample * 1.0526913;
    p[i] = (low + mid + high + sample * .1848) * .16;
  }
  function loop(buffer, into, offset = 0) {
    const source = own(ctx.createBufferSource());
    source.buffer = buffer; source.loop = true;
    return start(source, into, offset);
  }
  const master = gain(0, output);
  function layer() {
    const pan = ctx.createStereoPanner ? own(ctx.createStereoPanner()) : null;
    pan?.connect(master);
    return {level: gain(0, pan || master), pan};
  }
  const wind = layer(), hearth = layer(), creek = layer(), insects = layer();
  const howling = filter('bandpass', 550, 1.05, wind.level);
  modulate(howling.frequency, .057, 185);
  modulate(howling.frequency, .103, 60);
  modulate(howling.Q, .073, .42);
  loop(white, howling);
  loop(pink, filter('lowpass', 120, .68, hearth.level), .7);
  const snaps = filter('highpass', 890, .64, hearth.level);
  const water = filter('lowpass', 3400, .55, creek.level);
  for (const [hz, q, level, offset] of [[650,.68,.75,.43], [1280,.92,.46,.91], [2350,1.2,.16,1.44]]) {
    const band = filter('bandpass', hz, q, gain(level, water));
    modulate(band.frequency, .21 + offset * .19, hz * .12);
    loop(white, band, offset);
  }
  const trill = gain(.52, insects.level);
  modulate(trill.gain, 36, .44);
  const breath = gain(.5, trill);
  modulate(breath.gain, .62, .46);
  oscillator(3760, breath);
  oscillator(4010, gain(.26, breath));

  // Each one-second batch has 3–7 irregular attacks. Schedule on the audio
  // clock so a covered or slow WebGL frame cannot quantize the crackles.
  function voice(source, into, at, peak, attack, duration, offset) {
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(.00001, at);
    envelope.gain.exponentialRampToValueAtTime(peak, at + attack);
    envelope.gain.exponentialRampToValueAtTime(.00001, at + duration);
    source.connect(envelope); envelope.connect(into);
    voices.set(source, envelope);
    source.onended = () => {
      source.disconnect(); envelope.disconnect(); voices.delete(source);
    };
    if (offset === undefined) source.start(at); else source.start(at, offset);
    source.stop(at + duration + .005);
  }
  function schedule() {
    if (disposed || muted || ctx.state === 'closed') return;
    const now = ctx.currentTime;
    nextBatch = Math.max(nextBatch, now + .012);
    while (nextBatch < now + .55) {
      const count = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        const at = nextBatch + (i + Math.random() * .78) / count;
        const source = ctx.createBufferSource();
        source.buffer = white;
        source.playbackRate.value = .76 + Math.random() * .85;
        voice(source, snaps, at, .22 + Math.random() * .62, .0016, .012 + Math.random() * .047, Math.random() * 1.7);
      }
      nextBatch++;
    }
    if (summerNight > .04 && nextCroak < now + .55) {
      const at = Math.max(now + .03, nextCroak);
      const frog = ctx.createOscillator();
      frog.type = 'triangle';
      frog.frequency.setValueAtTime(275 + Math.random() * 55, at);
      frog.frequency.exponentialRampToValueAtTime(145, at + .17);
      voice(frog, insects.level, at, .57, .024, .21);
      nextCroak = at + 1.9 + Math.random() * 3.2;
    }
  }
  function update(cameraPosition = camera?.position, seasonName = seasons?.getSeason?.() || 'spring',
                  isBlizzard = seasons?.getBlizzard?.() || false) {
    if (disposed) return;
    const eye = cameraPosition || {x:0, y:2, z:7};
    let bank = stream[0], nearest = Infinity;
    for (const point of stream) {
      const distance = distanceSquared(eye,point);
      if (distance < nearest) { nearest = distance; bank = point; }
    }
    const cold = clamp(Math.max(Number(isBlizzard), seasons?.getDeepSnow?.() || 0, seasons?.getSnowAccumulation?.() || 0), 0, 1);
    summerNight = seasonName === 'summer' ? clamp(nightWeight(), 0, 1) : 0;
    camera?.updateWorldMatrix?.(true, false);
    const basis = camera?.matrixWorld?.elements;
    function spatial(layer, site, level, reach, floor) {
      const distance = Math.sqrt(distanceSquared(eye, site));
      follow(layer.level.gain, level * (floor + (1-floor)/(1+(distance/reach)**2)));
      if (layer.pan) {
        const lateral = (site.x-eye.x)*(basis?.[0] ?? 1) + (site.y-eye.y)*(basis?.[1] ?? 0) + (site.z-eye.z)*(basis?.[2] ?? 0);
        follow(layer.pan.pan, clamp(lateral/Math.max(2.5, distance), -.88, .88), .22);
      }
    }
    follow(wind.level.gain, (seasonName === 'winter' ? .21 : .085) + cold*.71);
    follow(howling.Q, 1.05 + cold*1.25, .58);
    spatial(hearth, fire, .52 + cold*.48, 5.2, .055);
    spatial(creek, bank, (seasonName === 'winter' ? .14 : .42)*(1-.65*cold), 5.7, .18);
    spatial(insects, bank, .048*summerNight, 10, .32);
  }
  function stopVoices() {
    for (const [source, envelope] of voices) {
      source.onended = null;
      source.stop(); source.disconnect(); envelope.disconnect();
    }
    voices.clear();
  }
  function setMuted(value) {
    if (disposed || muted === value) return;
    muted = value;
    follow(master.gain, muted ? 0 : 1, .045);
    clearInterval(timer);
    if (muted) stopVoices();
    else {
      nextBatch = ctx.currentTime + .016; nextCroak = nextBatch + .32;
      schedule(); timer = setInterval(schedule, 180);
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true; muted = true; clearInterval(timer); stopVoices();
    for (const source of sources) source.stop();
    for (const node of nodes) node.disconnect();
    sources.clear(); nodes.clear(); targets.clear();
  }
  update();
  return {update, setMuted, toggle() { setMuted(!muted); return !muted; }, get isMuted() { return muted; }, dispose};
}
