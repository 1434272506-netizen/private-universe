import * as THREE from 'three';
import { ground, RX, TREE_SITE } from './land.js';
import { rng } from './shared.js';

const PATTERNS = ['peony', 'willow', 'rings', 'chrysanthemum', 'heart'];
const PALETTE = ['#38ef7d', '#b983ff', '#ffcf7e', '#fffdf0'];
const [JADE, VIOLET, GOLD, IVORY] = PALETTE.map(hex => new THREE.Color(hex));
const TAU = 2 * Math.PI, RISE = 1.15, FLASH = .15, AFTERGLOW = 6.85;
// Artistic dimensions in island metres. Aspect and occluders never change a crown.
const CROWN_SCALE = 1.15;
const STAGE_DEPTH = 55;
const STREAMS = 128, PEARLS = 5, CLUSTERS = 32, CRACKLE = 16, INNER = 256;
const STARS = STREAMS * (1 + PEARLS) + CLUSTERS * CRACKLE;
// West meadow, cabin lawn and east bluff, in terrain (x, z) order.
const PAD = [[-16, 2], [2, -8], [15, -4]];
const padVectors = () => PAD.map(() => new THREE.Vector3());
const clamp = THREE.MathUtils.clamp;

// The dome and the separate Milky Way ribbon both contribute galactic light.
// Give their highlights a soft shoulder behind the display before additive
// compositing. The effect follows world positions as the viewer orbits.
export function makeFireworkBackdropUniforms() {
  return {
    uFireworkAmount: { value: 0 },
    uFireworkBounds: { value: PAD.map(() => new THREE.Vector4()) }
  };
}
export const FIREWORK_BACKDROP = /* glsl */`
  uniform float uFireworkAmount;
  uniform vec4 uFireworkBounds[3]; // world centre and optical radius in metres
  vec3 exposeGalaxy(vec3 radiance, vec3 ray) {
    if (uFireworkAmount <= 0.) return radiance;
    float weight = 0.;
    for (int i = 0; i < 3; i++) {
      vec3 offset = uFireworkBounds[i].xyz-cameraPosition;
      float depth = dot(offset,ray);
      vec3 lateral = offset-ray*depth;
      float r = uFireworkBounds[i].w;
      weight = max(weight,step(0.,depth)*exp(-dot(lateral,lateral)/max(.01,r*r)));
    }
    float luminance = dot(radiance,vec3(.2126,.7152,.0722));
    return radiance / (1.+10.*uFireworkAmount*weight*luminance);
  }
`;

const RAIN_START = .8, OPEN_DRAG_XZ = .50, OPEN_DRAG_Y = .45, OPEN_GRAVITY = 2.5;
// A streamline and every bead/fragment it sheds sample this same analytical
// history. Horizontal drag and vertical drag need not match. Integrating the
// latter with gravity gives a smooth apex and a finite terminal velocity.
const FLIGHT = /* glsl */`
  attribute vec4 aLaunch;      // velocity and ignition delay
  attribute vec4 aAir;         // horizontal drag, vertical drag, gravity, seed
  attribute float aPad;
  uniform vec3 uOrigins[3];    // west, centre, east in scaled burst-local space
  attribute vec3 aTint;
  uniform float uAge;
  uniform float uHeartShow;
  uniform vec2 uViewport;     // physical framebuffer pixels, including composer scaling
  uniform float uDpr;
  float travel(float k, float t) { return (1. - exp(-k*t)) / k; }

  // Analytic curl of a 3D periodic vector potential. Two decorrelated
  // octaves bend neighbouring splinters together without white-noise jitter.
  vec3 curl(vec3 p) {
    vec3 c = cos(vec3(p.y + .55*p.z, p.z + .4*p.x, p.x + .6*p.y));
    return vec3(.6*c.z-c.y, .55*c.x-c.z, .4*c.y-c.x);
  }
  vec3 displacement(vec3 velocity, float t, vec3 air) {
    float h = travel(air.x,t), v = travel(air.y,t);
    return vec3(velocity.x*h, velocity.y*v-air.z/air.y*(t-v), velocity.z*h);
  }
  vec3 flightAt(float t) {
    // Integrate both phases exactly. The second starts with the position
    // AND velocity of the first, so the silk has no kink at 0.8 seconds.
    const vec3 opening = vec3(${OPEN_DRAG_XZ}, ${OPEN_DRAG_Y}, ${OPEN_GRAVITY});
    float first = min(t,${RAIN_START}), rest = max(0.,t-first);
    vec3 p = displacement(aLaunch.xyz,first,opening);
    vec3 momentum = aLaunch.xyz*exp(-first*opening.xyx);
    momentum.y -= opening.z*travel(opening.y,first);
    p += displacement(momentum,rest,aAir.xyz);
    vec3 field = p*.23 + vec3(.19*t, aAir.w, .13*t);
    p += (.40*curl(field) + .15*curl(field.zxy*2.06+vec3(3.2,1.6,4.1)))
       * smoothstep(.08,1.65,t);
    p.xz += vec2(.21,.09)*t*(1.-exp(-.7*t)); // drift in the falling curtain
    return uOrigins[int(aPad)]+p;
  }
`;

