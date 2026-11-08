import * as THREE from 'three';

function finishGeometry(geometry){
  geometry.computeVertexNormals();geometry.center();
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

export function createCurvedPetalGeometry(width=.16,height=.24,segments=6){
  const geometry=new THREE.PlaneGeometry(width,height,segments,segments),position=geometry.attributes.position;
  for(let i=0;i<position.count;i++){
    let x=position.getX(i),y=position.getY(i);
    const u=x/(width*.5),v=(y+height*.5)/height;
    // Round shoulders, a narrow root and the small cleft of a spring petal.
    x*=.28+.72*Math.sin(Math.PI*v*.85);
    const notch=Math.exp(-u*u*18)*Math.pow(v,8)*height*.065;
    const z=-Math.cos(u*Math.PI*.5)*width*.35+v*v*height*.2;
    position.setXYZ(i,x,y-notch,z);
  }
  return finishGeometry(geometry);
}

export function createLeafGeometry(width=.13,height=.286){
  const geometry=new THREE.PlaneGeometry(width,height,6,6),position=geometry.attributes.position;
  for(let i=0;i<position.count;i++){
    const u=position.getX(i)/(width*.5),v=(position.getY(i)+height*.5)/height;
    const profile=Math.sin(Math.PI*v);
    // Both tips taper to a point; the center vein sits below the curled edges.
    position.setXYZ(i,u*width*.5*profile,position.getY(i),
      width*.24*Math.abs(u)*profile-height*.065*profile+height*.09*(v-.5)**2);
  }
  return finishGeometry(geometry);
}

// Three adjacent 128px cells: veined green leaf, seed parachute, white petal.
export function createFoliageTexture(){
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(384,128):document.createElement('canvas');
  canvas.width=384;canvas.height=128;const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Unable to paint foliage');
  ctx.save();ctx.beginPath();ctx.moveTo(64,8);ctx.bezierCurveTo(116,47,111,90,64,119);ctx.bezierCurveTo(17,90,12,47,64,8);ctx.closePath();
  const green=ctx.createLinearGradient(32,64,92,34);green.addColorStop(0,'#52b788');green.addColorStop(.65,'#38a169');green.addColorStop(1,'#a3e635');
  ctx.fillStyle=green;ctx.shadowColor='#a3e63566';ctx.shadowBlur=1.2;ctx.fill();ctx.clip();ctx.shadowBlur=0;
  ctx.strokeStyle='#efffdc85';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(64,115);ctx.quadraticCurveTo(59,63,64,12);ctx.stroke();
  ctx.strokeStyle='#f4ffe64d';ctx.lineWidth=.7;
  for(let i=0;i<7;i++){const y=30+i*11;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(63,y+15);ctx.quadraticCurveTo(63+side*15,y+6,64+side*(18+Math.sin(i/6*Math.PI)*20),y-7);ctx.stroke();}}
  ctx.restore();
  ctx.save();ctx.translate(128,0);
  // A soft feather umbrella survives minification; the halo remains translucent.
  const glow=ctx.createRadialGradient(64,55,8,64,55,53);
  glow.addColorStop(0,'#ffffff80');glow.addColorStop(.5,'#ffffff70');glow.addColorStop(.8,'#ffffff28');glow.addColorStop(1,'#ffffff00');
  ctx.fillStyle=glow;ctx.fillRect(0,0,128,128);
  ctx.lineCap='round';ctx.lineWidth=2.6;ctx.shadowColor='#ffffffb0';ctx.shadowBlur=4;
  for(let i=0;i<26;i++){
    const a=Math.PI+i/25*Math.PI,r=35+Math.sin(i*2.3)*7,x=64+Math.cos(a)*r,y=64+Math.sin(a)*r;
    ctx.strokeStyle='#ffffffe0';ctx.beginPath();ctx.moveTo(64,83);ctx.quadraticCurveTo(64+Math.cos(a)*r*.35,58,x,y);ctx.stroke();
    ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.PI/2);
    const feather=ctx.createRadialGradient(0,0,1,0,0,12);feather.addColorStop(0,'#ffffffff');feather.addColorStop(.5,'#ffffffb0');feather.addColorStop(1,'#ffffff00');
    ctx.fillStyle=feather;ctx.beginPath();ctx.ellipse(0,0,5,12,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  ctx.shadowBlur=0;ctx.fillStyle='#806443dd';ctx.beginPath();ctx.ellipse(64,85,2.4,4.5,.3,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.save();ctx.translate(256,0);const white=ctx.createRadialGradient(60,62,8,64,64,49);white.addColorStop(0,'#ffffff');white.addColorStop(.8,'#fffef0');white.addColorStop(1,'#f5efcc80');
  ctx.fillStyle=white;ctx.shadowColor='#ffffed99';ctx.shadowBlur=1.5;ctx.beginPath();ctx.ellipse(64,64,29,48,-.12,0,Math.PI*2);ctx.fill();ctx.restore();
  const texture=new THREE.CanvasTexture(canvas);texture.name='green-leaf-dandelion-atlas';texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export const guidingWindGust=time=>Math.max(0,Math.sin(2*Math.PI*time/7.5))**5;

export function createFallingFoliage(scene,{ground=()=>.8,seed=7241,reducedMotion=false,textureFactory=createFoliageTexture}={}){
  const count=60,geometry=new THREE.PlaneGeometry(.26,.52,10,10),pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++)pos.setZ(i,.018*(pos.getX(i)/.13)**2+.012*(pos.getY(i)/.26)**2);
  geometry.computeVertexNormals();
  const kinds=new THREE.InstancedBufferAttribute(new Float32Array(count),1),fades=new THREE.InstancedBufferAttribute(new Float32Array(count),1);
  fades.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('foliageKind',kinds);geometry.setAttribute('foliageFade',fades);
  const texture=textureFactory(),material=new THREE.MeshStandardMaterial({map:texture,color:'#ffffff',side:THREE.DoubleSide,transparent:true,opacity:.95,roughness:.48,metalness:0,emissive:'#ffffff',emissiveIntensity:.28,depthWrite:false,forceSinglePass:true});
  const leafEmissive=new THREE.Color('#38a169').multiplyScalar(.18);
  material.onBeforeCompile=shader=>{
    shader.uniforms.foliageLeafEmissive={value:leafEmissive};
    shader.vertexShader='attribute float foliageKind;\nattribute float foliageFade;\nvarying float vKind;\nvarying float vFade;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvKind=foliageKind;vFade=foliageFade;\nif(foliageKind>0.5) transformed*=vec3(0.846153846,0.423076923,0.65);');
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nif(foliageKind>0.5)objectNormal=normalize(objectNormal/vec3(0.846153846,0.423076923,0.65));');
    shader.fragmentShader='uniform vec3 foliageLeafEmissive;\nvarying float vKind;\nvarying float vFade;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','diffuseColor *= texture2D(map,vec2((vMapUv.x+vKind)/3.0,vMapUv.y));');
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a *= vFade;\n#include <alphatest_fragment>');
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nif(vKind<0.5) totalEmissiveRadiance=foliageLeafEmissive; else if(vKind>1.5) totalEmissiveRadiance=vec3(0.0);');
  };
  material.customProgramCacheKey=()=> 'lively-meadow-free-tumble-v4';
  const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name='ambient-falling-foliage';mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;scene.add(mesh);
  const particles=[],dummy=new THREE.Object3D();
  const patches=[[-5,2],[-5,-.5],[0,-2],[3,-.5],[5,0],[2,3]];
  let clock=0,updates=0,recycles=0,disposed=false;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function reset(p,initial=false){
    if(p.kind===0){p.x=-4.5+random()*5;p.z=-1.2+random()*4.4;p.y=3.8+random()*4;p.airborne=true;}
    else{const patch=patches[p.index%patches.length];p.x=patch[0]+(random()-.5)*.7;p.z=patch[1]+(random()-.5)*.7;p.y=ground(p.x,p.z)+.05;p.airborne=false;}
    p.floor=ground(p.x,p.z)+.05;p.age=initial?1:0;p.airTime=0;p.vx=p.vz=0;p.vy=0;p.life=34+random()*12;if(!initial)recycles++;
  }
  function write(p){
    dummy.position.set(p.x,p.y,p.z);
    // Independent pitch, roll and yaw expose both sides to the scene lights.
    // No camera input: changing the view never changes a particle transform.
    dummy.rotation.set(p.pitch,
      p.yawPhase+Math.sin(clock*p.yawRate+p.phase)*.55,
      Math.sin(clock*p.rockRate+p.rockPhase)*p.rockAmplitude,'YXZ');
    dummy.updateMatrix();mesh.setMatrixAt(p.index,dummy.matrix);
    let fade=Math.min(1,p.age/.8,(p.life-p.age)/2,(10-p.x)/1.5);
    if(p.kind===0)fade=Math.min(fade,(p.y-ground(p.x,p.z))/.6);
    else fade=p.airborne?Math.min(fade,p.airTime/.65):0;
    fades.setX(p.index,Math.max(0,fade));
  }
  for(let i=0;i<count;i++){
    const kind=i<32?0:i%4===0?2:1,p={index:i,kind,phase:random()*Math.PI*2,
      speed:.6+random()*.8,lift:.65+random()*.7,drag:.65+random()*.7,
      pitch:random()*Math.PI*2,pitchRate:(.5+random()*.7)*(kind===0?1:.55),
      rockPhase:random()*Math.PI*2,rockRate:.65+random()*1.1,rockAmplitude:Math.PI/6+random()*Math.PI/6,
      yawPhase:random()*Math.PI*2,yawRate:.2+random()*.45,windRate:.3+random()*.2,
      launchThreshold:.12+random()*.22};
    kinds.setX(i,kind);mesh.setColorAt(i,new THREE.Color('#ffffff'));reset(p,true);particles.push(p);write(p);
  }
  mesh.instanceColor.needsUpdate=true;mesh.instanceMatrix.needsUpdate=true;fades.needsUpdate=true;mesh.visible=!reducedMotion;
  const telemetry={leaves:32,ground:28,clock:0,gust:0};mesh.userData.wind=telemetry;
  function update(delta,{covered=false,reducedMotion=false}={}){
    if(disposed)return false;mesh.visible=!reducedMotion;if(covered||reducedMotion)return false;
    const dt=Math.max(0,Math.min(.06,delta));if(!dt)return false;clock+=dt;updates++;
    const gust=guidingWindGust(clock);
    for(const p of particles){
      p.age+=dt;
      if(p.kind>0&&!p.airborne&&gust>p.launchThreshold){p.airborne=true;p.airTime=0;}
      if(p.airborne){
        p.airTime+=dt;p.pitch+=p.pitchRate*(1+gust*.35)*dt;
        const groundSeed=p.kind>0,speed=(groundSeed?.2+gust*.7:.4+gust*1.7)*p.speed;
        const drag=1-Math.exp(-2.1*p.drag*dt);
        p.vx+=(speed*.85-p.vx)*drag;
        p.vz+=(speed*(.25+Math.sin(clock*p.windRate+p.phase)*.5)+Math.sin(p.x*.45)*.12-p.vz)*drag;
        // A brief aerodynamic impulse lifts meadow seeds off the grass;
        // slow drag retains the updraft before their tiny settling speed wins.
        if(groundSeed){p.vy+=.65*gust*p.lift*dt;p.vy+=(-.06-p.vy)*(1-Math.exp(-.32*p.drag*dt));}
        else p.vy+=(-.18*p.speed+.42*gust*p.lift+Math.sin(clock*p.rockRate+p.phase)*.08-p.vy)*drag;
        p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;
        if(p.y<ground(p.x,p.z)+.025||p.x>10||p.y>9.5||p.age>p.life)reset(p);
      }
      write(p);
    }
    telemetry.clock=clock;telemetry.gust=gust;mesh.instanceMatrix.needsUpdate=true;fades.needsUpdate=true;return true;
  }
  function setReducedMotion(value){if(!disposed)mesh.visible=!value;}
  function dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();mesh.dispose();geometry.dispose();material.dispose();texture.dispose();}
  function getState(){const seeds=particles.filter(p=>p.kind>0);return {count,...telemetry,updates,recycles,disposed,airborne:seeds.filter(p=>p.airborne).length,meanLift:seeds.reduce((s,p)=>s+p.y-p.floor,0)/28,meanVy:seeds.reduce((s,p)=>s+p.vy,0)/28};}
  return {mesh,update,setReducedMotion,dispose,getState};
}
