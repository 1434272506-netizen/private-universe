import * as THREE from 'three';
import {ground} from './land.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Each pair joins an opening inside the crown to a patch of grass.
const openings = [
  [[-7.6,11.3,-2.7],[-1.8,4.3],1.1],
  [[-11.5,12.8,-4.9],[-7.7,3.3],1.35],
  [[-9.3,12,-5.9],[-3.2,.4],.95]
];
const leafMask = `
  uniform float uTime,uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vWorld;
  float hash(vec2 p){
    vec3 q=fract(p.xyx*.1031);
    q+=dot(q,q.yzx+33.33);
    return fract((q.x+q.y)*q.z);
  }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
  }
  float leaves(vec2 p){
    p+=.075*vec2(sin(3.7699*uTime+p.y),cos(3.7699*uTime+p.x));
    return smoothstep(.31,.72,.65*noise(p*3.8)+.35*noise(p*8.7));
  }
`;
const vertexShader = `
  varying vec2 vUv;varying vec3 vWorld;
  void main(){
    vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;
    gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
  }
`;
export function makeVolumetricBeams(time){
  const group=new THREE.Group();group.name='volumetric-godrays';
  const uniforms={uTime:time,uOpacity:{value:.22},uColor:{value:new THREE.Color('#ffeac1')}};
  function layer(name,parts,fragment){
    const material=new THREE.ShaderMaterial({uniforms,vertexShader,transparent:true,depthWrite:false,
      side:THREE.DoubleSide,forceSinglePass:true,blending:THREE.AdditiveBlending,
      fragmentShader:leafMask+'\nvoid main(){\n'+fragment+'\n}'});
    const mesh=new THREE.Mesh(mergeGeometries(parts),material);
    mesh.name=name;group.add(mesh);parts.forEach(g=>g.dispose());
  }
  const veils=[],patches=[],seeds=[];
  for(const [source,[x,z],radius] of openings){
    const top=new THREE.Vector3(...source),foot=new THREE.Vector3(x,ground(x,z),z);
    const width=new THREE.Vector3(z-top.z,0,top.x-x).normalize();
    const veil=new THREE.PlaneGeometry(1,1),v=veil.attributes.position;
    for(let i=0;i<v.count;i++){
      const base=v.getY(i)>0?top:foot;
      const point=base.clone().addScaledVector(width,v.getX(i)*radius*(base===top?.65:2.4));
      v.setXYZ(i,point.x,point.y,point.z);
    }
    veils.push(veil);
    const patch=new THREE.PlaneGeometry(2*radius,1.6*radius,12,12);
    patch.rotateX(-Math.PI/2);patch.translate(x,0,z);
    const p=patch.attributes.position;
    for(let i=0;i<p.count;i++)p.setY(i,ground(p.getX(i),p.getZ(i))+.035);
    patches.push(patch);
    for(let i=0;i<8;i++){
      const angle=i*2.4,r=radius*Math.sqrt((i+.5)/8)*.8;
      const px=x+r*Math.cos(angle),pz=z+r*Math.sin(angle);
      seeds.push(px,ground(px,pz)+.15+(i%5)*.16,pz);
    }
  }
  layer('canopy-light-veils',veils,`
    float crossFade=pow(max(0.,sin(3.14159*vUv.x)),2.);
    float ends=smoothstep(0.,.25,vUv.y)*(1.-smoothstep(.68,1.,vUv.y));
    float mask=leaves(vec2(vUv.x*2.+vWorld.z*.15,vUv.y*.45));
    gl_FragColor=vec4(uColor,uOpacity*.38*ends*crossFade*mask);
  `);
  layer('komorebi-ground',patches,`
    float edge=1.-smoothstep(.32,1.,length(2.*vUv-1.));
    gl_FragColor=vec4(uColor,uOpacity*edge*leaves(vWorld.xz)*1.4);
  `);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(seeds,3));
  const motes=new THREE.Points(geometry,new THREE.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`
      uniform float uTime;varying float pulse;
      void main(){
        float phase=dot(position,vec3(2.,5.,7.));
        vec3 offset=vec3(sin(.19*uTime+phase),sin(.23*uTime+phase),cos(.15*uTime+phase))*.09;
        vec4 mv=modelViewMatrix*vec4(position+offset,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(42./max(1.,-mv.z),1.6,4.);
        pulse=.5+.45*sin(.64*uTime+phase);
      }`,
    fragmentShader:`
      uniform float uOpacity;uniform vec3 uColor;varying float pulse;
      void main(){
        float fade=1.-smoothstep(0.,1.,length(gl_PointCoord*2.-1.));
        gl_FragColor=vec4(uColor*vec3(1.,.84,.48),uOpacity*3.*pulse*fade);
      }`
  }));
  motes.name='drifting-gold-motes';group.add(motes);
  return {group,uniforms};
}
