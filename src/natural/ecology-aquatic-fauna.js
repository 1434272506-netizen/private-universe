import {
  BufferAttribute, CatmullRomCurve3, Color, DoubleSide, Group, MathUtils, Mesh,
  Matrix4, MeshStandardMaterial, PlaneGeometry, SphereGeometry, TubeGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { creekSlope, creekX, waterY } from './land.js';
import { bedSampler } from './ecology-riverbed.js';

const {sin,cos,PI}=Math, {clamp,lerp}=MathUtils;
const TAU=2*PI, up=new Vector3(0,1,0);
const point=(x,y,z)=>new Vector3(x,y,z);
const oval=(x,y,z,rx,ry,rz)=>new SphereGeometry(1,16,10).scale(rx,ry,rz).translate(x,y,z);
const strand=(path,radius,segments=10)=>new TubeGeometry(new CatmullRomCurve3(path),segments,radius,5,false);

function paint(geometry, pigment) {
  const p=geometry.attributes.position, data=new Float32Array(3*p.count), c=new Color();
  const procedural=typeof pigment==='function';
  if (!procedural) c.set(pigment);
  for (let i=0;i<p.count;i++) {
    if (procedural) pigment(c,p.getX(i),p.getY(i),p.getZ(i));
    c.toArray(data,3*i);
  }
  geometry.setAttribute('color',new BufferAttribute(data,3));
  return geometry;
}
function join(parts) {
  const geometry=mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geometry;
}
function add(parent,name,geometry,material) {
  const node=geometry ? new Mesh(geometry,material) : new Group();
  node.name=name; parent.add(node);
  if (material?.transparent) node.renderOrder=1; // Creek surface composites at order 2.
  return node;
}
const glass=(opacity,roughness)=>new MeshStandardMaterial({
  vertexColors:true, transparent:true, opacity, roughness, side:DoubleSide,
  depthWrite:false, forceSinglePass:true,
});

// Bake the highest bed across the swimming corridor. The narrowest turns put
// the long tails across the current; reserve space for them at both banks.
function poolFloor(bed) {
  const start=-2.1, step=.18, rows=new Float32Array(25);
  for (let i=0;i<rows.length;i++) {
    const z=start+i*step, x=creekX(z);
    rows[i]=Math.max(bed(x-.43,z),bed(x,z),bed(x+.43,z))+.012;
  }
  return z=>{
    const u=clamp((z-start)/step,0,rows.length-1), i=Math.floor(u);
    return lerp(rows[i],rows[Math.min(i+1,rows.length-1)],u-i);
  };
}

function makeJelly(parent, index, clock, floor) {
  const root=add(parent,'peach-blossom-jellyfish-'+(index+1)), phase=index*2.63;
  const geometry=new SphereGeometry(1,32,14,0,TAU,0,PI*.52);
  const positions=geometry.attributes.position, pink=new Color('#fea8c0'), ice=new Color('#bef8f1');
  for (let i=0;i<positions.count;i++) {
    const x=positions.getX(i), z=positions.getZ(i), y=positions.getY(i), a=Math.atan2(z,x);
    const rim=(1-Math.max(0,y))**4, r=.082*(1+.045*rim*cos(a*12));
    positions.setXYZ(i,x*r,y*.055+.005*rim*sin(12*a),z*r);
  }
  geometry.computeVertexNormals();
  paint(geometry,(c,x,y,z)=>{
    const a=Math.atan2(z,x), radius=Math.hypot(x,z);
    const canal=(.5+.5*cos(4*a))**5*Math.exp(-((radius-.043)**2)/.00022);
    c.copy(ice).lerp(pink,clamp(.18+.23*index+.29*cos(a+phase)+.65*canal,0,1));
  });
  const gel=glass(.72,.10);
  gel.emissive.set(index?'#185057':'#632741'); gel.emissiveIntensity=.34;
  const bell=add(root,'jellyfish-bell',geometry,gel);
  const tentacles=[];
  for (let n=0;n<4;n++) {
    const a=n*PI/2+.35, path=[];
    for (let j=0;j<=6;j++) {
      const t=j/6, r=.068-.024*t+.009*sin(5*t+n);
      path.push(point(r*cos(a)+.015*t*t,-(.10+.015*(n%2))*t,r*sin(a)+.012*t*t));
    }
    tentacles.push(paint(strand(path,.0025),n%2?'#f8b8ce':'#b2f5eb'));
  }
  const silk=glass(.56,.24);
  silk.customProgramCacheKey=()=>'aquatic-tentacle-v1';
  silk.onBeforeCompile=shader=>{
    shader.uniforms.uPulseTime=clock; shader.uniforms.uJellyPhase={value:phase};
    shader.vertexShader='uniform float uPulseTime,uJellyPhase;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>',`#include <begin_vertex>
        float h=clamp(-position.y/.11,0.,1.);
        float wave=uPulseTime*2.8+uJellyPhase-3.4*h+position.x*16.;
        transformed.xz+=h*h*vec2(.018*sin(wave),.012*cos(wave*.76));`);
  };
  const fringe=add(root,'jellyfish-four-tentacles',join(tentacles),silk);
  fringe.geometry.computeBoundingSphere(); fringe.geometry.boundingSphere.radius+=.023;
  return (t,winter)=>{
    const beat=sin(t*2.8+phase), width=1-.16*beat;
    bell.scale.set(width,1+.17*beat,width); fringe.scale.set(width,1,width);
    gel.emissiveIntensity=.31+.09*beat;
    const z=.20+index*.37+.062*sin(t*.51+phase);
    const x=creekX(z)+(index?.13:-.23)+.037*cos(t*.61+phase);
    const y=Math.max(floor(z)+.128,waterY(z)-.265-.035*winter+.015*sin(t*2.8+phase-.62));
    root.position.set(x,y,z); root.rotation.z=.075*sin(t*.73+phase);
  };
}

