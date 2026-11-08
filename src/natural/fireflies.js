import * as THREE from 'three';
import {ground} from './land.js';

// One draw call per population. A static seed drives independent motion and light.
export function glowPoints(name, positions, time, motion, tint, size) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('seed', new THREE.Float32BufferAttribute(
    Array.from({length: positions.length / 3}, (_, i) => (i * .618034) % 1), 1));
  const material = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{clock:time, opacity:{value:0}},
    vertexShader:`uniform float clock; attribute float seed; varying float pulse;
      void main(){vec3 p=position; float phase=seed*63.; ${motion}
      pulse=.62+.38*sin(clock*(.4+.3*seed)*6.283+phase);
      vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp((${size})*(.8+.4*seed),1.6,22.);}`,
    fragmentShader:`uniform float opacity; varying float pulse; void main(){
      float d=length(gl_PointCoord-.5)*2.; float glow=pow(max(0.,1.-d),2.);
      gl_FragColor=vec4(${tint},glow*pulse*opacity);}`
  });
  const points=new THREE.Points(geometry,material);
  points.name=name; points.visible=false;
  return points;
}
export function fireflies(time) {
  const positions=[];
  for(let i=0;i<72;i++){
    const x=10*Math.random()-5,z=6*Math.random()-3;
    positions.push(x,ground(x,z)+.4+1.8*Math.random(),z);
  }
  return glowPoints('meadow-fireflies',positions,time,
    'p+=.19*vec3(sin(clock*.8+phase),cos(clock*.64+phase),sin(clock*.53-phase));',
    'mix(vec3(.64,1.,.33),vec3(.85,1.,.45),pulse)','65./-mv.z');
}
