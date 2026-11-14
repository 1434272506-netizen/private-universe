import * as THREE from 'three';

// One coverage mask for every stellar point, from distant dust to beacon cores.
const canvas=document.createElement('canvas');
canvas.width=canvas.height=128;
const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(128,128);
for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const r=Math.hypot(x-63.5,y-63.5)/63.5,t=Math.max(0,(r-.15)/.85);
  const alpha=t>=1?0:Math.exp(-5*t*t)*(1-t*t*(3-2*t));
  pixels.data.set([255,255,255,Math.round(255*alpha)],4*(128*y+x));
}
ctx.putImageData(pixels,0,0);
export const starTexture=new THREE.CanvasTexture(canvas);
