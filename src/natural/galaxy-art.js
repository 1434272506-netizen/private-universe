import * as THREE from 'three';
import {publicAssetURL} from '../public-assets.js';
import {starTexture} from './star-texture.js';

// J2000 right ascension (degrees) and declination. Project each asterism
// independently so both distant sky regions fit in one keepsake view.
export const archer = [[271.45,-30.42],[275.25,-29.83],[276.04,-34.38],[276.99,-25.42],
  [285.65,-29.88],[283.82,-26.30],[281.41,-26.99],[286.74,-27.67]];
export const bull = [[68.98,16.51],[67.15,19.18],[64.95,15.63],[65.73,17.54],[67.17,15.87],
  [81.57,28.61],[84.41,21.14],[56.87,24.11],[56.22,24.11],[56.46,24.37],[56.58,23.95],[57.29,24.05],[57.13,24.05]];
const vec = (x,y,z=0)=>new THREE.Vector3(x,y,z);
const ink = (color, opacity=1)=>new THREE.LineBasicMaterial({color, transparent:true, opacity});
export function label(text,x,y) {
  const c=document.createElement('canvas');c.width=512;c.height=96;
  const ctx=c.getContext('2d');ctx.font='40px serif';ctx.textAlign='center';ctx.fillStyle='#ffecd3';ctx.fillText(text,256,63,500);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));
  sprite.position.set(x,y,0);sprite.scale.set(10,1.875,1);return sprite;
}
function luminousStar(color,size){
  const material=new THREE.PointsMaterial({map:starTexture,color,size,toneMapped:false,transparent:true,
    blending:THREE.AdditiveBlending,depthWrite:false});
  return material;
}
export function constellation(group,name,catalog,edges,origin,scale,main,color) {
  const [ra,dec]=catalog[0];
  const points=catalog.map(([r,d])=>vec(origin-(r-ra)*Math.cos(dec*Math.PI/180)*scale,(d-dec)*scale));
  const stars=new THREE.Points(new THREE.BufferGeometry().setFromPoints(points),
    luminousStar(color,.36));
  stars.name=name;group.add(stars);
  const lines=edges.flatMap(([a,b])=>[points[a],points[b]]);
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines),ink(color,.55)));
  const beacon=new THREE.Points(new THREE.BufferGeometry().setFromPoints([points[main]]),
    luminousStar(color,.75));
  group.add(beacon);
  return {pos:points[main],beacon};
}


export function glow(color, size) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'), grad=ctx.createRadialGradient(64,64,0,64,64,64);
  grad.addColorStop(0,'white');grad.addColorStop(.18,color);grad.addColorStop(1,'transparent');
  ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,blending:THREE.AdditiveBlending,depthWrite:false}));
  sprite.scale.setScalar(size);return sprite;
}

function diffraction(tint){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.translate(64,64);
  for(let i=0;i<4;i++){
    const grad=ctx.createLinearGradient(0,0,63,0);
    grad.addColorStop(0,'white');grad.addColorStop(.22,tint);grad.addColorStop(1,'transparent');
    ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(0,-2.6);ctx.lineTo(63,0);ctx.lineTo(0,2.6);ctx.fill();
    ctx.rotate(Math.PI/2);
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,blending:THREE.AdditiveBlending,depthWrite:false}));
  sprite.scale.setScalar(6);return sprite;
}

function journalCard(sag,tint){
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=296;
  const ctx=canvas.getContext('2d');
  const wash=ctx.createLinearGradient(0,0,1100,296);
  wash.addColorStop(0,'rgba(25,44,65,.90)');wash.addColorStop(1,'rgba(9,20,43,.83)');
  ctx.beginPath();ctx.roundRect(5,5,1190,286,23);ctx.fillStyle=wash;ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle='rgba(224,235,255,.35)';ctx.stroke();
  ctx.textAlign='center';
  function line(text,y,size,color){
    ctx.font=size+'px "Noto Serif SC","Songti SC","SimSun",serif';
    ctx.fillStyle=color;ctx.fillText(text,600,y,1120);
  }
  line(sag?'【 ♐ 射手座 · 翡翠引路星 】':'【 ♉ 金牛座 · 紫晶守望星 】',72,37,tint);
  line(sag?'「 一隅春天 · 射手的奔赴与自由 」':'「 一隅春天 · 金牛的执着与长情 」',152,48,'#f5ead9');
  line(sag?'“跨越数万光年的星河，奔赴一场属于我们的春天。”':'“岁月漫长，执守这方只属于我们的春日宇宙。”',232,36,'#cedbe8');
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const card=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,toneMapped:false}));
  card.name='realm-journal';card.scale.set(8,8*296/1200,1);card.position.set(0,-2.8,.75);card.renderOrder=5;
  return card;
}

