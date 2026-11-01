import * as THREE from 'three';
import {creekX,waterY,WATER_END} from './land.js';

// An art-directed, local spray bow, rather than a screen-fixed sky decoration.
export function makeMistRainbow(scene,time,sunDirection){
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    side:THREE.DoubleSide,uniforms:{uTime:time,uSun:{value:sunDirection}},
    vertexShader:`varying vec2 vUv;varying vec3 vWorld;
      void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`uniform float uTime;uniform vec3 uSun;varying vec2 vUv;varying vec3 vWorld;
      void main(){vec2 p=(vUv-.5)*2.0;p.y+=.35;
        float radius=length(p);float band=exp(-pow((radius-.79)/.065,2.0));
        float arc=smoothstep(.04,.30,p.y)*(1.0-smoothstep(.75,1.0,p.y));
        float t=clamp((radius-.71)/.16,0.0,1.0);
        vec3 color=.55+.45*cos(6.28318*(vec3(.68,.35,.07)+t*.72));
        vec3 viewDir=normalize(cameraPosition-vWorld);
        float angle=dot(viewDir,uSun);
        float visibility=.30+.70*pow(max(0.0,1.0-abs(angle-.7)),3.0);
        float breath=.94+.06*sin(uTime*.35);
        float alpha=band*arc*visibility*breath*.22;
        gl_FragColor=vec4(color*.8+.2,alpha);
      }`});
  const rainbow=new THREE.Mesh(new THREE.PlaneGeometry(3.8,3.0),material);
  rainbow.name='waterfall-spray-rainbow';rainbow.userData.gardenAtmosphere=true;
  rainbow.position.set(creekX(WATER_END)+.65,waterY(WATER_END)-2.6,WATER_END+.65);
  rainbow.rotation.y=-.25;scene.add(rainbow);return rainbow;
}
