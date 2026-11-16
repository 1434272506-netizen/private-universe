import * as THREE from 'three';

function textileMap(plaid=false){
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
 ctx.fillStyle=plaid?'#785f85':'#fffaf0';ctx.fillRect(0,0,256,256);
 if(plaid){
  ctx.fillStyle='#4a6852';for(let n=0;n<4;n++){ctx.fillRect(n*64,0,31,256);ctx.fillRect(0,n*64,256,31);}
  ctx.fillStyle='#e8dccb';for(let n=0;n<4;n++){ctx.fillRect(n*64+40,0,2,256);ctx.fillRect(0,n*64+40,256,2);}
 }
 for(let n=0;n<256;n+=3){ctx.fillStyle=n%2?'#ffffff15':'#3d342414';ctx.fillRect(n,0,1,256);ctx.fillRect(0,n,256,1);}
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
}

// All solid decorations feed the cabin's existing material batches. Only the
// two textiles need additional meshes; tea steam and bulb halos use two draws.
export function makeCabinArtistry(api){
 const {part,box,rounded,cylinder,beam,wood,paint,bronze,iron,frostedGlass,bulbs,group}=api;
 const linen=new THREE.MeshStandardMaterial({map:textileMap(),color:'#fffaf0',roughness:1,transparent:true,opacity:.58,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});
 const wool=new THREE.MeshStandardMaterial({map:textileMap(true),roughness:.98,side:THREE.DoubleSide});
 const chairOrigin={x:-1.60,z:2.63};
 const stats={palette:['#f4ede2','#e8dccb','#8a7499','#ffffff','#f2a7b8'],flowers:{lavender:0,marguerite:0,rose:0},foliageLeaves:0,ivyLeaves:0,teaSteamCount:12,stringHaloCount:11,chairBounds:[-1.97,.32,2.26,-1.20,1.30,2.95],chairBackPlaneZ:chairOrigin.z-.31,sillBloomFrontZ:2.30,tableCentre:[-1.03,.68,2.67]};
 function leaf(x,y,z,size=.05,yaw=0,drop=0,color='#456341'){
  const g=new THREE.PlaneGeometry(size,size*1.8,4,6),a=g.attributes.position;
  for(let i=0;i<a.count;i++){
   const u=a.getX(i)/(size*.5),v=a.getY(i)/(size*.9);
   a.setX(i,a.getX(i)*Math.sqrt(Math.max(0,1-v*v)));
   a.setZ(i,size*(.12*Math.abs(u)+.28*(1-v*v))); // soft central rib and curled edge
  }
  g.computeVertexNormals();part(paint,color,g,x,y,z,-Math.PI*.35-drop,yaw,.35*Math.sin(yaw));stats.foliageLeaves++;
 }
 function stem(points,r=.0035,color='#46623c'){
  part(paint,color,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),10,r,5,false),0,0,0);
 }
 function petal(width,length,cup=.35){
  const g=new THREE.PlaneGeometry(width,length,4,6),a=g.attributes.position;
  for(let i=0;i<a.count;i++){
   const t=THREE.MathUtils.clamp((a.getY(i)+length/2)/length,0,1),u=a.getX(i)/(width/2);
   a.setX(i,a.getX(i)*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.45));
   a.setZ(i,length*(cup*t*t+.12*u*u*Math.sin(Math.PI*t)));
  }
  g.computeVertexNormals();return g;
 }
 function bloom(x,y,z,kind='marguerite',scale=1,phase=0){
  stats.flowers[kind]++;
  const height=kind==='lavender'?.25*scale:.16*scale;
  stem([[x-.025*scale,y-height,z],[x+.012*scale,y-height*.45,z-.012*scale],[x,y,z]]);
  for(const side of [-1,1])leaf(x+side*.027*scale,y-height*.65,z,.036*scale,phase+side*.7,.15);
  if(kind==='lavender'){
   for(let level=0;level<6;level++)for(let k=0;k<3;k++){
    const angle=k*Math.PI*2/3+level*.6+phase,r=.020*scale*(1-level*.09);
    const bud=new THREE.SphereGeometry(.014*scale,8,5);bud.scale(.7,1.3,.75);
    part(paint,level%2?'#8a7499':'#b09abf',bud,x+Math.cos(angle)*r,y+level*.025*scale,z+Math.sin(angle)*r);
   }
  }else if(kind==='rose'){
   for(let ring=0;ring<3;ring++)for(let k=0;k<5;k++){
    const a=k*Math.PI*2/5+ring*.57+phase,r=(.019-ring*.005)*scale;
    const g=petal((.035-ring*.006)*scale,(.048-ring*.010)*scale,.55);
    part(paint,ring===2?'#efbdd0':'#f2a7b8',g,x+Math.sin(a)*r,y+ring*.008*scale,z+Math.cos(a)*r,-Math.PI/2+.45,a,.10);
   }
   part(paint,'#e6b881',new THREE.SphereGeometry(.010*scale,8,5),x,y+.026*scale,z);
  }else{
   for(let k=0;k<10;k++){
    const a=k*Math.PI/5+phase,r=.025*scale;
    part(paint,'#ffffff',petal(.021*scale,.058*scale,.25),x+Math.sin(a)*r,y,z+Math.cos(a)*r,-Math.PI/2+.14*Math.sin(a),a,0);
   }
   const centre=new THREE.SphereGeometry(.015*scale,10,6);centre.scale(1,.45,1);part(paint,'#d8b25c',centre,x,y+.010*scale,z);
  }
 }
 function sill(x,z,yaw){
  const W=(u,y,d)=>[x+u*Math.cos(yaw)+d*Math.sin(yaw),y,z-u*Math.sin(yaw)+d*Math.cos(yaw)];
  for(let i=0;i<12;i++){
   const u=(i%6-2.5)*.151+.015*Math.sin(i*2.4),d=.18+Math.floor(i/6)*.12+.012*Math.cos(i*1.8);
   const [fx,fy,fz]=W(u,1.02+(i%3)*.035,d);bloom(fx,fy,fz,['lavender','marguerite','rose'][i%3],.76+(i%2)*.15,i*.8);
  }
  const trails=x<0&&yaw===0?[.16,.29,.42]:[-.36,-.12,.12,.36];
  for(const u of trails){
   stem([W(u,.88,.26),W(u+.035,.76,.34),W(u-.02,.65,.35)],.0035);
   for(let j=0;j<4;j++){const p=W(u+(j%2?.035:-.035),.85-j*.056,.34);leaf(...p,.035,yaw+j*.9,.55);}
  }
 }
 function curtain(x,z,yaw){
  function panel(u,v,w,h){
   const g=new THREE.PlaneGeometry(w,h,12,18),a=g.attributes.position;
   for(let i=0;i<a.count;i++)a.setZ(i,.012*Math.sin((a.getX(i)/w+.5)*Math.PI*8)+.004*Math.sin(a.getY(i)*19));
   g.computeVertexNormals();part(linen,'#ffffff',g,x+u*Math.cos(yaw)-.055*Math.sin(yaw),1.52+v,z-u*Math.sin(yaw)-.055*Math.cos(yaw),0,yaw);
  }
  for(const side of [-1,1])panel(side*.395,0,.13,.96);
  panel(0,.464,.86,.08);
 }
 function porchGarden(cx,cz){
  for(let i=0;i<21;i++)bloom(cx+((i%7)-3)*.112+.025*Math.sin(i*2.4),.83+(i%3)*.05+.018*Math.sin(i*1.7),cz+((Math.floor(i/7))-1)*.12+.018*Math.cos(i*1.8),['rose','marguerite','lavender'][i%3],.90+(i%4)*.06,i*.7);
 }
 function ivy(points,leaves=25){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  part(paint,'#4a6341',new THREE.TubeGeometry(curve,48,.008,5,false),0,0,0);
  for(let i=0;i<leaves;i++){
   const p=curve.getPoint(i/(leaves-1));leaf(p.x+(i%2?.042:-.042),p.y,p.z+.024,.046+(i%3)*.006,i*.89,.2);stats.ivyLeaves++;
   if(i%6===3)bloom(p.x+.025,p.y-.012,p.z+.025,'lavender',.43,i);
  }
 }
 function chairAndTea(){
  const {x,z}=chairOrigin;
  for(const side of [-1,1]){
   const a=[new THREE.Vector3(x+side*.29,.365,z-.34),new THREE.Vector3(x+side*.29,.345,z),new THREE.Vector3(x+side*.29,.39,z+.27)];
   part(wood,'#60412e',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(a),24,.025,8,false),0,0,0);
   for(const dz of [-.21,.22])beam(wood,'#8a5a36',[x+side*.25,.37,z+dz],[x+side*.25,.68,z+dz],.021);
   rounded(wood,'#8a5a36',x+side*.29,.86,z,.05,.055,.62,.016);
   beam(wood,'#60412e',[x+side*.28,.66,z-.23],[x+side*.28,1.27,z-.31],.025);
  }
  for(let k=0;k<7;k++)rounded(wood,k%2?'#a5754b':'#8a5a36',x+(k-3)*.076,.66,z,.072,.055,.48,.012);
  for(let k=0;k<6;k++)rounded(wood,'#8a5a36',x+(k-2.5)*.088,1.02,z-.29,.070,.45,.045,.012);
  const cloth=new THREE.PlaneGeometry(.48,.72,16,24),a=cloth.attributes.position;
  for(let i=0;i<a.count;i++){
   const u=a.getX(i),t=(a.getY(i)+.36)/.72;
   const cy=t<.56?.71+t*.95:1.242-(t-.56)*.8;
   const cz=t<.56?z-.15-t*.20:z-.262-(t-.56)*.11;
   a.setXYZ(i,u+.008*Math.sin(t*15),cy,cz+.009*Math.sin(u*55));
  }
  cloth.computeVertexNormals();part(wool,'#ffffff',cloth,x,0,0);
  // Fine fringe is tucked behind the seat, away from the walking corridor.
  for(let i=0;i<12;i++)beam(paint,i%2?'#785f85':'#4a6852',[x-.22+i*.04,.71,z-.15],[x-.22+i*.04,.67,z-.13],.0018);
  const tx=-1.03,tz=2.67;
  cylinder(wood,'#a5754b',tx,.68,tz,.25,.055);
  for(const dx of [-.15,.15])for(const dz of [-.13,.13])beam(wood,'#60412e',[tx+dx,.345,tz+dz],[tx+dx,.655,tz+dz],.018);
  for(const [i,dx] of [-.11,.11].entries()){
   const cup=new THREE.LatheGeometry([new THREE.Vector2(.029,0),new THREE.Vector2(.042,.012),new THREE.Vector2(.045,.07),new THREE.Vector2(.041,.078),new THREE.Vector2(.035,.075),new THREE.Vector2(.034,.02)],18);
   part(paint,i?'#e8dccb':'#c3cdb5',cup,tx+dx,.711,tz-.05);
   cylinder(paint,'#6e432b',tx+dx,.780,tz-.05,.034,.004);
   part(paint,i?'#e8dccb':'#c3cdb5',new THREE.TorusGeometry(.025,.006,8,18),tx+dx+(i? .047:-.047),.752,tz-.05,0,Math.PI/2);
   cylinder(paint,'#e8dccb',tx+dx,.712,tz-.05,.059,.008);
  }
  cylinder(paint,'#f4ede2',tx,.715,tz+.095,.071,.010);
  for(let i=0;i<3;i++){
   const cx=tx+(i-1)*.036,cz=tz+.09+(i%2)*.028;
   cylinder(paint,'#bb8854',cx,.727,cz,.026,.014);
   for(let k=0;k<4;k++)part(paint,'#70472e',new THREE.SphereGeometry(.0035,6,4),cx+Math.cos(k*2.1+i)*.014,.736,cz+Math.sin(k*2.1+i)*.014);
  }
  cylinder(frostedGlass,'#ffffff',tx+.10,.755,tz+.12,.028,.065);cylinder(bulbs,'#ffd8a1',tx+.10,.776,tz+.12,.009,.024);
 }
 chairAndTea();
 ivy([[.81,.55,2.49],[.79,1.08,2.51],[.84,1.52,2.47],[.80,1.95,2.50],[.72,2.30,2.52]],29);
 ivy([[-1.94,2.34,-.70],[-1.92,2.79,-.69],[-1.97,3.24,-.66],[-1.91,3.69,-.66],[-1.96,4.18,-.66]],27);
 let steam,halos;
 function addEffects(map,bulbPositions){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(36),3));geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(48),4));
  steam=new THREE.Points(geometry,new THREE.PointsMaterial({map,color:'#fff0dc',size:.075,transparent:true,opacity:.24,depthWrite:false,vertexColors:true}));steam.name='porch-tea-steam';steam.frustumCulled=false;group.add(steam);
  const g=new THREE.BufferGeometry().setFromPoints(bulbPositions);
  halos=new THREE.Points(g,new THREE.PointsMaterial({map,color:'#ffd097',size:.20,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));halos.name='cabin-edison-soft-halos';halos.visible=false;group.add(halos);
 }
 function update(t,warmth){
  if(steam)for(let i=0;i<12;i++){
   const age=(t*.20+(i%6)/6)%1,side=i<6?-1:1;
   steam.geometry.attributes.position.setXYZ(i,-1.03+side*.11+Math.sin(t*.65+i)*.014*age,.796+age*.31,2.62+Math.cos(t*.8+i)*.016*age);
   steam.geometry.attributes.color.setXYZW(i,1,1,1,Math.sin(age*Math.PI)*.55);
  }
  if(steam){steam.geometry.attributes.position.needsUpdate=true;steam.geometry.attributes.color.needsUpdate=true;}
  if(halos){halos.material.opacity=warmth*.21*(1+.035*Math.sin(t*1.7));halos.visible=halos.material.opacity>=.002;}
 }
 return {sill,curtain,porchGarden,bloom,addEffects,update,stats,materials:[[linen,'cabin-linen-sheer-curtains'],[wool,'cabin-couple-plaid-wool']]};
}
