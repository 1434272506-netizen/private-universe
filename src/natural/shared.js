import * as THREE from 'three';
export function rng(seed=714){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const fract=x=>x-Math.floor(x);
export const hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453123);
export function noise(x,y){let ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),fx),THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),fx),fy);}
export function fbm(x,y){return noise(x,y)*.57+noise(x*2.03+9,y*2.03+5)*.27+noise(x*4.11,y*4.11)*.11+noise(x*8.3,y*8.3)*.05;}
export function mesh(parent,geo,mat,x=0,y=0,z=0){let m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
export function curveTube(points,startRadius,endRadius,segments=16,sides=9){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const frames=curve.computeFrenetFrames(segments,false),v=[],uv=[],idx=[];
 for(let j=0;j<=segments;j++){const t=j/segments,p=curve.getPointAt(t),r=THREE.MathUtils.lerp(startRadius,endRadius,t);for(let i=0;i<=sides;i++){let a=i/sides*Math.PI*2,off=frames.normals[j].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[j],Math.sin(a));let rr=r*(1+.05*Math.sin(a*5+t*11));v.push(p.x+off.x*rr,p.y+off.y*rr,p.z+off.z*rr);uv.push(i/sides,t*3);} }
 for(let j=0;j<segments;j++)for(let i=0;i<sides;i++){let a=j*(sides+1)+i,b=a+sides+1;idx.push(a,b,a+1,a+1,b,b+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
