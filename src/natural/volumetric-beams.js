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
  uniform float uTime,uOpacity,uScatter;
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
    p+=.095*vec2(sin(.47*uTime+p.y),cos(.39*uTime+p.x));
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
  const uniforms={uTime:time,uOpacity:{value:.22},uScatter:{value:1},uColor:{value:new THREE.Color('#ffeac1')}};
  function layer(name,parts,fragment,volume=false){
    const axes='varying vec4 shaftTop; varying vec3 shaftFoot;\n';
    const vertex=volume ? axes+'attribute vec4 opening;attribute vec3 landing;\n'+
      vertexShader.replace('vUv=uv;', 'shaftTop=opening;shaftFoot=landing;vUv=uv;') : vertexShader;
    const material=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,transparent:true,depthWrite:false,
      side:volume?THREE.FrontSide:THREE.DoubleSide,forceSinglePass:true,blending:THREE.AdditiveBlending,
      fragmentShader:(volume?axes:'')+leafMask+'\nvoid main(){\n'+fragment+'\n}'});
    const mesh=new THREE.Mesh(mergeGeometries(parts),material);
    mesh.name=name;group.add(mesh);parts.forEach(g=>g.dispose());
  }
  const veils=[],patches=[],seeds=[];
  for(const [source,[x,z],radius] of openings){
    const top=new THREE.Vector3(...source),foot=new THREE.Vector3(x,ground(x,z),z);
    const axis=top.clone().sub(foot);
    const veil=new THREE.CylinderGeometry(radius*.32,radius*1.24,axis.length(),20,1);
    veil.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize()));
    const mid=top.clone().lerp(foot,.5);veil.translate(mid.x,mid.y,mid.z);
    const count=veil.attributes.position.count,opening=[],landing=[];
    for(let i=0;i<count;i++){opening.push(top.x,top.y,top.z,radius);landing.push(x,foot.y,z);}
    veil.setAttribute('opening',new THREE.Float32BufferAttribute(opening,4));
    veil.setAttribute('landing',new THREE.Float32BufferAttribute(landing,3));
    veils.push(veil);
    const patch=new THREE.PlaneGeometry(2*radius,1.6*radius,12,12);
    patch.rotateX(-Math.PI/2);patch.translate(x,0,z);
    const p=patch.attributes.position;
    for(let i=0;i<p.count;i++)p.setY(i,ground(p.getX(i),p.getZ(i))+.035);
    patches.push(patch);
    for(let i=0;i<8;i++){
      const angle=i*2.4,r=radius*Math.sqrt((i+.5)/8)*.8;
      const mote=foot.clone().lerp(top,.025+.63*((i*5)%8)/8);
      seeds.push(mote.x+r*Math.cos(angle),mote.y+.12,mote.z+r*Math.sin(angle));
    }
  }
  layer('canopy-light-veils',veils,`
    vec3 axis=normalize(shaftFoot-shaftTop.xyz), eye=normalize(vWorld-cameraPosition);
    vec3 p=vWorld-shaftTop.xyz;
    float along=dot(p,axis)/length(shaftFoot-shaftTop.xyz);
    float radius=shaftTop.w*mix(.32,1.24,clamp(along,0.,1.));
    vec3 radial=p-axis*dot(p,axis), across=eye-axis*dot(eye,axis);
    // Integrate a soft cross section along the sightline through the cone.
    float travel=-dot(radial,across)/max(dot(across,across),.04);
    vec3 center=radial+across*max(0.,travel);
    float chord=max(0.,1.-dot(center,center)/(radius*radius));
    float ends=smoothstep(0.,.14,along)*(1.-smoothstep(.89,1.,along));
    float shafts=.36+.64*leaves(center.xz/radius*1.15+shaftTop.xz);
    gl_FragColor=vec4(uColor,uOpacity*uScatter*.75*chord*ends*shafts);
  `,true);
  layer('komorebi-ground',patches,`
    float edge=1.-smoothstep(.32,1.,length(2.*vUv-1.));
    gl_FragColor=vec4(uColor,uOpacity*uScatter*edge*leaves(vWorld.xz)*1.35);
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
      uniform float uOpacity,uScatter;uniform vec3 uColor;varying float pulse;
      void main(){
        float fade=1.-smoothstep(0.,1.,length(gl_PointCoord*2.-1.));
        gl_FragColor=vec4(uColor*vec3(1.,.89,.63),uOpacity*uScatter*3.*pulse*fade);
      }`
  }));
  motes.name='drifting-gold-motes';group.add(motes);
  return {group,uniforms};
}
