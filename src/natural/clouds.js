import * as THREE from 'three';
import {rng} from './shared.js';

// Bounded volume integration: the reference study is leoawen/volumetric-clouds
// (MIT). This smaller implementation keeps all volumes outside the main island
// and uses the existing opaque depth buffer instead of another scene pass.
export function makeCloudVolumes(scene,time,sunDirection){
  const size=32,data=new Uint8Array(size**3),random=rng(12071);
  for(let i=0;i<data.length;i++)data[i]=random()*255;
  const texture=new THREE.Data3DTexture(data,size,size,size);
  Object.assign(texture,{format:THREE.RedFormat,type:THREE.UnsignedByteType,
    minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
    wrapS:THREE.RepeatWrapping,wrapT:THREE.RepeatWrapping,wrapR:THREE.RepeatWrapping,
    unpackAlignment:1,needsUpdate:true});
  const group=new THREE.Group();group.name='distant-clouds';
  const geometry=new THREE.BoxGeometry(2,2,2),drifters=[];
  const vertexShader=`varying vec3 vOrigin,vRay;
    void main(){vOrigin=(inverse(modelMatrix)*vec4(cameraPosition,1.0)).xyz;
      vRay=position-vOrigin;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
  const fragmentShader=`precision highp sampler3D;
    uniform sampler3D uNoise;uniform float uTime,uSeed;
    uniform float dusk,night; uniform vec3 uSun;varying vec3 vOrigin,vRay;
    float density(vec3 p){
      float shape=max(1.0-length((p-vec3(-.40,-.14,.02))/vec3(.61,.46,.67)),
        1.0-length((p-vec3(.25,-.18,-.10))/vec3(.65,.40,.70)));
      shape=max(shape,1.0-length((p-vec3(.05,.14,.05))/vec3(.44,.61,.54)));
      vec3 uv=p*.22+vec3(uSeed+uTime*.0008,0.0,uSeed*.31);
      float n=texture(uNoise,uv).r*.65+texture(uNoise,uv*2.07).r*.25+texture(uNoise,uv*4.13).r*.10;
      return smoothstep(.015,.23,shape+(n-.5)*.55)*1.35;
    }
    void main(){
      vec3 ray=normalize(vRay);
      // Nonzero signed components avoid division by zero at axis-aligned views.
      vec3 safeRay=mix(vec3(-.00001),vec3(.00001),step(vec3(0.0),ray));
      safeRay=mix(ray,safeRay,lessThan(abs(ray),vec3(.00001)));
      vec3 a=(-vec3(1.0)-vOrigin)/safeRay,b=(vec3(1.0)-vOrigin)/safeRay;
      vec3 lo=min(a,b),hi=max(a,b);
      float start=max(max(lo.x,max(lo.y,lo.z)),0.0),end=min(hi.x,min(hi.y,hi.z));
      if(end<=start)discard;
      float stepSize=(end-start)/40.0,transmit=1.0;vec3 sum=vec3(0.0);
      float forward=pow(max(dot(ray,uSun),0.0),6.0);
      for(int i=0;i<40;i++){
        vec3 p=vOrigin+ray*(start+(float(i)+.5)*stepSize);
        float d=density(p);
        if(d>.01){
          float optical=0.0;
          for(int j=1;j<=4;j++)optical+=density(p+uSun*float(j)*.14)*.14;
          float sunlight=exp(-optical*5.4);
          // 将原有的扁平 vec3(1., .45, .25) 升级为带向阳金辉与背阳暮紫的层次光
          vec3 duskSunlight = mix(vec3(0.38, 0.22, 0.30), vec3(1.15, 0.72, 0.30), clamp(sunlight * 1.5 + forward * 0.5, 0.0, 1.0));
          vec3 light = mix(mix(vec3(.24,.32,.43), vec3(.20,.12,.16), dusk), vec3(.008,.014,.028), night) + 
                       mix(mix(vec3(1.0,.88,.69), duskSunlight, dusk), vec3(.18,.25,.38), night) * sunlight * (.92 + forward * .32);
          float alpha=1.0-exp(-d*stepSize*5.2);
          sum+=transmit*alpha*light;transmit*=1.0-alpha;
          if(transmit<.025)break;
        }
      }
      float alpha=1.0-transmit;if(alpha<.005)discard;
      gl_FragColor=vec4(sum/alpha,alpha);
    }`;
  const banks=[[-28,-10,-32,19,8,12],[27,-13,-42,23,9,14],[-5,-25,-66,32,9,17],
    [-35,-15,12,18,8,13],[34,-18,16,22,8,13],[0,-29,51,29,9,16],
    [-15,-17,-15,12,5,9],[16,-20,-14,14,6,11],
    [-12,-7,-4,6,3,4],[12,-8,-2,6,3,4],
    [-35,28,26,13,4,8],[15,36,35,17,5,9]];
  banks.forEach(([x,y,z,sx,sy,sz],index)=>{
    const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,
      uniforms:{uNoise:{value:texture},uTime:time,uSeed:{value:index*.137},
        uSun:{value:sunDirection.clone().divide(new THREE.Vector3(sx,sy,sz)).normalize()}},
      side:THREE.BackSide,transparent:true,depthWrite:false,depthTest:true});
    const cloud=new THREE.Mesh(geometry,material);cloud.position.set(x,y,z);cloud.scale.set(sx,sy,sz);
    cloud.name=`cloud-volume-${index+1}`;cloud.userData.gardenAtmosphere=true;
    group.add(cloud);drifters.push({cloud,x,z,phase:index*1.7});
  });
  scene.add(group);
  return {group,update(elapsed){for(const {cloud,x,z,phase} of drifters){
    cloud.position.x=x+(Math.sin(elapsed*.008+phase)-Math.sin(phase))*1.4;
    cloud.position.z=z+(Math.cos(elapsed*.005+phase)-Math.cos(phase))*.7;
  }}};
}
