import * as THREE from 'three';
import {createLIFSolver} from './connectome/lif-solver.js';
import {ground,inside,creekX,creekWidth,onCabinFloor,CABIN_SITE} from './land.js';

function makeWingGeometry(){
 // Slender tapered beetle wing anchored at hinge x=0, extending along +x.
 const pts=[
  [0,0,-.006],[.025,.006,-.026],[.072,.008,-.024],[.105,.004,-.006],
  [.102,0,.012],[.064,-.003,.024],[.022,-.002,.016],[0,0,.007]
 ];
 const positions=[.018,.002,0],indices=[];
 for(const p of pts)positions.push(p[0],p[1],p[2]);
 for(let i=0;i<pts.length;i++)indices.push(0,i+1,(i+1)%pts.length+1);
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 g.setIndex(indices);
 g.computeVertexNormals();
 return g;
}

function makeGlowTexture(){
 // Crisp pinpoint ember core with fast exponential feathering (no hazy green blotches).
 const c=document.createElement('canvas');c.width=c.height=64;
 const ctx=c.getContext('2d'),grad=ctx.createRadialGradient(32,32,0,32,32,32);
 grad.addColorStop(0,'rgba(255,254,224,1)');
 grad.addColorStop(.14,'rgba(242,255,165,.72)');
 grad.addColorStop(.35,'rgba(196,255,92,.16)');
 grad.addColorStop(.65,'rgba(165,240,64,.02)');
 grad.addColorStop(1,'rgba(165,240,64,0)');
 ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
 return new THREE.CanvasTexture(c);
}

function makeCoreSparks(count){
 // Distance-clamped star-core sparks ensure overview visibility without macro fog bloat.
 const positions=new Float32Array(count*3),flashes=new Float32Array(count);
 const geo=new THREE.BufferGeometry();
 const posAttr=new THREE.Float32BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage);
 const flashAttr=new THREE.Float32BufferAttribute(flashes,1).setUsage(THREE.DynamicDrawUsage);
 geo.setAttribute('position',posAttr);geo.setAttribute('aFlash',flashAttr);
 const mat=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{uScale:{value:1}},
  vertexShader:`attribute float aFlash; varying float vFlash;
   void main(){vFlash=aFlash; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv;
   gl_PointSize=aFlash>0.01?clamp((26.0+46.0*aFlash)/max(1.0,-mv.z),3.2,14.5):0.0;}`,
  fragmentShader:`varying float vFlash;
   void main(){float d=length(gl_PointCoord-0.5)*2.0; if(d>1.0)discard;
   float core=pow(max(0.0,1.0-d),1.8);
   vec3 col=mix(vec3(0.80,1.0,0.38),vec3(1.0,0.97,0.70),core);
   gl_FragColor=vec4(col,core*min(1.0,vFlash*1.25));}`
 });
 const points=new THREE.Points(geo,mat);points.name='neural-fly-cores';points.frustumCulled=false;
 return {points,posAttr,flashAttr,geo,mat};
}