const OUTPUT = /* glsl */`
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

// A strip samples the recent trajectory at 19 times. Project adjacent samples
// BEFORE taking the perpendicular: foreshortening, aspect and DPR affect the
// real tangent. No wide GL lines, sprite size limits or camera-facing streak hacks.
const SILK_VERTEX = FLIGHT + /* glsl */`
  attribute vec4 aSilk;        // burn time, width in CSS pixels, persistence, brightness
  varying vec2 vStrip;
  varying vec3 vTint;
  varying float vFlux;
  vec3 residue(float t, float lag, float feather) {
    // Old sparks do not stay pinned to the head's flight path. A wake of
    // cooling dust settles in the breeze beside the brighter silk.
    return vec3(.28+.23*sin(3.6*t+aAir.w),-.15*lag,.18*cos(2.1*t+aAir.w))
         * lag * (1.+1.65*feather);
  }
  void main() {
    float age = max(0.,uAge-aLaunch.w);
    float tail = position.x;
    float history = aSilk.z * (.68 + .70*smoothstep(.55,2.85,age));
    float t = max(0.,age-tail*min(age,history));
    float lag = age-t, feather = position.z;
    vec4 c = projectionMatrix*modelViewMatrix*vec4(flightAt(t)+residue(t,lag,feather),1.);
    vec4 next = projectionMatrix*modelViewMatrix*vec4(flightAt(t+.022)+residue(t+.022,max(0.,lag-.022),feather),1.);
    vec2 tangent = (next.xy/next.w-c.xy/c.w)*uViewport;
    vec2 normal = vec2(-tangent.y,tangent.x)*inversesqrt(max(dot(tangent,tangent),.00001));
    float width = aSilk.y*mix(1.,.52,tail);
    c.xy += normal * position.y * (2.*width*uDpr/uViewport)*c.w;
    gl_Position = c;
    vStrip = vec2(tail,position.y);
    vTint = mix(aTint,vec3(1.,.61,.20),.65*tail*smoothstep(.6,3.6,age));
    float fade = 1.-smoothstep(aSilk.x*.66,aSilk.x,age);
    vFlux = aSilk.w * smoothstep(.055,.31,t) * fade
          * (.91+.09*sin(5.1*t+aAir.w)) * (1.-smoothstep(.43,1.,tail));
    if (aPad==1.) vFlux *= mix(1.,.26+.74*smoothstep(1.24,2.3,age),uHeartShow);
    if (feather>.5) {
      vTint = mix(vTint,vec3(1.,.61,.20),.66);
      vFlux *= .32*smoothstep(.1,.47,lag)*smoothstep(-.2,.55,sin(18.*t+aAir.w));
    }
  }
`;

const SILK_FRAGMENT = /* glsl */`
  varying vec2 vStrip; varying vec3 vTint; varying float vFlux;
  void main() {
    float s = vStrip.y*vStrip.y;
    float thread = exp(-10.*s), halo = exp(-3.9*s);
    vec3 light = mix(vTint,vec3(1.,.982,.872),.22*thread*(1.-vStrip.x));
    float a = vFlux*(.57*thread+.22*halo);
    if(a<.004) discard;
    gl_FragColor = vec4(light,a);
    ${OUTPUT}
  }
`;

const GEM_VERTEX = FLIGHT + /* glsl */`
  attribute vec4 aGem;        // role, time marker, lifetime, diameter in world units
  attribute vec3 aScatter;
  uniform float uStill;
  varying float vFacet;
  varying vec3 vTint;
  varying float vFlux;
  void main() {
    float age = uAge-aLaunch.w;
    float t = max(0.,age);
    float marker = aGem.y, role = aGem.x, life = aGem.z;
    float flux = smoothstep(.035,.25,t)*(1.-smoothstep(life*.61,life,t));
    vec3 p;
    if(role > 3.5) {
      // Position samples are equidistant along the heart, including its cusp.
      // In accessibility mode both position AND photometry are time-independent.
      p = position;
      if(uStill>.5) { flux = .82; }
      else {
        float open = smoothstep(.16,1.02,t);
        p *= mix(.48,1.,open);
        p.y -= .24*max(0.,t-1.);
        flux = open*(1.-smoothstep(2.9,4.55,t));
      }
      p += uOrigins[int(aPad)];
    } else if(role > 1.5 && role < 2.5) {
      // Every group of daughters is born AT its own parent's apex, never
      // at the origin. Parent velocity at separation is inherited.
      float dt = max(0.,age-marker);
      vec3 pivot = flightAt(marker);
      vec3 carry = (flightAt(marker+.025)-pivot)*40.;
      p = pivot + (aScatter+.47*carry)*travel(1.45,dt);
      p.y -= 1.22*dt*dt;
      flux = step(marker,age)*(.72+.28*exp(-12.*dt))*(1.-smoothstep(.16,life,dt));
    } else if(role > .5 && role < 1.5) {
      // Slowly falling crumbs of the same streamer, separated by dark gaps.
      float back = marker*(.52+.52*smoothstep(.7,2.7,t));
      p = flightAt(max(0.,t-back)) + aScatter*back;
      p.y -= .48*back*back;
      float pulse = .5+.5*cos(t*(6.8+marker*3.)+9.*aAir.w+marker*15.);
      flux *= smoothstep(back+.12,back+.37,t)*(.07+.85*smoothstep(.37,.92,pulse));
    } else {
      p = flightAt(t);
      flux *= role > 2.5 ? .49 : .88;
    }
    vec4 mv = modelViewMatrix*vec4(p,1.);
    gl_Position = projectionMatrix*mv;
    gl_PointSize = clamp(aGem.w*length(modelMatrix[0].xyz)*.5*uViewport.y*projectionMatrix[1][1] / max(1.,-mv.z),
                         2.15*uDpr,17.*uDpr);
    vTint = aTint;
    vFlux = flux;
    vFacet = step(3.5,role);
    if (role < 3.5 && aPad==1.) vFlux *= mix(1.,.26+.74*smoothstep(1.24,2.3,t),uHeartShow);
  }
