import * as THREE from 'three';

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
export function trace(group,points,color) {
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),ink(color,.76)));
}
export function constellation(group,name,catalog,edges,origin,scale,main,color) {
  const [ra,dec]=catalog[0];
  const points=catalog.map(([r,d])=>vec(origin-(r-ra)*Math.cos(dec*Math.PI/180)*scale,(d-dec)*scale));
  const stars=new THREE.Points(new THREE.BufferGeometry().setFromPoints(points),
    new THREE.PointsMaterial({color,size:.26,depthWrite:false}));
  stars.name=name;group.add(stars);
  const lines=edges.flatMap(([a,b])=>[points[a],points[b]]);
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines),ink(color,.65)));
  const beacon=new THREE.Points(new THREE.BufferGeometry().setFromPoints([points[main]]),
    new THREE.PointsMaterial({color,size:.48,depthWrite:false}));
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

export function makePortal(sag) {
  const portal=new THREE.Group(),realm=new THREE.Group();
  const colors=sag?['#ff9e42','#e85d75']:['#60a5fa','#ff6b3d'];
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
  const map=new THREE.TextureLoader().load(import.meta.env.BASE_URL+'textures/constellations/'+file+'.png');
  map.colorSpace=THREE.SRGBColorSpace;
  const veil=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,opacity:.55,
    blending:THREE.AdditiveBlending,depthWrite:false}));
  veil.name=file;veil.position.set(0,0,-5);veil.scale.setScalar(25);
  portal.add(veil,halo,spikes,core,hitProxy,title);
  realm.name=portal.name+'-realm';realm.position.copy(portal.position);realm.visible=false;
  const backdrop=veil.clone();backdrop.position.z=-9;backdrop.scale.setScalar(32);realm.add(backdrop);
  if(sag)constellation(realm,'sagittarius-teapot',archer,[[0,1],[0,2],[1,2],[1,3],[3,6],[6,5],[5,7],[7,4],[4,2],[4,6]],4,.48,5,colors[0]);
  else constellation(realm,'taurus-hyades',bull,[[0,4],[4,2],[2,3],[3,1],[1,5],[0,6]],1,.32,0,colors[1]);
  // Draw the centaur archer and the bull as luminous celestial atlas outlines.
  const figure=new THREE.Group();figure.position.set(0,2.3,.4);figure.scale.setScalar(.64);
  const strokes=sag?[
    [[-4,-1],[-3,0],[-1,0],[0,1],[.2,2],[.8,2.5],[1.2,2.2],[1,1.5],[.8,1],[2,1.3],[3,1.4]],
    [[1,1.4],[.2,1.6],[1,1.9],[3,1.4]],[[2.5,3],[3.3,2.2],[3.5,1.4],[3.2,.5],[2.5,-.1],[3,1.4],[2.5,3]],
    [[1,1.5],[4.4,1.3],[4,1.6]],[[.8,1],[1,-.5],[2,-1.2],[2.5,-2],[1.5,-1.6],[.2,-1],[-2,-1],[-3,-2.3],[-3.4,-2.3],[-3,-.6],[-4,-1],[-4.5,-1.8]]
  ]:[
    [[-4,0],[-3,1],[-1,1.4],[.5,1.1],[1.4,1.6],[2.5,1.2],[3,.2],[2.2,-.2],[1.5,0],[.5,-.7],[-1.5,-.8],[-2.4,-1.8],[-3,-2],[-2.8,-.5],[-4,0],[-4.4,-1]],
    [[1.4,1.6],[.4,2.1],[0,3.4],[.8,2.6],[2,2]],[[2,1.5],[3.2,2.2],[3.8,3.5],[3.6,2],[2.7,1]],
    [[.5,-.7],[1.7,-1.2],[2.8,-1.1],[1.8,-.7]]
  ];
  for(const stroke of strokes)trace(figure,stroke.map(([x,y])=>vec(x,y)),colors[0]);
  if(!sag){const eye=glow(colors[1],.9);eye.position.set(2.2,1,.1);figure.add(eye);}
  const letter=label(sag?'一隅春天 · 射手的奔赴与自由':'一隅春天 · 金牛的执着与长情',0,-3);
  realm.add(figure,letter);
  return {portal,realm,hitProxy,halo,title,spikes};
}
