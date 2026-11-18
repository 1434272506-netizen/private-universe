import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ground, creekX, waterY, creekWidth, inside, onCabinFloor, CAMPFIRE_SITE, COCOA_STUMP } from './land.js';
import { material } from './materials.js';

function safeMerge(geoms) {
  if (!geoms || geoms.length === 0) return null;
  const uniform = geoms.map(g => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(uniform);
  geoms.forEach(g => g.dispose());
  return merged;
}

/**
 * 🏰 天空庄园专属地标构件总集 (Celestial Estate Comprehensive Features)
 * 
 * 1. 🌉 和风月弓木拱桥 (Arched Wooden Footbridge)
 * 2. 🏮 全岛 21 处沿径暖光木桩地灯网络 (Warm Pathway Stake Lanterns)
 * 3. ⛺ 双人草地浪漫野餐角 (Romantic Picnic Setup: 吉他、红白格野餐毯、香槟高脚杯与野餐提篮)
 * 4. 🔥 石砌暖光篝火堆 (Cozy Stone Fire Pit: 原木树桩坐凳、发光炭火、火星与温暖火光)
 * 5. 🔭 东侧悬崖黄铜天文望远镜与星空挑台 (Brass Stargazing Telescope & Cliff Lookout)
 * 6. 🎪 西侧崖畔双人木秋千 (Couples' Cliffside Swing: 原木人字架、藤蔓繁花缠绕绳索)
 * 7. 🪵 田园原木矮栅栏与攀爬蔷薇 (Rustic Wooden Picket Fences & Wild Roses)
 * 8. 🌻 西大陆盛开向日葵花田与紫晶薰衣草阶梯花甸 (Sunflowers, Lavender & Bioluminescent Flora)
 */
export function makeEstateFeatures(parent, time) {
  const group = new THREE.Group();
  group.name = 'estate-features';
  parent.add(group);

  // 1. 构筑和风月弓木拱桥
  const bridge = makeArchedFootbridge(group, time);

  // 2. 构筑全岛暖光木桩地灯网络
  const lanterns = makePathwayLanterns(group, time);

  // 3. 构筑草地双人野餐角
  const picnic = makeRomanticPicnic(group, time);

  // 4. 构筑石砌暖光篝火堆
  const campfire = makeCozyCampfire(group, time);

  // 5. 构筑东侧悬崖黄铜望远镜与星空观景挑台
  const observatory = makeStargazingDeckAndTelescope(group, time);

  // 6. 构筑西侧崖畔双人秋千
  const swing = makeCouplesSwing(group, time);

  // 7. 构筑田园原木矮栅栏与攀爬蔷薇
  const fences = makeRusticFences(group, time);

  // 8. 构筑西大陆向日葵花田与紫晶薰衣草
  const meadows = makeBlossomMeadows(group, time);

  let warmthLevel = 0; // 0: day, 0.45: sunset, 1.0: night

  return {
    group,
    bridge,
    lanterns,
    picnic,
    campfire,
    observatory,
    swing,
    fences,
    meadows,
    setWarmth(v) {
      warmthLevel = v;
      bridge.setWarmth(v);
      lanterns.setWarmth(v);
      picnic.setWarmth(v);
      campfire.setWarmth(v);
      observatory.setWarmth(v);
      meadows.setWarmth(v);
    },
    update(elapsed, winterWeight = 0) {
      bridge.update(elapsed, warmthLevel);
      lanterns.update(elapsed, warmthLevel);
      campfire.update(elapsed, warmthLevel, winterWeight);
      picnic.update(elapsed, warmthLevel);
      swing.update(elapsed);
      meadows.update(elapsed, warmthLevel);
    },
    dispose() {
      group.removeFromParent();
      bridge.dispose();
      lanterns.dispose();
      picnic.dispose();
      campfire.dispose();
      observatory.dispose();
      swing.dispose();
      fences.dispose();
      meadows.dispose();
    }
  };
}

/**
 * 🌉 1. 和风月弓木拱桥 (Arched Wooden Footbridge)
 */
function makeArchedFootbridge(parent, time) {
  const bridgeGroup = new THREE.Group();
  bridgeGroup.name = 'arched-wooden-footbridge';
  parent.add(bridgeGroup);

  const p0 = new THREE.Vector3(-1.85, 0, 0.15);
  p0.y = ground(p0.x, p0.z) + 0.035;
  const p1 = new THREE.Vector3(1.85, 0, -0.22);
  p1.y = ground(p1.x, p1.z) + 0.035;

  const bridgeVec = new THREE.Vector3().subVectors(p1, p0);
  const length = bridgeVec.length();
  const dir = bridgeVec.clone().normalize();
  const norm = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

  const archHeight = 0.46;
  const bridgeWidth = 1.28;

  function getBridgePoint(t) {
    const x = THREE.MathUtils.lerp(p0.x, p1.x, t);
    const z = THREE.MathUtils.lerp(p0.z, p1.z, t);
    const baseGroundY = THREE.MathUtils.lerp(p0.y, p1.y, t);
    const archOffset = 4.0 * archHeight * t * (1.0 - t);
    const y = baseGroundY + archOffset;
    return new THREE.Vector3(x, y, z);
  }

  function getBridgeTangent(t) {
    const delta = 0.01;
    const pt1 = getBridgePoint(Math.max(0, t - delta));
    const pt2 = getBridgePoint(Math.min(1, t + delta));
    return pt2.sub(pt1).normalize();
  }

  const woodGeoms = [];
  const darkWoodGeoms = [];

  // A. 桥底双弧形主大梁
  const beamSegments = 24;
  for (const side of [-1, 1]) {
    const beamOffset = side * (bridgeWidth * 0.44);
    for (let i = 0; i < beamSegments; i++) {
      const tA = i / beamSegments;
      const tB = (i + 1) / beamSegments;
      const posA = getBridgePoint(tA).addScaledVector(norm, beamOffset);
      const posB = getBridgePoint(tB).addScaledVector(norm, beamOffset);
      posA.y -= 0.07;
      posB.y -= 0.07;

      const segLen = posA.distanceTo(posB);
      const beamSeg = new THREE.BoxGeometry(0.09, 0.12, segLen);
      const mid = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);
      const segDir = new THREE.Vector3().subVectors(posB, posA).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), segDir);
      beamSeg.applyQuaternion(quat);
      beamSeg.translate(mid.x, mid.y, mid.z);
      darkWoodGeoms.push(beamSeg);
    }
  }

  // 横撑系梁
  for (let k = 1; k < 4; k++) {
    const t = k / 4;
    const pt = getBridgePoint(t);
    pt.y -= 0.07;
    const tie = new THREE.BoxGeometry(bridgeWidth * 0.92, 0.08, 0.09);
    const yaw = Math.atan2(dir.x, dir.z);
    tie.rotateY(yaw);
    tie.translate(pt.x, pt.y, pt.z);
    darkWoodGeoms.push(tie);
  }

  // B. 桥面弧形铺板 (22 块手作踏板)
  const plankCount = 22;
  for (let i = 0; i < plankCount; i++) {
    const t = (i + 0.5) / plankCount;
    const pt = getBridgePoint(t);
    const tang = getBridgeTangent(t);
    const plankLen = bridgeWidth + (Math.sin(i * 1.7) * 0.03);
    const plankThick = 0.048;
    const plankDepth = (length / plankCount) * 0.86;

    const plank = new RoundedBoxGeometry(plankLen, plankThick, plankDepth, 2, 0.006);
    const pitch = -Math.asin(tang.y);
    const yaw = Math.atan2(dir.x, dir.z);
    plank.rotateX(pitch);
    plank.rotateY(yaw);

    const jitterY = (Math.sin(i * 3.1) * 0.003);
    plank.translate(pt.x, pt.y + plankThick * 0.5 + jitterY, pt.z);
    woodGeoms.push(plank);
  }

  // C. 原木立柱与月弓扶手
  const postTValues = [0.03, 0.22, 0.42, 0.58, 0.78, 0.97];
  const postHeight = 0.82;
  const postRadius = 0.036;

  for (const side of [-1, 1]) {
    const sideOffset = side * (bridgeWidth * 0.50);
    for (const t of postTValues) {
      const pt = getBridgePoint(t).addScaledVector(norm, sideOffset);
      const isCorner = (t < 0.05 || t > 0.95);
      const h = isCorner ? postHeight + 0.06 : postHeight;
      const r = isCorner ? postRadius * 1.25 : postRadius;

      const post = new THREE.CylinderGeometry(r, r * 1.08, h, 8);
      post.translate(pt.x, pt.y + h * 0.5, pt.z);
      woodGeoms.push(post);

      if (isCorner) {
        const cap = new THREE.ConeGeometry(r * 1.35, 0.07, 4);
        cap.rotateY(Math.PI / 4);
        cap.translate(pt.x, pt.y + h + 0.035, pt.z);
        darkWoodGeoms.push(cap);
      }
    }

    const railSegs = 20;
    for (let j = 0; j < railSegs; j++) {
      const tA = j / railSegs;
      const tB = (j + 1) / railSegs;
      const ptA = getBridgePoint(tA).addScaledVector(norm, sideOffset);
      const ptB = getBridgePoint(tB).addScaledVector(norm, sideOffset);

      // 顶部主扶手
      {
        const topA = ptA.clone().setY(ptA.y + postHeight - 0.02);
        const topB = ptB.clone().setY(ptB.y + postHeight - 0.02);
        const segLen = topA.distanceTo(topB);
        const rail = new THREE.CylinderGeometry(0.026, 0.026, segLen, 6);
        rail.rotateX(Math.PI / 2);
        const mid = new THREE.Vector3().addVectors(topA, topB).multiplyScalar(0.5);
        const sDir = new THREE.Vector3().subVectors(topB, topA).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), sDir);
        rail.applyQuaternion(q);
        rail.translate(mid.x, mid.y, mid.z);
        woodGeoms.push(rail);
      }
      // 中层护栏
      {
        const midA = ptA.clone().setY(ptA.y + postHeight * 0.48);
        const midB = ptB.clone().setY(ptB.y + postHeight * 0.48);
        const segLen = midA.distanceTo(midB);
        const midRail = new THREE.CylinderGeometry(0.016, 0.016, segLen, 6);
        midRail.rotateX(Math.PI / 2);
        const midPt = new THREE.Vector3().addVectors(midA, midB).multiplyScalar(0.5);
        const sDir = new THREE.Vector3().subVectors(midB, midA).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), sDir);
        midRail.applyQuaternion(q);
        midRail.translate(midPt.x, midPt.y, midPt.z);
        woodGeoms.push(midRail);
      }
    }
  }

  const deckMesh = new THREE.Mesh(safeMerge(woodGeoms), material('wood', '#c4a682'));
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  deckMesh.name = 'bridge-deck-and-railings';
  bridgeGroup.add(deckMesh);

  const beamMesh = new THREE.Mesh(safeMerge(darkWoodGeoms), material('wood', '#7c6144'));
  beamMesh.castShadow = true;
  beamMesh.receiveShadow = true;
  beamMesh.name = 'bridge-dark-timber-beams';
  bridgeGroup.add(beamMesh);

  // D. 桥心暖光复古马灯
  const lanternGlassMat = new THREE.MeshStandardMaterial({
    color: '#fff3cc',
    emissive: '#ff9a1f',
    emissiveIntensity: 0.0,
    roughness: 0.35,
    metalness: 0.05,
    transparent: true,
    opacity: 0.90
  });

  const lanternMetalMat = new THREE.MeshStandardMaterial({
    color: '#3d3835',
    roughness: 0.55,
    metalness: 0.65
  });

  const lanternPositions = [{ t: 0.42, side: 1 }, { t: 0.58, side: -1 }];
  const lanternGlassGeoms = [];
  const lanternMetalGeoms = [];

  for (const { t, side } of lanternPositions) {
    const postPt = getBridgePoint(t).addScaledVector(norm, side * (bridgeWidth * 0.50));
    const lanternY = postPt.y + postHeight - 0.04;
    const lPos = postPt.clone().addScaledVector(norm, side * 0.09);
    lPos.y = lanternY;

    const arm = new THREE.CylinderGeometry(0.009, 0.009, 0.12, 6);
    arm.rotateZ(Math.PI / 2);
    arm.translate(postPt.x + (side * norm.x * 0.05), lanternY + 0.06, postPt.z + (side * norm.z * 0.05));
    lanternMetalGeoms.push(arm);

    const roof = new THREE.ConeGeometry(0.065, 0.045, 6);
    roof.translate(lPos.x, lPos.y + 0.05, lPos.z);
    lanternMetalGeoms.push(roof);

    const basePlate = new THREE.CylinderGeometry(0.055, 0.060, 0.015, 6);
    basePlate.translate(lPos.x, lPos.y - 0.05, lPos.z);
    lanternMetalGeoms.push(basePlate);

    const glass = new THREE.CylinderGeometry(0.042, 0.046, 0.085, 6);
    glass.translate(lPos.x, lPos.y, lPos.z);
    lanternGlassGeoms.push(glass);
  }

  const glassMesh = new THREE.Mesh(safeMerge(lanternGlassGeoms), lanternGlassMat);
  glassMesh.name = 'bridge-lantern-cores';
  bridgeGroup.add(glassMesh);

  const metalMesh = new THREE.Mesh(safeMerge(lanternMetalGeoms), lanternMetalMat);
  metalMesh.name = 'bridge-lantern-metal';
  bridgeGroup.add(metalMesh);

  const centerPt = getBridgePoint(0.5);
  const bridgeLight = new THREE.PointLight('#ffaa44', 0, 7.5, 1.4);
  bridgeLight.position.set(centerPt.x, centerPt.y + 0.35, centerPt.z);
  bridgeLight.name = 'bridge-ambient-glow';
  bridgeGroup.add(bridgeLight);

  return {
    group: bridgeGroup,
    setWarmth(v) {
      lanternGlassMat.emissiveIntensity = v * 2.4;
      bridgeLight.intensity = v * 0.95;
    },
    update(elapsed, warmth) {
      if (warmth > 0.05) {
        const pulse = 1.0 + Math.sin(elapsed * 3.5) * 0.06;
        lanternGlassMat.emissiveIntensity = warmth * 2.4 * pulse;
        bridgeLight.intensity = warmth * 0.95 * pulse;
      }
    },
    dispose() {
      bridgeGroup.removeFromParent();
      deckMesh.geometry.dispose();
      beamMesh.geometry.dispose();
      glassMesh.geometry.dispose();
      metalMesh.geometry.dispose();
      lanternGlassMat.dispose();
      lanternMetalMat.dispose();
    }
  };
}

