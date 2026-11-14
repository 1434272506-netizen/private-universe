import * as THREE from 'three';

console.log('Testing astrolabe milestone geometry...');

function makeAstrolabeGeometry() {
  const parts = [];

  // A. 汉白玉叠级原石基座
  const base1 = new THREE.CylinderGeometry(0.38, 0.42, 0.10, 24);
  base1.translate(0, 0.05, 0);
  parts.push({ geom: base1, mat: 'stone' });

  const base2 = new THREE.CylinderGeometry(0.28, 0.32, 0.08, 24);
  base2.translate(0, 0.14, 0);
  parts.push({ geom: base2, mat: 'stone' });

  // B. 黄铜中轴与托座
  const col = new THREE.CylinderGeometry(0.022, 0.034, 0.28, 12);
  col.translate(0, 0.32, 0);
  parts.push({ geom: col, mat: 'brass' });

  const cup = new THREE.CylinderGeometry(0.065, 0.02, 0.05, 16);
  cup.translate(0, 0.46, 0);
  parts.push({ geom: cup, mat: 'brass' });

  // C. 浑天黄铜双环
  const ring1 = new THREE.TorusGeometry(0.22, 0.014, 8, 32);
  ring1.rotateX(0.55);
  ring1.translate(0, 0.62, 0);
  parts.push({ geom: ring1, mat: 'brass' });

  const ring2 = new THREE.TorusGeometry(0.19, 0.012, 8, 32);
  ring2.rotateY(0.75);
  ring2.rotateZ(0.35);
  ring2.translate(0, 0.62, 0);
  parts.push({ geom: ring2, mat: 'brass' });

  // D. 黄铜星轨指针
  const needle = new THREE.CylinderGeometry(0.007, 0.007, 0.52, 8);
  needle.rotateZ(0.65);
  needle.translate(0, 0.62, 0);
  parts.push({ geom: needle, mat: 'brass' });

  // E. 核心水晶星核
  const core = new THREE.SphereGeometry(0.068, 18, 14);
  core.translate(0, 0.62, 0);
  parts.push({ geom: core, mat: 'crystal' });

  console.log('Astrolabe parts count:', parts.length);
  return parts;
}

makeAstrolabeGeometry();
console.log('Astrolabe geometry test passed!');
