import * as THREE from 'three';
import {addRibbon} from './ribbon.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng,mesh,curveTube,fbm} from './shared.js';
import {ground} from './land.js';
import {material} from './materials.js';

// All branch, root and leaf positions are authored in the island's coordinate system.
// A broad, low canopy and rooted aerial columns distinguish this from the old upright tree.
export function makeBanyan(parent,time){
  const random=rng(41283),x=-4.1,z=-.6,y=ground(x,z);
  const wood=[],fineRoots=[],clusters=[],rootContacts=[],limbs=[];
  const bark=material('banyan','#d4c9b2');bark.roughness=.97;bark.bumpScale=.031;
  bark.onBeforeCompile=s=>{
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBarkPosition;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvBarkPosition=position;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vBarkPosition;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float barkFlute=.5+.5*sin(atan(vBarkPosition.z+.6,vBarkPosition.x+4.1)*23.+vBarkPosition.y*.7);
        diffuseColor.rgb*=mix(vec3(.63,.70,.53),vec3(1.),smoothstep(.65,2.0,vBarkPosition.y));
        diffuseColor.rgb*=.89+.11*barkFlute;
      `);
  };
  const addWood=(points,r0,r1,segments=20,sides=12)=>wood.push(curveTube(points,r0,r1,segments,sides));
  const root=(points,r0,r1)=>fineRoots.push(curveTube(points,r0,r1,18,6));

  // An uneven trunk made of a central bole and fused stems; roots flare into the terrain.
  addWood([[x,y-.10,z],[x+.04,y+.6,z-.08],[x-.16,y+1.25,z],[x-.08,y+2.3,z-.1]],.53,.29,30,18);
  for(let i=0;i<5;i++){
    const a=i*2.399,r=.25+random()*.09,dx=Math.cos(a),dz=Math.sin(a);
    addWood([[x+dx*r,y-.05,z+dz*r],[x+dx*r*.9,y+.85,z+dz*r*.9],[x+dx*.22,y+1.7,z+dz*.22],[x+dx*.38,y+2.35,z+dz*.4]],.23,.085,22,12);
  }
  for(let i=0;i<10;i++){
    const a=i*2.399+.25,r=1.15+random()*.95,dx=Math.cos(a),dz=Math.sin(a),ex=x+dx*r,ez=z+dz*r;
    addWood([[x+dx*.28,y+.6+random()*.2,z+dz*.28],[x+dx*.6,y+.12,z+dz*.6],[x+dx*r*.8,ground(x+dx*r*.8,z+dz*r*.8)+.025,z+dz*r*.8],[ex,ground(ex,ez)-.04,ez]],.20,.012,22,10);
    wood.push(buttress(x,z,a,r,y));
    if(i%2===0){const tipx=ex+Math.cos(a+.42)*.6,tipz=ez+Math.sin(a+.42)*.6;
      addWood([[ex-dx*.25,ground(ex-dx*.25,ez-dz*.25)+.02,ez-dz*.25],[ex,ground(ex,ez)+.015,ez],[tipx,ground(tipx,tipz)-.035,tipz]],.045,.005,10,7);
    }
  }

  // Broad asymmetric limbs rise out of the bole and then spread almost horizontally.
  for(let i=0;i<11;i++){
    const a=i/11*Math.PI*2+.25*Math.sin(i*2.1),r=2.22+random()*.88,dx=Math.cos(a),dz=Math.sin(a)*.74;
    const start=new THREE.Vector3(x-.08,y+1.45+(i%3)*.23,z-.04);
    const knee=new THREE.Vector3(x+dx*.8,y+2.35+random()*.18,z+dz*.8);
    const end=new THREE.Vector3(x+dx*r,y+2.95+random()*.4,z+dz*r);
    const bend=knee.clone().lerp(end,.55);bend.y+=.12;
    const points=[start.toArray(),knee.toArray(),bend.toArray(),end.toArray()];
    addWood(points,.25-(i%3)*.025,.065,30,13);
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));limbs.push(curve);

    // Secondary limbs fill each crown sector with overlapping, shallow foliage masses.
    for(let j=0;j<5;j++){
      const branchBase=curve.getPoint(.48+j*.105),fan=a+(j-2)*.28;
      const tip=branchBase.clone().add(new THREE.Vector3(Math.cos(fan)*(.55+random()*.32),.33+random()*.30,Math.sin(fan)*(.5+random()*.18)));
      const middle=branchBase.clone().lerp(tip,.45);middle.y+=.12;
      addWood([branchBase.toArray(),middle.toArray(),tip.toArray()],.055,.009,12,7);
      clusters.push({p:tip,rx:.65+random()*.50,ry:.28+random()*.24,rz:.42+random()*.36,angle:fan,phase:random()*6.28});
      for(let k=0;k<3;k++){
        const ca=fan+(k-1)*.65,leafTip=tip.clone().add(new THREE.Vector3(Math.cos(ca)*.28,.1+random()*.12,Math.sin(ca)*.23));
        addWood([middle.toArray(),tip.toArray(),leafTip.toArray()],.013,.003,6,5);
      }
    }
  }
  // Close the central crown without a sphere or camera-facing foliage card.
  for(let i=0;i<13;i++){
    const a=i*2.399,r=Math.sqrt((i+.5)/13)*1.72;
    const tip=new THREE.Vector3(x+Math.cos(a)*r,y+3.91+.44*(1-r/1.72)+random()*.38,z+Math.sin(a)*r*.74);
    addWood([[x-.1,y+2.1,z], [x+Math.cos(a)*r*.65,y+3.2,z+Math.sin(a)*r*.5],tip.toArray()],.075,.012,16,8);
    clusters.push({p:tip,rx:.71+random()*.31,ry:.35+random()*.26,rz:.50+random()*.32,angle:a,phase:random()*6.28});
  }

  // A few established prop roots reach the soil; younger aerial roots stop above it.
  for(let i=0;i<limbs.length;i++){
    const curve=limbs[i];
    if([0,3,5,7,9].includes(i)){
      const start=curve.getPoint(.76),end=start.clone();end.x+=.1*Math.sin(i);end.z+=.12*Math.cos(i);end.y=ground(end.x,end.z)-.025;
      const mid=start.clone().lerp(end,.53);mid.x+=.16*Math.sin(i+.5);mid.z+=.11*Math.cos(i+.7);
      addWood([start.toArray(),mid.toArray(),end.toArray()],.049,.095,28,9);rootContacts.push(end.toArray());
      for(let j=0;j<3;j++){let a=i+j*2.1,ex=end.x+Math.cos(a)*.38,ez=end.z+Math.sin(a)*.38;
        addWood([[end.x,end.y+.2,end.z],[end.x+Math.cos(a)*.12,end.y+.04,end.z+Math.sin(a)*.12],[ex,ground(ex,ez)-.02,ez]],.055,.005,12,7);
      }
    }
    for(let j=0;j<3;j++){
      const start=curve.getPoint(.50+random()*.45);start.x+=(random()-.5)*.13;start.z+=(random()-.5)*.13;
      const length=.55+random()*1.55,endY=Math.max(ground(start.x,start.z)+.28,start.y-length);
      root([start.toArray(),[start.x+.025*Math.sin(i+j),start.y-.4,start.z+.015],[start.x+.03*Math.sin(i*2+j),endY,start.z+.035*Math.cos(j)]],.009+random()*.006,.0025);
    }
  }
  // A small foreground bough carries the ribbon clear of the bole and hanging roots.
  addWood([[x+.42,y+2.17,z+.44],[x+.96,y+2.72,z+.97],[x+1.46,y+2.88,z+1.29],[x+1.77,y+2.95,z+1.47]],.085,.017,18,8);
  const trunkMesh=mesh(parent,mergeGeometries(wood,false),bark);trunkMesh.name='banyan-trunk-and-roots';wood.forEach(g=>g.dispose());
  const airRootMesh=mesh(parent,mergeGeometries(fineRoots,false),bark);airRootMesh.name='banyan-aerial-roots';fineRoots.forEach(g=>g.dispose());

  // Individual shallow-curved, broad oval leaves with tapered tips.
  const leaf=new THREE.BufferGeometry();
  leaf.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.023,.025,.002,-.039,.059,.005,-.030,.095,.004,0,.132,0,.030,.095,.004,.039,.059,.005,.023,.025,.002,0,.062,.011],3));
  leaf.setAttribute('uv',new THREE.Float32BufferAttribute([.5,0,.18,.19,0,.45,.12,.72,.5,1,.88,.72,1,.45,.82,.19,.5,.47],2));
  const ids=[];for(let i=0;i<8;i++)ids.push(8,i,(i+1)%8);leaf.setIndex(ids);leaf.computeVertexNormals();
  const leafMat=new THREE.MeshStandardMaterial({color:'#ffffff',map:leafVeins(),roughness:.88,side:THREE.DoubleSide});

  leafMat.onBeforeCompile=s=>{
    s.uniforms.uTime=time;
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;varying float vLeafHeight;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 origin=instanceMatrix[3].xyz;vLeafHeight=origin.y;
        transformed.x+=sin(uTime*.9+origin.x*.8+origin.z*.7)*.014*uv.y;
        transformed.z+=sin(uTime*1.2+origin.x*1.1)*.006*uv.y;
        #endif
      `);
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vLeafHeight;')
      .replace('#include <opaque_fragment>',`// A thin-leaf wrap term lifts shaded boughs gently, retaining the crown's green depth.
        float leafEdgeLight=.30+.70*smoothstep(2.3,4.8,vLeafHeight);
        outgoingLight+=diffuseColor.rgb*vec3(.060,.077,.035)*leafEdgeLight;
        #if NUM_DIR_LIGHTS > 0
          float leafThroughLight=pow(max(dot(-normal,directionalLights[0].direction),0.0),1.5);
          outgoingLight+=diffuseColor.rgb*directionalLights[0].color*leafThroughLight*.055;
        #endif
        #include <opaque_fragment>
      `);
  };
  clusters.forEach(cluster=>cluster.leafCount=Math.round(350+random()*210));
  const count=clusters.reduce((sum,cluster)=>sum+cluster.leafCount,0);
  const leaves=new THREE.InstancedMesh(leaf,leafMat,count),dummy=new THREE.Object3D(),leafColor=new THREE.Color();
  const deepLeaf=new THREE.Color('#365c3e'),middleLeaf=new THREE.Color('#62814b'),sunlitLeaf=new THREE.Color('#899d62');
  let index=0;for(const cluster of clusters)for(let i=0;i<cluster.leafCount;i++){
    const a=random()*Math.PI*2,vertical=random()*2-1,r=Math.sqrt(random());
    const rim=.80+.16*Math.sin(a*3+cluster.phase)+.13*Math.sin(a*7+cluster.phase*1.8);
    const lx=Math.cos(a)*r*cluster.rx*rim,lz=Math.sin(a)*r*cluster.rz*rim;
    const ca=Math.cos(cluster.angle),sa=Math.sin(cluster.angle);
    dummy.position.set(cluster.p.x+lx*ca-lz*sa,cluster.p.y+vertical*cluster.ry*(1-r*r*.68)-.20*r*r,cluster.p.z+lx*sa+lz*ca);
    // Missing leaves and irregular draping edges reveal branches between the boughs.
    const habitat=fbm(dummy.position.x*1.35+7,dummy.position.z*1.35+13);
    if(habitat<.30&&r>.4)continue;
    dummy.rotation.set(-Math.PI/2+(random()-.5)*1.60+r*.3,cluster.angle+(random()-.5)*2.1,(random()-.5)*1.45);
    const size=.76+random()*.72;dummy.scale.set(size*(.80+random()*.34),size,size);dummy.updateMatrix();leaves.setMatrixAt(index,dummy.matrix);
    const outer=THREE.MathUtils.clamp((dummy.position.y-y-2.8)/2,0,1);
    leafColor.copy(deepLeaf).lerp(middleLeaf,.22+outer*.36+random()*.30);
    leafColor.multiplyScalar(.88+random()*.28);
    // Only a few outward shoots are pale; the body of the crown stays deep spring green.
    if(r>.86&&outer>.62&&random()>.90)leafColor.lerp(sunlitLeaf,.32);
    leaves.setColorAt(index,leafColor);index++;
  }
  leaves.count=index;leaves.castShadow=leaves.receiveShadow=true;leaves.name='banyan-canopy';parent.add(leaves);
  const ribbon=addRibbon(parent,x+1.46,y+2.88,z+1.29,time);
  const ribbonAnchor=ribbon.getWorldPosition(new THREE.Vector3()).toArray();
  return {leaves:index,treeType:'banyan',aerialRoots:fineRoots.length,rootedColumns:rootContacts.length,rootContacts,ribbonAnchor};
}

