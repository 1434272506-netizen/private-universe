import * as THREE from 'three';
import {noise, fbm, hash} from './shared.js';

const cache = {};
export function surface(kind) {
  if (cache[kind]) return cache[kind];
  const n = 512, canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d'), data = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n;
      let b, base;
      if (kind === 'rock') {
        const warp = fbm(u * 3.1 + 5, v * 3.1 + 3);
        const mineral = fbm(u * 6.2 + warp, v * 6.2 + warp * .6);
        const grain = fbm(u * 36 + 2, v * 36 + 7);
        // Broad mineral deposits and fine pores, without a repeated crack grid.
        const pore = Math.pow(Math.max(0, (hash(x, y) - .81) / .19), 2);
        b = .69 + mineral * .33 + grain * .14 - pore * .10;
        // A sparse warped joint network adds fine fractures between the broad
        // geometric faults. Missing portions keep the cells from outlining a grid.
        const qx = u * 4.7 + noise(u * 7 + 3,v * 7) * .42;
        const qy = v * 4.7 + noise(u * 7,v * 7 + 7) * .42;
        const cellX = Math.floor(qx), cellY = Math.floor(qy);
        let nearest = 10, next = 10;
        for (let cy = -1; cy <= 1; cy++) for (let cx = -1; cx <= 1; cx++) {
          const px = cellX + cx + .12 + hash(cellX + cx,cellY + cy) * .76;
          const py = cellY + cy + .12 + hash(cellX + cx + 19,cellY + cy + 37) * .76;
          const distance = (qx - px) ** 2 + (qy - py) ** 2;
          if (distance < nearest) { next = nearest; nearest = distance; }
          else if (distance < next) next = distance;
        }
        const joint = (1 - THREE.MathUtils.smoothstep(next - nearest,.005,.035))
          * THREE.MathUtils.smoothstep(mineral,.32,.62);
        b *= 1 - joint * .21;
        base = [214, 212, 197];
      } else if (kind === 'earth') {
        const mottling = fbm(u * 7 + 13, v * 7 + 4);
        const grain = fbm(u * 38, v * 38), stubble = noise(u * 95 + 7,v * 83 + 13);
        b = .63 + mottling * .30 + grain * .18 + stubble * .10 + (hash(x,y) - .5) * .10;
        base = [214, 226, 204];
      } else if (kind === 'banyan') {
        const mottling = fbm(u * 9, v * 12);
        const fissure = Math.pow(Math.max(0, 1 - Math.abs(Math.sin(u * 96 + noise(u * 18, v * 5) * 4)) * 11), 2);
        b = .73 + mottling * .27 - fissure * .12 + (hash(x, y) - .5) * .045;
        base = [173, 167, 149];
      } else if (kind === 'bark') {
        const f = fbm(u * 32, v * 3), groove = Math.pow(Math.abs(Math.sin(u * 120 + fbm(u * 20, v * 6) * 8)), .3);
        b = .4 + f * .52 + groove * .2 + (hash(x, y) - .5) * .1;
        base = [146, 135, 116];
      } else if (kind === 'wood') {
        const grain = Math.sin(u * 150 + Math.sin(v * 5) * 1.8 + noise(u * 5, v * 9) * 4);
        b = .81 + grain * .065 + fbm(u * 15, v * 2) * .2 + (hash(x, y) - .5) * .05;
        base = [191, 171, 134];
      } else {
        b = .55 + fbm(u * 11, v * 11) * .6 + (hash(x, y) - .5) * .23;
        base = [210, 205, 185];
      }
      const k = (y * n + x) * 4;
      for (let c = 0; c < 3; c++) data.data[k + c] = Math.min(255, base[c] * b);
      data.data[k + 3] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  cache[kind] = texture;
  return texture;
}

export function material(kind, color = '#ffffff') {
  const map = surface(kind).clone();
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    color, map, bumpMap: map,
    bumpScale: kind === 'bark' ? .075 : kind === 'earth' ? .018 : .035,
    roughness: kind === 'wood' ? .8 : 1,
  });
}

export function rockMaterial({distant = false} = {}) {
  const m = material('rock');
  m.vertexColors = true;
  // Object-space relief avoids stretching the ordinary UV bump at the tip.
  m.bumpMap = null;
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRockPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRockPos=position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vRockPos;
float puRockHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float puRockNoise(vec2 p) {
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(puRockHash(i),puRockHash(i+vec2(1.,0.)),f.x),mix(puRockHash(i+vec2(0.,1.)),puRockHash(i+1.),f.x),f.y);
}
float puRockHeight(vec3 p) {
  return puRockNoise(p.xy * 8.3 + p.z * .31) * .008
    + puRockNoise(p.yz * 17.1 + p.x * .23) * .003;
}`)
      .replace('#include <map_fragment>', `
vec3 rockNormal=abs(normalize(cross(dFdx(vRockPos),dFdy(vRockPos))));
rockNormal=pow(rockNormal,vec3(5.));rockNormal/=max(.001,rockNormal.x+rockNormal.y+rockNormal.z);
vec3 rockTexture=texture2D(map,vRockPos.yz*.29+vec2(.13,.37)).rgb*rockNormal.x
  +texture2D(map,vRockPos.xz*.29+vec2(.59,.17)).rgb*rockNormal.y
  +texture2D(map,vRockPos.xy*.29+vec2(.31,.71)).rgb*rockNormal.z;
float rockWarp=puRockNoise(vRockPos.xz*.24)*.8;
float mineral=puRockNoise(vRockPos.xy*.39+vec2(4.,2.));
float deposit=puRockNoise(vec2(vRockPos.x*.15+vRockPos.z*.11,(vRockPos.y+rockWarp)*1.7));
// Uneven mineral deposits replace the regular horizontal stripes.
rockTexture*=.91+deposit*.14;
rockTexture=mix(rockTexture,rockTexture*vec3(1.055,.99,.91),mineral*.30);
float mossHeight=smoothstep(-1.2,.0,vRockPos.y)*(1.-smoothstep(.2,.65,vRockPos.y));
float moss=pow(smoothstep(.52,.78,puRockNoise(vRockPos.xz*.87+vRockPos.y*.2)),2.)*mossHeight*.21;
rockTexture=mix(rockTexture,rockTexture*vec3(.65,.77,.51),moss);
diffuseColor.rgb*=rockTexture;
`);
    if (!distant) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
float rockHeight=puRockHeight(vRockPos);
vec3 rockDx=dFdx(-vViewPosition),rockDy=dFdy(-vViewPosition);
vec3 rockR1=cross(rockDy,normal),rockR2=cross(normal,rockDx);
float rockDet=dot(rockDx,rockR1);
vec3 rockGradient=sign(rockDet)*(dFdx(rockHeight)*rockR1+dFdy(rockHeight)*rockR2);
normal=normalize(max(abs(rockDet),.0000001)*normal-rockGradient);
`);
  };
  m.customProgramCacheKey = () => `fractured-limestone-v4-${distant}`;
  return m;
}
