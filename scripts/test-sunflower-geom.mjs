import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function colorize(geom, hex) {
  const c = new THREE.Color(hex);
  const count = geom.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geom;
}

function safeMerge(geoms) {
  if (!geoms || geoms.length === 0) return null;
  const uniform = geoms.map(g => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(uniform);
  geoms.forEach(g => g.dispose());
  return merged;
}

// 1. 在本地坐标系中生成一枚优雅的匙形花瓣 (Local Petal: 基部在原点，沿 +Y 向上伸展，在 XY 平面，微凸/微凹沿 Z)
function createScoopPetalGeometry(length = 0.22, maxWidth = 0.055, droopZ = 0.035, cupDepth = 0.015, colorBase = '#d97706', colorTip = '#fde047') {
  const segW = 3;
  const segL = 5;
  const geom = new THREE.PlaneGeometry(1, 1, segW, segL);
  const pos = geom.attributes.position;
  const count = pos.count;

  const colBase = new THREE.Color(colorBase);
  const colTip = new THREE.Color(colorTip);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const origX = pos.getX(i); // -0.5 to 0.5
    const origY = pos.getY(i); // -0.5 to 0.5

    const u = origY + 0.5; // 0 (基部) -> 1 (尖端)
    const v = origX * 2.0; // -1 (左缘) -> +1 (右缘)

    // 优美柳叶/匙形廓线：基部较窄，中前段(u=0.55)最丰满，末端圆润微尖
    const widthProfile = Math.sin(u * Math.PI) ** 0.65 * (1.0 - 0.2 * u);
    const x = v * maxWidth * 0.5 * (0.35 + 0.65 * widthProfile);
    const y = u * length;

    // 匙形横向中凹 (沿着花瓣中脉内凹，形成立体微槽)
    const cup = -cupDepth * (1.0 - v * v) * Math.sin(u * Math.PI);
    // 花瓣尖端向前柔和起伏/轻微微垂
    const droop = droopZ * Math.pow(u, 2.2);
    const z = cup + droop;

    pos.setXYZ(i, x, y, z);

    // 颜色渐变：花基暖琥珀 -> 花身盛夏纯金 -> 瓣尖朝阳柠檬黄
    const c = colBase.clone().lerp(colTip, Math.pow(u, 0.8));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

// 2. 拟真阔心形下垂大叶 (带中脉与重力下垂弧)
function createCordateLeafGeometry(length = 0.38, maxWidth = 0.22, droop = 0.12) {
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

    const cordateProfile = Math.sin(u * Math.PI * 0.85 + 0.15) * Math.cos(u * 0.6);
    const x = v * maxWidth * 0.5 * Math.max(0.12, cordateProfile);
    const y = u * length;

    const midribGutter = -0.018 * Math.abs(v) * Math.sin(u * Math.PI);
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

export function buildMasterpieceSunflowerGeometry() {
  const parts = [];

  // ==========================================
  // 1. 建造花头 (Flower Head Group, 局部坐标系以花盘中心为原点，法线向 +Z)
  // ==========================================
  const headParts = [];

  // A. 凸圆顶厚实花盘 (Convex Domed Seed Disc)
  // 盘心深浓墨褐咖啡色穹顶 (正面朝向 +Z)
  const discCenter = colorize(new THREE.SphereGeometry(0.135, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), '#1a0e07');
  discCenter.rotateX(Math.PI / 2); // 极点转向 +Z
  discCenter.scale(1, 1, 0.35);   // 压扁成凸镜穹顶
  discCenter.translate(0, 0, 0.02);
  headParts.push(discCenter);

  // B. 盘缘管状花毛绒金粉环带 (Golden Pollen Corona: 位于 XY 平面，围绕花盘边缘)
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

  // D. 三层盛开立体花瓣冠 (3-Tier Radiating Scoop Petals)
  // 1) 外层 24 瓣盛开长舌状花瓣 (Outer tier: 24 petals, 柔和向外舒展并向后微扬)
  const outerCount = 24;
  const outerR = 0.125;
  for (let i = 0; i < outerCount; i++) {
    const a = (i / outerCount) * Math.PI * 2;
    const p = createScoopPetalGeometry(0.22, 0.054, -0.025, 0.014, '#d97706', '#fde047');
    // 旋转让花瓣底端在原点，沿径向向外放射
    p.rotateZ(a - Math.PI / 2);
    // 稍微向后微张 10°
    p.rotateX(-0.15);
    p.translate(Math.cos(a) * outerR, Math.sin(a) * outerR, 0.005);
    headParts.push(p);
  }

  // 2) 中层 20 瓣交错盛放金黄花瓣 (Middle tier: 20 interlocking petals)
  const midCount = 20;
  const midR = 0.108;
  for (let i = 0; i < midCount; i++) {
    const a = ((i + 0.5) / midCount) * Math.PI * 2;
    const p = createScoopPetalGeometry(0.18, 0.048, 0.018, 0.012, '#ea580c', '#fbbf24');
    p.rotateZ(a - Math.PI / 2);
    // 稍向前环抱 8°
    p.rotateX(0.12);
    p.translate(Math.cos(a) * midR, Math.sin(a) * midR, 0.014);
    headParts.push(p);
  }

  // 3) 内层 16 瓣初绽向心幼瓣 (Inner tier: 16 young budding petals)
  const innerCount = 16;
  const innerR = 0.092;
  for (let i = 0; i < innerCount; i++) {
    const a = (i / innerCount) * Math.PI * 2 + 0.2;
    const p = createScoopPetalGeometry(0.12, 0.038, 0.025, 0.010, '#f59e0b', '#fef08a');
    p.rotateZ(a - Math.PI / 2);
    // 更加向前环抱 18°，紧密烘托花盘
    p.rotateX(0.28);
    p.translate(Math.cos(a) * innerR, Math.sin(a) * innerR, 0.022);
    headParts.push(p);
  }

  // E. 花盘背面 20 枚青翠总苞苞片 (Involucral Bracts: 位于负 Z 侧包裹花托)
  const bractCount = 20;
  for (let i = 0; i < bractCount; i++) {
    const a = (i / bractCount) * Math.PI * 2;
    const bract = colorize(new THREE.ConeGeometry(0.022, 0.08, 4), '#365314');
    bract.scale(1, 1, 0.35);
    bract.rotateZ(a - Math.PI / 2);
    bract.rotateX(-0.45); // 向后倒伏贴合花托
    bract.translate(Math.cos(a) * 0.11, Math.sin(a) * 0.11, -0.02);
    headParts.push(bract);
  }

  // F. 绿色厚实花托底座 (Fleshy Receptacle Base: 位于负 Z 侧)
  const receptacleBase = colorize(new THREE.CylinderGeometry(0.11, 0.035, 0.07, 16), '#3f6212');
  receptacleBase.rotateX(-Math.PI / 2);
  receptacleBase.translate(0, 0, -0.045);
  headParts.push(receptacleBase);

  // 合并花头，并整体调整朝向：
  // 真实向日葵正面向前(观众)，并向上仰视晨光约 25° (仰角 elevation ~ 25°)
  const mergedHead = safeMerge(headParts);
  mergedHead.rotateX(-0.45); // 抬头仰视 26°
  mergedHead.translate(0, 1.28, 0.12);
  parts.push(mergedHead);

  // ==========================================
  // 2. 茎秆与天鹅颈微弯连接 (Stem & Arching Peduncle)
  // ==========================================
  // 下半段主茎 (直立微粗)
  const stemLower = colorize(new THREE.CylinderGeometry(0.024, 0.030, 0.95, 7), '#4d7c0f');
  stemLower.translate(0, 0.475, 0);
  parts.push(stemLower);

  // 上半段向阳倾斜颈部 (Arching neck: 从 0.95 向上微前倾连接花托)
  const stemUpper = colorize(new THREE.CylinderGeometry(0.020, 0.024, 0.38, 7), '#5b8e14');
  stemUpper.rotateX(0.32); // 向前倾斜 18°
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
    // 叶柄
    const petiole = colorize(new THREE.CylinderGeometry(0.007, 0.009, 0.12, 5), '#4d7c0f');
    petiole.rotateZ(cfg.rotZ > 0 ? Math.PI / 3.2 : -Math.PI / 3.2);
    petiole.rotateY(cfg.rotY);
    petiole.translate(0, cfg.h, 0);
    parts.push(petiole);

    // 阔心形叶身
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

  const finalGeom = safeMerge(parts);
  console.log('Masterpiece sunflower created! Total vertices:', finalGeom.attributes.position.count);
  return finalGeom;
}

buildMasterpieceSunflowerGeometry();