function buttress(x,z,a,length,base){
  const v=[],uv=[],idx=[],steps=14;const dx=Math.cos(a),dz=Math.sin(a),sx=-dz,sz=dx;
  for(let j=0;j<=steps;j++){
    const t=j/steps,r=.26+t*length,px=x+dx*r,pz=z+dz*r,gy=ground(px,pz)-.02,height=Math.pow(1-t,2.2)*(.73+.12*Math.sin(a*3)),width=.15*Math.pow(1-t,.7)+.01;
    for(let k=0;k<3;k++){let side=k===0?-1:k===2?1:0;v.push(px+sx*width*side,gy+(k===1?height:0),pz+sz*width*side);uv.push(t*2,k*.5);}
  }
  for(let j=0;j<steps;j++)for(let k=0;k<2;k++){const a=j*3+k,b=a+3;idx.push(a,a+1,b,a+1,b+1,b);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}


function leafVeins(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,128,0);gradient.addColorStop(0,'#d2d9c6');gradient.addColorStop(.5,'#f5f5e9');gradient.addColorStop(1,'#dce2cf');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  ctx.strokeStyle='rgba(242,244,220,.44)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(64,0);ctx.lineTo(64,128);ctx.stroke();
  for(let i=0;i<7;i++){let y=15+i*15;for(let sign of [-1,1]){ctx.beginPath();ctx.moveTo(64,y);ctx.quadraticCurveTo(64+sign*15,y+12,64+sign*55,y+26);ctx.stroke();}}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