/**
 * 🏮 2. 全岛沿径暖光木桩地灯网络 (Warm Pathway Stake Lanterns)
 */
function makePathwayLanterns(parent, time) {
  const lanternsGroup=new THREE.Group();lanternsGroup.name='pathway-stake-lanterns';parent.add(lanternsGroup);
  const lanternSites=[
    [-2.82,3.43],[-1.78,1.72],[-1.0,1.0],[-8.5,-1.9],[-12.6,-3.0],[-11.5,-6.8],
    [-5.8,5.2],[-9.2,7.2],[-15.5,1.2],[1.8,.1],[3.6,-.2],[6,.9],
    [8.8,2],[10.5,1.2],[12.6,3.6],[8,3.8],[7.2,-4.2],[13,-3.6],
    [14.65,1.15],[16.35,2.35],[11.8,6.8]
  ];
  const wood=[],caps=[],stones=[],cores=[],wicks=[],glass=[],glows=[],pools=[];
  const makeMesh=(geoms,mat,name)=>{
    const mesh=new THREE.Mesh(safeMerge(geoms),mat);mesh.name=name;lanternsGroup.add(mesh);return mesh;
  };
  // Continuous radial falloff: texture edges have zero alpha, never square plates.
  const c=document.createElement('canvas');c.width=c.height=128;
  const ctx=c.getContext('2d'),gradient=ctx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(255,223,159,.85)');gradient.addColorStop(.22,'rgba(255,177,79,.35)');
  gradient.addColorStop(.55,'rgba(255,147,44,.08)');gradient.addColorStop(1,'rgba(255,147,44,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const glowTexture=new THREE.CanvasTexture(c);glowTexture.colorSpace=THREE.SRGBColorSpace;
  const glowMat=new THREE.SpriteMaterial({map:glowTexture,color:'#ffc887',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
  const poolMat=new THREE.MeshBasicMaterial({map:glowTexture,color:'#eeb672',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  for(const [i,[x,z]] of lanternSites.entries()){
    const y=ground(x,z),leanX=Math.sin(i*2.3)*.012,leanZ=Math.cos(i*1.9)*.012;
    const local=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(leanX,0,leanZ));
    // All part offsets below are lamp-local. Apply the shared tilt BEFORE world placement.
    const part=(g,bucket,lx=0,ly=0,lz=0)=>{g.translate(lx,ly,lz);g.applyMatrix4(local);g.translate(x,y,z);bucket.push(g);};
    part(new THREE.CylinderGeometry(.105,.12,.075,8,1),stones,0,.028);
    part(new THREE.TorusGeometry(.068,.009,5,12).rotateX(Math.PI/2),caps,0,.068);
    part(new THREE.CylinderGeometry(.037,.046,.46,10),wood,0,.27);
    part(new RoundedBoxGeometry(.182,.026,.182,2,.006),caps,0,.51);
    // Four gently splayed supports beneath the tray; bronze corners frame frosted glass.
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const brace=new THREE.BoxGeometry(.013,.09,.014);brace.rotateZ(.32);brace.rotateY(a);
      part(brace,wood,Math.cos(a)*.045,.467,Math.sin(a)*.045);
    }
    for(const dx of [-1,1])for(const dz of [-1,1]){
      part(new THREE.CylinderGeometry(.006,.008,.17,6),caps,dx*.072,.604,dz*.072);
    }
    part(new RoundedBoxGeometry(.126,.15,.126,2,.012),cores,0,.604);
    part(new RoundedBoxGeometry(.038,.083,.038,2,.01),wicks,0,.583);
    part(new RoundedBoxGeometry(.142,.16,.142,2,.007),glass,0,.604);
    // Two four-slope roofs. Raised outer corners give the eaves a quiet hand-made lift.
    function roof(width,baseY,height){
      const vertices=[],indices=[];
      for(const [r,h] of [[width,baseY+.008],[width*.76,baseY],[width*.16,baseY+height]])
        for(const [dx,dz] of [[-1,-1],[1,-1],[1,1],[-1,1]])vertices.push(dx*r,h,dz*r);
      for(let ring=0;ring<2;ring++)for(let k=0;k<4;k++){
        const a=ring*4+k,b=ring*4+(k+1)%4,d=a+4,e=b+4;indices.push(a,d,b,b,d,e);
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(vertices.length/3*2),2));
      g.setIndex(indices);g.computeVertexNormals();part(g,caps);
    }
    roof(.112,.69,.062);roof(.078,.748,.047);
    part(new THREE.SphereGeometry(.015,10,6),caps,0,.805);
    part(new THREE.ConeGeometry(.011,.029,8),caps,0,.826);
    const glow=new THREE.Sprite(glowMat);glow.position.set(0,.604,0).applyMatrix4(local).add(new THREE.Vector3(x,y,z));glow.scale.set(.85,.85,1);lanternsGroup.add(glow);glows.push(glow);
    const pool=new THREE.Mesh(new THREE.PlaneGeometry(.95,.95),poolMat);pool.rotation.x=-Math.PI/2;
    pool.position.set(x,y+.012,z);lanternsGroup.add(pool);pools.push(pool);
  }
  const woodMat=material('wood','#856a4d');
  const capMat=new THREE.MeshStandardMaterial({color:'#655035',metalness:.62,roughness:.48,side:THREE.DoubleSide});
  const stoneMat=new THREE.MeshStandardMaterial({color:'#555b53',roughness:.97});
  const coreMaterial=new THREE.MeshStandardMaterial({color:'#fff0d2',emissive:'#ffae50',emissiveIntensity:0,roughness:.62});
  const wickMat=new THREE.MeshStandardMaterial({color:'#ffc285',emissive:'#ff8e32',emissiveIntensity:0,roughness:.55});
  const glassMat=new THREE.MeshPhysicalMaterial({color:'#ffedcf',transparent:true,opacity:.12,roughness:.18,metalness:.05,depthWrite:false});
  const woodMesh=makeMesh(wood,woodMat,'lantern-stake-posts');woodMesh.castShadow=true;woodMesh.receiveShadow=true;
  const capMesh=makeMesh(caps,capMat,'lantern-caps');capMesh.castShadow=true;
  const stoneMesh=makeMesh(stones,stoneMat,'lantern-stone-bases');stoneMesh.receiveShadow=true;
  const coreMesh=makeMesh(cores,coreMaterial,'lantern-luminous-cores');
  const wickMesh=makeMesh(wicks,wickMat,'lantern-candle-hearts');
  const glassMesh=makeMesh(glass,glassMat,'lantern-glass-panes');
  const applyWarmth=(v,pulse=1)=>{
    coreMaterial.emissiveIntensity=v*2.2*pulse;wickMat.emissiveIntensity=v*3*pulse;
    glowMat.opacity=v*.36*pulse;poolMat.opacity=v*.19*pulse;
    for(const object of glows)object.visible=glowMat.opacity>=.002;
    for(const object of pools)object.visible=poolMat.opacity>=.002;
  };
  applyWarmth(0);
  return {group:lanternsGroup,count:lanternSites.length,sites:lanternSites.map(([x,z])=>[x,ground(x,z),z]),
    setWarmth(v){applyWarmth(v);},
    update(elapsed,warmth){applyWarmth(warmth,1+Math.sin(elapsed*2.2)*.05+Math.cos(elapsed*4.1)*.03);},
    dispose(){
      lanternsGroup.removeFromParent();
      for(const mesh of [woodMesh,capMesh,stoneMesh,coreMesh,wickMesh,glassMesh])mesh.geometry.dispose();
      for(const pool of pools)pool.geometry.dispose();
      for(const mat of [woodMat,capMat,stoneMat,coreMaterial,wickMat,glassMat,glowMat,poolMat])mat.dispose();glowTexture.dispose();
    }
  };
}

/**
 * ⛺ 3. 双人草地浪漫野餐角 (Romantic Picnic Setup)
 * 红白方格野餐毯、原木民谣吉他、藤编野餐提篮、气泡香槟与高脚水晶杯
 */
function makeRomanticPicnic(parent, time) {
  const picnicGroup = new THREE.Group();
  picnicGroup.name = 'romantic-picnic-spot';
  picnicGroup.userData.interaction = 'picnic';
  parent.add(picnicGroup);

  const px = 13.2, pz = 0.8;
  const py = ground(px, pz);

  // A. 红白方格野餐毯 (conforming to terrain)
  const blanketGeom = new THREE.PlaneGeometry(1.85, 1.55, 10, 8);
  blanketGeom.rotateX(-Math.PI / 2);
  blanketGeom.rotateY(0.24);
  const posAttr = blanketGeom.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const wx = px + posAttr.getX(i);
    const wz = pz + posAttr.getZ(i);
    posAttr.setY(i, ground(wx, wz) - py + 0.022);
  }
  blanketGeom.computeVertexNormals();

  // 程序化红白方格纹理 (Gingham Canvas)
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const size = 32;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#d9383a' : '#fff8ed';
      ctx.fillRect(c * size, r * size, size, size);
    }
  }
  const blanketTex = new THREE.CanvasTexture(canvas);
  blanketTex.wrapS = blanketTex.wrapT = THREE.RepeatWrapping;
  blanketTex.repeat.set(4, 3.5);

  const blanketMat = new THREE.MeshStandardMaterial({
    map: blanketTex,
    roughness: 0.92,
    metalness: 0.02,
    side: THREE.DoubleSide
  });
  const blanketMesh = new THREE.Mesh(blanketGeom, blanketMat);
  blanketMesh.position.set(px, py, pz);
  blanketMesh.receiveShadow = true;
  blanketMesh.name = 'picnic-checkered-blanket';
  picnicGroup.add(blanketMesh);

  // B. 原木民谣吉他 (Acoustic Guitar)
  const guitarWoodGeoms = [];
  const gx = px - 0.25, gz = pz - 0.22, gy = py + 0.05;

  // 下琴身
  const lowerBout = new THREE.CylinderGeometry(0.19, 0.19, 0.065, 16);
  lowerBout.scale(1, 1, 0.88);
  lowerBout.translate(gx, gy + 0.035, gz);
  guitarWoodGeoms.push(lowerBout);

  // 上琴身
  const upperBout = new THREE.CylinderGeometry(0.145, 0.145, 0.065, 16);
  upperBout.scale(1, 1, 0.86);
  upperBout.translate(gx - 0.18, gy + 0.035, gz - 0.12);
  guitarWoodGeoms.push(upperBout);

  // 琴颈与琴头
  const neck = new THREE.BoxGeometry(0.38, 0.024, 0.042);
  neck.rotateY(0.58);
  neck.translate(gx - 0.42, gy + 0.045, gz - 0.26);
  guitarWoodGeoms.push(neck);

  const headstock = new THREE.BoxGeometry(0.12, 0.022, 0.055);
  headstock.rotateY(0.58);
  headstock.translate(gx - 0.62, gy + 0.048, gz - 0.38);
  guitarWoodGeoms.push(headstock);

  const guitarMesh = new THREE.Mesh(safeMerge(guitarWoodGeoms), material('wood', '#e29d52'));
  guitarMesh.castShadow = true;
  guitarMesh.receiveShadow = true;
  guitarMesh.name = 'picnic-acoustic-guitar';
  picnicGroup.add(guitarMesh);

  // C. 藤编野餐提篮 (Wicker Picnic Basket)
  const basketGeoms = [];
  const bx = px + 0.45, bz = pz + 0.32, by = py + 0.02;

  const basketBox = new RoundedBoxGeometry(0.38, 0.22, 0.26, 2, 0.015);
  basketBox.translate(bx, by + 0.11, bz);
  basketGeoms.push(basketBox);

  // 提手
  const handle = new THREE.TorusGeometry(0.14, 0.014, 6, 16, Math.PI);
  handle.rotateX(Math.PI / 2);
  handle.translate(bx, by + 0.22, bz);
  basketGeoms.push(handle);

  const basketMesh = new THREE.Mesh(safeMerge(basketGeoms), material('wood', '#996633'));
  basketMesh.castShadow = true;
  basketMesh.receiveShadow = true;
  basketMesh.name = 'picnic-wicker-basket';
  picnicGroup.add(basketMesh);

  // D. 气泡香槟与高脚水晶杯 (Champagne & Flutes)
  const glassGeoms = [];
  const bottleX = px + 0.15, bottleZ = pz + 0.38;

  const bottle = new THREE.CylinderGeometry(0.038, 0.042, 0.24, 12);
  bottle.translate(bottleX, py + 0.12, bottleZ);
  glassGeoms.push(bottle);

  for (const [fx, fz] of [[bottleX + 0.12, bottleZ - 0.06], [bottleX + 0.18, bottleZ + 0.08]]) {
    const stem = new THREE.CylinderGeometry(0.005, 0.005, 0.11, 6);
    stem.translate(fx, py + 0.055, fz);
    glassGeoms.push(stem);
    const bowl = new THREE.CylinderGeometry(0.026, 0.012, 0.075, 8);
    bowl.translate(fx, py + 0.14, fz);
    glassGeoms.push(bowl);
    const foot = new THREE.CylinderGeometry(0.028, 0.028, 0.006, 8);
    foot.translate(fx, py + 0.003, fz);
    glassGeoms.push(foot);
  }

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#e5f2e6',
    roughness: 0.08,
    transmission: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    ior: 1.52,
    transparent: true,
    opacity: 0.36,
    depthWrite: false
  });
  const glassMesh = new THREE.Mesh(safeMerge(glassGeoms), glassMat);
  glassMesh.name = 'picnic-champagne-and-flutes';
  picnicGroup.add(glassMesh);

  // E. 野餐烛台微光
  const candleCoreMat = new THREE.MeshStandardMaterial({
    color: '#fff0b3',
    emissive: '#ff9900',
    emissiveIntensity: 0.0,
    roughness: 0.3
  });
  const candleGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.04, 8);
  candleGeom.translate(px - 0.1, py + 0.05, pz + 0.15);
  const candleMesh = new THREE.Mesh(candleGeom, candleCoreMat);
  candleMesh.name = 'picnic-candle-glow';
  picnicGroup.add(candleMesh);

  return {
    group: picnicGroup,
    setWarmth(v) {
      candleCoreMat.emissiveIntensity = v * 2.0;
    },
    update(elapsed, warmth) {
      if (warmth > 0.05) {
        candleCoreMat.emissiveIntensity = warmth * (2.0 + Math.sin(elapsed * 4.5) * 0.12);
      }
    },
    dispose() {
      picnicGroup.removeFromParent();
      blanketGeom.dispose();
      blanketMat.dispose();
      blanketTex.dispose();
      guitarMesh.geometry.dispose();
      basketMesh.geometry.dispose();
      glassMesh.geometry.dispose();
      candleMesh.geometry.dispose();
      candleCoreMat.dispose();
    }
  };
}

