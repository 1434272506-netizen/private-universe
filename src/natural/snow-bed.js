import { BufferAttribute, DataTexture, LinearFilter, MathUtils, RGBAFormat } from 'three';
import { RX, RZ, boundary, creekX, ground, onCabinFloor, waterY } from './land.js';
import { fbm } from './shared.js';

// Three bands in island space: ordinary snow, field colour, wind-packed snow.
// Height and its two derivatives are baked together so drifts light and collide
// consistently without evaluating noise per flake, per fragment or per paw.
const W = 192, H = 112, SX = RX * 2.4, SZ = RZ * 2.4;
const dx = SX / W, dz = SZ / H, size = W * H;
const { clamp, lerp, smoothstep } = MathUtils;
const byte = value => Math.round(255 * clamp(value, 0, 1));

export const SNOW_BED_GLSL = `
  uniform sampler2D uSnowBed;
  vec4 snowBand(vec2 xz, float band) {
    vec2 uv = clamp(xz / vec2(${SX}, ${SZ}) + .5,
      vec2(${.5/W}, ${.5/H}), vec2(${1-.5/W}, ${1-.5/H}));
    return texture2D(uSnowBed, vec2(uv.x, (uv.y + band) / 3.0));
  }
  float snowHeightAt(vec4 bed, vec4 drift, float winterSnow, float accumulation) {
    return mix(.29 * bed.r * bed.a * winterSnow, .65 * drift.r, accumulation);
  }
  vec2 snowGradient(vec4 layer) { return (layer.gb * 255.0 - 128.0) / 63.0; }
`;

export function makeSnowBed(inTerrace) {
  const terrain = new Float32Array(size), usual = new Float32Array(size), storm = new Float32Array(size);
  const data = new Uint8Array(size * 12);
  for (let j=0; j<H; j++) for (let i=0; i<W; i++) {
    terrain[j*W+i] = ground((i+.5-W/2)*dx, (j+.5-H/2)*dz);
  }
  for (let j=0; j<H; j++) for (let i=0; i<W; i++) {
    const k=j*W+i, x=(i+.5-W/2)*dx, z=(j+.5-H/2)*dz;
    const grain=fbm(x*.43+9,z*.36-5), broad=fbm(x*.35,z*.35);
    const rim=boundary(Math.atan2(z/RZ,x/RX))-Math.hypot(x/RX,z/RZ);
    const edge=smoothstep(rim+.028*(grain-.5),-.004,.066);
    const hollow=i>3 && i<W-4 && j>3 && j<H-4
      ? (terrain[k-4]+terrain[k+4]+terrain[k-4*W]+terrain[k+4*W])*.25-terrain[k] : 0;
    const distance=Math.abs(x-creekX(z));
    const riverbed=distance<1.85 ? smoothstep(waterY(z)-terrain[k],-.025,.045) : 0;
    // Snow tails off at the cliff, open channel, hearth and covered cabin floor.
    const exposure=edge*(1-riverbed)*smoothstep(Math.hypot(x-15,z+1.6),.63,1.38)
      * Number(!onCabinFloor(x,z,-.10));
    const loose=clamp(.08+.58*grain+.33*(.5+.5*Math.cos(1.12*x+1.78*z+3.1*grain))**2+.93*hollow,.035,1);
    const ridge=(.5+.5*Math.cos(.52*x+2.16*z+6.0*broad))**3;
    const ordinaryMask=inTerrace(x,z) ? 0 : exposure;
    usual[k]=.29*loose*ordinaryMask;
    storm[k]=exposure*(.35+.30*clamp(.30*broad+.70*ridge+.55*hollow,0,1));
    const field=4*(size+k), drift=4*(2*size+k);
    data[4*k]=byte(loose); data[4*k+3]=byte(ordinaryMask);
    const ripe=.73*fbm(x*.20+4.6,z*.24+1.3)+.27*grain-.14*Math.max(0,1-distance/1.85);
    data[field]=byte((ripe-.22)/.54); data[field+1]=byte(.30+3.4*hollow);
    data[field+2]=byte(riverbed); data[field+3]=byte(ridge);
    data[drift]=byte(storm[k]/.65); data[drift+3]=byte(exposure);
  }
  for (const [heights,off] of [[usual,0],[storm,2*size]]) {
    for (let j=0; j<H; j++) for (let i=0; i<W; i++) {
      const k=j*W+i, p=4*(off+k);
      const gx=(heights[k+Number(i<W-1)]-heights[k-Number(i>0)])/(2*dx);
      const gz=(heights[k+W*Number(j<H-1)]-heights[k-W*Number(j>0)])/(2*dz);
      data[p+1]=clamp(Math.round(128+63*gx),0,255);
      data[p+2]=clamp(Math.round(128+63*gz),0,255);
    }
  }
  const texture=new DataTexture(data,W,H*3,RGBAFormat);
  texture.minFilter=texture.magFilter=LinearFilter;
  texture.needsUpdate=true;
  function heightAt(x,z,winterSnow,accumulation) {
    if (!(winterSnow || accumulation) || !Number.isFinite(x) || !Number.isFinite(z)) return 0;
    const u=clamp((x/SX+.5)*W-.5,0,W-1), v=clamp((z/SZ+.5)*H-.5,0,H-1);
    const i=Math.floor(u), j=Math.floor(v), right=Math.min(i+1,W-1), next=Math.min(j+1,H-1);
    const sample=(band,c) => {
      const offset=4*size*band+c;
      const a=lerp(data[offset+4*(j*W+i)],data[offset+4*(j*W+right)],u-i);
      const b=lerp(data[offset+4*(next*W+i)],data[offset+4*(next*W+right)],u-i);
      return lerp(a,b,v-j)/255;
    };
    return lerp(.29*sample(0,0)*sample(0,3)*winterSnow,.65*sample(2,0),accumulation);
  }
  return {texture,heightAt};
}

