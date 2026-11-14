import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {material} from './materials.js';
import {rng} from './shared.js';
import {ground,CABIN_SITE} from './land.js';
import {publicAssetURL} from '../public-assets.js';

function engravedSign(){
 const c=document.createElement('canvas');c.width=1024;c.height=192;
 const ctx=c.getContext('2d');ctx.fillStyle='#33281e';ctx.fillRect(0,0,c.width,c.height);
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='italic 48px Georgia';
 ctx.fillStyle='#16130f';ctx.fillText('Our Secret Haven',514,70);ctx.fillStyle='#dbbd87';ctx.fillText('Our Secret Haven',512,68);
 ctx.font='24px Georgia';ctx.fillStyle='#ba9d70';ctx.fillText('·  2025.09.23  ·',512,137);
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
 return new THREE.MeshStandardMaterial({map,roughness:.8});
}
function grainMap(){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
 ctx.fillStyle='#a37a51';ctx.fillRect(0,0,128,128);
 for(let r=5;r<90;r+=6){ctx.beginPath();for(let i=0;i<=96;i++){const a=i*Math.PI/48,radius=r*(1+.04*Math.sin(a*5+r));const x=62+Math.cos(a)*radius,y=66+Math.sin(a)*radius;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.strokeStyle='#5e432c';ctx.lineWidth=1.4;ctx.stroke();}
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;return map;
}
// Linear-space tangent normals: reflection shifts gently as the viewing angle changes.
function glassWaveNormalMap(frosted=false){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),image=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const u=x/128*Math.PI*2,v=y/128*Math.PI*2,i=(y*128+x)*4;
  image.data[i]=128+(frosted?32*Math.cos(u*19)+9*Math.cos(u*7+v):10*Math.cos(u*2+v)+5*Math.cos(u-v*3));
  image.data[i+1]=128+(frosted?5*Math.sin(v*5+u):8*Math.sin(v*3+u*2));image.data[i+2]=255;image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);const map=new THREE.CanvasTexture(c);map.wrapS=map.wrapT=THREE.RepeatWrapping;return map;
}
export function makeCabin(){
 const group=new THREE.Group();group.name='secret-haven-cabin';
 const wood=material('wood'),stone=material('rock');
 const paint=new THREE.MeshStandardMaterial({roughness:.86});
 const bronze=new THREE.MeshStandardMaterial({roughness:.42,metalness:.7});
 const iron=new THREE.MeshStandardMaterial({roughness:.64,metalness:.55});
 const glass=new THREE.MeshPhysicalMaterial({color:'#f0f6f8',emissive:'#ff9c47',ior:1.52,roughness:.028,metalness:0,clearcoat:1,clearcoatRoughness:.02,specularIntensity:1,specularColor:'#fff8ec',transparent:true,depthWrite:false,transmission:0,normalMap:glassWaveNormalMap(),normalScale:new THREE.Vector2(.035,.035)});
 // reflectivity aliases IOR in Three.js; retain the measured glass IOR instead of silently changing it.
 const frostedGlass=new THREE.MeshPhysicalMaterial({color:'#e4ebe5',emissive:'#ff9c47',ior:1.5,clearcoat:.75,clearcoatRoughness:.12,roughness:.24,metalness:0,transparent:true,depthWrite:false,transmission:0,normalMap:glassWaveNormalMap(true),normalScale:new THREE.Vector2(.10,.045)});
 // Treat the requested per-glass gain as a multiplier of the garden's day/night
 // environment exposure. Explicit envMap binding otherwise bypasses that exposure.
 for(const mat of [glass,frostedGlass]){
  const skyIntensity={value:1};
  mat.onBeforeRender=(renderer,scene)=>{skyIntensity.value=scene.environmentIntensity;};
  mat.onBeforeCompile=shader=>{
   shader.uniforms.cabinSkyIntensity=skyIntensity;
   shader.fragmentShader=shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',
    'uniform float cabinSkyIntensity;\n'+THREE.ShaderChunk.envmap_physical_pars_fragment.replaceAll('envMapIntensity','(envMapIntensity * cabinSkyIntensity)'));
  };
  mat.customProgramCacheKey=()=> 'cabin-physical-sky-exposure-v1';
 }
 const dayInteriorBounce=new THREE.Color('#fff2de'),nightHearthBounce=new THREE.Color('#ffb56e');
 const interiorFurnitureMat=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,emissive:'#fff2de',emissiveIntensity:.13,roughness:.78,metalness:.04,envMapIntensity:.55});
 const interiorGlowMat=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,emissive:'#ffffff',emissiveIntensity:.18,roughness:.42,metalness:0});
 // glTF stores RGBA vertex colours. Tint both reflected and emitted light with
 // the baked furniture/AO/fire colours, including Three's USE_COLOR_ALPHA path.
 for(const [index,mat] of [interiorFurnitureMat,interiorGlowMat].entries()){
  mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#if defined(USE_COLOR_ALPHA) || defined(USE_COLOR)\n totalEmissiveRadiance *= vColor.rgb;\n#endif');};
  mat.customProgramCacheKey=()=>`cabin-interior-vertex-emission-v1-${index}`;
 }
 const bulbs=new THREE.MeshStandardMaterial({emissive:'#ffa143',roughness:.42});
 const endGrain=new THREE.MeshStandardMaterial({map:grainMap(),roughness:.93});
 const batches=new Map(),doorFallback=new Map(),hangingFallback=new Map(),walls=[],random=rng(923),walnut='#60412e',honey='#bc8b61',trim='#d9b180';
 let activeBatches=batches;
 const fixtures={windowPanes:0,supports:[],steps:[],deck:{y:.34,front:3.6},windowCount:4};
 function part(mat,color,g,x,y,z,rx=0,ry=0,rz=0){
  if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}
  g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);
  const tint=new THREE.Color(color),colors=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<colors.length;i+=3)tint.toArray(colors,i);g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  if(!activeBatches.has(mat))activeBatches.set(mat,[]);activeBatches.get(mat).push(g);
 }
 function box(mat,color,x,y,z,w,h,d,rz=0){part(mat,color,new THREE.BoxGeometry(w,h,d),x,y,z,0,0,rz);}
 function rounded(mat,color,x,y,z,w,h,d,r=.012){part(mat,color,new RoundedBoxGeometry(w,h,d,2,r),x,y,z);}
 function cylinder(mat,color,x,y,z,r,h,rx=0,rz=0){part(mat,color,new THREE.CylinderGeometry(r*.96,r,h,12),x,y,z,rx,0,rz);}
 function beam(mat,color,a,b,r=.035){
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av),mid=av.clone().add(bv).multiplyScalar(.5);
  const g=new THREE.CylinderGeometry(r,r,d.length(),10);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));part(mat,color,g,mid.x,mid.y,mid.z);
 }
 function localGround(x,z){const c=Math.cos(CABIN_SITE.yaw),s=Math.sin(CABIN_SITE.yaw);return ground(CABIN_SITE.x+x*c+z*s,CABIN_SITE.z-x*s+z*c)-ground(CABIN_SITE.x,CABIN_SITE.z);}
 function foot(x,z,top,width=.19){
  const bottom=localGround(x,z)-.035;
  box(wood,walnut,x,(bottom+top)/2,z,width,top-bottom,width);
  cylinder(stone,'#797c6c',x,bottom+.028,z,width*.76,.065);
  fixtures.supports.push({x,z,bottom,top});
 }
 // Low fieldstone plinths follow the terrain around the cabin's existing footprint.
 for(const x of [-1.9,0,1.9])for(const z of [-1.5,0,1.5]){
  const bottom=localGround(x,z)-.06,top=.31;box(stone,'#918d7e',x,(top+bottom)/2,z,.54,top-bottom,.54);
  fixtures.supports.push({x,z,bottom,top});
 }
 box(wood,walnut,0,.29,0,4.35,.16,3.48);
 function segments(cuts){let spans=[[-2.275,2.275]];for(const [lo,hi] of cuts)spans=spans.flatMap(([a,b])=>hi<=a||lo>=b?[[a,b]]:[[a,Math.min(b,lo)],[Math.max(a,hi),b]].filter(([x,y])=>y-x>.01));return spans;}
 // Actual door and window openings let light reveal the small interior behind the glass.
 for(let row=0;row<10;row++){
  const y=.40+row*.216,tint=row%3===0?'#c39870':honey;
  for(const side of [-1,1]){
   const cuts=side===1?[...(y<2.14?[[-.52,.52]]:[]),...(y>.89&&y<2.12?[[-1.9,-.82],[.82,1.9]]:[])]:[];
   for(const [a,b] of segments(cuts))part(wood,tint,new THREE.CylinderGeometry(.142,.147,b-a,14),(a+b)/2,y,side*1.71,0,0,Math.PI/2);
   let spans=[[-1.85,1.85]];if(y>.89&&y<2.12)spans=[[-1.85,-.48],[.68,1.85]];
   for(const [a,b] of spans)part(wood,tint,new THREE.CylinderGeometry(.142,.147,b-a,14),side*2.12,y+.045,(a+b)/2,Math.PI/2);
   // Dark joint collars and ringed end faces at the alternating corner courses.
   for(const x of [-2.28,2.28])part(endGrain,'#b68b5d',new THREE.CircleGeometry(.133,16),x,y,side*1.71,0,x>0?Math.PI/2:-Math.PI/2);
   for(const z of [-1.856,1.856])part(endGrain,'#b68b5d',new THREE.CircleGeometry(.133,16),side*2.12,y+.045,z,0,z>0?0:Math.PI);
   for(const z of [-1.71,1.71])part(wood,'#67452e',new THREE.TorusGeometry(.143,.012,5,12),side*2.12,y,z,0,Math.PI/2);
  }
 }
 const slope=.62,angle=Math.atan(slope);
 for(const side of [-1,1]){
  for(let i=-13;i<=13;i++){const x=i*.155,h=1.42-Math.abs(x)*slope;box(wood,honey,x,2.34+h/2,side*1.74,.153,h,.13);}
  const x=side*1.28;box(wood,walnut,x,3.8-slope*Math.abs(x),0,2.64/Math.cos(angle),.14,4.23,-side*angle);
  for(let row=0;row<8;row++)for(let tile=0;tile<12;tile++){
   const across=2.53-row*.326,a=Math.max(-2.16,-2.16+(tile-.5*(row%2))*.40),b=Math.min(2.16,-2.16+(tile+1-.5*(row%2))*.40);
   if(b<=a)continue;const shade=new THREE.Color().setHSL(.071+random()*.015,.20+random()*.12,.23+random()*.14);
   box(wood,shade,side*across,3.90-slope*across,(a+b)/2,.47,.076,b-a-.009,-side*angle);
  }
  for(const z of [-2.17,2.17])box(wood,trim,x,3.78-slope*Math.abs(x),z,3.04,.14,.12,-side*angle);
 }
 box(bronze,'#73513a',0,3.966,0,.19,.13,4.43);
 // King post, tie beam and diagonal braces on both exposed gables.
 for(const z of [-1.86,1.91]){
  box(wood,walnut,0,2.59,z,4.28,.14,.13);beam(wood,walnut,[-2.04,2.59,z],[0,3.77,z],.075);beam(wood,walnut,[0,3.77,z],[2.04,2.59,z],.075);
  beam(wood,walnut,[0,2.59,z],[0,3.75,z],.06);beam(wood,walnut,[-1.05,2.6,z],[0,3.1,z],.035);beam(wood,walnut,[1.05,2.6,z],[0,3.1,z],.035);
 }
 // Deck boards have a central stair recess; all steps remain inside forward=3.62.
 for(let i=0;i<19;i++){const x=(i-9)*.237,short=Math.abs(x)<.72;box(wood,i%3===0?honey:trim,x,.27,short?2.345:2.70,.23,.14,short?1.09:1.80);}
 for(const z of [1.87,3.48])for(const x of [-2.1,2.1])foot(x,z,.20);
 for(const side of [-1,1]){
  for(const z of [2,3.46]){box(wood,honey,side*2.12,.69,z,.12,.85,.12);part(bronze,'#6f5c3b',new THREE.CylinderGeometry(.086,.086,.025,8),side*2.12,1.13,z);}
  box(wood,trim,side*2.12,1.10,2.74,.14,.10,1.62);box(wood,honey,side*2.12,.8,2.74,.07,.08,1.62);
 }
 for(const [z,top,width,depth] of [[3.02,.205,1.42,.26],[3.235,.065,1.64,.18]]){
  const bottom=Math.min(localGround(0,z)-.025,top-.12);rounded(wood,honey,0,(top+bottom)/2,z,width,top-bottom,depth,.012);
  box(wood,trim,0,top-.012,z+depth*.5-.015,width,.025,.035);fixtures.steps.push({z,top,width,depth,bottom});
 }
 const padY=localGround(0,3.47);rounded(stone,'#a7a18e',0,padY+.018,3.47,1.8,.07,.30,.018);
 fixtures.steps.push({z:3.47,top:padY+.053,width:1.8,depth:.3,bottom:padY-.017});
 // Tall porch posts and a shallow, shingled door canopy, inside the existing eave envelope.
 for(const side of [-1,1]){
  foot(side*.74,2.45,.21,.13);box(wood,walnut,side*.74,1.325,2.45,.13,2.25,.13);
  beam(wood,honey,[side*.74,2.02,2.45],[side*.32,2.49,2.45],.04);
  beam(wood,honey,[side*.74,2.10,2.45],[side*.74,2.48,2.02],.04);
 }
 box(wood,walnut,0,2.49,2.26,1.82,.12,.68);
 for(let i=0;i<9;i++)box(wood,i%2?walnut:honey,(i-4)*.205,2.57,2.28,.20,.07,.76);
 box(bronze,'#786043',0,2.55,2.68,1.9,.08,.045);
 // Framed plank door, small frosted light and Z braces.
 rounded(wood,walnut,0,1.23,1.865,1.1,1.89,.14);
 for(let i=-3;i<=3;i++)box(wood,i%2?honey:'#aa7952',i*.133,1.22,1.953,.127,1.73,.045);
 for(const y of [.55,1.55])box(wood,walnut,0,y,1.992,.84,.072,.045);
 beam(wood,walnut,[-.37,.59,2.015],[.37,1.52,2.015],.031);
 rounded(frostedGlass,'#ffffff',0,1.84,1.988,.62,.27,.032);
 for(const x of [-.32,0,.32])box(wood,trim,x,1.84,2.013,.027,.30,.033);
 for(const y of [1.69,1.99])box(wood,trim,0,y,2.013,.67,.026,.033);
 for(const y of [.74,1.46]){box(iron,'#343530',-.39,y,2.035,.23,.045,.018);for(const x of [-.48,-.31])part(bronze,'#aa8955',new THREE.SphereGeometry(.009,6,4),x,y,2.049);}
 activeBatches=doorFallback;
 part(bronze,'#ba9255',new THREE.TorusGeometry(.046,.008,7,20),.29,1.2,2.059);
 box(iron,'#393b35',.29,1.225,2.027,.055,.11,.014);
 activeBatches=batches;
 function windowFrame(x,z,yaw){
  function panel(mat,color,u,v,depth,w,h,d,rot=0){const g=new THREE.BoxGeometry(w,h,d);g.rotateZ(rot);part(mat,color,g,x+u*Math.cos(yaw)+depth*Math.sin(yaw),1.52+v,z-u*Math.sin(yaw)+depth*Math.cos(yaw),0,yaw);}
  for(const u of [-.52,.52])panel(wood,walnut,u,0,.015,.09,1.14,.20);
  for(const v of [-.55,.55])panel(wood,walnut,0,v,.015,1.13,.10,.20);
  for(const side of [-1,1])for(let k=0;k<3;k++)panel(paint,k%2?'#d3bd94':'#a99273',side*(.38+k*.024),0,-.04,.035,.91,.045);
  // Four physical panes per window, separated by the existing cross-shaped timber mullions.
  for(const u of [-.24,.24])for(const v of [-.258,.258]){
   panel(glass,'#ffffff',u,v,.07,.429,.464,.012);fixtures.windowPanes++;
   for(const edge of [-1,1]){
    panel(glass,'#bcdde0',u+edge*.212,v,.078,.005,.462,.008);
    panel(glass,'#bcdde0',u,v+edge*.230,.078,.424,.005,.008);
   }
  }
  // Recessed timber returns bridge the back wall and jambs in an oblique view.
  for(const u of [-.46,.46])panel(wood,'#674a34',u,0,-.10,.028,1.01,.32);
  panel(wood,'#674a34',0,.49,-.10,.94,.032,.32);
  panel(wood,'#674a34',0,-.505,-.10,.94,.032,.32);
  panel(wood,trim,0,0,.108,.047,1.0,.05);panel(wood,trim,0,0,.108,.97,.045,.05);
  panel(wood,trim,0,-.6,.03,1.22,.12,.30);
  for(const side of [-1,1]){
   panel(wood,walnut,side*.68,0,.01,.23,1.07,.065);
   for(let k=0;k<8;k++)panel(wood,k%2?honey:'#916946',side*.68,-.44+k*.125,.053,.21,.065,.08,.10);
  }
  // Slim sill planter with individual flower petals and slender leaves.
  panel(wood,walnut,0,-.70,.16,1.03,.16,.22);
  for(let i=0;i<7;i++){
   const u=(i-3)*.127,depth=.18,fx=x+u*Math.cos(yaw)+depth*Math.sin(yaw),fz=z-u*Math.sin(yaw)+depth*Math.cos(yaw);
   flower(fx,.99+(i%2)*.025,fz,i%2?'#eac19b':'#d1b8c7',.026);
  }
 }
 function flower(x,y,z,petalColor,r=.035){
  cylinder(paint,'#426441',x,y-.08,z,.007,.16);
  for(let k=0;k<7;k++){const a=k*Math.PI*2/7,g=new THREE.SphereGeometry(r,7,5);g.scale(.65,.32,1.1);g.rotateY(a);part(paint,petalColor,g,x+Math.sin(a)*r*.75,y,z+Math.cos(a)*r*.75);}
  part(paint,'#d8ac49',new THREE.SphereGeometry(r*.35,8,5),x,y+.008,z);
  for(const side of [-1,1]){const leaf=new THREE.SphereGeometry(r*.7,7,4);leaf.scale(.38,.22,1.6);part(paint,'#476a46',leaf,x+side*r*.6,y-.08,z,0,side*.7,side*.45);}
 }
 for(const side of [-1,1]){windowFrame(side*1.36,1.89,0);windowFrame(side*2.27,.1,side*Math.PI/2);}
 rounded(wood,'#3c2c23',0,2.295,1.966,1.91,.37,.09,.025);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.79,.30),engravedSign());sign.name='Our Secret Haven · 2025.09.23';sign.position.set(0,2.295,2.016);group.add(sign);walls.push(sign);
 for(const x of [-.92,.92])for(const y of [2.15,2.44])part(bronze,'#b59058',new THREE.SphereGeometry(.016,8,6),x,y,2.028);
 // The emitter sits below the canopy soffit, rather than being buried in its beam.
 box(bronze,'#766044',0,2.44,2.12,.24,.025,.13);box(bulbs,'#e6bf81',0,2.417,2.13,.15,.018,.07);
 // Eleven bulbs now hang from an actual drooping cable with individual sockets.
 const cablePoints=[];
 for(let i=-5;i<=5;i++){const x=i*.42,y=3.57-Math.abs(x)*slope-.08*(1-Math.abs(i)/5);cablePoints.push(new THREE.Vector3(x,y,2.20));cylinder(bronze,'#514735',x,y-.026,2.20,.024,.049);part(bulbs,'#f5d39b',new THREE.SphereGeometry(.036,10,7),x,y-.069,2.20);}
 part(iron,'#33352c',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePoints),60,.007,5,false),0,0,0);
 for(const side of [-1,1])beam(iron,'#33352c',[side*2.1,2.48,2.17],[side*2.1,cablePoints[0].y,2.20],.005);
 beam(iron,'#33352c',[0,3.76,2.17],[0,cablePoints[5].y,2.20],.005);
 fixtures.stringBulbs=cablePoints.length;
 // Copper-hooped timber planters, leafy flowers and trailing vines replace faceted balls.
 for(const side of [-1,1]){
  const cx=side*1.4,cz=3.22;
  for(let i=0;i<9;i++)for(const dz of [-.23,.23])box(wood,i%2?honey:walnut,cx+(i-4)*.096,.52,cz+dz,.09,.35,.045);
  for(const dx of [-.45,.45])box(wood,walnut,cx+dx,.52,cz,.045,.35,.48);
  for(const y of [.41,.64]){for(const dz of [-.255,.255])box(bronze,'#81643f',cx,y,cz+dz,.94,.025,.02);for(const dx of [-.47,.47])box(bronze,'#81643f',cx+dx,y,cz,.02,.025,.51);}
  box(paint,'#343a28',cx,.681,cz,.84,.025,.40);
  for(let i=0;i<18;i++){const x=cx+(random()-.5)*.74,z=cz+(random()-.5)*.32;flower(x,.83+random()*.13,z,['#d6a7b4','#efd8a9','#c9b4d5'][i%3],.035+random()*.008);}
  for(let i=0;i<4;i++){
   const x=cx-.34+i*.22,pts=[new THREE.Vector3(x,.72,cz+.27),new THREE.Vector3(x+.07,.55,cz+.31),new THREE.Vector3(x-.03,.35,cz+.29)];
   part(paint,'#365338',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),10,.008,5,false),0,0,0);
   for(let k=0;k<5;k++){const leaf=new THREE.SphereGeometry(.037,7,5);leaf.scale(.5,.25,1.5);part(paint,'#426644',leaf,x+(k%2?.04:-.04),.68-k*.065,cz+.32,0,k*.7);}
  }
 }
 const lanternCenters=[];
 function lantern(x,y,z){
  lanternCenters.push([x,y+.18,z]);
  rounded(iron,'#30372f',x,y+.025,z,.21,.05,.21);rounded(frostedGlass,'#ffffff',x,y+.18,z,.145,.26,.145);
  cylinder(bulbs,'#edbc74',x,y+.15,z,.023,.11);
  for(const dx of [-1,1])for(const dz of [-1,1])cylinder(bronze,'#927343',x+dx*.09,y+.18,z+dz*.09,.009,.29);
  part(bronze,'#8d7145',new THREE.ConeGeometry(.18,.09,4),x,y+.36,z,0,Math.PI/4);
  part(bronze,'#a68a54',new THREE.TorusGeometry(.053,.007,7,20),x,y+.43,z);
 }
 lantern(.87,.34,3.04);activeBatches=hangingFallback;lantern(-.88,1.76,2.47);activeBatches=batches;
 beam(iron,'#33392f',[-.74,2.42,2.45],[-.88,2.23,2.47],.008);
 // A tiny brass chime moves only with updateSmoke's scene time (frozen in reduced motion).
 const chime=new THREE.Group();chime.name='porch-brass-wind-chime';chime.position.set(.89,2.36,2.46);group.add(chime);
 beam(iron,'#4c4937',[.89,2.48,2.46],[.89,2.385,2.46],.0025);
 const chimeTop=new THREE.Mesh(new THREE.ConeGeometry(.066,.07,10),new THREE.MeshStandardMaterial({color:'#a98a54',metalness:.75,roughness:.4}));chime.add(chimeTop);
 for(let i=0;i<4;i++){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.15+i*.018,8),chimeTop.material);
  const x=Math.cos(i*Math.PI/2)*.038,z=Math.sin(i*Math.PI/2)*.038;mesh.position.set(x,-.12,z);chime.add(mesh);
  const top=-.12+(.15+i*.018)/2,thread=new THREE.Mesh(new THREE.CylinderGeometry(.0015,.0015,-.005-top,5),chimeTop.material);
  thread.position.set(x,(top-.005)/2,z);chime.add(thread);
 }
 // A small tea table sits to the side of the clear approach to the door.
 cylinder(wood,honey,-1.34,.68,2.48,.31,.065);
 for(const dx of [-.19,.19])for(const dz of [-.14,.14])box(wood,walnut,-1.34+dx,.49,2.48+dz,.045,.34,.045);
 for(const dx of [-.13,.13]){cylinder(paint,'#c0b39b',-1.34+dx,.758,2.48,.047,.09);cylinder(paint,'#7a4e29',-1.34+dx,.804,2.48,.038,.008);part(paint,'#c0b39b',new THREE.TorusGeometry(.028,.006,7,16),-1.34+dx+.051,.759,2.48,0,Math.PI/2);}
 cylinder(frostedGlass,'#ffffff',-1.34,.76,2.65,.035,.082);cylinder(bulbs,'#edc387',-1.34,.79,2.65,.011,.023);
 for(let row=0;row<2;row++)for(let j=0;j<4-row;j++){part(wood,'#705039',new THREE.CylinderGeometry(.055,.068,.39,10),1.13+j*.14,.40+row*.11,2.10,Math.PI/2);}
 // Stone chimney, sloping metal flashing and a covered, recessed flue.
 for(let i=0;i<9;i++)for(let j=0;j<2;j++){const offset=(j-.5)*.36,alongX=i%2===0;box(stone,i%3===0?'#9b9187':'#b4afa0',-1.55+(alongX?offset:0),2.28+i*.245,-.90+(alongX?0:offset),alongX?.35:.73,.238,alongX?.73:.35);}
 box(iron,'#42473f',-1.55,2.99,-.9,1.04,.045,1.04,angle);box(iron,'#42473f',-1.55,3.15,-.9,.82,.28,.82);
 box(stone,'#827e71',-1.55,4.34,-.9,.87,.14,.87);box(iron,'#181d19',-1.55,4.425,-.9,.49,.025,.49);
 for(const dx of [-.32,.32])for(const dz of [-.32,.32])box(stone,'#929185',-1.55+dx,4.535,-.9+dz,.12,.24,.12);
 rounded(stone,'#777c70',-1.55,4.69,-.9,1.0,.13,1.0,.025);
 const names=new Map([[wood,'cabin-crafted-timber'],[stone,'cabin-stonework'],[paint,'cabin-flowers-and-interior-detail'],[bronze,'cabin-bronze-trim'],[iron,'cabin-iron-and-cables'],[glass,'cabin-recessed-window-glass'],[frostedGlass,'cabin-frosted-and-lantern-glass'],[bulbs,'cabin-bulbs-and-lamps'],[endGrain,'cabin-log-end-grain']]);
 const structureMaterials=new Set([wood,stone,endGrain]);
 for(const [mat,parts] of batches){mat.vertexColors=true;const merged=mergeGeometries(parts);if(!merged)throw new Error('Cabin material batch could not merge');for(const g of parts)g.dispose();const mesh=new THREE.Mesh(merged,mat);mesh.name=names.get(mat);if(mat===paint)mesh.userData.gardenFoliage=true;mesh.castShadow=mat!==glass&&mat!==frostedGlass&&mat!==bulbs;mesh.receiveShadow=true;group.add(mesh);if(structureMaterials.has(mat))walls.push(mesh);}
 function fallbackMesh(parts,name){
  const root=new THREE.Group();root.name=name;group.add(root);
  for(const [mat,list] of parts){mat.vertexColors=true;const mesh=new THREE.Mesh(mergeGeometries(list),mat);for(const g of list)g.dispose();mesh.castShadow=mat!==frostedGlass&&mat!==bulbs;mesh.receiveShadow=true;root.add(mesh);}
  return root;
 }
 const doorFallbackGroup=fallbackMesh(doorFallback,'cabin-door-hardware-fallback');
 const hangingFallbackGroup=fallbackMesh(hangingFallback,'cabin-hanging-lantern-fallback');
 const light=new THREE.PointLight('#ffb369',0,11,2);light.name='porch-warm-light';light.position.set(0,2.05,3.10);group.add(light);
 // Shared feathered texture has genuinely transparent edges, avoiding square smoke planes.
 const sc=document.createElement('canvas');sc.width=sc.height=96;const ctx=sc.getContext('2d'),grad=ctx.createRadialGradient(48,48,3,48,48,48);
 grad.addColorStop(0,'rgba(225,218,203,.65)');grad.addColorStop(.35,'rgba(225,218,203,.32)');grad.addColorStop(1,'rgba(225,218,203,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,96,96);const map=new THREE.CanvasTexture(sc);
 const lanternGlowMat=new THREE.SpriteMaterial({map,color:'#ffc778',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
 const lanternGlows=[];
 for(const position of lanternCenters){const sprite=new THREE.Sprite(lanternGlowMat);sprite.name='cabin-lantern-soft-glow';sprite.position.set(...position);sprite.scale.setScalar(.63);sprite.visible=false;group.add(sprite);lanternGlows.push(sprite);}
 const smoke=Array.from({length:8},()=>{const p=new THREE.Sprite(new THREE.SpriteMaterial({map,color:'#c7c4b9',transparent:true,depthWrite:false}));p.name='cabin-hearth-smoke';group.add(p);return p;});
 let warmth=0;
 function updateSmoke(t){
  bulbs.emissiveIntensity=(.035+1.6*warmth)*(1+.025*Math.sin(t*1.7));
  interiorGlowMat.emissiveIntensity=(.18+1.55*warmth)*(1+.018*warmth*Math.sin(t*2.3));
  for(let i=0;i<smoke.length;i++){const age=(t*.13+i/smoke.length)%1,p=smoke[i];p.position.set(-1.55+.65*(1-Math.exp(-age*12))+.15*age*age,4.55+Math.max(0,age-.2)*1.8,-.9+.13*Math.sin(6*age+i)*age);p.scale.setScalar(.09+.55*age);p.material.opacity=.21*Math.sin(Math.PI*age);}
  chime.rotation.z=Math.sin(t*1.1)*.025;chime.rotation.x=Math.sin(t*.73)*.012;
 }
 function setWarmth(amount){
  warmth=amount;lanternGlowMat.opacity=amount*.22;for(const glow of lanternGlows)glow.visible=lanternGlowMat.opacity>=.002;
  glass.opacity=.05+.035*amount;glass.emissiveIntensity=.002+.014*amount;glass.envMapIntensity=1.85-.85*amount;
  frostedGlass.opacity=.46+.12*amount;frostedGlass.emissiveIntensity=.02+.20*amount;frostedGlass.envMapIntensity=1.6-.55*amount;
  interiorFurnitureMat.emissive.lerpColors(dayInteriorBounce,nightHearthBounce,amount);interiorFurnitureMat.emissiveIntensity=.13+.13*amount;
  interiorGlowMat.emissiveIntensity=.18+1.55*amount;
  bulbs.emissiveIntensity=.035+1.6*amount;light.intensity=28*amount;
 }
 group.userData.architecture=fixtures;
 updateSmoke(0);setWarmth(0);
 let partsPromise=null;
 async function loadAsset(file,name,status,target,prepare){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
  try{
   const url=publicAssetURL(`models/${file}`);
   const response=await fetch(url,{signal:controller.signal});
   if(!response.ok){group.userData[status]='unavailable';return null;}
   const gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),new URL('.',new URL(url,location.href)).href);
   const asset=gltf.scene;asset.name=name;
   asset.traverse(obj=>{
    if(!obj.isMesh)return;
    obj.castShadow=false;obj.receiveShadow=true;prepare(obj);
    if(obj.material.vertexColors&&!obj.geometry.getAttribute('color')){
     const colors=new Float32Array(obj.geometry.attributes.position.count*3).fill(1);
     obj.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    }
   });
   target.add(asset);setWarmth(warmth);group.userData[status]='ready';return asset;
  }catch(error){group.userData[status]='unavailable';console.warn(`Cabin optional ${file} not available:`,error.message);return null;}
  finally{clearTimeout(timeout);}
 }
 function loadParts(target=group){
  if(partsPromise)return partsPromise;
  // Independent requests: a missing/malformed detail asset must not hide the room.
  partsPromise=Promise.all([
   loadAsset('cabin-parts.glb','cabin-artisan-parts','partsStatus',target,obj=>{
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];
    if(mats.some(m=>m.name==='Cabin_Lamp_Glass'))obj.material=frostedGlass;
    else if(mats.some(m=>m.name==='Cabin_Wick_Emission'))obj.material=bulbs;
   }).then(parts=>{if(parts){doorFallbackGroup.visible=false;hangingFallbackGroup.visible=false;}return parts;}),
   loadAsset('cabin-interior.glb','cabin-interior-room','interiorStatus',target,obj=>{
    obj.material=obj.material.name==='Cabin_Interior_Glow'?interiorGlowMat:interiorFurnitureMat;
   })
  ]).then(([parts])=>parts||null);
  return partsPromise;
 }
 return {group,walls,setWarmth,updateSmoke,loadParts};
}