`;

const GEM_FRAGMENT = /* glsl */`
  varying vec3 vTint; varying float vFlux;
  varying float vFacet;
  void main() {
    vec2 uv = gl_PointCoord*2.-1.;
    float r2 = dot(uv,uv);
    float core = exp(-15.*r2);
    float facet = exp(-18.*min(abs(uv.x),abs(uv.y))-3.*length(uv));
    float alpha = (.81*core+.19*exp(-4.2*r2)+.18*vFacet*facet)*(1.-smoothstep(.67,1.,r2))*vFlux;
    if(alpha<.003) discard;
    gl_FragColor = vec4(mix(vTint,vec3(1.,.982,.872),.25*core),alpha);
    ${OUTPUT}
  }
`;

// One short-lived optical bloom, not a full-screen exposure change.
const FLASH_VERTEX = /* glsl */`
  uniform float uAge;
  uniform vec3 uOrigins[3];
  attribute float aPad;
  varying vec2 vDisc;
  void main() {
    vDisc = position.xy*2.;
    vec4 eye = modelViewMatrix*vec4(uOrigins[int(aPad)],1.);
    eye.xy += vDisc*length(modelMatrix[0].xyz)*(.95+2.4*smoothstep(0.,.15,uAge));
    gl_Position = projectionMatrix*eye;
  }
`;
const FLASH_FRAGMENT = /* glsl */`
  uniform float uAge;
  varying vec2 vDisc;
  void main() {
    float d = dot(vDisc,vDisc), core = exp(-36.*d);
    float pulse = (1.-smoothstep(.012,.15,uAge))*(1.-smoothstep(.56,1.,d));
    float a = pulse*(.72*core+.28*exp(-5.8*d));
    if(a<.003) discard;
    gl_FragColor = vec4(mix(vec3(1.,.55,.16),vec3(1.,.982,.872),core),a);
    ${OUTPUT}
  }
`;

// Evaluate the curved, decelerating lift with different sample ages. Fine
// grains peel away from the bright comet and extinguish before reaching base.
const LIFT_VERTEX = /* glsl */`
  uniform vec3 uBases[3], uBends[3], uEnds[3]; // unscaled local metres
  uniform float uLift, uDpr;
  uniform vec2 uViewport;
  attribute vec3 aWisp;       // history, lateral offset, depth offset
  attribute float aPad;
  varying float vFacet;
  varying float vFlux;
  varying vec3 vTint;
  void main() {
    float lag = aWisp.x;
    float t = clamp(uLift-.32*lag,0.,1.);
    float s = 1.-pow(1.-t,1.24);
    int pad = int(aPad);
    vFacet = 0.;
    vec3 p = mix(mix(uBases[pad],uBends[pad],s),mix(uBends[pad],uEnds[pad],s),s);
    p.xz += lag*vec2(aWisp.y+.22*sin(12.*s+aWisp.y),aWisp.z);
    p.y -= lag*lag*.66;
    vec4 mv = modelViewMatrix*vec4(p,1.);
    gl_Position = projectionMatrix*mv;
    gl_PointSize = clamp(mix(.52,.21,lag)*.5*uViewport.y*projectionMatrix[1][1]/max(1.,-mv.z),
                         1.8*uDpr,14.*uDpr);
    vFlux = (1.-smoothstep(.0,1.,lag)) * smoothstep(0.,.035,t)
          * mix(.74,.38,step(.05,lag)) * (1.-smoothstep(.94,1.,uLift));
    vTint = mix(vec3(1.,.68,.28),vec3(.95,.32,.08),lag);
  }