// GTAO renders one override material for the entire scene. Only marked surfaces
// should move in that pass; otherwise buried paths cast contacts above the snow.
export function bindSnowContacts(scene, material, uniforms) {
  if (!material) return;
  const markers=[];
  scene.traverse(mesh=>{
    const ground=mesh.name==='meadow-and-soil' || mesh.name==='island-terrain';
    const terrace=mesh.name==='paddy-earthen-bunds' || mesh.name==='paddy-sky-mirrors';
    if (!mesh.isMesh || !(ground || terrace)) return;
    const g=mesh.geometry, previous=g.getAttribute('aSnowLayer');
    const flag=new BufferAttribute(new Uint8Array(g.attributes.position.count).fill(ground?1:2),1);
    g.setAttribute('aSnowLayer',flag); markers.push([g,previous,flag]);
  });
  const compile=material.onBeforeCompile, key=material.customProgramCacheKey;
  const oldKey=key.call(material), defaults=material.defaultAttributeValues;
  material.defaultAttributeValues={...defaults,aSnowLayer:[0]};
  material.customProgramCacheKey=()=>oldKey+':snow-relief';
  material.onBeforeCompile=function(shader,renderer) {
    compile.call(this,shader,renderer);
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=SNOW_BED_GLSL+'attribute float aSnowLayer; uniform float uSnowAccumulation,uSnowProgress; uniform vec4 uSeasons;\n'
      +shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        float lift=0.;
        if (aSnowLayer>.5 && (uSnowAccumulation>0. || uSnowProgress*uSeasons.w>0.)) {
          vec4 base=snowBand(position.xz,0.), drift=snowBand(position.xz,2.);
          float frost=(aSnowLayer<1.5 ? uSnowProgress*uSeasons.w : 0.);
          lift=snowHeightAt(base,drift,frost,uSnowAccumulation)*smoothstep(-.2,.4,normal.y);
          objectNormal.xz-=mix(snowGradient(base)*frost,snowGradient(drift),uSnowAccumulation)*objectNormal.y;
        }`).replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=lift;');
  };
  material.needsUpdate=true;
  return ()=>{
    for (const [g,previous,flag] of markers) {
      if(g.getAttribute('aSnowLayer')===flag) {
        if(previous) g.setAttribute('aSnowLayer',previous); else g.deleteAttribute('aSnowLayer');
      }
      flag.dispose?.();
    }
    material.onBeforeCompile=compile; material.customProgramCacheKey=key;
    material.defaultAttributeValues=defaults; material.needsUpdate=true;
  };
}
