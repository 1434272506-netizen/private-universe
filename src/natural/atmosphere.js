import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {makeCloudVolumes} from './clouds.js';
import {makeMistRainbow} from './rainbow.js';

export function makeAtmosphere(scene,renderer,time){
  const sunDirection=new THREE.Vector3(-11,10.5,7.5).normalize();
  const sky=new Sky();sky.name='spring-sky';sky.scale.setScalar(240);sky.renderOrder=-20;
  const uniforms=sky.material.uniforms;
  uniforms.sunPosition.value.copy(sunDirection).multiplyScalar(450000);
  uniforms.turbidity.value=1.8;uniforms.rayleigh.value=2.5;
  uniforms.mieCoefficient.value=.002;uniforms.mieDirectionalG.value=.84;
  uniforms.cloudCoverage.value=.55;uniforms.cloudDensity.value=.65;
  uniforms.cloudScale.value=.0016;uniforms.cloudSpeed.value=.000006;
  // Sky's native model treats the lower hemisphere as ground. Here the garden
  // floats above a cloud sea: retain air colour below the astronomical horizon.
  sky.material.fragmentShader=sky.material.fragmentShader.replace(
    'gl_FragColor = vec4( texColor, 1.0 );',`
    vec3 lowerAir=mix(vec3(.66,.73,.77),vec3(.22,.43,.67),smoothstep(-.95,.15,direction.y));
    lowerAir+=vec3(.06,.035,0.0)*exp(-pow((direction.y+.45)/.18,2.0));
    texColor=mix(lowerAir,texColor*.32,smoothstep(.02,.16,direction.y));
    gl_FragColor = vec4(texColor,1.0);`);
  sky.material.customProgramCacheKey=()=> 'spring-floating-sky-v1';
  scene.add(sky);
  if(scene.fog)scene.fog.color.set('#d8e4e7');
  // Bake diffuse reflections without the tiny high-energy solar disc.
  const environmentScene=new THREE.Scene(),environmentSky=new THREE.Mesh(sky.geometry,sky.material);
  environmentSky.scale.copy(sky.scale);environmentScene.add(environmentSky);
  uniforms.showSunDisc.value=0;
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(environmentScene,.06,.1,500);
  scene.environment=environment.texture;scene.environmentIntensity=.14;pmrem.dispose();
  uniforms.showSunDisc.value=1;
  const volumes=makeCloudVolumes(scene,time,sunDirection);
  const rainbow=makeMistRainbow(scene,time,sunDirection);
  return {sky,clouds:volumes.group,environment,rainbow,
    update(elapsed){uniforms.time.value=elapsed;volumes.update(elapsed);}};
}