function tailSheet(side) {
  const g=new PlaneGeometry(1,1,12,6), uv=g.attributes.uv, p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const t=uv.getX(i), v=2*uv.getY(i)-1;
    p.setXYZ(i,side*(.005+.069*t+.019*v*t),.012+v*(.008+.055*t)-.033*t*t,
      -.096-(.137+.029*v*v+.010*cos(4*v))*t);
  }
  g.computeVertexNormals();
  const white=new Color('#fff2dc'), coral=new Color('#f06b57');
  return paint(g,(c,x,y,z)=>c.copy(white).lerp(coral,clamp(.55+.36*sin(y*187+x*32)-(-z-.10)*2,0,1)));
}

function makeGoldfish(parent,index,clock,floor,bodyMat) {
  const root=add(parent,'veiltail-goldfish-'+(index+1)), phase=index*TAU/3;
  const cream=new Color('#fff1d6'), red=new Color(index===1?'#df452e':'#ef5639');
  const body=paint(oval(0,0,.009,.055,.060,.109),(c,x,y,z)=>{
    const patch=sin(47*z+9*x+phase)+.65*sin(51*y-19*x+phase*.5)+.35*cos(70*x-14*z);
    c.copy(cream).lerp(red,MathUtils.smoothstep(patch,-.13,.19));
  });
  const parts=[body,paint(oval(0,.055,-.014,.006,.027,.048),'#df825e')];
  for (const side of [-1,1]) {
    parts.push(paint(oval(side*.045,.016,.064,.013,.015,.014),'#eed49c'),
      paint(oval(side*.054,.018,.067,.007,.009,.008),'#232b26'),
      paint(oval(side*.042,-.018,.017,.027,.006,.032),'#f3a77f'));
  }
  add(root,'veiltail-red-and-white-body',join(parts),bodyMat);
  const silk=glass(.72,.43);
  silk.customProgramCacheKey=()=>'veiltail-travelling-wave-v1';
  silk.onBeforeCompile=shader=>{
    shader.uniforms.uSwimTime=clock; shader.uniforms.uFishPhase={value:phase};
    shader.vertexShader='uniform float uSwimTime,uFishPhase;\n'+shader.vertexShader.replace(
      '#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        float h=uv.x, wave=uSwimTime*5.2+uFishPhase-2.9*h;
        float flex=h*h*(.047*sin(wave)+.010*sin(2.*wave+.4));
        float slope=2.*h*(.047*sin(wave)+.010*sin(2.*wave+.4))
                    -2.9*h*h*(.047*cos(wave)+.020*cos(2.*wave+.4));
        objectNormal.z+=objectNormal.x*slope/.15;`)
      .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=flex;');
  };
  const tail=add(root,'veiltail-paired-silk-fins',join([tailSheet(-1),tailSheet(1)]),silk);
  tail.geometry.computeBoundingSphere(); tail.geometry.boundingSphere.radius+=.057;
  return (t,winter)=>{
    const a=t*(.52+.035*index)+phase, amp=lerp(.60,.39,winter);
    const z=lerp(-.88+index*.63,-.76+index*.23,winter)+amp*sin(a);
    const dx=.16*cos(a)+(index-1)*.052;
    const floorY=floor(z), surface=waterY(z);
    root.position.set(creekX(z)+dx,lerp(surface-.13+.013*sin(2*a),floorY+.082,winter),z);
    const dz=amp*cos(a);
    root.rotation.y=Math.atan2(creekSlope(z)*dz-.16*sin(a),dz);
    root.rotation.z=.07*cos(2*a+phase);
  };
}

function makeShrimp(parent,index,bed,weedSites,material) {
  const root=add(parent,'glass-shrimp-'+(index+1)), pieces=[];
  const tint='#b7f1df', joint='#d9f9dc';
  for(let k=0;k<7;k++) pieces.push(paint(oval(0,.015+.014*sin(k*.55),.029-k*.013,
    .014-.0009*k,.013-.0008*k,.018),k%2?tint:joint));
  for (const s of [-1,1]) {
    pieces.push(paint(oval(s*.009,.030,.041,.004,.004,.004),'#233e36'),
      paint(oval(s*.009,.008,-.056,.011,.003,.016),'#92c4a9'),
      paint(strand([point(s*.007,.025,.040),point(s*.023,.052,.085),point(s*.041,.049,.119)],.0016),'#d2faf2'));
    for(let j=0;j<4;j++) pieces.push(paint(strand([point(s*.008,.019,.022-.012*j),
      point(s*.022,.008,.018-.012*j),point(s*.025,0,.021-.012*j)],.0016,4),tint));
  }
  add(root,'shrimp-carapace-and-feelers',join(pieces),material);
  const site=weedSites?.[index?3:1], z=site?.[2] ?? (index?2.8:-1.2);
  const x=(site?.[0] ?? creekX(z))+.045, baseY=bed(x,z);
  const yaw=Math.atan2(creekSlope(z),1)+.28*(index?1:-1), reach=.11;
  const endX=x-reach*sin(yaw), endZ=z-reach*cos(yaw), endY=bed(endX,endZ);
  return (t,winter)=>{
    const cycle=(t+index*3.7)%8.3;
    const retreat=(cycle<.22 ? 1-(1-cycle/.22)**2 : 1-MathUtils.smoothstep(cycle,.22,1.05))*(1-winter);
    const hop=cycle<.55 ? sin(PI*cycle/.55)*(1-winter) : 0;
    root.position.set(lerp(x,endX,retreat),lerp(baseY,endY,retreat)+.004+.060*hop,lerp(z,endZ,retreat));
    root.rotation.set(-.25*hop,yaw,0,'YXZ');
  };
}

function makeSnails(parent,bed,bodyMat) {
  const rockMat=new MeshStandardMaterial({color:'#899b91',roughness:.62});
  const spiral=[];
  for (let i=0;i<=32;i++) {
    const t=i/32, a=t*TAU*1.7, r=.023*(1-t)+.002;
    spiral.push(point(.018+.011*t,.025+r*cos(a),-.008+r*sin(a)));
  }
  const shell=join([paint(oval(0,.023,-.006,.026,.029,.029),'#426a62'),
    paint(strand(spiral,.002,32),'#809789'),paint(oval(0,.006,.012,.017,.008,.041),'#647c62'),
    ...[-1,1].map(s=>paint(strand([point(s*.006,.009,.039),point(s*.014,.017,.055),point(s*.018,.020,.065)],.002,4),'#657b68'))]);
  for(const [i,z] of [1.35,3.5,5.15].entries()) {
    const side=i%2?1:-1, x=creekX(z)+side*.27, y=bed(x,z);
    const rx=.145+.013*i, rz=.122, ry=Math.min(.085,(waterY(z)-y)*.42);
    const rock=add(parent,'snail-river-stone-'+(i+1),oval(0,0,0,rx,ry,rz),rockMat);
    rock.position.set(x,y+.004,z);
    const n=point(side*.72,.68,.25).normalize(), snail=add(rock,'river-snail-'+(i+1),shell,bodyMat);
    snail.position.set(n.x*rx,n.y*ry-.001,n.z*rz);
    n.set(n.x/rx,n.y/ry,n.z/rz).normalize();
    // The foot hugs the ellipsoid; its feelers extend along a horizontal contour.
    const forward=new Vector3().crossVectors(n,up).normalize();
    snail.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(new Vector3().crossVectors(n,forward),n,forward));
    const sx=x+snail.position.x, sz=z+snail.position.z;
    const ledge=Math.max(bed(sx,sz),bed(sx+.061*forward.x,sz+.061*forward.z));
    rock.position.y=Math.max(rock.position.y,ledge+.006-snail.position.y);
  }
}

/** Geometry, materials and per-specimen uniforms belong to the ecology root. */
export function makeAquaticFauna(root,island,bed=bedSampler(island)) {
  const habitat=add(root,'aquatic-fauna'), clock={value:0}, floor=poolFloor(bed);
  const solid=new MeshStandardMaterial({vertexColors:true,roughness:.43});
  const shell=glass(.61,.19), weeds=root.getObjectByName('submerged-river-ribbon-weeds')?.userData.clumps;
  const swimmers=[
    ...Array.from({length:2},(_,i)=>makeJelly(habitat,i,clock,floor)),
    ...Array.from({length:3},(_,i)=>makeGoldfish(habitat,i,clock,floor,solid)),
    ...Array.from({length:2},(_,i)=>makeShrimp(habitat,i,bed,weeds,shell)),
  ];
  makeSnails(habitat,bed,solid);
  function update(delta,winter=0,still=false) {
    if (!still) clock.value+=delta*(1-.75*winter);
    for (const swim of swimmers) swim(clock.value,winter);
  }
  update(0);
  return {update};
}