`;

function attribute(array, size, instanced = false) {
  const Type = instanced ? THREE.InstancedBufferAttribute : THREE.BufferAttribute;
  return new Type(array, size).setUsage(THREE.DynamicDrawUsage);
}
function storage(geometry, layout, count, instanced = false) {
  for (const [name, size] of Object.entries(layout)) {
    geometry.setAttribute(name, attribute(new Float32Array(count*size), size, instanced));
  }
  return geometry.attributes;
}
function dirty(attributes) {
  for (const a of Object.values(attributes)) if (a.usage === THREE.DynamicDrawUsage) a.needsUpdate = true;
}
function silkGeometry() {
  const g = new THREE.InstancedBufferGeometry(), verts = [], ix = [];
  for (let feather = 0; feather <= 1; ++feather) {
    for (let i = 0; i <= 18; ++i) {
      const k=verts.length/3;
      verts.push(i/18,-1,feather, i/18,1,feather);
      if (i) ix.push(k-2,k-1,k, k,k-1,k+1);
    }
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3)); g.setIndex(ix);
  storage(g,{aLaunch:4,aAir:4,aPad:1,aTint:3,aSilk:4},STREAMS,true);
  g.instanceCount = STREAMS;
  return g;
}
function gemGeometry(count) {
  const g = new THREE.BufferGeometry();
  storage(g,{position:3,aLaunch:4,aAir:4,aPad:1,aTint:3,aGem:4,aScatter:3},count);
  return g;
}
function liftGeometry() {
  const samples = 76, g = new THREE.BufferGeometry(), wisps = [], pads = [], rand = rng(731);
  for (let pad=0; pad<PAD.length; ++pad) {
    for (let i=0; i<samples; ++i) {
      wisps.push(i/(samples-1),(rand()-.5)*1.1,(rand()-.5)*1.1);
      pads.push(pad);
    }
  }
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(wisps.length),3));
  g.setAttribute('aWisp',new THREE.Float32BufferAttribute(wisps,3));
  g.setAttribute('aPad',new THREE.Float32BufferAttribute(pads,1));
  return g;
}
function flashGeometry() {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([
    -.5,-.5,0, .5,-.5,0, .5,.5,0, -.5,.5,0
  ],3));
  g.setIndex([0,1,2,0,2,3]);
  g.setAttribute('aPad',new THREE.InstancedBufferAttribute(new Float32Array([0,1,2]),1));
  g.instanceCount=PAD.length;
  return g;
}

// Invert arc length once. Uniform angle would pile dozens of additive gems
// on the notch and tip of the double heart.
function heartCurve() {
  const pts = [], length = [0];
  for (let i = 0; i <= 512; i++) {
    const t = TAU*i/512;
    pts.push(new THREE.Vector2(Math.sin(t)**3,
      (13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t)+2)/16));
    if (i) length.push(length[i-1]+pts[i].distanceTo(pts[i-1]));
  }
  return u => {
    const d = u*length[512]; let lo = 0, hi = 512;
    while (hi-lo > 1) { const mid = (lo+hi)>>1; if (length[mid]<=d) lo=mid; else hi=mid; }
    return pts[lo].clone().lerp(pts[hi],(d-length[lo])/(length[hi]-length[lo]));
  };
}
const heartPoint = heartCurve();

// Form irregular families before splitting each family into individual stars.
// Rings are two oblique shells in the camera's launch-time basis; gravity in
// flightAt always remains vertical in world space.
function makeScore(pattern, serial, right, up, toward, silk, sky, inner, quiet) {
  const random = rng((serial + 1) * 0x79b9 + 997 * (PATTERNS.indexOf(pattern) + 1));
  const range = (low, high) => low + (high - low) * random();
  const inPlane = (x, y, z) => right.clone().multiplyScalar(x).addScaledVector(up, y).addScaledVector(toward, z);
  const willow = pattern === 'willow';
  const rings = pattern === 'rings';
  const chrysanthemum = pattern === 'chrysanthemum';
  const heart = pattern === 'heart';
  const zero = new THREE.Vector3();
  const diamond = new THREE.Color('#ffffff');
  const principal = [JADE, GOLD, VIOLET];
  const companion = ['#89f6cc', '#ffacbf', '#81d4e8'].map(hex => new THREE.Color(hex));
  const glint = [IVORY, diamond, GOLD];
  const counts = [38, STREAMS - 76, 38];
  const charges = [[], [], []];

  // The pad is inherited by every ribbon, pearl, daughter fragment and pistil.
  // It is an index into the three local burst origins shared by all layers.
  function writeFlight(attrs, index, charge, tint) {
    const { velocity, delay, drag, liftDrag, gravity, seed, pad } = charge;
    attrs.aPad.setX(index, pad);
    attrs.aLaunch.setXYZW(index, velocity.x, velocity.y, velocity.z, delay);
    attrs.aAir.setXYZW(index, drag, liftDrag, gravity, seed);
    attrs.aTint.setXYZ(index, tint.r, tint.g, tint.b);
  }

  function writeGem(attrs, index, charge, role, marker, life, size, tint, scatter = zero, pos = zero) {
    writeFlight(attrs, index, charge, tint);
    attrs.position.setXYZ(index, pos.x, pos.y, pos.z);
    attrs.aScatter.setXYZ(index, scatter.x, scatter.y, scatter.z);
    attrs.aGem.setXYZW(index, role, marker, life, size);
  }

  // The first 0.8 seconds use kv=.45 and g=2.5. Beyond that seam the
  // damped Y velocity is continuous. Solve v(t)=0 in the appropriate interval
  // so each crackle opens where its own parent actually starts to fall.
  function apexTime({ velocity, liftDrag, gravity }) {
    const terminalSpeed = OPEN_GRAVITY / OPEN_DRAG_Y;
    const initialApex = Math.log1p(velocity.y / terminalSpeed) / OPEN_DRAG_Y;
    if (initialApex <= RAIN_START) return initialApex;
    const seamVelocity = (velocity.y + terminalSpeed) * Math.exp(-OPEN_DRAG_Y * RAIN_START) - terminalSpeed;
    return RAIN_START + Math.log1p(seamVelocity * liftDrag / gravity) / liftDrag;
  }

  let headIndex = 0;
  for (let pad = 0; pad < counts.length; pad++) {
    const count = counts[pad];
    const centre = pad === 1;
    const familyCount = Math.round(count * (chrysanthemum ? .49 : .32));
    const rotation = random() * TAU;
    const families = Array.from({ length: familyCount }, (_, i) => ({
      angle: rotation + TAU * (i + range(-.31, .31)) / familyCount,
      depth: range(-.83, .83), push: range(.76, 1.17),
      hue: random(), delay: range(0, .10), seed: range(0, 21)
    }));

    for (let local = 0; local < count; local++, headIndex++) {
      const family = families[local % familyCount];
      const jitter = chrysanthemum ? .083 : .19;
      const angle = family.angle + range(-jitter, jitter);
      let velocity;
      let tint;
      if (rings) {
        // Each pad has two complete tilted rings, with one sample from each
        // at every azimuth. Cropping thirds of a single ring would leave arcs.
        const outer = local % 2 === 0;
        const theta = rotation + TAU * (Math.floor(local / 2) + range(-.09, .09)) / (count / 2);
        const radius = (outer ? 8.9 : 5.7) * range(.98, 1.02);
        const x = Math.cos(theta) * radius;
        const y = Math.sin(theta) * radius * (outer ? .79 : .72);
        const tilt = outer ? .26 : -.46;
        velocity = inPlane(x * Math.cos(tilt) - y * Math.sin(tilt),
          x * Math.sin(tilt) + y * Math.cos(tilt), Math.sin(theta) * radius * (outer ? .54 : -.61));
        tint = (outer ? principal[pad] : companion[pad]).clone().lerp(glint[pad], range(.02, .13));
      } else {
        if (willow) {
          const radius = range(7.6, 10.2) * family.push;
          velocity = new THREE.Vector3(Math.cos(angle) * radius, range(4.3, 11.5) - .22 * radius,
            Math.sin(angle) * radius);
        } else {
          // Broad uneven peony lobes; two shorter, narrower whorls in the chrysanthemum.
          const shortPetal = chrysanthemum && (local % familyCount) % 2 === 0;
          const speed = range(8.1, 10.5) * family.push * (shortPetal ? .67 : 1);
          const depth = family.depth + range(-.12, .12);
          const spread = Math.sqrt(Math.max(.22, 1 - depth * depth));
          velocity = inPlane(Math.cos(angle) * speed * spread,
            Math.sin(angle) * speed * spread * .64 + 1.9, depth * speed);
        }
        tint = (family.hue < .74 ? principal[pad] : companion[pad]).clone();
        if (willow) tint.lerp(GOLD, centre ? .82 : .43);
        tint.lerp(glint[pad], family.hue > .95 ? range(.42, .62) : range(.015, .10));
      }


      const charge = {
        pad, velocity, tint,
        seed: family.seed + range(-.34, .34), delay: family.delay + range(0, .07),
        drag: rings ? .70 : range(.65, .80), liftDrag: rings ? .59 : range(.55, .70),
        gravity: rings ? 2.85 : range(2.55, 3.05),
        life: willow ? range(5.95, 6.50) : range(4.80, 5.85)
      };
      charges[pad].push(charge);
      writeFlight(silk, headIndex, charge, tint);
      const persistence = willow ? range(2.48, 3.02) : rings ? range(.46, .72) : range(1.53, 2.25);
      const brightness = heart && centre ? .62 : .97;
      silk.aSilk.setXYZW(headIndex, charge.life, range(1.45, 2.12), persistence, brightness * range(.72, .94));
      writeGem(sky, headIndex, charge, 0, 0, charge.life, range(.30, .46), tint);
      for (let j = 0; j < PEARLS; j++) {
        const lag = (j + range(.32, .82)) / PEARLS * (willow ? 2.45 : 1.64);
        const index = STREAMS + headIndex * PEARLS + j;
        const scatter = new THREE.Vector3(range(-.18,.18), range(-.17,.04), range(-.16,.16));
        writeGem(sky, index, charge, 1, lag, charge.life + range(-.24,.18), range(.21,.37),
          tint.clone().lerp(glint[pad],range(.08, .55)), scatter);
      }
    }
  }

  // Sample upward paths in each crown independently. A quiet wing still gets
  // its own secondary bloom, even if its neighbour has more high trajectories.
  const clusterCounts = [9, CLUSTERS - 18, 9];
  let fragmentIndex = STREAMS * (1 + PEARLS);
  for (let pad = 0; pad < charges.length; pad++) {
    const upward = charges[pad].filter(c => c.velocity.y > 1.15);
    const candidates = upward.length ? upward : charges[pad];
    for (let j = 0; j < clusterCounts[pad]; j++) {
      const charge = candidates[Math.floor((j + random()) * candidates.length / clusterCounts[pad])];
      const apex = charge.velocity.y > 0 ? apexTime(charge) : .18;
      for (let k = 0; k < CRACKLE; k++, fragmentIndex++) {
        const theta = random() * TAU, y = range(-1, 1), r = Math.sqrt(1 - y*y);
        const scatter = new THREE.Vector3(r*Math.cos(theta), y, r*Math.sin(theta)).multiplyScalar(range(.85, 2.55));
        const tint = GOLD.clone().lerp(glint[pad], range(.13, .39));
        writeGem(sky, fragmentIndex, charge, 2, apex + range(-.04,.07), range(.42,.86), range(.22,.39), tint, scatter);
      }
    }
  }

  for (let i = 0; i < INNER; i++) {
    if (heart) {
      // All 256 facets belong to the zenith. The same two outlines can be
      // displayed without motion while both side wings are completely dark.
      const outer = i < 144;
      const j = outer ? i : i - 144;
      const curve = heartPoint((j + .3 * random()) / (outer ? 144 : 112));
      const radius = outer ? 5.15 : 3.56;
      const charge = charges[1][i % counts[1]];
      const outline = quiet ? (outer ? JADE : VIOLET) : (outer ? companion[1] : GOLD);
      const tint = outline.clone().lerp(diamond, quiet ? range(.02,.12) : range(.28,.60));
      writeGem(inner, i, charge, 4, 0, 4.55, range(.35,.47), tint, zero, inPlane(radius*curve.x, radius*curve.y, 0));
    } else {
      // Concentrate the pistil in the central flower; its smaller neighbours
      // retain their jade and violet hues as the champagne pearls burn out.
      const pad = i < 48 ? 0 : i < INNER - 48 ? 1 : 2;
      const local = pad === 0 ? i : pad === 1 ? i - 48 : i - (INNER - 48);
      const parent = charges[pad][local % counts[pad]];
      const radius = rings ? range(.94, 1.03) : range(.33, willow ? .77 : .66);
      const charge = { ...parent, velocity: parent.velocity.clone().multiplyScalar(radius),
        delay: parent.delay + range(.12,.33) };
      const tint = (pad === 1 ? GOLD : parent.tint).clone().lerp(glint[pad],range(.10,.38));
      writeGem(inner, i, charge, 3, 0, parent.life * range(.67,.89), range(.24,.40), tint);
    }
  }
  dirty(silk);
  dirty(sky);
  dirty(inner);
}

export function makeFireworks(scene, { sound = () => {} } = {}) {
  const group = new THREE.Group();
  group.name = 'couple-stardust-fireworks';
  group.visible = false;
  scene.add(group);

  let hemi = null;
  const backdrops = [];
  scene.traverse(object => {
    if (!hemi && object.isHemisphereLight) hemi = object;
    const sky = object.material?.uniforms;
    if (sky?.uFireworkBounds && sky.uFireworkAmount) backdrops.push(sky);
  });
  function exposeBackdrop(amount) {
    for (const sky of backdrops) sky.uFireworkAmount.value = amount;
  }
  // Atmosphere may replace the absolute intensity immediately before update().
  // Remove only our own still-present contribution, even on cancellation.
  let previousWrite = NaN, baseIntensity = 0, contribution = 0;
  function lightPulse(value) {
    if (!hemi || (!value && !contribution)) return;
    if (hemi.intensity !== previousWrite) baseIntensity = hemi.intensity;
    hemi.intensity = baseIntensity+value;
    previousWrite = hemi.intensity;
    contribution = value;
  }

  const uniforms = {
    uAge:{value:0}, uStill:{value:0}, uHeartShow:{value:0}, uLift:{value:0},
    uViewport:{value:new THREE.Vector2(1280,800)}, uDpr:{value:1},
    uBases:{value:padVectors()}, uBends:{value:padVectors()},
    uEnds:{value:padVectors()}, uOrigins:{value:padVectors()}
  };
  const viewport = new THREE.Vector4();
  function setViewport(renderer) {
    renderer.getCurrentViewport(viewport);
    uniforms.uViewport.value.set(Math.max(1,viewport.z),Math.max(1,viewport.w));
    uniforms.uDpr.value=renderer.getPixelRatio();
  }
  function layer(name, geometry, vertexShader, fragmentShader, points=false) {
    const material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,transparent:true,
      blending:THREE.AdditiveBlending,depthTest:true,depthWrite:false,
      side:points?THREE.FrontSide:THREE.DoubleSide,forceSinglePass:true});
    const obj=points?new THREE.Points(geometry,material):new THREE.Mesh(geometry,material);
    obj.name=name;
    obj.userData.gardenAtmosphere=true;
    obj.frustumCulled=false; // shader-generated positions are not the input bounds
    obj.visible=false;
    obj.onBeforeRender=setViewport;
    group.add(obj);
    return obj;
  }
  const silk=layer('couple-firework-brocade',silkGeometry(),SILK_VERTEX,SILK_FRAGMENT);
  const stars=layer('couple-firework-stardust',gemGeometry(STARS),GEM_VERTEX,GEM_FRAGMENT,true);
  const heart=layer('couple-firework-heart',gemGeometry(INNER),GEM_VERTEX,GEM_FRAGMENT,true);
  const flash=layer('couple-firework-core-flash',flashGeometry(),FLASH_VERTEX,FLASH_FRAGMENT);
  const comet=layer('couple-firework-golden-trail',liftGeometry(),LIFT_VERTEX,GEM_FRAGMENT,true);

  let phase='idle', age=0, launches=0, bursts=0, patternName='peony', disposed=false;
  const origins = uniforms.uOrigins.value;
  const centre = new THREE.Vector3(), eye = new THREE.Vector3(), forward = new THREE.Vector3();
  const right = new THREE.Vector3(), up = new THREE.Vector3(), toward = new THREE.Vector3();
  const orientation = new THREE.Quaternion(), undoYaw = new THREE.Quaternion();
  const cellCache = new WeakMap();
  const fallback = new THREE.Box3();
  const rootY = ground(TREE_SITE.x,TREE_SITE.z);
  fallback.min.set(TREE_SITE.x-10,rootY,TREE_SITE.z-9);
  fallback.max.set(TREE_SITE.x+10,rootY+16,TREE_SITE.z+9);

  // Small enclosing boxes follow the uneven crown better than a single
  // ellipsoid. Read the vertices only once per geometry revision. Project
  // the boxes afresh at launch so reparenting, scaling and late GLB loads work.
  function cellsFor(geometry) {
    const pos = geometry.getAttribute('position');
    const index=geometry.index, cached=cellCache.get(geometry);
    if (cached && cached.pos===pos && cached.version===pos.version &&
        cached.index===index && cached.indexVersion===index?.version) return cached.cells;
    const bounds=new THREE.Box3().setFromBufferAttribute(pos);
    const size=bounds.getSize(new THREE.Vector3());
    const buckets=new Map(), a=new THREE.Vector3(), b=a.clone(), c=a.clone();
    // Assign whole triangles, not just vertices: the faces between two cells
    // must also be inside the silhouette. Static GLB geometry is scanned once.
    for(let i=0,n=index?.count??pos.count;i+2<n;i+=3){
      a.fromBufferAttribute(pos,index?index.getX(i):i);
      b.fromBufferAttribute(pos,index?index.getX(i+1):i+1);
      c.fromBufferAttribute(pos,index?index.getX(i+2):i+2);
      const ix=Math.floor(((a.x+b.x+c.x)/3-bounds.min.x)*8/(size.x||1));
      const iz=Math.floor(((a.z+b.z+c.z)/3-bounds.min.z)*8/(size.z||1));
      const key=ix*10+iz;
      if(!buckets.has(key)) buckets.set(key,new THREE.Box3());
      buckets.get(key).expandByPoint(a).expandByPoint(b).expandByPoint(c);
    }
    const cells=[...buckets.values()];
    cellCache.set(geometry,{pos,version:pos.version,index,indexVersion:index?.version,cells});
    return cells;
  }

  function obstacles(camera) {
    const roofline = [], overall = new THREE.Box3();
    const view = new THREE.Matrix4();
    const corner = new THREE.Vector3(), worldBox = new THREE.Box3();
    const corners=Array.from({length:8},()=>new THREE.Vector3());
    function add(box, matrix) {
      overall.union(worldBox.copy(box).applyMatrix4(matrix));
      view.multiplyMatrices(camera.matrixWorldInverse,matrix);
      let left=Infinity, rightEdge=-Infinity, top=-Infinity;
      function project(v){
        corner.copy(v).applyMatrix4(camera.projectionMatrix);
        left=Math.min(left,corner.x); rightEdge=Math.max(rightEdge,corner.x); top=Math.max(top,corner.y);
      }
      for(let i=0;i<8;i++){
        const v=corners[i].set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).applyMatrix4(view);
        if(v.z<=-camera.near) project(v);
      }
      // Clip edges that cross the eye plane. An offscreen branch near the
      // camera must not masquerade as a wall covering the whole sky.
      for(let i=0;i<8;i++) for(const bit of [1,2,4]){
        if(i&bit) continue;
        const a=corners[i], b=corners[i|bit];
        if((a.z < -camera.near)!==(b.z < -camera.near))
          project(corner.lerpVectors(a,b,(-camera.near-a.z)/(b.z-a.z)));
      }
      if(left<=rightEdge) roofline.push([left,rightEdge,top]);
    }
    const tree = scene.getObjectByName('centerpiece-love-tree') || scene.getObjectByName('Leaves_ContinuousUmbrella');
    let crownReady=false;
    if (tree) {
      tree.updateWorldMatrix(true,true);
      tree.traverseVisible(mesh=>{
        if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
        if(mesh.userData.gardenFoliage || /leaves|foliage|canopy/i.test(mesh.name)) crownReady=true;
        for (const cell of cellsFor(mesh.geometry)) add(cell,mesh.matrixWorld);
      });
    }
    if (!crownReady) add(fallback,new THREE.Matrix4());
    // A close porch shot can be under the roof even with the tree behind us.
    const cabin = scene.getObjectByName('secret-haven-cabin');
    if (cabin && camera.getWorldPosition(corner).distanceTo(cabin.getWorldPosition(new THREE.Vector3()))<12) {
      // The building footprint includes the eaves; smoke is not an occluder.
      add(new THREE.Box3(new THREE.Vector3(-2.65,0,-2.2),new THREE.Vector3(2.65,4.8,3.6)),cabin.matrixWorld);
    }
    return {roofline,top:overall.max.y};
  }

  // A camera parked 70–200 m away for the island overview cannot put a
  // 55 m burst beyond the rear shore. Move the audience to the shore first.
  // Narrow screens borrow a wider lens to see the same full-size flowers.
  function viewingSeat(camera, focusDistance = 12) {
    camera.updateWorldMatrix(true, false);
    const position = camera.getWorldPosition(new THREE.Vector3());
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const radius = Math.hypot(position.x, position.z);
    const approaching = radius > 39;
    if (approaching) {
      const ratio = 35 / radius;
      position.set(position.x * ratio, clamp(position.y * ratio * .8, 7, 14), position.z * ratio);
    }
    const probe = camera.clone();
    probe.position.copy(position);
    camera.getWorldQuaternion(probe.quaternion);
    const horizontalHalfFrame = 27.5;
    const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const zoom = Math.min(camera.zoom, STAGE_DEPTH * verticalTangent * camera.aspect / horizontalHalfFrame,
      approaching ? verticalTangent / .35 : camera.zoom);
    probe.zoom = zoom;
    probe.updateProjectionMatrix();
    probe.updateWorldMatrix(true, false);
    const { roofline, top } = obstacles(probe);
    let skyline = -Infinity;
    for (const [left, rightEdge, y] of roofline) {
      if (left < .85 && rightEdge > -.85) skyline = Math.max(skyline, y);
    }
    if (!approaching && zoom === camera.zoom && skyline < .18 && direction.y > -.32) return null;

    // An eye inside foliage or under the eaves must clear the surface.
    if (skyline > 1 && position.y < top + 1.5) position.y = top + 1.5;
    const pitch = Math.asin(clamp(direction.y, -1, 1));
    const tangent = verticalTangent / zoom;
    const horizonAngle = pitch + Math.atan(clamp(skyline, 0, 1.15) * tangent);
    const angle = approaching
      ? clamp(horizonAngle - Math.atan(.28 * tangent), -.06, .30)
      : clamp(horizonAngle + Math.atan(.15 * tangent), .08, 1.32);
    const azimuth = Math.atan2(direction.x, direction.z);
    direction.set(Math.sin(azimuth)*Math.cos(angle), Math.sin(angle), Math.cos(azimuth)*Math.cos(angle));
    const target = position.clone().addScaledVector(direction, clamp(focusDistance, 1, 42));
    return { position, target, zoom };
  }

  function stage(camera, direction) {
    camera.updateWorldMatrix(true,false);
    camera.getWorldPosition(eye);
    camera.getWorldQuaternion(orientation);
    camera.getWorldDirection(forward);
    right.set(1,0,0).applyQuaternion(orientation);
    up.set(0,1,0).applyQuaternion(orientation);
    toward.copy(forward).negate();

    const depth = STAGE_DEPTH;
    const halfWidth = depth / camera.projectionMatrix.elements[0];
    const halfHeight = depth / camera.projectionMatrix.elements[5];
    // Neighbouring crowns share sky at full bloom. Only the distance between
    // their centres is constrained on unusually narrow or zoomed-in views.
    const wingOffset = RX * (patternName === 'willow' ? .38 : .45);
    const spread = Math.min(wingOffset, halfWidth * .46);
    let anchorX = 0;
    if (direction?.isVector3 && direction.dot(forward) > 0) {
      const click = direction.clone().normalize().add(eye).project(camera);
      anchorX = clamp(click.x * .08, -.04, .04);
    }
    const { roofline } = obstacles(camera);
    let anchorY = .38;
    for (const [left, rightEdge, top] of roofline) {
      if (left < .72 && rightEdge > -.72) anchorY = Math.max(anchorY, top + .17);
    }
    // Protect ignition and the apex. Late strands may descend behind real
    // foreground geometry, which gives the curtain its distance from the tree.
    anchorY = Math.min(.58, anchorY);
    centre.copy(eye).addScaledVector(forward,depth).addScaledVector(right,anchorX*halfWidth)
      .addScaledVector(up,anchorY*halfHeight);
    group.position.copy(centre);
    group.rotation.y=Math.atan2(-forward.x,-forward.z);
    undoYaw.copy(group.quaternion).invert();
    right.applyQuaternion(undoYaw); up.applyQuaternion(undoYaw); toward.applyQuaternion(undoYaw);
    for(const layer of [silk,stars,heart,flash]) layer.scale.setScalar(CROWN_SCALE);
    for(let wing=0;wing<3;wing++) {
      const side=wing-1;
      const end=uniforms.uEnds.value[wing].copy(right).multiplyScalar(side * spread);
      if(side) end.addScaledVector(up,-Math.min(3.0,halfHeight*.15)).addScaledVector(toward,-2);
      origins[wing].copy(end).divideScalar(CROWN_SCALE);
      const [x,z]=PAD[wing];
      const base=uniforms.uBases.value[wing].set(x,ground(x,z)+.08,z).sub(centre).applyQuaternion(undoYaw);
      const bend=uniforms.uBends.value[wing].lerpVectors(base,end,.48);
      bend.y+=Math.max(1.4,Math.abs(end.y-base.y)*.27);
      bend.addScaledVector(right,side*2.6);
    }
  }

  function clear() {
    phase='idle'; age=0;
    group.visible=false;
    for (const obj of group.children) obj.visible=false;
    lightPulse(0);
    exposeBackdrop(0);
  }
  function launch(camera, { direction, reducedMotion = false, pattern } = {}) {
    if (disposed || phase!=='idle' || !camera?.isPerspectiveCamera) return false;
    patternName=reducedMotion?'heart':PATTERNS.includes(pattern)?pattern:PATTERNS[launches%PATTERNS.length];
    stage(camera,direction);
    // Flash and stars share these physical centres with the sky's highlight
    // control. uEnds already includes the display scale, unlike uOrigins.
    group.updateWorldMatrix(true,false);
    for (const sky of backdrops) {
      uniforms.uEnds.value.forEach((end,i) => {
        const worldCentre = group.localToWorld(end.clone());
        sky.uFireworkBounds.value[i].set(worldCentre.x, worldCentre.y, worldCentre.z, 21*silk.scale.x);
      });
    }
    makeScore(patternName,launches,right,up,toward,silk.geometry.attributes,
      stars.geometry.attributes,heart.geometry.attributes,reducedMotion);
    launches++; age=0; group.visible=true;
    uniforms.uAge.value=uniforms.uLift.value=0;
    uniforms.uStill.value=reducedMotion?1:0;
    uniforms.uHeartShow.value=patternName==='heart'?1:0;
    phase=reducedMotion?'still-heart':'rising';
    comet.visible=!reducedMotion; heart.visible=reducedMotion;
    if (!reducedMotion) sound('launch');
    return true;
  }
  function update(delta, { covered = false, reducedMotion = false, available = true } = {}) {
    if (disposed || phase==='idle') return;
    if (!available || (reducedMotion && phase!=='still-heart')) { clear(); return; }
    if (covered) { lightPulse(0); return; }
    age+=Number.isFinite(delta)?Math.max(delta,0):0;
    if (phase==='still-heart') { if (age>=2.8) clear(); return; }
    if (age<RISE) {
      uniforms.uLift.value=age/RISE;
      exposeBackdrop(THREE.MathUtils.smoothstep(age,.14,RISE));
      return;
    }
    const t=age-RISE;
    if (phase==='rising') {
      phase='burst'; bursts++; comet.visible=false;
      silk.visible=stars.visible=heart.visible=true;
      sound('bloom');
    }
    if (t>=AFTERGLOW) { clear(); return; }
    uniforms.uAge.value=t; flash.visible=t<FLASH;
    exposeBackdrop(1-THREE.MathUtils.smoothstep(t,3.8,AFTERGLOW));
    lightPulse(t<1 ? .19*(1-Math.exp(-45*t))*Math.exp(-4.3*t)*(1-THREE.MathUtils.smoothstep(t,.74,1)) : 0);
  }
  return {
    group,launch,update,clear,viewingSeat,
    getState:()=>({phase,age:phase==='idle'?null:age,launches,bursts,pattern:patternName,
      particleCount:STARS+INNER,burstCount:STARS,heartCount:INNER,colours:PALETTE.slice(0,2),
      centre:centre.toArray(),visible:group.visible}),
    dispose() {
      if (disposed) return;
      disposed=true; clear(); group.removeFromParent();
      for (const obj of group.children) { obj.geometry.dispose(); obj.material.dispose(); }
      group.clear();
    }
  };
}
