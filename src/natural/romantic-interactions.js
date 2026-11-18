import * as THREE from 'three';
import {COCOA_STUMP, creekX, ground} from './land.js';
import {makeCoupleFootprints} from './couple-footprints.js';
import {meteorGeometry, meteorStreak} from './shooting-stars.js';

const {smoothstep, lerp} = THREE.MathUtils;
const wishes = new WeakMap();

// Standalone entry point for the registered garden camera (or a camera
// parented to its scene). Independent gardens never share a particle pool.
export function triggerWish(camera) {
  for (let owner=camera; owner; owner=owner.parent) {
    const start=wishes.get(owner);
    if(start) return start(camera);
  }
  return false;
}

function piece(parent, geometry, material, x=0, y=0, z=0) {
  const part=new THREE.Mesh(geometry, material);
  part.position.set(x,y,z); part.castShadow=part.receiveShadow=true; parent.add(part);
  return part;
}
const porcelain = color => new THREE.MeshStandardMaterial({color,roughness:.28});

function makeSnowman() {
  const group=new THREE.Group();
  group.name='cabin-snowman'; group.userData.interaction='snowman';
  group.position.set(-3.6,ground(-3.6,1.2),1.2);
  group.rotation.y=.73;
  // Raycaster ordinarily traverses invisible groups too.
  group.raycast=()=>group.visible;
  const ball=new THREE.SphereGeometry(1,22,16);
  const powder=new THREE.MeshStandardMaterial({color:'#fffaf4',roughness:.97});
  const coal=new THREE.MeshStandardMaterial({color:'#231d23',roughness:.75});
  const knit=new THREE.MeshStandardMaterial({color:'#e11d48',roughness:.95});
  const body=piece(group,ball,powder,0,.42,0); body.scale.set(.47,.42,.45);
  const head=piece(group,ball,powder,0,.97,0); head.scale.set(.335,.30,.322);
  for(const side of [-1,1]) piece(group,ball,coal,side*.113,1.025,.292).scale.set(.037,.04,.027);
  const nose=piece(group,new THREE.ConeGeometry(.051,.224,12),porcelain('#f46c33'),0,.957,.402);
  nose.rotation.x=Math.PI*.48;
  for(const [x,y,z] of [[0,.57,.415],[0,.37,.445],[-.077,.894,.301],[0,.88,.309],[.077,.894,.301]])
    piece(group,ball,coal,x,y,z).scale.setScalar(y>.8?.016:.034);
  const collar=piece(group,new THREE.TorusGeometry(.276,.056,10,36),knit,0,.766,0);
  collar.rotation.x=Math.PI/2-.055;
  const tail=piece(group,ball,knit,.166,.63,.311);
  tail.scale.set(.075,.176,.035); tail.rotation.z=.22; tail.rotation.x=-.55;
  const knot=piece(group,ball,knit,.156,.753,.232); knot.scale.set(.08,.064,.064);
  group.visible=false;
  return group;
}

function steamGeometry() {
  const xyz=[], offsets=[], indices=[];
  for(let i=0;i<11;i++){
    const base=i*4;
    for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
      xyz.push(x,y,0); offsets.push(i/11);
    }
    indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
  geometry.setAttribute('seed',new THREE.Float32BufferAttribute(offsets,1));
  geometry.setIndex(indices);
  return geometry;
}

