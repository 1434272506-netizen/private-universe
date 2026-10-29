import * as THREE from 'three';
import {rng, noise} from './shared.js';

// Cloud banks are placed in the same world as the garden, below its altitude.
// Their soft billboards retain their position and depth through a full orbit.
export function makeAtmosphere(scene, renderer, time) {
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    uniforms: {
      uTime: time,
      uZenith: {value: new THREE.Color('#79aacb')},
      uHorizon: {value: new THREE.Color('#c3d3d9')},
      uLower: {value: new THREE.Color('#d7dfd7')},
    },
    vertexShader: `varying vec3 vDirection;
      void main() { vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vDirection;
      uniform float uTime;
      uniform vec3 uZenith,uHorizon,uLower;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
      }
      float fbm(vec2 p){
        float n=0.0,a=.52;
        for(int i=0;i<5;i++){n+=a*noise(p);p=mat2(1.6,-1.2,1.2,1.6)*p+7.3;a*=.48;}
        return n;
      }
      void main(){
        vec3 d=normalize(vDirection);
        // The camera looks down from a high island. Carry the atmospheric
        // gradient into that visible lower hemisphere instead of leaving it flat.
        vec3 color=mix(uHorizon,uZenith,smoothstep(-.72,.60,d.y));
        color=mix(color,uLower,1.0-smoothstep(-.96,-.46,d.y));
        float sun=max(dot(d,normalize(vec3(-.7,.62,.4))),0.0);
        color+=vec3(.048,.032,.012)*pow(sun,6.0);
        vec2 p=d.xz/max(.25,d.y+.43)*2.1+vec2(uTime*.0009,0.0);
        float vapor=fbm(p*1.7+3.0);
        float highCloud=smoothstep(.54,.77,vapor)*smoothstep(-.20,.25,d.y)*.17;
        float lowCloud=smoothstep(.53,.76,fbm(d.xz*7.0+vec2(uTime*.0007,13.0)))
          *smoothstep(-.97,-.66,d.y)*(1.0-smoothstep(-.28,.02,d.y))*.10;
        color=mix(color,vec3(.93,.945,.91),highCloud+lowCloud);
        gl_FragColor=vec4(color,1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky=new THREE.Mesh(new THREE.SphereGeometry(140,32,20),skyMaterial);
  sky.name='spring-sky';
  sky.renderOrder=-20;
  scene.add(sky);
  if(scene.fog)scene.fog.color.set('#d0e1e7');

  const random=rng(80135),textures=[0,1,2].map(cloudTexture);
  const clouds=new THREE.Group(),drifters=[];
  clouds.name='distant-clouds';
  const addCloud=(x,y,z,width,index,opacity)=>{
    const material=new THREE.SpriteMaterial({
      map:textures[index%3],color:'#fffaf1',opacity,depthWrite:false,
      fog:false,toneMapped:false,
    });
    const cloud=new THREE.Sprite(material);
    cloud.position.set(x,y,z);
    cloud.scale.set(width,width*(.36+random()*.15),1);
    cloud.name=`lower-cloud-bank-${index+1}`;
    clouds.add(cloud);
    drifters.push({cloud,home:cloud.position.clone(),phase:random()*Math.PI*2,speed:.005+random()*.004});
  };
  for(let i=0;i<12;i++){
    const angle=i/12*Math.PI*2+random()*.27,radius=50+random()*28;
    addCloud(Math.cos(angle)*radius,-29-radius*.24+random()*16,
      Math.sin(angle)*radius,18+random()*17,i,.46+random()*.15);
  }
  // These nearer, lower banks keep altitude legible in the opening shot;
  // they remain outside the navigable garden and never obscure its objects.
  addCloud(-27,-20,-31,21,12,.48);
  addCloud(30,-24,-36,23,13,.46);
  addCloud(-12,-43,-45,30,14,.54);
  // Broad, staggered banks sit behind and below the island's solid geometry.
  // Depth testing preserves the tree, ribbon and rock silhouette in every orbit.
  addCloud(-24,-14,-30,29,15,.72);
  addCloud(25,-18,-33,34,16,.67);
  addCloud(-3,-24,-61,61,17,.65);
  scene.add(clouds);

  const environmentScene=new THREE.Scene();
  environmentScene.add(new THREE.Mesh(new THREE.SphereGeometry(40,24,12),skyMaterial));
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(environmentScene,.08,.1,100);
  scene.environment=environment.texture;
  scene.environmentIntensity=.35;
  pmrem.dispose();
  return {
    sky,clouds,environment,
    update(elapsed){
      for(const {cloud,home,phase,speed} of drifters){
        cloud.position.x=home.x+(Math.sin(elapsed*speed+phase)-Math.sin(phase))*2.3;
        cloud.position.z=home.z+(Math.sin(elapsed*speed*.55+phase)-Math.sin(phase))*.9;
      }
    },
  };
}

function cloudTexture(seed){
  const width=768,height=320,canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d'),random=rng(381+seed*73);
  const image=context.createImageData(width,height);
  const puffs=Array.from({length:8},()=>{
    const angle=random()*Math.PI*2,radius=Math.sqrt(random());
    return {
      x:.5+Math.cos(angle)*radius*.30,
      y:.47+Math.sin(angle)*radius*.23,
      sx:.08+random()*.105,sy:.12+random()*.12,
      weight:.26+random()*.20,
    };
  });
  for(let i=0;i<3;i++)puffs.push({
    x:.25+i*.25,y:.62+(random()-.5)*.13,
    sx:.16+random()*.10,sy:.055+random()*.035,weight:.19,
  });
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width,v=y/height;
    let density=0;
    for(const puff of puffs){
      const dx=(u-puff.x)/puff.sx,dy=(v-puff.y)/puff.sy;
      density+=Math.exp(-(dx*dx+dy*dy)*2.2)*puff.weight;
    }
    density*=.64+.42*noise(u*17+seed*9,v*17+4)+.12*noise(u*41+3,v*37+seed*5);
    const edgeX=THREE.MathUtils.smoothstep(u,0,.12)*(1-THREE.MathUtils.smoothstep(u,.88,1));
    const edgeY=THREE.MathUtils.smoothstep(v,0,.12)*(1-THREE.MathUtils.smoothstep(v,.88,1));
    const alpha=THREE.MathUtils.smoothstep(density,.025,.74)*.84*edgeX*edgeY;
    const shade=THREE.MathUtils.smoothstep(v,.36,.81)*.6;
    const index=(y*width+x)*4;
    image.data[index]=252-shade*45;
    image.data[index+1]=252-shade*28;
    image.data[index+2]=247-shade*10;
    image.data[index+3]=alpha*255;
  }
  context.putImageData(image,0,0);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}
