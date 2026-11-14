import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,fbm} from './shared.js';
import {ground,inside,creekX,creekWidth,waterY,RX,RZ,TREE_SITE,BENCH_SITE,onCabinFloor} from './land.js';
import {makeBanyan} from './banyan.js';
import {guidingWindGust} from './falling-foliage.js';

// A little less lawn, a little more meadow: plants share patches of habitat,
// while the places people would sit, cross and walk remain softly open.
export function makePlants(parent,time,{includeTree=true}={}){
  const random=rng(9284),dummy=new THREE.Object3D(),color=new THREE.Color();
  const tree=includeTree?makeBanyan(parent,time):{};
  const blade=meadowTuft();
  const grassMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.94,side:THREE.DoubleSide});
  grassMat.onBeforeCompile=shader=>{
    addWind(shader,time,.018,.34);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vBladeHeight;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvBladeHeight=uv.y;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vBladeHeight;')
      .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(vec3(.67,.76,.57),vec3(1.0,1.01,.90),vBladeHeight);')
      .replace('#include <opaque_fragment>',`// Soft transmitted light keeps thin grass legible in its own shade.
        outgoingLight+=diffuseColor.rgb*vec3(.050,.065,.028)*(.35+.65*vBladeHeight);
        #include <opaque_fragment>
      `);
  };
  const grass=new THREE.InstancedMesh(blade,grassMat,25000);
  const onEstatePad=(x,z)=>{
    const pdx=x-13.2,pdz=z-.8,pc=Math.cos(.24),ps=Math.sin(.24);
    return Math.hypot(x+12,z+1.5)<1.04
      ||(Math.abs(pdx*pc-pdz*ps)<1.02&&Math.abs(pdx*ps+pdz*pc)<.88)
      ||Math.hypot(x-15,z+1.6)<1.02
      ||(x>16.65&&x<19.75&&z>.65&&z<3.35);
  };
  const shadeGrass=new THREE.Color('#4b6f40'),meadowGrass=new THREE.Color('#7b9559'),dryGrass=new THREE.Color('#8b945f');
  let gi=0;
  for(let attempt=0;attempt<100000&&gi<grass.count;attempt++){
    const x=(random()-.5)*RX*2.2,z=(random()-.5)*RZ*2.2;
    if(onCabinFloor(x,z)||onEstatePad(x,z)||!inside(x,z,.996)||Math.abs(x-creekX(z))<creekWidth(z)+.20)continue;
    const patch=fbm(x*.57+9,z*.57),smallPatch=fbm(x*2.15+5,z*2.15-3),path=walkway(x,z),root=Math.hypot(x-TREE_SITE.x,z-TREE_SITE.z);
    const seat=Math.hypot(x-BENCH_SITE.x,(z-BENCH_SITE.z)*1.2);
    if(root<.56||seat<.63)continue;
    // Independently authored habitat rule: the local height gradient suppresses
    // tall grass on steep banks, while smooth ground supports loose clumps.
    const sample=.16,dx=(ground(x+sample,z)-ground(x-sample,z))/(sample*2),dz=(ground(x,z+sample)-ground(x,z-sample))/(sample*2);
    const slope=Math.hypot(dx,dz),levelMeadow=1-THREE.MathUtils.smoothstep(slope,.22,.78);
    const creekDistance=Math.abs(x-creekX(z))-creekWidth(z),bankMeadow=THREE.MathUtils.smoothstep(creekDistance,.20,.90);
    const openPath=THREE.MathUtils.smoothstep(path,.10,.65),rootMeadow=THREE.MathUtils.smoothstep(root,.65,2.05);
    let density=(.34+THREE.MathUtils.smoothstep(patch,.28,.70)*.59)*(.57+smallPatch*.56);
    density*=THREE.MathUtils.lerp(.42,1,openPath)*THREE.MathUtils.lerp(.48,1,rootMeadow);
    density*=THREE.MathUtils.lerp(.46,1,levelMeadow);
    if(random()>density)continue;
    const edge=THREE.MathUtils.smoothstep(Math.abs(x-creekX(z)),creekWidth(z)+.2,creekWidth(z)+.8);
    const tuft=THREE.MathUtils.smoothstep(smallPatch,.40,.72);
    let height=(.34+Math.pow(random(),.8)*.54)*(.71+tuft*.48);
    height*=THREE.MathUtils.lerp(.37,1,openPath)*THREE.MathUtils.lerp(.58,1,rootMeadow);
    height*=THREE.MathUtils.lerp(.42,1,levelMeadow)*THREE.MathUtils.lerp(.56,1,bankMeadow);
    dummy.position.set(x,ground(x,z)-.008,z);
    dummy.rotation.set((random()-.5)*.14,random()*Math.PI*2,(random()-.5)*.14);
    const spread=.76+random()*.48;dummy.scale.set(spread,height,spread);
    dummy.updateMatrix();grass.setMatrixAt(gi,dummy.matrix);
    color.copy(shadeGrass).lerp(meadowGrass,.28+patch*.55+random()*.15);
    color.multiplyScalar(.86+random()*.25);
    if(random()>.94)color.lerp(dryGrass,.24);
    if(edge<.5)color.lerp(shadeGrass,.15);
    grass.setColorAt(gi++,color);
  }
  grass.count=gi;grass.receiveShadow=true;grass.name='patches-of-meadow-grass';parent.add(grass);

  const petalParts=[];
  for(let i=0;i<9;i++){
    const petal=new THREE.BufferGeometry();
    petal.setAttribute('position',new THREE.Float32BufferAttribute([
      0,.225,.012,-.009,.234,.024,-.012,.236,.043,-.007,.227,.059,
      0,.223,.065,.007,.227,.059,.012,.236,.043,.009,.234,.024,0,.241,.039
    ],3));
    petal.setAttribute('uv',new THREE.Float32BufferAttribute([.5,0,.1,.2,0,.5,.15,.85,.5,1,.85,.85,1,.5,.9,.2,.5,.5],2));
    const ids=[];for(let k=0;k<8;k++)ids.push(8,k,(k+1)%8);
    petal.setIndex(ids);petal.computeVertexNormals();petal.rotateY(i/9*Math.PI*2);petalParts.push(petal);
  }
  const petals=mergeGeometries(petalParts);petalParts.forEach(g=>g.dispose());
  const centers=new THREE.SphereGeometry(.014,8,5);centers.scale(1,.38,1);centers.translate(0,.238,0);
  const stems=new THREE.CylinderGeometry(.002,.003,.225,4);stems.translate(0,.1125,0);
  const flowerMats=[
    new THREE.MeshStandardMaterial({color:'#faf9f0',roughness:.88,side:THREE.DoubleSide}),
    new THREE.MeshStandardMaterial({color:'#c6ae5c',roughness:.92}),
    new THREE.MeshStandardMaterial({color:'#638044',roughness:1})
  ];
  flowerMats.forEach(mat=>mat.onBeforeCompile=shader=>addWind(shader,time,.012));
  const flowers=[petals,centers,stems].map((g,i)=>new THREE.InstancedMesh(g,flowerMats[i],440));
  const flowerPatches=[[-5.8,2.25,1.60,.74],[-2.65,2.55,.98,.55],[6,-.9,1.35,.85],[6.6,2.55,1.0,.52],[-5.9,-2.2,.95,.62]];
  let fi=0;
  for(let attempt=0;attempt<2600&&fi<340;attempt++){
    const patch=flowerPatches[Math.floor(random()*flowerPatches.length)],a=random()*Math.PI*2,r=Math.pow(random(),.64);
    const edge=1+.18*Math.sin(a*3+patch[0])+.12*Math.cos(a*5+patch[1]);
    const tail=random()<.12?1.75:1;
    const x=patch[0]+Math.cos(a)*r*patch[2]*edge*tail,z=patch[1]+Math.sin(a)*r*patch[3]*edge;
    if(onCabinFloor(x,z)||!inside(x,z,.94)||Math.abs(x-creekX(z))<creekWidth(z)+.42||walkway(x,z)<.42||Math.hypot(x-TREE_SITE.x,z-TREE_SITE.z)<1.07||onEstatePad(x,z))continue;
    if(random()> .12+fbm(x*2.5+12,z*2.5-7)*.95||random()<r*.15)continue;
    dummy.position.set(x,ground(x,z),z);
    dummy.rotation.set((random()-.5)*.34,random()*Math.PI*2,(random()-.5)*.34);
    dummy.scale.setScalar(.50+random()*.71);dummy.updateMatrix();
    flowers.forEach(m=>m.setMatrixAt(fi,dummy.matrix));fi++;
  }
  flowers.forEach((m,i)=>{m.count=fi;m.receiveShadow=true;m.name=['daisy-petals','daisy-centers','daisy-stems'][i];m.userData.gardenFoliage=true;parent.add(m);});

  // Pale, tapered flower spikes grow in small families, rather than isolated beads.
  const spikeParts=[];
  for(let i=0;i<10;i++){
    const g=new THREE.SphereGeometry(1,5,3),a=i*2.399,height=.22+i*.012;
    g.scale(.012*(1-i*.035),.019,.012*(1-i*.035));
    g.translate(Math.cos(a)*.013,height,Math.sin(a)*.013);spikeParts.push(g);
  }
  const spike=mergeGeometries(spikeParts);spikeParts.forEach(g=>g.dispose());
  const lavenderMat=new THREE.MeshStandardMaterial({color:'#a59abb',roughness:.95});
  lavenderMat.onBeforeCompile=shader=>addWind(shader,time,.018);
  const lavender=new THREE.InstancedMesh(spike,lavenderMat,250);
  const lavenderStem=new THREE.CylinderGeometry(.002,.003,.23,4);lavenderStem.translate(0,.115,0);
  const sprigs=new THREE.InstancedMesh(lavenderStem,new THREE.MeshStandardMaterial({color:'#607846',roughness:1}),250);
  const lavPatches=[[-7.3,.6,1.0,.75],[6.0,-2.2,.85,.7],[3.8,3.2,1.0,.55],[-1.7,-2.4,.65,.9]];
  let li=0;
  for(let attempt=0;attempt<700&&li<250;attempt++){
    const patch=lavPatches[Math.floor(random()*lavPatches.length)],a=random()*Math.PI*2,r=Math.sqrt(random());
    const rim=.83+.17*Math.sin(a*3+patch[0])+.14*Math.sin(a*5+patch[1]);
    const x=patch[0]+Math.cos(a)*r*patch[2]*rim,z=patch[1]+Math.sin(a)*r*patch[3]*rim;
    if(onCabinFloor(x,z)||!inside(x,z,.93)||Math.abs(x-creekX(z))<creekWidth(z)+.37||walkway(x,z)<.42||onEstatePad(x,z))continue;
    if(fbm(x*2.7+6,z*2.7+4)<.35)continue;
    dummy.position.set(x,ground(x,z),z);dummy.rotation.set((random()-.5)*.3,random()*Math.PI*2,(random()-.5)*.32);
    const s=.63+random()*.65;dummy.scale.setScalar(s);dummy.updateMatrix();
    lavender.setMatrixAt(li,dummy.matrix);sprigs.setMatrixAt(li,dummy.matrix);li++;
  }
  lavender.count=sprigs.count=li;lavender.receiveShadow=sprigs.receiveShadow=true;
  lavender.name='lavender-meadow-patches';lavender.userData.gardenFoliage=true;sprigs.name='lavender-stems';parent.add(lavender,sprigs);
  return {...tree,grass:gi*3,grassClumps:gi,flowers:fi,lavender:li};
}

