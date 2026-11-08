import * as THREE from 'three';

function armAngle(arm,r) {
  return arm*Math.PI*2/3+1.25*Math.log1p(r);
}
function gasClouds(radius) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,0,64,64,64);
  for(let i=0;i<=16;i++){
    const r=i/16,alpha=Math.max(0,Math.exp(-5*r*r)-Math.exp(-5));
    gradient.addColorStop(r,'rgba(255,255,255,'+alpha+')');
  }
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const map=new THREE.CanvasTexture(canvas),gas=new THREE.Group();gas.name='spiral-gas';
  const hot=new THREE.Color('#ff996f'),cool=new THREE.Color('#8871d5');
  for(let i=0;i<36;i++){
    const r=radius*(Math.floor(i/3)+.5+Math.random()*.4)/12,angle=armAngle(i%3,r);
    const cloud=new THREE.Sprite(new THREE.SpriteMaterial({map,color:hot.clone().lerp(cool,r/radius),
      transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false}));
    cloud.position.set(r*Math.cos(angle),Math.random()-.5,r*Math.sin(angle));
    cloud.scale.set(12+r*.18,8+r*.12,1);gas.add(cloud);
  }
  return gas;
}
export function spiralGalaxy() {
  const count = 48000, radius = 65;
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  const core = new THREE.Color('#ffe094'), rim = new THREE.Color('#2b448a'), color = new THREE.Color();
  const scatter = r => Math.sign(Math.random() - .5) * Math.random() ** 3.5 * .45 * r;
  for (let i = 0; i < count; i++) {
    const r = Math.random() * radius;
    const angle = armAngle(i % 3,r);
    positions.set([r * Math.cos(angle) + scatter(r), scatter(r) * .32, r * Math.sin(angle) + scatter(r)], i * 3);
    color.lerpColors(core, rim, r / radius).toArray(colors, i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const galaxy = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: .22, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  galaxy.name = 'spiral-galaxy';
  galaxy.add(gasClouds(radius));
  return galaxy;
}