export function createNeuralFireflies(scene,{lanternSites=[],obstacles=[],flowerMeshes=[],camera}={}){
 const count=80,solver=createLIFSolver(count),group=new THREE.Group();
 group.name='neural-fireflies';group.visible=false;scene.add(group);
 const flowersList=[],m=new THREE.Matrix4(),v=new THREE.Vector3();
 for(const mesh of flowerMeshes.filter(Boolean)){
  mesh.updateWorldMatrix(true,false);
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);v.setFromMatrixPosition(m).applyMatrix4(mesh.matrixWorld);flowersList.push(v.x,v.z);}
 }
 const flowerCoords=new Float32Array(flowersList),flowerCount=flowerCoords.length/2;
 const boxes=obstacles.map(b=>b.clone().expandByScalar(.25));
 const lightsArr=lanternSites.concat([[CABIN_SITE.x+2,2,CABIN_SITE.z+2],[44,48,-94]]);
 const lightCoords=new Float32Array(lightsArr.length*2);
 for(let k=0;k<lightsArr.length;k++){lightCoords[k*2]=lightsArr[k][0];lightCoords[k*2+1]=lightsArr[k][2];}
 const lightCount=lightsArr.length;

 const dummy=new THREE.Object3D(),color=new THREE.Color(),lime=new THREE.Color('#ccff5c'),gold=new THREE.Color('#fff08a'),dimRest=new THREE.Color('#2c3818');
 function instances(name,geometry,material){
  const mesh=new THREE.InstancedMesh(geometry,material,count);
  mesh.name=name;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(mesh);return mesh;
 }
 const body=instances('neural-fly-bodies',new THREE.SphereGeometry(1,8,6),new THREE.MeshStandardMaterial({color:'#30381c',roughness:.75}));
 const head=instances('neural-fly-heads',new THREE.SphereGeometry(1,8,6),new THREE.MeshStandardMaterial({color:'#2a311a',roughness:.68}));
 const shell=instances('neural-fly-elytra',new THREE.SphereGeometry(1,8,6),new THREE.MeshStandardMaterial({color:'#485828',metalness:.18,roughness:.58}));
 const wingGeo=makeWingGeometry();
 const wingMat=new THREE.MeshStandardMaterial({color:'#f2efc8',transparent:true,opacity:.48,side:THREE.DoubleSide,depthWrite:false});
 const leftWing=instances('neural-fly-left-wings',wingGeo,wingMat),rightWing=instances('neural-fly-right-wings',wingGeo,wingMat);
 const tail=instances('neural-fly-lanterns',new THREE.SphereGeometry(1,10,8),new THREE.MeshBasicMaterial({color:'white'}));
 const texture=makeGlowTexture();
 // One additive billboard batch replaces the individual sprite submissions.
 // Retain SpriteMaterial's texture, colour, opacity, world size and depth test.
 const haloGeometry=new THREE.PlaneGeometry(1,1),haloOpacity=new THREE.InstancedBufferAttribute(new Float32Array(count),1).setUsage(THREE.DynamicDrawUsage);
 haloGeometry.setAttribute('aHaloOpacity',haloOpacity);
 const haloMaterial=new THREE.MeshBasicMaterial({map:texture,color:'#d8ff6e',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
 haloMaterial.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float aHaloOpacity; varying float vHaloOpacity;')
   .replace('#include <project_vertex>',`vHaloOpacity=aHaloOpacity;
    vec4 mvPosition=modelViewMatrix*vec4(instanceMatrix[3].xyz,1.0);
    vec2 haloScale=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
    mvPosition.xy+=transformed.xy*haloScale;
    gl_Position=projectionMatrix*mvPosition;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vHaloOpacity;')
   .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vHaloOpacity;');
 };
 haloMaterial.customProgramCacheKey=()=> 'neural-halo-billboards-v1';
 const halos=instances('neural-fly-halos',haloGeometry,haloMaterial);halos.visible=false;
 halos.userData.gardenAtmosphere=true;
 const sparks=makeCoreSparks(count);group.add(sparks.points);

 function safe(x,y,z){
  if(!inside(x,z,.86)||onCabinFloor(x,z)||Math.abs(x-creekX(z))<creekWidth(z)+.5||Math.hypot(x-15,z+1.6)<1.2)return false;
  for(let k=0;k<boxes.length;k++){
   const b=boxes[k];
   if(x>b.min.x&&x<b.max.x&&y>b.min.y&&y<b.max.y&&z>b.min.z&&z<b.max.z)return false;
  }
  return true;
 }

 function seedHabitat(i){
  // Distribute 80 fireflies densely across all six island biomes with multi-height layering.
  if(i<24)return {cx:-14.0,cz:3.2,rx:5.8,rz:5.8,cruise:.55+(i%7)*.28,zone:'west'};
  if(i<38)return {cx:-9.2,cz:-2.2,rx:5.0,rz:5.6,cruise:.85+((i-24)%6)*.34,zone:'oak'};
  if(i<50){
   const z=-5.0+((i-38)/12)*13.2,side=i%2?1:-1;
   return {cx:creekX(z)+side*2.0,cz:z,rx:1.6,rz:1.6,cruise:.48+((i-38)%5)*.26,zone:'creek'};
  }
  if(i<60)return {cx:6.2,cz:.8,rx:3.8,rz:4.6,cruise:.52+((i-50)%5)*.24,zone:'meadow'};
  if(i<72)return {cx:12.6,cz:.9,rx:3.9,rz:4.6,cruise:.56+((i-60)%6)*.25,zone:'lantern'};
  return {cx:16.4,cz:2.4,rx:3.4,rz:3.6,cruise:.60+((i-72)%4)*.28,zone:'deck'};
 }

 const flies=Array.from({length:count},(_,i)=>{
  const hub=seedHabitat(i);
  let x=5.5,z=0.5,y=ground(5.5,0.5)+hub.cruise;
  for(let k=0;k<240;k++){
   const a=k*2.39996+i*.618,r=Math.sqrt(((k%24)+.5)/24);
   const cx=hub.cx+Math.cos(a)*hub.rx*r,cz=hub.cz+Math.sin(a)*hub.rz*r;
   const cy=ground(cx,cz)+hub.cruise;
   if(safe(cx,cy,cz)){x=cx;z=cz;y=cy;break;}
  }
  return {x,y,z,vx:0,vy:0,vz:0,heading:i*2.399,cruiseOffset:hub.cruise,zone:hub.zone,flash:0,burst:0,scent:0,scare:0,age:i*.31,behavior:'栖息'};
 });

 let selected=-1,lastCost=0,maxCost=0,totalCost=0,frames=0,paused=false;
 const panel=document.createElement('aside');panel.id='neural-fly-panel';panel.hidden=true;
 panel.setAttribute('aria-label','微光观察');
 panel.innerHTML='<button class="neural-close" aria-label="收起微光观察">×</button><span class="neural-eyebrow">微光观察</span><h3></h3><p class="neural-reference">FlyWire / Shiu 2024 LIF Subnetwork<br>具身缩减模型 · 发光为艺术扩展</p><p class="neural-behavior"></p><div class="neural-bars"></div><div class="neural-actions"><button data-stim="light-left">微光引导</button><button data-stim="scent-left">送一缕花香</button></div>';
 document.querySelector('#garden-ui').append(panel);
 const bars=[];
 for(const label of ['LC10 视觉趋光','ORN→PN 花香梯度','E-PG 罗盘','DNa02 左／右转向差','生物荧光素脉冲']){
  const row=document.createElement('label');row.textContent=label;const meter=document.createElement('meter');meter.min=0;meter.max=1;row.append(meter);panel.querySelector('.neural-bars').append(row);bars.push(meter);
 }
 panel.querySelector('.neural-close').onclick=()=>selectFly(-1);
 for(const b of panel.querySelectorAll('[data-stim]'))b.onclick=()=>stimulate(selected,b.dataset.stim);
 function selectFly(index){selected=Number.isInteger(index)&&index>=0&&index<count?index:-1;panel.hidden=selected<0;if(selected>=0)panel.querySelector('h3').textContent='萤火虫 '+String(selected+1).padStart(2,'0');}
 function stimulate(index,kind){if(!Number.isInteger(index)||index<0||index>=count)return false;const f=flies[index];if(kind==='light-left')f.burst=3;else if(kind==='scent-left')f.scent=3;else if(kind==='startle')f.scare=2;else return false;return true;}
 function disturb(point){for(let i=0;i<count;i++){const f=flies[i];if(Math.hypot(f.x-point.x,f.y-point.y,f.z-point.z)<1.5)f.scare=.9;}}

 function put(mesh,i,f,ox,oy,oz,sx,sy,sz,roll=0,mirrorX=false){
  const co=Math.cos(f.heading),si=Math.sin(f.heading);
  dummy.position.set(f.x+ox*co+oz*si,f.y+oy,f.z-ox*si+oz*co);
  dummy.rotation.set(0,f.heading,roll);
  dummy.scale.set(mirrorX?-sx:sx,sy,sz);
  dummy.updateMatrix();
  mesh.setMatrixAt(i,dummy.matrix);
 }

 function update(delta,{warmth=0,paused:stop=false,reducedMotion=false,available=true}={}){
  const begin=performance.now();paused=stop||reducedMotion;
  group.visible=warmth>=.002;
  if(!available)panel.hidden=true;else panel.hidden=selected<0;
  const dt=Math.min(.05,Math.max(0,delta));
  if(!paused){
   const active=warmth>.08;
   for(let i=0;i<count;i++){
    const f=flies[i];f.age+=dt;f.burst=Math.max(0,f.burst-dt);f.scent=Math.max(0,f.scent-dt);f.scare=Math.max(0,f.scare-dt);
    const cosH=Math.cos(f.heading),sinH=Math.sin(f.heading);
    let ll=0,lr=0,ol=0,or=0,nearest2=100;
    if(active){
     for(let k=0;k<lightCount;k++){
      const dx=lightCoords[k*2]-f.x,dz=lightCoords[k*2+1]-f.z,d2=dx*dx+dz*dz;
      const side=-dx*cosH+dz*sinH,value=warmth*14/(2.5+d2);
      if(side>=0)ll+=value;else lr+=value;
     }
     for(let k=0;k<flowerCount;k++){
      const dx=flowerCoords[k*2]-f.x,dz=flowerCoords[k*2+1]-f.z,d2=dx*dx+dz*dz;
      if(d2<nearest2)nearest2=d2;
      if(d2>64)continue;
      const value=6.2/(1.8+d2);
      if(-dx*cosH+dz*sinH>=0)ol+=value;else or+=value;
     }
    }
    const nearest=Math.sqrt(nearest2);
    const forwardX=f.x+sinH*.9,forwardZ=f.z+cosH*.9;
    const alarm=active&&(!safe(forwardX,f.y,forwardZ)||f.scare>0);
    solver.drive(i,'LC10_L',active?10+Math.min(18,ll)+f.burst*14:0);
    solver.drive(i,'LC10_R',active?10+Math.min(18,lr):0);
    solver.drive(i,'ORN_L',active?8+Math.min(18,ol)+f.scent*14:0);
    solver.drive(i,'ORN_R',active?8+Math.min(18,or):0);
    solver.drive(i,'LC4_L',alarm?35:0);solver.drive(i,'LC4_R',0);
    // Near-threshold nocturnal excitability (6.65mV) + staggered 1.7s-2.4s PDF_Clock bursts produce natural twinkling across the island.
    const period=1.7+(i%7)*.12,clock=((f.age+i*.37)%period)<.56;
    solver.drive(i,'PDF_Clock',active&&clock?38:0);
    solver.drive(i,'Octopamine',active?6.65+(f.burst+f.scent)*3.2:0);
    solver.drive(i,'Bioluminescence',active?6.65+(f.burst+f.scent)*2.8:0);
    const baseDrive=active?6.7:0;
    for(const name of ['uPN_L','uPN_R','MBON_L','MBON_R','PFL3_L','PFL3_R','DNa01_L','DNa01_R','DNa02_L','DNa02_R','DNp01']){
     solver.drive(i,name,active?(name.startsWith('MBON')&&nearest<1.1?20:baseDrive):0);
    }
    solver.driveCompass(i,f.heading,active);
    f.behavior=!active?'栖息':alarm?'避障':nearest<.9?'悬停':ol+or>ll+lr?'循香':'趋灯';
   }
   solver.step(lastCost>3.5?4:6);
   for(let i=0;i<count;i++){
    const f=flies[i],r=solver.readouts[i];
    f.heading-=r.turnDrive*dt*2.7;
    const speed=active?.26+r.thrustDrive*.70:0;
    const brake=1-r.hoverBrake*.82;
    const sinH=Math.sin(f.heading),cosH=Math.cos(f.heading);
    let nx=f.x+sinH*speed*brake*dt,nz=f.z+cosH*speed*brake*dt;
    const targetY=ground(nx,nz)+(active?f.cruiseOffset+.36*r.thrustDrive+(f.scare>0?.6:0):f.cruiseOffset*.7);
    let ny=f.y+(targetY-f.y)*dt*1.8;
    ny=Math.max(ny,ground(nx,nz)+.35);
    if(!safe(nx,ny,nz)){
     nx=f.x;nz=f.z;ny=Math.max(f.y,ground(nx,nz)+.35);f.behavior='避障';
     for(let k=1;k<=8;k++){
      const a=f.heading+k*Math.PI/4,px=f.x+Math.sin(a)*.14,pz=f.z+Math.cos(a)*.14;
      if(safe(px,Math.max(ny,ground(px,pz)+.35),pz)){f.heading=a;break;}
     }
    }
    f.vx=(nx-f.x)/Math.max(dt,.001);f.vy=(ny-f.y)/Math.max(dt,.001);f.vz=(nz-f.z)/Math.max(dt,.001);
    f.x=nx;f.y=ny;f.z=nz;f.flash=r.flashLevel*warmth;
   }
  }
  const posArr=sparks.posAttr.array,flashArr=sparks.flashAttr.array;let anyHalo=false;
  for(let i=0;i<count;i++){
   const f=flies[i],flash=paused?warmth*.22:f.flash;
   put(body,i,f,0,0,0,.028,.022,.06);
   put(shell,i,f,0,.013,-.004,.03,.017,.044);
   put(head,i,f,0,.003,.054,.019,.017,.019);
   put(tail,i,f,0,-.004,-.052,.032,.026,.038);
   const beat=paused||warmth<.08?0:Math.sin(f.age*132)*.85;
   put(leftWing,i,f,-.026,.011,.005,1,1,1,beat,true);
   put(rightWing,i,f,.026,.011,.005,1,1,1,-beat,false);
   color.copy(dimRest).lerp(lime,Math.min(1,flash*1.5)).lerp(gold,Math.max(0,flash-.25)).multiplyScalar(1+flash*1.9);
   tail.setColorAt(i,color);
   const sinH=Math.sin(f.heading),cosH=Math.cos(f.heading);
   const tx=f.x-.052*sinH,ty=f.y-.004,tz=f.z-.052*cosH;
   posArr[i*3]=tx;posArr[i*3+1]=ty;posArr[i*3+2]=tz;
   flashArr[i]=flash;
   const glowVisible=flash>.005;
   const haloScale=glowVisible?.16+flash*.24:0;
   haloOpacity.array[i]=glowVisible?Math.min(.88,flash*.85):0;anyHalo||=glowVisible;
   dummy.position.set(tx,ty,tz);dummy.rotation.set(0,0,0);dummy.scale.setScalar(haloScale);dummy.updateMatrix();halos.setMatrixAt(i,dummy.matrix);
  }
  halos.visible=anyHalo;halos.instanceMatrix.needsUpdate=true;haloOpacity.needsUpdate=true;
  sparks.points.visible=warmth>.01;
  sparks.posAttr.needsUpdate=true;sparks.flashAttr.needsUpdate=true;
  for(const mesh of [body,head,shell,tail,leftWing,rightWing])mesh.instanceMatrix.needsUpdate=true;
  if(tail.instanceColor)tail.instanceColor.needsUpdate=true;
  if(selected>=0&&!panel.hidden){
   const r=solver.readouts[selected];
   panel.querySelector('.neural-behavior').textContent=paused?'静静栖息':flies[selected].behavior;
   bars[0].value=Math.max(r.LC10_L,r.LC10_R)/150;
   bars[1].value=Math.max(r.ORN_L,r.ORN_R)/150;
   bars[2].value=r.compass/100;
   bars[3].value=.5+r.turnDrive*.5;
   bars[4].value=r.flashLevel;
  }
  lastCost=performance.now()-begin;maxCost=Math.max(maxCost,lastCost);totalCost+=lastCost;frames++;
 }

 const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
 function pick(x,y){
  if(!camera||!group.visible)return false;
  mouse.set(x/innerWidth*2-1,1-y/innerHeight*2);
  ray.setFromCamera(mouse,camera);
  const hit=ray.intersectObjects([body,shell,head,tail],false)[0];
  if(!hit)return false;
  for(const b of boxes){if(ray.ray.intersectBox(b,v)&&camera.position.distanceTo(v)<hit.distance)return false;}
  selectFly(hit.instanceId);return true;
 }

 return {
  group,update,disturb,pick,selectFly,stimulate,
  getState:()=>flies.map((f,i)=>({index:i,zone:f.zone,position:[f.x,f.y,f.z],velocity:[f.vx,f.vy,f.vz],heading:f.heading,behavior:f.behavior,...solver.readouts[i],flashLevel:f.flash})),
  getConnectomeMeta:()=>solver.circuit.meta,
  getDiagnostics:()=>({lastCostMs:lastCost,meanCostMs:totalCost/Math.max(1,frames),maxCostMs:maxCost,frames,paused,...solver.stats,finite:solver.voltage.every(Number.isFinite),obstacles:boxes.map(b=>({min:b.min.toArray(),max:b.max.toArray()}))}),
  dispose(){group.removeFromParent();panel.remove();sparks.geo.dispose();sparks.mat.dispose();for(const mesh of [body,head,shell,tail,leftWing,rightWing])mesh.geometry.dispose();for(const mat of new Set([body.material,head.material,shell.material,wingMat,tail.material,haloMaterial]))mat.dispose();halos.dispose();haloGeometry.dispose();texture.dispose();}
 };
}