function makeCocoa() {
  const root=new THREE.Group(); root.name='campfire-hot-cocoa';
  root.position.set(COCOA_STUMP.x,ground(COCOA_STUMP.x,COCOA_STUMP.z)+COCOA_STUMP.height,COCOA_STUMP.z);
  root.rotation.y=2.16;
  const profile=[[.001,.005],[.062,.005],[.073,.018],[.088,.16],[.089,.181],[.086,.187],[.08,.184],[.078,.159],[.057,.036],[.001,.036]];
  const shell=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),32);
  const handle=new THREE.TorusGeometry(.049,.011,9,24);
  const surface=new THREE.CircleGeometry(.08,32); surface.rotateX(-Math.PI/2);
  const chocolate=porcelain('#60392e'), steam=steamGeometry();
  const clock={value:0};
  const cups=[-1,1].map((side,i)=>{
    const cup=new THREE.Group(); cup.name=i?'warm-blue-mug':'blush-pink-mug';
    cup.userData.interaction='hot-cocoa'; cup.position.x=side*.127;
    root.add(cup);
    const glaze=porcelain(i?'#94c6d3':'#f4b7c1');
    piece(cup,shell,glaze);
    const ear=piece(cup,handle,glaze,side*.093,.103,0); ear.scale.set(1,1.1,1);
    piece(cup,surface,chocolate,0,.171,0);
    const vapor=new THREE.Mesh(steam,new THREE.ShaderMaterial({
      uniforms:{clock,phase:{value:i*.37}},transparent:true,depthWrite:false,
      vertexShader:`attribute float seed;uniform float clock,phase;varying vec2 puff;varying float alpha;
        void main(){
          float age=fract(seed+phase+clock*.53);
          float a=6.28318*(seed+phase)+age*3.8;
          vec3 center=vec3(.018*sin(a)+.036*age*age,.183+.31*age,.018*cos(a));
          vec4 mv=modelViewMatrix*vec4(center,1.);
          mv.xy+=position.xy*vec2(.017+.035*age,.023+.029*age);
          puff=position.xy;alpha=sin(age*3.14159);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader:`varying vec2 puff;varying float alpha;
        void main(){float soft=max(0.,1.-dot(puff,puff));gl_FragColor=vec4(1.,.97,.94,soft*soft*alpha*.27);}`
    }));
    vapor.name='cocoa-steam'; vapor.raycast=()=>{}; vapor.frustumCulled=false; cup.add(vapor);
    return cup;
  });
  return {root,cups,clock};
}

function hearts(parent,count) {
  const heart=new THREE.Shape();
  heart.moveTo(0,-.49);
  heart.bezierCurveTo(-.22,-.28,-.64,.07,-.44,.35);
  heart.bezierCurveTo(-.31,.55,-.09,.49,0,.28);
  heart.bezierCurveTo(.12,.52,.34,.52,.45,.34);
  heart.bezierCurveTo(.62,.07,.21,-.3,0,-.49);
  const geometry=new THREE.ShapeGeometry(heart,10);
  return Array.from({length:count},(_,i)=>{
    const material=new THREE.MeshBasicMaterial({color:i%2?'#ffd9e7':'#ffaac9',side:THREE.DoubleSide,transparent:true,depthWrite:false});
    const mesh=new THREE.Mesh(geometry,material);
    mesh.name='rising-pink-heart';mesh.visible=false; mesh.raycast=()=>{};
    parent.add(mesh);return mesh;
  });
}

function drawHearts(pool, origin, age, scale, camera, reduced) {
  for(let i=0;i<pool.length;i++){
    const heart=pool[i], t=(age-i*.09)/1.22;
    heart.visible=t>=0 && t<1;
    if(!heart.visible)continue;
    const x=(i-(pool.length-1)*.5)*.24 + (reduced?0:.048*Math.sin(5*t+i));
    heart.position.copy(origin);
    heart.position.x+=x*scale; heart.position.y+=scale*(reduced?.17:.12+t*.53);
    heart.scale.setScalar((.15+.075*Math.sin(t*Math.PI))*scale);
    if(camera) camera.getWorldQuaternion(heart.quaternion);
    heart.material.opacity=.93*Math.sin(Math.PI*t);
  }
}

export function makeRomanticInteractions(scene, island, {
  gardenAudio, seasons, creekRipples, camera,
  isNight=()=>scene.getObjectByName('spring-sky')?.material.uniforms.night.value>.5, reducedMotion=()=>false,
  notify=()=>{}, setWishGlow=()=>{},
}={}) {
  const root=new THREE.Group();root.name='romantic-interactions';island.add(root);
  const snowman=makeSnowman(), cocoa=makeCocoa();
  root.add(snowman,cocoa.root);
  const footprints=makeCoupleFootprints(island);
  const snowHearts=hearts(root,3), cocoaHearts=hearts(root,2);
  const snowOrigin=new THREE.Vector3(), cocoaOrigin=cocoa.root.position.clone();
  cocoaOrigin.y+=.26;
  const shower=new THREE.Group();shower.name='meteor-wish-shower';scene.add(shower);
  shower.visible=false;
  const trail=meteorGeometry(), palette=['#ffe2aa','#efc4ff','#ffedc9','#d9bcff','#ffccd6'];
  const streaks=palette.map(tint=>{
    const mesh=meteorStreak(trail,new THREE.Color(tint));shower.add(mesh);
    return {mesh,start:new THREE.Vector3(),travel:new THREE.Vector3(),delay:0,life:1};
  });
  const ambient=scene.getObjectByName('wishing-meteor');
  const voices=new Map();
  let disposed=false, snowAge=Infinity, cocoaAge=Infinity, wishAge=Infinity, count=0;
  function clink(delay) {
    if(!gardenAudio?.chimeOutput)return;
    const wanted=performance.now()+delay*1000;
    void gardenAudio.chimeOutput().then(output=>{
      if(!output || disposed)return;
      const {context,bus,volume}=output;
      const at=context.currentTime+Math.max(0,(wanted-performance.now())/1000);
      for(const [hz,level,duration] of [[1850,.13,.8],[2937,.036,.38],[4280,.012,.19]]){
        const tone=context.createOscillator(), envelope=context.createGain();
        tone.frequency.setValueAtTime(hz,at);tone.frequency.exponentialRampToValueAtTime(hz*.994,at+duration);
        envelope.gain.setValueAtTime(.00001,at);
        envelope.gain.exponentialRampToValueAtTime(Math.max(.00002,level*volume),at+.004);
        envelope.gain.exponentialRampToValueAtTime(.00001,at+duration);
        tone.connect(envelope);envelope.connect(bus);voices.set(tone,envelope);
        tone.onended=()=>{tone.disconnect();envelope.disconnect();voices.delete(tone);};
        tone.start(at);tone.stop(at+duration+.005);
      }
    }).catch(()=>{}); // A denied audio device still leaves a complete visual toast.
  }
  function activate(kind) {
    if(disposed)return false;
    if(kind==='snowman' && snowman.visible){
      snowAge=0;return true;
    }
    if(kind==='hot-cocoa' && cocoaAge>=.65){
      cocoaAge=0;clink(reducedMotion()?0:.16);
      notify('热可可碰一杯，冬天很暖。');return true;
    }
    return false;
  }
  function startWish(view) {
    if(disposed || !view?.isPerspectiveCamera || !isNight() || wishAge<2.45)return false;
    view.updateWorldMatrix(true,false);
    const q=view.getWorldQuaternion(new THREE.Quaternion()), eye=view.getWorldPosition(new THREE.Vector3());
    const right=new THREE.Vector3(1,0,0).applyQuaternion(q), up=new THREE.Vector3(0,1,0).applyQuaternion(q);
    const forward=view.getWorldDirection(new THREE.Vector3());
    const depth=82, h=depth/view.projectionMatrix.elements[5], w=depth/view.projectionMatrix.elements[0];
    const normal=forward.clone().negate(), basis=new THREE.Matrix4();
    count=3+Math.floor(Math.random()*3);
    for(const [i,star] of streaks.entries()){
      star.mesh.visible=false;
      if(i>=count)continue;
      star.delay=.02+i*.18+Math.random()*.09;star.life=.60+Math.random()*.28;
      star.start.copy(eye).addScaledVector(forward,depth)
        .addScaledVector(right,w*(-.89+i*.21+Math.random()*.13)).addScaledVector(up,h*(.49+Math.random()*.43));
      star.travel.copy(right).multiplyScalar(w*(.49+Math.random()*.23)).addScaledVector(up,-h*(.25+Math.random()*.23));
      const tangent=star.travel.clone().normalize(), width=new THREE.Vector3().crossVectors(normal,tangent).normalize();
      star.mesh.quaternion.setFromRotationMatrix(basis.makeBasis(tangent,width,normal));
      star.mesh.scale.set(star.travel.length()*.38/14,h*.029,1);
    }
    wishAge=0;shower.visible=true;
    if(!reducedMotion())creekRipples?.pulse?.(creekX(2.45),2.45,.09);
    notify('心愿已悄悄收下。');return true;
  }
  wishes.set(scene,startWish);
  if(camera)wishes.set(camera,startWish);
  function hitMeteor(raycaster) {
    if(disposed || !isNight() || wishAge<2.45 || !ambient?.visible)return false;
    ambient.updateWorldMatrix(true,false);
    const hit=raycaster.intersectObject(ambient,false)[0];
    return !!hit && hit.uv.x>.14 && Math.abs(hit.uv.y-.5)<.36;
  }
  function update(delta,{covered=false,view=camera}={}) {
    if(disposed)return;
    const dt=Number.isFinite(delta)?Math.max(0,delta):0;
    const winter=seasons?.getWinterWeight?.() || 0, reduced=reducedMotion();
    const wasVisible=snowman.visible;
    snowman.visible=winter>.3;
    footprints?.update(winter);
    if(!snowman.visible)snowAge=Infinity;
    if(snowman.visible)snowman.position.y=groundSnowY+(seasons?.getSnowHeight?.(-3.6,1.2)||0);
    if(covered)return wasVisible!==snowman.visible;
    snowAge+=dt;cocoaAge+=dt;
    snowman.rotation.z=!reduced && snowAge<2.2?Math.sin(snowAge*12)*.18*Math.exp(-snowAge*3):0;
    snowOrigin.copy(snowman.position);snowOrigin.y+=1.27;
    drawHearts(snowHearts,snowOrigin,snowAge,1,view,reduced);
    if(!reduced)cocoa.clock.value+=dt;
    const contact=cocoaAge<.16 ? smoothstep(cocoaAge,0,.16) : 1-smoothstep(cocoaAge,.18,.56);
    for(const [i,cup] of cocoa.cups.entries()){
      const side=i?1:-1, amount=reduced?0:contact;
      cup.position.set(side*lerp(.127,.096,amount),.065*amount,0);
      cup.rotation.z=side*.047*amount;
    }
    drawHearts(cocoaHearts,cocoaOrigin,cocoaAge-.16,.64,view,reduced);
    if(shower.visible){
      // A newly visible night material can take a frame to compile on a
      // presentation laptop. Never skip the whole shower on that first draw.
      wishAge+=Math.min(dt,.10);
      if(!isNight() || wishAge>=2.45){
        shower.visible=false;wishAge=Infinity;setWishGlow(0);
        for(const star of streaks)star.mesh.visible=false;
      }else{
        const glow=smoothstep(wishAge,0,.52)*(1-smoothstep(wishAge,.62,2.45));
        setWishGlow(glow*(reduced?.35:1));
        for(let i=0;i<count;i++){
          const star=streaks[i], t=(wishAge-star.delay)/star.life;
          star.mesh.visible=t>=0 && t<1;
          if(!star.mesh.visible)continue;
          star.mesh.position.copy(star.start).addScaledVector(star.travel,reduced?.42:t);
          star.mesh.material.uniforms.intensity.value=1.3*smoothstep(t,0,.12)*(1-smoothstep(t,.66,1));
        }
      }
    }
    return wasVisible!==snowman.visible || snowAge<1 || cocoaAge<.62;
  }
  const groundSnowY=snowman.position.y;
  function dispose(){
    if(disposed)return;
    disposed=true;setWishGlow(0);
    for(const owner of [scene,camera])if(owner && wishes.get(owner)===startWish)wishes.delete(owner);
    for(const [tone,envelope] of voices){tone.onended=null;tone.stop();tone.disconnect();envelope.disconnect();}
    voices.clear();footprints?.dispose();
    const resources=new Set();
    for(const group of [root,shower]){
      group.removeFromParent();group.traverse(obj=>{
        if(obj.geometry)resources.add(obj.geometry);
        if(obj.material)resources.add(obj.material);
      });
    }
    for(const resource of resources)resource.dispose();
  }
  return {targets:[snowman,...cocoa.cups],snowman,cups:cocoa.cups,footprints,shower,
    activate,triggerWish:startWish,hitMeteor,update,dispose};
}