/**
 * 🔥 4. 石砌暖光篝火堆 (Cozy Stone Fire Pit)
 * 原木树桩坐凳、发光炭火层、火星跳动与温暖火光点光源
 */
function makeCozyCampfire(parent, time) {
  const fireGroup = new THREE.Group();
  fireGroup.name = 'cozy-campfire-pit';
  fireGroup.userData.interaction = 'campfire';
  parent.add(fireGroup);

  const {x:cx,z:cz} = CAMPFIRE_SITE;
  const cy = ground(cx, cz);

  // A. 围炉鹅卵石圈 (12块平滑河石)
  const stoneGeoms = [];
  const stoneCount = 12;
  const radius = 0.62;
  for (let i = 0; i < stoneCount; i++) {
    const angle = (i / stoneCount) * Math.PI * 2;
    const sx = cx + Math.cos(angle) * radius;
    const sz = cz + Math.sin(angle) * radius;
    const sy = ground(sx, sz);

    const stone = new THREE.DodecahedronGeometry(0.12 + (Math.sin(i * 2.5) * 0.025), 1);
    stone.scale(1.1, 0.75, 1.05);
    stone.translate(sx, sy + 0.06, sz);
    stoneGeoms.push(stone);
  }
  const stoneMesh = new THREE.Mesh(safeMerge(stoneGeoms), material('rock', '#777a72'));
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  stoneMesh.name = 'campfire-stone-ring';
  fireGroup.add(stoneMesh);

  // B. 交错原木柴堆 (Crisscrossed Charred Firewood)
  const logGeoms = [];
  for (let j = 0; j < 6; j++) {
    const a = (j / 6) * Math.PI;
    const log = new THREE.CylinderGeometry(0.042, 0.048, 0.68, 6);
    log.rotateX(Math.PI / 2);
    log.rotateY(a + 0.15);
    log.translate(cx, cy + 0.08 + (j * 0.02), cz);
    logGeoms.push(log);
  }
  const logMesh = new THREE.Mesh(safeMerge(logGeoms), material('wood', '#382e25'));
  logMesh.castShadow = true;
  logMesh.name = 'campfire-charred-logs';
  fireGroup.add(logMesh);

  // C. 发光炭火堆 (Glowing Charcoal Core)
  const emberMat = new THREE.MeshStandardMaterial({
    color: '#ff3700',
    emissive: '#ff4800',
    emissiveIntensity: 0.0,
    roughness: 0.75
  });
  const emberGeom = new THREE.SphereGeometry(0.28, 12, 6);
  emberGeom.scale(1.2, 0.42, 1.2);
  emberGeom.translate(cx, cy + 0.06, cz);
  const emberMesh = new THREE.Mesh(emberGeom, emberMat);
  emberMesh.name = 'campfire-ember-core';
  fireGroup.add(emberMesh);

  // D. 篝火点光源 (Warm Firelight)
  const fireLight = new THREE.PointLight('#ff6a00', 0, 7.0, 1.5);
  fireLight.position.set(cx, cy + 0.45, cz);
  fireLight.name = 'campfire-glow-light';
  fireGroup.add(fireLight);

  // THREE.Fire's advected turbulence and hot-core colour ramp, evaluated on
  // three curved ribbons so the small hearth needs no texture or ray march.
  const flameParts=[];
  for(let i=0;i<3;i++){
    const ribbon=new THREE.PlaneGeometry(.72,1.18,4,14).translate(0,.59,0);
    const position=ribbon.attributes.position,uv=ribbon.attributes.uv;
    const phase=i*Math.PI/3,phases=new Float32Array(position.count).fill(phase);
    for(let j=0;j<position.count;j++){
      const h=uv.getY(j),x=position.getX(j);
      position.setXYZ(j,x*(1-.68*h),position.getY(j),.085*Math.sin(h*Math.PI)*(1-x*x/.13));
    }
    ribbon.rotateY(phase);ribbon.computeVertexNormals();
    ribbon.setAttribute('aFlamePhase',new THREE.BufferAttribute(phases,1));
    flameParts.push(ribbon);
  }
  const flameGeometry=mergeGeometries(flameParts);
  flameParts.forEach(g=>g.dispose());
  const flameUniforms={uFireClock:{value:0},uFireGain:{value:0},uFireWinter:{value:0}};
  const flameMaterial=new THREE.MeshStandardMaterial({color:'#ff6a00',emissive:'#ff6a00',
    emissiveIntensity:2.8,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,roughness:1});
  flameMaterial.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,flameUniforms);
    const uniforms='uniform float uFireClock,uFireGain,uFireWinter;\nvarying vec2 vFireUv;\nvarying float vFirePhase;\n';
    shader.vertexShader=uniforms+'attribute float aFlamePhase;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vFireUv=uv;vFirePhase=aFlamePhase;
      float h=uv.y,phase=aFlamePhase;
      float bend=(.065*sin(uFireClock*4.8-h*7.0+phase)+.035*sin(uFireClock*8.1-h*11.0))*h*h;
      transformed.x+=cos(phase)*bend+.034*h*h*uFireWinter;
      transformed.z+=sin(phase)*bend+.024*sin(uFireClock*2.0+h*5.0)*h*h;
      transformed.y*=1.0+(.075*sin(uFireClock*3.2+phase)+.035*sin(uFireClock*7.3+phase))*h;`);
    shader.fragmentShader=uniforms+shader.fragmentShader
      .replace('#include <color_fragment>',`#include <color_fragment>
        float h=vFireUv.y;
        float curl=.10*sin(h*17.0-uFireClock*5.0+vFirePhase)+.04*sin(h*31.0-uFireClock*8.7);
        float edge=abs(vFireUv.x*2.0-1.0+curl*h);
        float plume=(1.0-smoothstep(.68,1.0,edge))*smoothstep(0.0,.055,h)*(1.0-smoothstep(.79,1.0,h));
        float heat=clamp(h+.24*edge+.055*sin(h*12.0-uFireClock*5.0),0.0,1.0);
        vec3 fireColour=mix(vec3(1.0,.83,.30),vec3(1.0,.24,.012),smoothstep(.08,.56,heat));
        fireColour=mix(fireColour,vec3(.75,.025,.001),smoothstep(.55,1.0,heat));
        diffuseColor.rgb=vec3(0.0);diffuseColor.a*=plume*uFireGain;`)
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance=fireColour*2.8;');
  };
  flameMaterial.customProgramCacheKey=()=> 'winter-campfire-ribbons-v1';
  const flames=new THREE.Mesh(flameGeometry,flameMaterial);
  flames.name='campfire-flame-tongues';flames.position.set(cx,cy+.12,cz);flames.frustumCulled=false;
  fireGroup.add(flames);

  const sparkGeometry = new THREE.BufferGeometry();
  const sparkPositions = new Float32Array(96 * 3),sparkFades=new Float32Array(96);
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3).setUsage(THREE.DynamicDrawUsage));
  sparkGeometry.setAttribute('aSparkFade',new THREE.BufferAttribute(sparkFades,1).setUsage(THREE.DynamicDrawUsage));
  const sparkMaterial = new THREE.PointsMaterial({color:'#ffd58a',size:.035,transparent:true,
    opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
  sparkMaterial.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float aSparkFade;varying float vSparkFade;\n'+shader.vertexShader
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvSparkFade=aSparkFade;');
    shader.fragmentShader='varying float vSparkFade;\n'+shader.fragmentShader
      .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vSparkFade*(1.0-smoothstep(.15,.50,length(gl_PointCoord-.5)));');
  };
  sparkMaterial.customProgramCacheKey=()=> 'campfire-soft-embers-v1';
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.name = 'campfire-rising-sparks';sparks.frustumCulled=false;
  // The solid logs receive stoking gestures. The point-cloud hit radius
  // would otherwise intercept both porcelain mugs even when sparks are dark.
  sparks.raycast=()=>{};
  fireGroup.add(sparks);
  let stokeTime=-999,lastElapsed=0,sparkClock=0,clock=0,winter=0,warmthLevel=0,disposed=false;

  // E. 两个原木树桩坐凳 (Log Stools)
  const stoolGeoms = [];
  const stoolPositions = [
    COCOA_STUMP,
    {x:cx + 0.72,z:cz + 0.65,height:.38,radius:.18}
  ];
  for (const {x:stX,z:stZ,height,radius} of stoolPositions) {
    const stY = ground(stX, stZ);
    const stool = new THREE.CylinderGeometry(radius, radius+.03, height, 16);
    stool.translate(stX, stY + height/2, stZ);
    stoolGeoms.push(stool);
  }
  const stoolMesh = new THREE.Mesh(safeMerge(stoolGeoms), material('wood', '#8f7253'));
  stoolMesh.castShadow = true;
  stoolMesh.receiveShadow = true;
  stoolMesh.name = 'campfire-log-stools';
  fireGroup.add(stoolMesh);

  function applyGlow(flicker=0){
    const age=Math.max(0,clock-stokeTime);
    const boost=age<5?(1+Math.cos(Math.PI*age/5))*.5:0;
    const glow=Math.max(warmthLevel,boost*.65,winter);
    emberMat.emissiveIntensity=glow*(2.2+flicker)*(1+boost);
    fireLight.intensity=THREE.MathUtils.lerp(glow*(1.35+flicker*.8)*(1+boost),2.4,winter);
    fireLight.distance=THREE.MathUtils.lerp(7,9.5,winter);
    flameUniforms.uFireGain.value=glow*.92;
    flameUniforms.uFireWinter.value=winter;
    flames.visible=sparks.visible=glow>.01;
    flames.scale.set(.74+.26*winter,.48+.52*winter+.18*boost,.74+.26*winter);
    sparkMaterial.opacity=glow*(.55+boost*.35);
    sparkMaterial.size=.035+.014*winter;
    return boost;
  }
  applyGlow();
  return {
    group: fireGroup,
    stoke() { if(!disposed){stokeTime=clock;applyGlow();} },
    setWarmth(v) {
      if(disposed)return;
      warmthLevel=THREE.MathUtils.clamp(Number.isFinite(v)?v:0,0,1);applyGlow();
    },
    setWinter(value){
      if(disposed)return;
      winter=THREE.MathUtils.clamp(Number.isFinite(value)?value:0,0,1);applyGlow();
    },
    update(elapsed, warmth=warmthLevel, winterWeight=winter) {
      if(disposed||!Number.isFinite(elapsed))return;
      // Frozen elapsed values retain both flame phase and particle positions.
      const dt=Math.min(.1,Math.max(0,elapsed-lastElapsed));lastElapsed=elapsed;clock+=dt;
      warmthLevel=THREE.MathUtils.clamp(Number.isFinite(warmth)?warmth:0,0,1);
      winter=THREE.MathUtils.clamp(Number.isFinite(winterWeight)?winterWeight:0,0,1);
      const boost=applyGlow(Math.sin(clock*7.5)*.14+Math.cos(clock*12)*.08);
      flameUniforms.uFireClock.value=clock;
      sparkClock+=dt*(.32+boost*.35+.15*winter);
      for(let i=0;i<96;i++){
        const h=(i/96+sparkClock*(1+(i%5)*.06))%1;
        const a=i*2.399+clock*.7+h*3;
        const radius=(.04+h*.22)*(1+winter);
        sparkPositions[i*3]=cx+Math.cos(a)*radius+winter*.48*h*h;
        sparkPositions[i*3+1]=cy+.2+h*(1.6+1.6*winter);
        sparkPositions[i*3+2]=cz+Math.sin(a)*radius+winter*.13*h*Math.sin(clock*.6);
        sparkFades[i]=(i<48?1:winter)*THREE.MathUtils.smoothstep(h,0,.07)*(1-THREE.MathUtils.smoothstep(h,.65,1));
      }
      sparkGeometry.attributes.position.needsUpdate=true;
      sparkGeometry.attributes.aSparkFade.needsUpdate=true;
    },
    dispose() {
      if(disposed)return;disposed=true;
      fireGroup.removeFromParent();
      stoneMesh.geometry.dispose();
      stoneMesh.material.dispose();
      logMesh.geometry.dispose();
      logMesh.material.dispose();
      emberMesh.geometry.dispose();
      emberMat.dispose();
      sparkGeometry.dispose();sparkMaterial.dispose();
      stoolMesh.geometry.dispose();
      stoolMesh.material.dispose();
      flameGeometry.dispose();flameMaterial.dispose();fireLight.dispose();
    }
  };
}

/**
 * 🔭 5. 东侧悬崖黄铜望远镜与星空观景挑台 (Stargazing Deck & Brass Telescope)
 * 悬挑观景木平台、双绳护栏、三脚架复古黄铜天文望远镜，直指北天银河
 */
function makeStargazingDeckAndTelescope(parent, time) {
  const deckGroup = new THREE.Group();
  deckGroup.name = 'stargazing-deck-and-telescope';
  deckGroup.userData.interaction = 'telescope';
  parent.add(deckGroup);

  const dx = 18.2, dz = 2.0;
  const dy = ground(dx, dz);

  // A. 悬空星空木质挑台 (Cantilevered Deck)
  const deckWoodGeoms = [];
  const deckWidth = 2.8, deckDepth = 2.4, deckThick = 0.08;

  // 铺板
  const deckPlank = new RoundedBoxGeometry(deckWidth, deckThick, deckDepth, 2, 0.012);
  deckPlank.translate(dx, dy + 0.04, dz);
  deckWoodGeoms.push(deckPlank);

  // 悬崖支撑木桩
  for (const ox of [-1.1, 1.1]) {
    for (const oz of [-0.9, 0.9]) {
      const pile = new THREE.CylinderGeometry(0.065, 0.075, 1.4, 8);
      pile.translate(dx + ox, dy - 0.65, dz + oz);
      deckWoodGeoms.push(pile);
    }
  }

  // 观景木栏杆
  const railH = 0.88;
  for (const [rx, rz] of [
    [-1.3, -1.1], [0, -1.1], [1.3, -1.1],
    [1.3, 0], [1.3, 1.1], [0, 1.1], [-1.3, 1.1]
  ]) {
    const post = new THREE.CylinderGeometry(0.035, 0.038, railH, 6);
    post.translate(dx + rx, dy + railH * 0.5 + 0.04, dz + rz);
    deckWoodGeoms.push(post);
  }

  // 扶手顶轨
  const topRail = new THREE.BoxGeometry(0.07, 0.03, deckDepth);
  topRail.translate(dx + 1.3, dy + railH + 0.04, dz);
  deckWoodGeoms.push(topRail);

  const deckMesh = new THREE.Mesh(safeMerge(deckWoodGeoms), material('wood', '#a48464'));
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  deckMesh.name = 'stargazing-wooden-deck';
  deckGroup.add(deckMesh);

  // B. 黄铜复古天文望远镜 (Brass Astronomical Telescope)
  const brassGeoms = [];
  const tx = dx + 0.4, tz = dz - 0.1;
  const ty = dy + 0.08;

  // 三脚架 (Tripod)
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const leg = new THREE.CylinderGeometry(0.018, 0.024, 1.25, 6);
    leg.rotateZ(0.24);
    leg.rotateY(a);
    leg.translate(tx + Math.cos(a) * 0.32, ty + 0.58, tz + Math.sin(a) * 0.32);
    brassGeoms.push(leg);
  }

  // 云台与旋转中轴
  const mount = new THREE.CylinderGeometry(0.052, 0.065, 0.16, 10);
  mount.translate(tx, ty + 1.22, tz);
  brassGeoms.push(mount);

  // 望远镜主镜筒 (指向仰角 52 度对准北天极光与星轨)
  const barrel = new THREE.CylinderGeometry(0.052, 0.046, 1.32, 16);
  barrel.rotateX(Math.PI / 2 - 0.88); // 仰角约 50 度
  barrel.rotateY(-0.35); // 朝向东北高空
  barrel.translate(tx, ty + 1.36, tz);
  brassGeoms.push(barrel);

  // 寻星镜 (Finder Scope)
  const finder = new THREE.CylinderGeometry(0.016, 0.016, 0.45, 8);
  finder.rotateX(Math.PI / 2 - 0.88);
  finder.rotateY(-0.35);
  finder.translate(tx - 0.04, ty + 1.45, tz - 0.03);
  brassGeoms.push(finder);

  // 目镜调焦筒
  const eyepiece = new THREE.CylinderGeometry(0.025, 0.032, 0.14, 8);
  eyepiece.rotateX(Math.PI / 2 - 0.88);
  eyepiece.rotateY(-0.35);
  eyepiece.translate(tx + 0.22, ty + 1.08, tz + 0.35);
  brassGeoms.push(eyepiece);

  const brassMat = new THREE.MeshStandardMaterial({
    color: '#e5b357',
    metalness: 0.88,
    roughness: 0.26
  });
  const brassMesh = new THREE.Mesh(safeMerge(brassGeoms), brassMat);
  brassMesh.castShadow = true;
  brassMesh.receiveShadow = true;
  brassMesh.name = 'brass-stargazing-telescope';
  deckGroup.add(brassMesh);

  return {
    group: deckGroup,
    setWarmth(v) {
      // 望远镜高光随夜幕星辉微弱折射
    },
    dispose() {
      deckGroup.removeFromParent();
      deckMesh.geometry.dispose();
      brassMesh.geometry.dispose();
      brassMat.dispose();
    }
  };
}

/**
 * 🎪 6. 西侧崖畔双人木秋千 (Couples' Cliffside Swing)
 * 人字形原木支架、藤蔓繁花缠绕麻绳、双人原木秋千板，在山风中轻荡
 */
function makeCouplesSwing(parent, time) {
  const swingGroup = new THREE.Group();
  swingGroup.name = 'couples-cliffside-swing';
  swingGroup.userData.interaction = 'swing';
  parent.add(swingGroup);

  const sx = -15.5, sz = -2.0;
  const sy = ground(sx, sz);

  // A. 人字形原木支架 (A-Frame Timber Stand)
  const frameGeoms = [];
  const frameWidth = 2.2, frameH = 3.2;

  for (const side of [-1, 1]) {
    const fx = sx + side * (frameWidth * 0.5);
    for (const tilt of [-1, 1]) {
      const leg = new THREE.CylinderGeometry(0.065, 0.075, frameH, 8);
      leg.rotateZ(tilt * 0.18);
      leg.translate(fx + tilt * 0.28, sy + frameH * 0.48, sz);
      frameGeoms.push(leg);
    }
    // A 字横撑
    const brace = new THREE.CylinderGeometry(0.045, 0.045, 0.72, 6);
    brace.rotateZ(Math.PI / 2);
    brace.translate(fx, sy + 1.15, sz);
    frameGeoms.push(brace);
  }

  // 顶部主横梁
  const topBeam = new THREE.CylinderGeometry(0.075, 0.075, frameWidth + 0.65, 8);
  topBeam.rotateZ(Math.PI / 2);
  topBeam.translate(sx, sy + frameH - 0.08, sz);
  frameGeoms.push(topBeam);

  const frameMesh = new THREE.Mesh(safeMerge(frameGeoms), material('wood', '#806245'));
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;
  frameMesh.name = 'swing-a-frame-timber';
  swingGroup.add(frameMesh);

  // B. 动态微风摆动的秋千吊索与坐板 (Swing Seat Rig)
  const seatRig = new THREE.Group();
  seatRig.position.set(sx, sy + frameH - 0.12, sz);
  swingGroup.add(seatRig);

  const ropeGeoms = [];
  const ropeLen = 2.15;
  const seatW = 1.15, seatD = 0.32;

  // 双侧吊索
  for (const rx of [-seatW * 0.44, seatW * 0.44]) {
    const rope = new THREE.CylinderGeometry(0.012, 0.012, ropeLen, 6);
    rope.translate(rx, -ropeLen * 0.5, 0);
    ropeGeoms.push(rope);
  }

  // 双人原木坐板
  const seat = new RoundedBoxGeometry(seatW, 0.045, seatD, 2, 0.01);
  seat.translate(0, -ropeLen, 0);
  ropeGeoms.push(seat);

  const seatMesh = new THREE.Mesh(safeMerge(ropeGeoms), material('wood', '#bda07b'));
  seatMesh.castShadow = true;
  seatMesh.name = 'swing-seat-and-ropes';
  seatRig.add(seatMesh);

  let nudgeTime=-999,lastElapsed=0;

  return {
    group: swingGroup,
    nudge() { nudgeTime=lastElapsed; },
    update(elapsed) {
      lastElapsed=elapsed;
      const age=Math.max(0,elapsed-nudgeTime);
      const boost=age<12 ? .24*Math.exp(-age*.42) : 0;
      seatRig.rotation.x = Math.sin(elapsed * 1.45) * (.055+boost);
      seatRig.rotation.z = 0;
    },
    dispose() {
      swingGroup.removeFromParent();
      frameMesh.geometry.dispose();
      seatMesh.geometry.dispose();
    }
  };
}

/**
 * 🪵 7. 田园白桦原木矮栅栏与攀爬蔷薇 (Rustic Wooden Fences & Wild Roses)
 */
function makeRusticFences(parent, time) {
  const fenceGroup = new THREE.Group();
  fenceGroup.name = 'rustic-wooden-fences';
  parent.add(fenceGroup);

  const fenceNodes = [
    [-17.5, 2.0],
    [-15.8, 3.2],
    [-14.0, 4.5],
    [-12.2, 5.4],
    [-10.5, 6.0]
  ];

  const postGeoms = [];
  const railGeoms = [];
  const roseGeoms = [];

  for (let i = 0; i < fenceNodes.length; i++) {
    const [x, z] = fenceNodes[i];
    const y = ground(x, z);

    // 立桩
    const post = new THREE.CylinderGeometry(0.042, 0.048, 0.88, 8);
    post.translate(x, y + 0.44, z);
    postGeoms.push(post);

    // 横栏杆
    if (i < fenceNodes.length - 1) {
      const [nx, nz] = fenceNodes[i + 1];
      const ny = ground(nx, nz);

      const pA = new THREE.Vector3(x, y, z);
      const pB = new THREE.Vector3(nx, ny, nz);
      const segLen = pA.distanceTo(pB);
      const sDir = new THREE.Vector3().subVectors(pB, pA).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), sDir);

      for (const hOffset of [0.32, 0.65]) {
        const rail = new THREE.CylinderGeometry(0.024, 0.024, segLen, 6);
        rail.applyQuaternion(quat);
        const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
        rail.translate(mid.x, mid.y + hOffset, mid.z);
        railGeoms.push(rail);
      }

      // 攀爬粉白蔷薇花朵
      const flower = new THREE.SphereGeometry(0.038, 6, 4);
      flower.translate(x + (nx - x) * 0.45, y + 0.48, z + (nz - z) * 0.45);
      roseGeoms.push(flower);
    }
  }

  const postMesh = new THREE.Mesh(safeMerge(postGeoms), material('wood', '#856a4d'));
  postMesh.castShadow = true;
  postMesh.name = 'fence-posts';
  fenceGroup.add(postMesh);

  const railMesh = new THREE.Mesh(safeMerge(railGeoms), material('wood', '#685038'));
  railMesh.castShadow = true;
  railMesh.name = 'fence-rails';
  fenceGroup.add(railMesh);

  const roseMat = new THREE.MeshStandardMaterial({
    color: '#f472b6',
    roughness: 0.82
  });
  const roseMesh = new THREE.Mesh(safeMerge(roseGeoms), roseMat);
  roseMesh.name = 'fence-climbing-roses';
  fenceGroup.add(roseMesh);

  return {
    group: fenceGroup,
    dispose() {
      fenceGroup.removeFromParent();
      postMesh.geometry.dispose();
      railMesh.geometry.dispose();
      roseMesh.geometry.dispose();
      roseMat.dispose();
    }
  };
}

/**
 * 🌻 8. 西大陆盛开向日葵花田与紫晶薰衣草阶梯花甸 (Vivid Sunflowers & Lavender Terraces)
 * 
 * 升级版生动花海生态：
 * 1. 🌻 180+ 株生动双层向日葵：S型有机微弯主茎、宽阔心形垂叶、深褐与金色同心花盘、22+18双层交错金黄花瓣，面向晨光微仰；
 * 2. 🪻 380+ 株普罗旺斯紫晶薰衣草：基底针叶灌木丛簇生、多轮饱满花穗、深紫/罗兰/粉紫三色渐变；
 * 3. 🔔 40 簇阿凡达夜光风铃花 (Avatar Fairy Bells)：垂坠半透明钟形花冠，夜间双频呼吸律动；
 * 4. ✨ 90 颗夜光微粒孢子 (Floating Bioluminescent Spores)：入夜后随风盘旋漂浮于花海之上，宛如梦幻星辉绿洲！
 */
function makeBlossomMeadows(parent, time) {
  const meadowGroup = new THREE.Group();
  meadowGroup.name = 'blossom-meadows';
  parent.add(meadowGroup);

  const dummy = new THREE.Object3D();

  function colorize(geom, hex) {
    const g = geom.index ? geom.toNonIndexed() : geom;
    const c = new THREE.Color(hex);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }

  // --- A. 构筑大师级高精拟真向日葵 (Masterpiece Botanical Helianthus) ---
  // 1. 参数化微凹匙形立体花瓣 (Parametric Curved Scoop Petal)
  function createCurvedPetalGeometry(length = 0.22, baseWidth = 0.055, droop = 0.035, cupDepth = 0.015, colorBase = '#d97706', colorTip = '#fde047') {
    const segW = 3;
    const segL = 5;
    const geom = new THREE.PlaneGeometry(1, 1, segW, segL);
    const pos = geom.attributes.position;
    const count = pos.count;

    const colBase = new THREE.Color(colorBase);
    const colTip = new THREE.Color(colorTip);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const origX = pos.getX(i);
      const origY = pos.getY(i);

      const u = origY + 0.5; // 0 (基部) -> 1 (尖端)
      const v = origX * 2.0; // -1 (左缘) -> +1 (右缘)

      // 拟真花瓣阔披针廓线：基部渐宽，中前段最饱满，末端圆润收尖
      const widthProfile = Math.sin(u * Math.PI) ** 0.65 * (1.0 - 0.22 * u);
      const x = v * baseWidth * 0.5 * (0.32 + 0.68 * widthProfile);
      const y = u * length;
      // 匙形横向中凹 (Cup depth)
      const cupZ = -cupDepth * (1.0 - v * v) * Math.sin(u * Math.PI);
      // 尖端柔和重力垂卷 (Droop)
      const droopZ = -droop * Math.pow(u, 2.1);
      const z = cupZ + droopZ;

      pos.setXYZ(i, x, y, z);

      // 双向色温渐变：花基暖琥珀金 -> 瓣身灿烂金黄 -> 瓣尖耀眼朝阳柠檬金
      const c = colBase.clone().lerp(colTip, Math.pow(u, 0.85));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }

  // 2. 拟真阔心形重力下垂大叶 (Broad Cordate Drooping Leaf with Midrib)
  function createCordateLeafGeometry(length = 0.36, maxWidth = 0.20, droop = 0.11) {
    const segW = 3;
    const segL = 5;
    const geom = new THREE.PlaneGeometry(1, 1, segW, segL);
    const pos = geom.attributes.position;
    const count = pos.count;

    const colBase = new THREE.Color('#365314');
    const colMid = new THREE.Color('#4d7c0f');
    const colVein = new THREE.Color('#65a30d');
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const origX = pos.getX(i);
      const origY = pos.getY(i);

      const u = origY + 0.5; // 0 to 1
      const v = origX * 2.0; // -1 to 1

      // 阔心形叶身廓线
      const cordateProfile = Math.sin(u * Math.PI * 0.85 + 0.15) * Math.cos(u * 0.6);
      const x = v * maxWidth * 0.5 * Math.max(0.12, cordateProfile);
      const y = u * length;

      // 主叶脉下陷沟与叶缘侧弯
      const midribGutter = -0.015 * Math.abs(v) * Math.sin(u * Math.PI);
      // 重力自然下垂弧
      const droopZ = -droop * Math.pow(u, 2.0);
      const z = midribGutter + droopZ;

      pos.setXYZ(i, x, y, z);

      const isVein = Math.abs(v) < 0.25;
      const c = (isVein ? colVein : colBase).clone().lerp(colMid, u * 0.5);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }

  function buildVividSunflowerGeometry() {
    const parts = [];

    // ==========================================
    // 1. 构筑立体花头 (局部以花盘中心为原点，正向朝 +Z)
    // ==========================================
    const headParts = [];

    // A. 凸圆顶厚实花盘 (Convex Domed Seed Disc: 穹顶朝向 +Z)
    const discCenter = colorize(new THREE.SphereGeometry(0.135, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), '#1a0e07');
    discCenter.rotateX(Math.PI / 2);
    discCenter.scale(1, 1, 0.35);
    discCenter.translate(0, 0, 0.02);
    headParts.push(discCenter);

    // B. 盘缘管状花金粉环带 (Golden Pollen Corona: 位于 XY 平面)
    const discCorona = colorize(new THREE.TorusGeometry(0.118, 0.022, 8, 24), '#d97706');
    discCorona.translate(0, 0, 0.015);
    headParts.push(discCorona);

    // C. 盘缘密密匝匝的管状花初绽花蕾 (Floret Beads: 28 颗金黄色微粒)
    const floretCount = 28;
    for (let i = 0; i < floretCount; i++) {
      const a = (i / floretCount) * Math.PI * 2;
      const r = 0.095 + (i % 3) * 0.012;
      const bead = colorize(new THREE.SphereGeometry(0.009, 4, 3), (i % 2 === 0 ? '#f59e0b' : '#b45309'));
      bead.translate(Math.cos(a) * r, Math.sin(a) * r, 0.028);
      headParts.push(bead);
    }

    // D. 三层盛开立体匙形花瓣冠 (3-Tier Radiating Scoop Petals)
    // 1) 外层 24 瓣盛开长舌状花瓣 (Outer tier: 24 petals, 柔和向外舒展并向后微扬)
    const outerCount = 24;
    const outerR = 0.125;
    for (let i = 0; i < outerCount; i++) {
      const a = (i / outerCount) * Math.PI * 2;
      const p = createCurvedPetalGeometry(0.22, 0.054, -0.025, 0.014, '#d97706', '#fde047');
      p.rotateZ(a - Math.PI / 2);
      p.rotateX(-0.15); // 稍微向后微张
      p.translate(Math.cos(a) * outerR, Math.sin(a) * outerR, 0.005);
      headParts.push(p);
    }

    // 2) 中层 20 瓣交错盛放金黄花瓣 (Middle tier: 20 interlocking petals)
    const midCount = 20;
    const midR = 0.108;
    for (let i = 0; i < midCount; i++) {
      const a = ((i + 0.5) / midCount) * Math.PI * 2;
      const p = createCurvedPetalGeometry(0.18, 0.048, 0.018, 0.012, '#ea580c', '#fbbf24');
      p.rotateZ(a - Math.PI / 2);
      p.rotateX(0.12); // 稍向前环抱
      p.translate(Math.cos(a) * midR, Math.sin(a) * midR, 0.014);
      headParts.push(p);
    }

    // 3) 内层 16 瓣初绽向心幼瓣 (Inner tier: 16 young budding petals)
    const innerCount = 16;
    const innerR = 0.092;
    for (let i = 0; i < innerCount; i++) {
      const a = (i / innerCount) * Math.PI * 2 + 0.2;
      const p = createCurvedPetalGeometry(0.12, 0.038, 0.025, 0.010, '#f59e0b', '#fef08a');
      p.rotateZ(a - Math.PI / 2);
      p.rotateX(0.28); // 更加向前环抱，紧密烘托花盘
      p.translate(Math.cos(a) * innerR, Math.sin(a) * innerR, 0.022);
      headParts.push(p);
    }

    // E. 花盘背面 20 枚青翠总苞苞片 (Involucral Bracts: 负 Z 侧包裹花托)
    const bractCount = 20;
    for (let i = 0; i < bractCount; i++) {
      const a = (i / bractCount) * Math.PI * 2;
      const bract = colorize(new THREE.ConeGeometry(0.022, 0.08, 4), '#365314');
      bract.scale(1, 1, 0.35);
      bract.rotateZ(a - Math.PI / 2);
      bract.rotateX(-0.45);
      bract.translate(Math.cos(a) * 0.11, Math.sin(a) * 0.11, -0.02);
      headParts.push(bract);
    }

    // F. 绿色厚实花托底座 (Fleshy Receptacle Base)
    const receptacleBase = colorize(new THREE.CylinderGeometry(0.11, 0.035, 0.07, 16), '#3f6212');
    receptacleBase.rotateX(-Math.PI / 2);
    receptacleBase.translate(0, 0, -0.045);
    headParts.push(receptacleBase);

    // 组装并整体抬头仰视晨光 26°
    const mergedHead = safeMerge(headParts);
    mergedHead.rotateX(-0.45);
    mergedHead.translate(0, 1.28, 0.12);
    parts.push(mergedHead);

    // ==========================================
    // 2. 茎秆与天鹅颈微弯连接 (Stem & Arching Peduncle)
    // ==========================================
    const stemLower = colorize(new THREE.CylinderGeometry(0.024, 0.030, 0.95, 7), '#4d7c0f');
    stemLower.translate(0, 0.475, 0);
    parts.push(stemLower);

    const stemUpper = colorize(new THREE.CylinderGeometry(0.020, 0.024, 0.38, 7), '#5b8e14');
    stemUpper.rotateX(0.32);
    stemUpper.translate(0, 0.95 + 0.18, 0.06);
    parts.push(stemUpper);

    // ==========================================
    // 3. 阔心形下垂主叶与叶柄 (3 Cordate Leaves with Petioles)
    // ==========================================
    const leafConfigs = [
      { h: 0.38, rotY: 0.3, rotZ: 0.72, tilt: 0.35, scale: 1.05 },
      { h: 0.68, rotY: -2.2, rotZ: -0.75, tilt: 0.40, scale: 0.92 },
      { h: 0.92, rotY: 1.9, rotZ: 0.65, tilt: 0.30, scale: 0.75 }
    ];

    for (const cfg of leafConfigs) {
      const petiole = colorize(new THREE.CylinderGeometry(0.007, 0.009, 0.12, 5), '#4d7c0f');
      petiole.rotateZ(cfg.rotZ > 0 ? Math.PI / 3.2 : -Math.PI / 3.2);
      petiole.rotateY(cfg.rotY);
      petiole.translate(0, cfg.h, 0);
      parts.push(petiole);

      const leaf = createCordateLeafGeometry(0.36 * cfg.scale, 0.22 * cfg.scale, 0.11 * cfg.scale);
      leaf.rotateX(-Math.PI / 2);
      leaf.rotateX(cfg.tilt);
      leaf.rotateZ(cfg.rotZ > 0 ? -0.45 : 0.45);
      leaf.rotateY(cfg.rotY);
      const pOffsetX = Math.cos(cfg.rotY) * (cfg.rotZ > 0 ? 0.09 : -0.09);
      const pOffsetZ = Math.sin(cfg.rotY) * (cfg.rotZ > 0 ? 0.09 : -0.09);
      leaf.translate(pOffsetX, cfg.h + 0.04, pOffsetZ);
      parts.push(leaf);
    }

    return safeMerge(parts);
  }

  const sunflowerGeom = buildVividSunflowerGeometry();
  const sunflowerMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide
  });
  const sunflowerInst = new THREE.InstancedMesh(sunflowerGeom, sunflowerMat, 220);
  sunflowerInst.name = 'sunflower-fields';
  sunflowerInst.userData.gardenFoliage = true;
  sunflowerInst.castShadow = true;
  sunflowerInst.receiveShadow = true;
  meadowGroup.add(sunflowerInst);

  // 密集分布向日葵 (4 大自然蔓延群落，共 180+ 株)
  const sunflowerClusters = [
    [-18.5, -1.2, 2.6, 55],
    [-15.2, 2.8, 2.4, 50],
    [-13.5, -5.8, 2.2, 45],
    [-17.0, 4.5, 2.0, 40]
  ];
  let sfIdx = 0;
  for (const [cx, cz, spread, count] of sunflowerClusters) {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + (k * 0.77);
      const r = 0.2 + (Math.sin(k * 2.9) * 0.45 + 0.5) * spread;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (!inside(x, z, 0.94) || onCabinFloor(x, z)) continue;

      const y = ground(x, z);
      const scale = 0.78 + (Math.sin(k * 2.1) * 0.28 + 0.15);
      dummy.position.set(x, y, z);
      dummy.scale.set(scale, scale, scale);
      // 朝阳面微微转向东南 (sunrise) 带有自然手绘抖动
      dummy.rotation.set(
        Math.sin(k * 1.5) * 0.08,
        0.45 + (Math.sin(k * 3.3) * 0.35),
        Math.cos(k * 1.9) * 0.08
      );
      dummy.updateMatrix();
      sunflowerInst.setMatrixAt(sfIdx++, dummy.matrix);
    }
  }
  sunflowerInst.count = sfIdx;
  sunflowerInst.instanceMatrix.needsUpdate = true;

  // --- B. 构筑生动普罗旺斯紫晶薰衣草灌木丛 (Vivid Lavender Clumps) ---
  function buildVividLavenderClusterGeometry() {
    const parts = [];

    // 1. 基底雪松绿叶丛 (Base foliage mound)
    const base = colorize(new THREE.SphereGeometry(0.26, 8, 4), '#2d4a2d');
    base.scale(1, 0.42, 1);
    base.translate(0, 0.08, 0);
    parts.push(base);

    // 2. 5 支放射状自然散开的饱满花穗 (5 radiating spires in cluster)
    const spireConfigs = [
      [0, 0, 0, 0],
      [0.12, 0.14, 0.12, 0.3],
      [-0.12, 0.10, -0.11, -0.4],
      [0.09, -0.14, -0.12, 0.8],
      [-0.10, -0.11, 0.13, -0.7]
    ];

    for (const [ox, oz, rotX, rotZ] of spireConfigs) {
      const stem = colorize(new THREE.CylinderGeometry(0.006, 0.008, 0.52, 5), '#3d613d');
      stem.rotateX(rotX);
      stem.rotateZ(rotZ);
      stem.translate(ox, 0.26, oz);
      parts.push(stem);

      // 6 轮饱满轮生花穗 (6 floret whorls)
      for (let w = 0; w < 6; w++) {
        // 三阶渐变色：底层深紫 -> 中层罗兰 -> 顶端粉紫晨雾
        const col = w < 2 ? '#4c1d95' : (w < 4 ? '#7c3aed' : '#c084fc');
        const wh = colorize(new THREE.SphereGeometry(0.024 - w * 0.0018, 6, 4), col);
        wh.scale(1.35, 0.85, 1.35);
        wh.translate(ox, 0.38 + w * 0.038, oz);
        parts.push(wh);
      }
    }

    return mergeGeometries(parts);
  }

  const lavGeom = buildVividLavenderClusterGeometry();
  const lavMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.02
  });
  // 80 丛薰衣草丛 (每丛 5 支花穗，合计 400 支花穗！)
  const lavInst = new THREE.InstancedMesh(lavGeom, lavMat, 100);
  lavInst.name = 'lavender-terraces';
  lavInst.userData.gardenFoliage = true;
  lavInst.castShadow = true;
  lavInst.receiveShadow = true;
  meadowGroup.add(lavInst);

  const lavClusters = [
    [-16.8, 0.8, 2.2, 28],
    [-14.5, -4.5, 2.5, 26],
    [-11.5, 4.2, 2.0, 24],
    [-19.0, 3.2, 1.8, 22]
  ];
  let lvIdx = 0;
  for (const [cx, cz, spread, count] of lavClusters) {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + (k * 0.65);
      const r = 0.15 + (Math.sin(k * 3.1) * 0.45 + 0.5) * spread;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (!inside(x, z, 0.94) || onCabinFloor(x, z)) continue;

      const y = ground(x, z);
      const scale = 0.85 + (Math.sin(k * 2.7) * 0.28);
      dummy.position.set(x, y, z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = k * 1.1;
      dummy.updateMatrix();
      lavInst.setMatrixAt(lvIdx++, dummy.matrix);
    }
  }
  lavInst.count = lvIdx;
  lavInst.instanceMatrix.needsUpdate = true;

  // --- C. 构筑阿凡达梦幻风铃花 (Avatar Fairy Bell Flora) ---
  function buildFairyBellGeometry() {
    const parts = [];
    // 弯曲茎秆
    const stem = colorize(new THREE.CylinderGeometry(0.008, 0.012, 0.65, 6), '#0284c7');
    stem.rotateZ(0.24);
    stem.translate(-0.06, 0.32, 0);
    parts.push(stem);

    // 3 朵垂坠半透明风铃花 (Hanging bells)
    for (const [bx, by, bz, rotZ] of [
      [0.08, 0.55, 0.04, 0.6],
      [0.14, 0.44, -0.05, 0.9],
      [0.18, 0.32, 0.06, 1.2]
    ]) {
      const bell = colorize(new THREE.ConeGeometry(0.042, 0.065, 6, 1, true), '#38bdf8');
      bell.rotateZ(Math.PI - rotZ);
      bell.translate(bx, by, bz);
      parts.push(bell);

      // 发光花蕊
      const stamen = colorize(new THREE.SphereGeometry(0.016, 6, 4), '#a7f3d0');
      stamen.translate(bx, by - 0.035, bz);
      parts.push(stamen);
    }

    return mergeGeometries(parts);
  }

  const bellGeom = buildFairyBellGeometry();
  const bellMat = new THREE.MeshStandardMaterial({
    color: '#7dd3fc',
    emissive: '#0284c7',
    emissiveIntensity: 0.0,
    roughness: 0.25,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92
  });
  const bellInst = new THREE.InstancedMesh(bellGeom, bellMat, 45);
  bellInst.name = 'bioluminescent-star-flora';
  meadowGroup.add(bellInst);

  let bIdx = 0;
  for (let s = 0; s < 45; s++) {
    const x = -19.5 + (s % 7) * 1.5 + (Math.sin(s * 2.1) * 0.45);
    const z = -6.5 + Math.floor(s / 7) * 2.0 + (Math.cos(s * 1.9) * 0.45);
    if (!inside(x, z, 0.93) || onCabinFloor(x, z)) continue;

    const y = ground(x, z);
    const scale = 0.85 + (Math.sin(s * 3.3) * 0.25);
    dummy.position.set(x, y, z);
    dummy.scale.set(scale, scale, scale);
    dummy.rotation.y = s * 1.4;
    dummy.updateMatrix();
    bellInst.setMatrixAt(bIdx++, dummy.matrix);
  }
  bellInst.count = bIdx;
  bellInst.instanceMatrix.needsUpdate = true;

  // --- D. 构筑漫天漂浮的发光微粒/星芒孢子 (Floating Bioluminescent Spores) ---
  const sporeCount = 90;
  const sporeGeom = new THREE.BufferGeometry();
  const sporePositions = new Float32Array(sporeCount * 3);
  const sporeSpeeds = new Float32Array(sporeCount);
  const sporeBasePos = [];

  for (let p = 0; p < sporeCount; p++) {
    const x = -19.5 + Math.random() * 9.5;
    const z = -7.0 + Math.random() * 13.5;
    const y = inside(x, z, 0.93) ? ground(x, z) + 0.3 + Math.random() * 1.8 : 1.0;
    sporePositions[p * 3] = x;
    sporePositions[p * 3 + 1] = y;
    sporePositions[p * 3 + 2] = z;
    sporeSpeeds[p] = 0.2 + Math.random() * 0.35;
    sporeBasePos.push({ x, y, z, phase: Math.random() * Math.PI * 2 });
  }
  sporeGeom.setAttribute('position', new THREE.BufferAttribute(sporePositions, 3));

  const sporeMat = new THREE.PointsMaterial({
    color: '#38bdf8',
    size: 0.14,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sporePoints = new THREE.Points(sporeGeom, sporeMat);
  sporePoints.name = 'bioluminescent-floating-spores';
  sporePoints.visible = false;
  meadowGroup.add(sporePoints);

  return {
    group: meadowGroup,
    setWarmth(v) {
      // 昼夜联动：入夜后激活阿凡达发光花与浮游孢子 (0 -> 2.4)
      bellMat.emissiveIntensity = v * 2.4;
      sporeMat.opacity = v * 0.88;
      sporePoints.visible = sporeMat.opacity >= .002;
    },
    update(elapsed, warmth) {
      // 1. 全岛花海微风波浪摆动 (Harmonic Meadow Wind Sway)
      const windX = Math.sin(elapsed * 1.85) * 0.04;
      const windZ = Math.cos(elapsed * 1.45) * 0.03;
      sunflowerInst.position.set(windX, 0, windZ);
      lavInst.position.set(windX * 0.7, 0, windZ * 0.7);

      // 2. 阿凡达风铃花双频呼吸律动 (Dual-harmonic color breathing)
      if (warmth > 0.05) {
        const pulse = 1.0 + Math.sin(elapsed * 2.6) * 0.18 + Math.cos(elapsed * 4.2) * 0.08;
        bellMat.emissiveIntensity = warmth * 2.4 * pulse;

        // 3. 漫天夜光微粒对流漂浮 (Convective drifting spores)
        const posArr = sporeGeom.attributes.position.array;
        for (let p = 0; p < sporeCount; p++) {
          const bp = sporeBasePos[p];
          const speed = sporeSpeeds[p];
          // 垂直温和上升循环
          let curY = posArr[p * 3 + 1] + (speed * 0.016);
          if (curY > bp.y + 2.4) curY = bp.y;
          posArr[p * 3 + 1] = curY;

          // 水平布朗微旋
          posArr[p * 3] = bp.x + Math.sin(elapsed * 1.2 + bp.phase) * 0.15;
          posArr[p * 3 + 2] = bp.z + Math.cos(elapsed * 0.9 + bp.phase) * 0.15;
        }
        sporeGeom.attributes.position.needsUpdate = true;
      }
    },
    dispose() {
      meadowGroup.removeFromParent();
      sunflowerInst.geometry.dispose();
      sunflowerMat.dispose();
      lavInst.geometry.dispose();
      lavMat.dispose();
      bellInst.geometry.dispose();
      bellMat.dispose();
      sporeGeom.dispose();
      sporeMat.dispose();
    }
  };
}