function deepStarfield(){
  const count=2000,positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  const sizes=new Float32Array(count);
  const palette=['#fff','#d0e6ff','#ffe8bc'].map(hex=>new THREE.Color(hex));
  for(let i=0;i<count;i++){
    positions.set([52*Math.random()-26,40*Math.random()-20,-16-16*Math.random()],3*i);
    const tier=i<1400?0:i<1900?1:2;
    sizes[i]=[.12,.18,.28][tier]/.16;
    const color=palette[Math.floor(Math.random()*palette.length)];
    const brightness=[.38,.68,.96][tier]*(.85+.15*Math.random());
    colors.set([color.r*brightness,color.g*brightness,color.b*brightness],3*i);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.setAttribute('starScale',new THREE.BufferAttribute(sizes,1));
  const material=new THREE.PointsMaterial({map:starTexture,size:.16,vertexColors:true,transparent:true,
    blending:THREE.AdditiveBlending,depthWrite:false});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float starScale;\n'+shader.vertexShader.replace(
      'gl_PointSize = size;', 'gl_PointSize = size * starScale;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',
      '#include <alphamap_fragment>\ndiffuseColor.a *= 1.0-smoothstep(0.0,1.0,length(2.0*gl_PointCoord-1.0));');
  };
  const stars=new THREE.Points(geometry,material);
  stars.name='realm-starfield';stars.renderOrder=-2;return stars;
}

export function makePortal(sag) {
  const portal=new THREE.Group(),realm=new THREE.Scene();
  portal.position.set(...(sag?[-18,14,-22]:[22,18,-16]));
  portal.name=sag?'sagittarius-portal':'taurus-portal';
  const tint=sag?'#10b981':'#c084fc';
  const core=glow('#ffffff',.28),halo=glow(tint,4);
  const spikes=diffraction(tint);
  const hitProxy=new THREE.Mesh(new THREE.BoxGeometry(4.4,4.4,4.4),new THREE.MeshBasicMaterial({visible:false}));
  hitProxy.name='hitProxy';
  const title=label(sag?'♐ 射手座 · 翡翠星':'♉ 金牛座 · 紫晶星',0,-2.5);
  title.visible=false;title.scale.multiplyScalar(.75);
  const file=sag?'m8-lagoon':'m45-pleiades';
  const map=new THREE.TextureLoader().load(publicAssetURL('textures/constellations/'+file+'.png'));
  map.colorSpace=THREE.SRGBColorSpace;
  // Sample the interior of the observation. The haze dissolves independently
  // of the original photograph's circular alpha mask.
  const hazeMaterial=new THREE.ShaderMaterial({
    uniforms:{photo:{value:map},strength:{value:.4}},transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 st;
      void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D photo;uniform float strength;varying vec2 st;
      void main(){
        vec2 p=st*2.-1.;
        vec2 q=vec2(p.x,p.y+.23*sin(p.x*3.)-.12*p.x);
        float density=exp(-4.*q.x*q.x-9.*q.y*q.y);
        vec2 edge=1.-smoothstep(vec2(.58),vec2(1.),abs(p));
        vec3 light=texture2D(photo,.5+.28*p).rgb;
        gl_FragColor=vec4(light,strength*density*edge.x*edge.y);
        #include <colorspace_fragment>
      }`
  });
  const veil=new THREE.Mesh(new THREE.PlaneGeometry(1,1),hazeMaterial);
  veil.name=file;veil.position.set(0,0,-8);veil.scale.set(64,36,1);
  portal.add(veil,halo,spikes,core,hitProxy,title);
  realm.add(deepStarfield());
  realm.name=portal.name+'-realm';realm.position.copy(portal.position);realm.visible=false;
  const backdrop=veil.clone();backdrop.material=veil.material.clone();backdrop.material.uniforms.photo.value=map;backdrop.material.uniforms.strength.value=.35;backdrop.position.z=-12;backdrop.scale.set(54,36,1);backdrop.renderOrder=-1;realm.add(backdrop);
  if(sag)constellation(realm,'sagittarius-teapot',archer,[[0,1],[0,2],[1,2],[1,3],[3,6],[6,5],[5,7],[7,4],[4,2],[4,6]],4,.48,5,'#e0fbf0');
  else constellation(realm,'taurus-hyades',bull,[[0,4],[4,2],[2,3],[3,1],[1,5],[0,6]],1,.32,0,'#ffe2ba');
  const atlas=new THREE.TextureLoader().load(publicAssetURL('textures/constellations/stellarium-'+(sag?'sagittarius':'taurus')+'.png'));
  // Treat the monochrome engraving as a light-intensity mask.
  const figure=new THREE.Mesh(new THREE.PlaneGeometry(5.35,5.35),new THREE.MeshBasicMaterial({
    map:atlas,color:tint,opacity:.72,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false
  }));
  figure.name='stellarium-figure';figure.position.set(0,1.28,.55);
  if(!sag){
    const eye=glow('#ff603d',.55);
    eye.position.set((.457-.5)*5.35,(.5-.45)*5.35,.02);figure.add(eye);
  }
  realm.add(figure,journalCard(sag,tint));
  return {portal,realm,hitProxy,halo,title,spikes};
}