// Three slim, differently curved leaves share one instanced clump. Five bends
// replace the old broad triangular silhouette without adding a material draw.
function meadowTuft(){
  const parts=[];
  for(let blade=0;blade<3;blade++){
    const angle=blade*2.22+.2,height=[.31,.25,.35][blade],lean=[.12,.10,.145][blade];
    const sx=Math.cos(angle),sz=-Math.sin(angle),lx=Math.sin(angle),lz=Math.cos(angle);
    const vertices=[],uv=[],indices=[],segments=5;
    for(let j=0;j<segments;j++){
      const t=j/segments,curve=Math.pow(t,1.85)*lean;
      const halfWidth=.0065*Math.pow(1-t,.78)*(1+.12*Math.sin(t*Math.PI));
      for(const side of [-1,1]){
        vertices.push(lx*(curve+blade*.007)+sx*halfWidth*side,height*t*(1-.10*t),lz*(curve+blade*.007)+sz*halfWidth*side);
        uv.push((side+1)*.5,t);
      }
    }
    vertices.push(lx*(lean+blade*.007),height*.9,lz*(lean+blade*.007));uv.push(.5,1);
    for(let j=0;j<segments-1;j++){const a=j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    const last=(segments-1)*2;indices.push(last,last+1,segments*2);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();parts.push(geometry);
  }
  const geometry=mergeGeometries(parts,false);parts.forEach(part=>part.dispose());return geometry;
}

function walkway(x,z){
  const segments=[[[.35,-.28],[BENCH_SITE.x,BENCH_SITE.z]],[[BENCH_SITE.x,BENCH_SITE.z],[4.7,-2]],[[.05,-.3],[-3.2,2.1]]];
  let distance=Infinity;
  for(const [a,b] of segments){
    const dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
    distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }
  return distance;
}

function addWind(shader,time,strength,height=.24){
  shader.uniforms.uTime=time;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>\n#ifdef USE_INSTANCING\nvec3 origin=instanceMatrix[3].xyz;float windHeight=clamp(position.y/${height},0.,1.);windHeight*=windHeight;transformed.x+=sin(uTime*1.05+origin.x*.8+origin.z*.6)*${strength}*windHeight;transformed.z+=sin(uTime*.77+origin.z*.83)*${strength*.4}*windHeight;\n#endif`);
}

/** Small living habitats, batched independently of the existing grass canopy. */
export function makeMeadowEcology(parent){
  const random=rng(6207),group=new THREE.Group();group.name='meadow-ecology';parent.add(group);
  const dummy=new THREE.Object3D(),batches=[],plants=[],perches=[];
  let clock=0,disposed=false;
  // Tiny colored surfaces keep flower centers and stems in the blossom draw.
  function surface(){
    const positions=[],colors=[],alphas=[];
    return {
      triangle(a,b,c,hex,alpha=[1,1,1]){const color=new THREE.Color(hex);for(const v of [a,b,c]){positions.push(...v);colors.push(color.r,color.g,color.b);}alphas.push(...alpha);},
      finish(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('tuftAlpha',new THREE.Float32BufferAttribute(alphas,1));g.computeVertexNormals();return g;}
    };
  }
  function stem(s,height=.2){
    for(let j=0;j<2;j++){
      const y=j*height/2,ny=(j+1)*height/2,x=.018*(y/height)**2,nx=.018*(ny/height)**2;
      for(const axis of [0,2]){
        const a=[x,y,0],b=[x,y,0],c=[nx,ny,0],d=[nx,ny,0];
        a[axis]-=.0025;b[axis]+=.0025;c[axis]-=.002;d[axis]+=.002;
        s.triangle(a,b,c,'#568144');s.triangle(b,d,c,'#568144');
      }
    }
  }
  function blossom(s,n,r,y,hex){
    for(let j=0;j<n;j++){
      const a=j/n*Math.PI*2,point=(radius,angle,h)=>[.018+Math.cos(angle)*radius,h,Math.sin(angle)*radius];
      const root=point(.007,a,y),left=point(r*.75,a-.24,y+.008),tip=point(r,a,y+.004),right=point(r*.75,a+.24,y+.008);
      if(n===5){
        const l=point(r*.94,a-.16,y+.006),rgt=point(r*.94,a+.16,y+.006);
        s.triangle(root,left,l,hex);s.triangle(root,l,rgt,hex);s.triangle(root,rgt,right,hex);
      }else{s.triangle(root,left,tip,hex);s.triangle(root,tip,right,hex);}
    }
    for(let j=0;j<4;j++){
      const a=j*Math.PI/2,b=a+Math.PI/2;
      s.triangle([.018,y+.014,0],[.018+Math.cos(a)*.011,y+.008,Math.sin(a)*.011],[.018+Math.cos(b)*.011,y+.008,Math.sin(b)*.011],'#ffe066');
    }
  }
  function batch(name,g,mat,count){
    const mesh=new THREE.InstancedMesh(g,mat,count);mesh.name=name;mesh.receiveShadow=true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(mesh);batches.push(mesh);return mesh;
  }
  const plantMat=()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,side:THREE.DoubleSide});
  const blueSurface=surface();stem(blueSurface);blossom(blueSurface,5,.05,.2,'#48cae4');
  const blue=batch('creek-forget-me-nots',blueSurface.finish(),plantMat(),150);
  const stemsSurface=surface();stem(stemsSurface,.3);
  const stems=batch('dandelion-stems',stemsSurface.finish(),plantMat(),35);
  const goldSurface=surface();blossom(goldSurface,12,.07,.3,'#ffb703');
  const gold=batch('golden-dandelions',goldSurface.finish(),plantMat(),14);
  const fluffSurface=surface();
  // Three-dimensional soft tufts around a seedhead, rather than a solid ball.
  for(let i=0;i<22;i++){
    const v=1-2*(i+.5)/22,a=i*2.39996,n=new THREE.Vector3(Math.sqrt(1-v*v)*Math.cos(a),v,Math.sqrt(1-v*v)*Math.sin(a));
    const tangent=new THREE.Vector3().crossVectors(n,new THREE.Vector3(0,1,.1)).normalize();
    const bitangent=new THREE.Vector3().crossVectors(n,tangent).normalize(),center=n.clone().multiplyScalar(.073).add(new THREE.Vector3(.018,.3,0));
    const points=[tangent.clone().multiplyScalar(.052),bitangent.clone().multiplyScalar(.052),tangent.clone().multiplyScalar(-.052),bitangent.clone().multiplyScalar(-.052)].map(p=>p.add(center).toArray());
    for(let j=0;j<4;j++)fluffSurface.triangle(center.toArray(),points[j],points[(j+1)%4],'#ffffff',[1,0,0]);
  }
  const fluff=batch('white-dandelion-seedheads',fluffSurface.finish(),new THREE.MeshStandardMaterial({color:'#ffffff',emissive:'#ffffff',emissiveIntensity:.22,transparent:true,opacity:.88,roughness:.8,side:THREE.DoubleSide,depthWrite:false,forceSinglePass:true}),21);
  fluff.material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float tuftAlpha;\nvarying float vTuftAlpha;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTuftAlpha=tuftAlpha;');
    shader.fragmentShader='varying float vTuftAlpha;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=smoothstep(0.0,0.8,vTuftAlpha);\n#include <alphatest_fragment>');
  };
  fluff.material.customProgramCacheKey=()=> 'soft-spatial-seedhead';
  function record(mesh,index,x,z,scale,head,links=[]){
    const p={mesh,index,x,z,y:ground(x,z),scale,angle:random()*Math.PI*2,phase:random()*Math.PI*2,head,links,matrix:new THREE.Matrix4()};
    plants.push(p);return p;
  }
  // The ground/water intersection is the visible shoreline, not the centerline width.
  function shore(z,side){
    let distance=creekWidth(z);
    while(distance<1.6&&ground(creekX(z)+side*distance,z)<waterY(z)+.025)distance+=.025;
    return creekX(z)+side*distance;
  }
  for(let i=0;i<150;i++){
    const side=i%2?1:-1,z=-3.5+(i/150)*7.2+(random()-.5)*.12,x=shore(z,side)+side*(.25+random()*.35);
    const p=record(blue,i,x,z,.85+random()*.25,.214);
    // Several real blossom tips in each habitat allow a different landing flower.
    if([38,42,46,104,108,112].includes(i))perches.push({plant:p,getPoint(out){return out.set(.018,p.head,0).applyMatrix4(p.matrix);}});
  }
  const patches=[[-4.5,1.8],[1.2,-1.8],[5,1.2],[4.8,.25]];
  for(let i=0;i<35;i++){
    const patch=patches[i%4],a=random()*Math.PI*2,r=.2+random()*.55;
    let x=patch[0]+Math.cos(a)*r,z=patch[1]+Math.sin(a)*r*.65;
    if(Math.abs(x-creekX(z))<.95)x=shore(z,x<creekX(z)?-1:1)+(x<creekX(z)?-.4:.4);
    const isFluff=i<21,mesh=isFluff?fluff:gold,index=isFluff?i:i-21;
    record(stems,i,x,z,.85+random()*.25,.3,[{mesh,index}]);
  }
  const pebbleGeometry=new THREE.SphereGeometry(1,8,5);
  const pebbles=batch('wet-creek-pebbles',pebbleGeometry,new THREE.MeshStandardMaterial({color:'#8b9588',roughness:.16}),12);
  const mossGeometry=new THREE.SphereGeometry(1,8,2,0,Math.PI*2,0,Math.PI*.38);
  const mossPositions=mossGeometry.attributes.position,mossColors=[];
  for(let i=0;i<mossPositions.count;i++){
    const x=mossPositions.getX(i),y=mossPositions.getY(i),z=mossPositions.getZ(i),a=Math.atan2(z,x);
    const ripple=1+.045*Math.sin(a*3+.7)+.025*Math.cos(a*5);
    mossPositions.setXYZ(i,x*ripple,y+(1-y)*.06*Math.sin(a*5),z*ripple);
    const c=new THREE.Color('#ffffff').multiplyScalar(.72+.28*(.5+.5*Math.sin(x*13+z*9)));mossColors.push(c.r,c.g,c.b);
  }
  mossGeometry.setAttribute('color',new THREE.Float32BufferAttribute(mossColors,3));mossGeometry.computeVertexNormals();
  const moss=batch('pebble-moss-caps',mossGeometry,new THREE.MeshStandardMaterial({color:'#2d6a4f',vertexColors:true,roughness:.95}),12);
  for(let i=0;i<12;i++){
    const z=-3.2+i*.6,side=i%2?1:-1,x=shore(z,side)+side*(.02+random()*.10),r=.085+random()*.07;
    dummy.position.set(x,ground(x,z)+r*.22,z);dummy.rotation.set(.12,random()*Math.PI*2,.1);
    dummy.scale.set(r,r*.65,r*.8);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);
    dummy.scale.multiplyScalar(1.025);dummy.updateMatrix();moss.setMatrixAt(i,dummy.matrix);
  }
  const cloverSurface=surface();
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3,root=[0,.055,0],left=[Math.cos(a-.55)*.04,.065,Math.sin(a-.55)*.04],tip=[Math.cos(a)*.065,.06,Math.sin(a)*.065],right=[Math.cos(a+.55)*.04,.065,Math.sin(a+.55)*.04];cloverSurface.triangle(root,left,tip,'#4c8652');cloverSurface.triangle(root,tip,right,'#68a45a');}
  const clover=batch('low-clover-mats',cloverSurface.finish(),plantMat(),48);
  for(let i=0;i<48;i++){
    const center=i<24?[-4.4,1]:[4.6,2.1],a=random()*Math.PI*2,r=.15+random()*.75,x=center[0]+Math.cos(a)*r,z=center[1]+Math.sin(a)*r;
    dummy.position.set(x,ground(x,z)+.003,z);dummy.rotation.set(0,a,0);dummy.scale.setScalar(.8+random()*.4);dummy.updateMatrix();clover.setMatrixAt(i,dummy.matrix);
  }
  function writePlants(){
    const gust=guidingWindGust(clock);
    for(const p of plants){
      dummy.position.set(p.x,p.y,p.z);dummy.scale.setScalar(p.scale);
      dummy.rotation.set(Math.sin(clock*.85+p.phase)*(.025+.07*gust),p.angle,Math.sin(clock*1.2+p.phase)*(.035+.10*gust));
      dummy.updateMatrix();p.matrix.copy(dummy.matrix);p.mesh.setMatrixAt(p.index,dummy.matrix);
      for(const link of p.links)link.mesh.setMatrixAt(link.index,dummy.matrix);
    }
    for(const mesh of [blue,stems,gold,fluff])mesh.instanceMatrix.needsUpdate=true;
    group.userData.clock=clock;
  }
  writePlants();for(const mesh of batches){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
  const statistics={dandelions:35,forgetMeNots:150,pebbles:12,clover:48,triangles:batches.reduce((n,m)=>n+(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3*m.count,0)};
  group.userData.statistics=statistics;
  function update(delta,{covered=false,reducedMotion=false}={}){
    if(disposed||covered||reducedMotion)return false;
    clock+=Math.max(0,Math.min(.06,delta));writePlants();return true;
  }
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const m of batches){m.dispose();m.geometry.dispose();m.material.dispose();}}
  return {group,perches,statistics,update,dispose,get clock(){return clock;}};
}
