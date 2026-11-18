import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {makeCloudVolumes} from './clouds.js';
import {makeMistRainbow} from './rainbow.js';
import {FIREWORK_BACKDROP, makeFireworkBackdropUniforms} from './fireworks.js';

export function makeAtmosphere(scene,renderer,time){
  const sunDirection=new THREE.Vector3(-11,10.5,7.5).normalize();
  const sky=new Sky();sky.name='spring-sky';sky.scale.setScalar(360);sky.renderOrder=-20;
  const uniforms=sky.material.uniforms;
  uniforms.sunPosition.value.copy(sunDirection).multiplyScalar(450000);
  uniforms.turbidity.value=1.8;uniforms.rayleigh.value=2.5;
  uniforms.mieCoefficient.value=.002;uniforms.mieDirectionalG.value=.84;
  uniforms.cloudCoverage.value=.55;uniforms.cloudDensity.value=.65;
  uniforms.cloudScale.value=.0016;uniforms.cloudSpeed.value=.000006;
  // Sky's native model treats the lower hemisphere as ground. Here the garden
  // floats above a cloud sea: retain air colour below the astronomical horizon.
  uniforms.dusk={value:0}; uniforms.night={value:0};uniforms.wishGlow={value:0};
  Object.assign(uniforms,makeFireworkBackdropUniforms());
  sky.material.fragmentShader=FIREWORK_BACKDROP+'\nuniform float dusk,night,wishGlow;\n'+sky.material.fragmentShader;
  sky.material.fragmentShader=sky.material.fragmentShader.replace(
    'gl_FragColor = vec4( texColor, 1.0 );',`
    vec3 lowerAir=mix(vec3(.66,.73,.77),vec3(.22,.43,.67),smoothstep(-.95,.15,direction.y));
    lowerAir+=vec3(.06,.035,0.0)*exp(-pow((direction.y+.45)/.18,2.0));
    texColor=mix(lowerAir,texColor*.32,smoothstep(.02,.16,direction.y));
    float horizon = exp(-abs(direction.y) * 3.7);
    
    // === 🌅 Glorious Burning Sunset & Crepuscular Rays v3.0 (史诗级真·烈焰火烧云系统) ===
    if (dusk > 0.001) {
      vec3 sunDir = vSunDirection;
      float cosSun = dot(direction, sunDir);
      float sunDist = length(direction - sunDir);

      // 1. Setting Sun Disc & Warm Localized Glow (落日与局部夕辉)
      float sunsetDisc = 1.0 - smoothstep(0.018, 0.026, sunDist);
      float innerHalo = exp(-sunDist * 8.0) * 2.2;
      float outerGlow = exp(-sunDist * 2.5) * 0.55;

      vec3 sunsetSunColor = vec3(1.0, 0.98, 0.90) * sunsetDisc * 3.5 + 
                            vec3(1.0, 0.65, 0.18) * innerHalo + 
                            vec3(0.95, 0.35, 0.10) * outerGlow;

      // 2. High-Contrast Deep Twilight Sky Canvas (深邃紫罗兰与暗紫红天幕底色)
      // The island floats above the cloud deck. Its visible horizon is below
      // the astronomical horizon, especially in the downward-looking overview.
      float elev = clamp(direction.y + 0.32, 0.0, 1.0);
      float sunAzimuth = dot(direction.xz, sunDir.xz) / max(length(direction.xz) * length(sunDir.xz), 0.0001);
      float horizonFactor = exp(-abs(direction.y + 0.32) * 4.0);
      // Decode the painted palette into scene-linear radiance before blending.
      vec3 zenith = sRGBTransferEOTF(vec4(0.09, 0.13, 0.28, 1.0)).rgb;
      vec3 upperSky = sRGBTransferEOTF(vec4(0.36, 0.19, 0.38, 1.0)).rgb;
      vec3 peach = sRGBTransferEOTF(vec4(0.78, 0.38, 0.32, 1.0)).rgb;
      vec3 sunHorizon = sRGBTransferEOTF(vec4(1.22, 0.78, 0.26, 1.0)).rgb;
      vec3 antiHorizon = sRGBTransferEOTF(vec4(0.86, 0.48, 0.46, 1.0)).rgb;
      vec3 horizonColor = mix(antiHorizon, sunHorizon, smoothstep(0.10, 0.95, sunAzimuth));
      vec3 duskSky = mix(zenith, upperSky, exp(-elev * 1.8));
      duskSky = mix(duskSky, peach, exp(-elev * 4.6));
      duskSky = mix(duskSky, horizonColor, horizonFactor * 0.95) + sunsetSunColor;

      vec2 domeUV = direction.xz / (0.35 + elev * 0.60);
      vec2 cUV = domeUV * vec2(0.55, 1.25) * 2.4 + time * vec2(0.000022, 0.000008);
      vec2 gentleWarp = vec2(fbm(cUV * 1.1 + vec2(1.7, 9.2), 0.0),
                             fbm(cUV * 1.1 + vec2(8.3, 2.8), 0.0)) * 0.16;
      vec2 coords = cUV + gentleWarp;
      float macro1 = fbm(coords * 0.82, 0.0) * 0.55 + 0.50;
      float macro2 = fbm(coords * 1.75 + vec2(4.2, 1.5), 0.0) * 0.55 + 0.50;
      float bank = smoothstep(0.24, 0.96, mix(macro1, macro2, 0.35));
      float wisps = fbm(coords * 3.4 + vec2(2.1, 7.3), 0.0) * 0.55 + 0.50;
      float density = clamp(bank + 0.30 * smoothstep(0.40, 0.76, wisps), 0.0, 1.0);

      float forwardScatter = pow(clamp(cosSun * 0.5 + 0.5, 0.0, 1.0), 2.2);
      float omniGlow = 0.58 + 0.42 * forwardScatter;
      float rim = smoothstep(0.06, 0.28, density) * (1.0 - smoothstep(0.28, 0.65, density));
      vec3 shade = sRGBTransferEOTF(vec4(0.28, 0.18, 0.26, 1.0)).rgb;
      vec3 body = sRGBTransferEOTF(vec4(1.10, 0.48, 0.18, 1.0)).rgb;
      vec3 amber = sRGBTransferEOTF(vec4(1.22, 0.72, 0.25, 1.0)).rgb;
      vec3 gold = sRGBTransferEOTF(vec4(1.38, 1.05, 0.48, 1.0)).rgb;
      vec3 cloudColor = mix(shade, body, clamp(density * 1.4, 0.0, 1.0));
      cloudColor = mix(cloudColor, amber, density * omniGlow);
      // Thick banks scatter less direct sunset light through their bellies.
      float selfShadow = smoothstep(0.55, 1.0, density) * (0.65 - 0.30 * forwardScatter);
      cloudColor = mix(cloudColor, shade, selfShadow);
      cloudColor += gold * rim * (0.46 + 1.6 * forwardScatter);
      float alpha = smoothstep(0.05, 0.65, density) * 0.86 * smoothstep(0.0, 0.12, elev);
      // Sunset radiance is lower than daylight; preserve hue through the ACES shoulder.
      texColor = mix(texColor, mix(duskSky, cloudColor, alpha) * 0.58, dusk);
    }
    vec3 moonDir=normalize(vec3(-.88,.165,-.72));
    float m=length(direction-moonDir);
    float moonDisc=1.-smoothstep(.0235,.0255,m);
    float shadowDisc=1.-smoothstep(.0225,.0248,length(direction-normalize(moonDir+vec3(.010,.008,-.010))));
    float crescent=clamp(moonDisc-shadowDisc,0.,1.);
    float earthshine=moonDisc*(1.-crescent)*.12;
    vec3 moonBody=vec3(.98,.96,.91)*crescent*2.2+vec3(.42,.52,.68)*earthshine;
    vec3 corona=vec3(1.,.94,.85)*exp(-m*14.)*.55+vec3(.55,.72,.95)*exp(-m*3.8)*.28;
    // === 🌌 Authentic Romantic Milky Way Galaxy System (Bench Panoramic Arch v2.2) ===
    // 1. Precise grass & ground extinction: Zero light on meadow, 100% open sky
    float skyElevation = smoothstep(-0.42, -0.20, direction.y);
    // Map the celestial panorama onto the open air above the island's cloud sea.
    vec3 galaxyDirection = normalize(vec3(direction.x, direction.y + 0.84, direction.z));

    // 2. Galactic Spherical Coordinates: Panoramic Arch crowning the western tree canopy and moon
    vec3 galNorm = normalize(vec3(0.80, 0.58, 0.15));
    vec3 galCore = normalize(vec3(-0.55, 0.45, -0.70));
    vec3 galBinorm = normalize(cross(galNorm, galCore));

    float galLat = dot(galaxyDirection, galNorm);
    float galLongX = dot(galaxyDirection, galCore);
    float galLongY = dot(galaxyDirection, galBinorm);
    float galAngle = atan(galLongY, galLongX);
    vec2 galUV = vec2(galAngle * 1.6, galLat * 4.8);

    // 3. Multi-Octave Organic FBM Nebula & Great Rift
    float nNebula1 = fbm(galUV * 1.1, 0.0);
    float nNebula2 = fbm(galUV * 2.4 + vec2(2.1, 1.4), 0.0);
    float wisp = clamp(nNebula1 * 0.58 + nNebula2 * 0.42 + 0.30, 0.0, 1.0);

    float riftNoise = abs(fbm(galUV * 1.8 + vec2(3.7, -2.1), 0.0));
    float darkRift = smoothstep(0.10, 0.48, riftNoise) * exp(-(galLat * 5.2) * (galLat * 5.2));

    // Majestic broad galactic band profiles
    float bandOuter = exp(-(galLat * 4.5) * (galLat * 4.5));
    float bandInner = exp(-(galLat * 8.0) * (galLat * 8.0));
    float band = bandOuter * clamp(wisp - darkRift * 0.36, 0.0, 1.0);

    // 4. Galactic Core Bulge: Warm luminous bulge crowning the sky above the tree and moon
    float coreDist = max(0.0, dot(galaxyDirection, galCore));
    float coreGlow = pow(coreDist, 20.0) * exp(-galLat * galLat * 120.0)
      * (0.16 + 0.48 * wisp) * (1.0 - 0.68 * darkRift);

    // 5. Stardust Scintillation
    // Sparse subpixel knots follow the band rather than becoming broad noise patches.
    vec2 dustUV = galUV * vec2(550.0, 120.0);
    vec2 cell = floor(dustUV);
    vec2 offset = 0.35 * vec2(noise(cell * 0.27), noise(cell * 0.41 + 2.1));
    vec2 local = fract(dustUV) - 0.5 - offset;
    float dustRadius = max(0.12, 0.45 * length(fwidth(dustUV)));
    float microStars = exp(-dot(local, local) / (dustRadius * dustRadius))
      * smoothstep(0.25, 0.68, noise(cell * 0.73)) * bandInner * 0.80;

    // 6. Rich Romantic Palette: Deep Indigo, Twilight Violet, Soft Amber Core
    vec3 cOuter = vec3(0.14, 0.22, 0.55) * 1.5;  // Ethereal deep indigo
    vec3 cMid   = vec3(0.52, 0.26, 0.68) * 1.8;  // Twilight violet
    vec3 cCore  = vec3(1.15, 0.90, 0.62) * 1.8;  // Soft warm stellar amber core
    vec3 cStars = vec3(2.2, 2.4, 3.0);            // Crystalline stardust sparkle

    vec3 nebCol = mix(cOuter, cMid, clamp(band * 1.4, 0.0, 1.0));
    nebCol = mix(nebCol, cCore, clamp(coreGlow * 1.6, 0.0, 1.0));

    vec3 galaxyLight = (nebCol * (band * 1.15 + coreGlow * 1.25) + cStars * microStars) * skyElevation;

    // Deep Sky Dome Compositing with rich cosmic sapphire atmosphere
    vec3 darkSky = mix(vec3(0.014, 0.024, 0.060), vec3(0.042, 0.062, 0.105), horizon);
    vec3 dark = darkSky + exposeGalaxy(galaxyLight,direction) + moonBody + corona;
    float wishBand=exp(-5.0*abs(direction.y-.27-.12*sin(4.0*direction.x+2.0*direction.z)));
    dark+=wishGlow*(vec3(.016,.018,.038)+mix(vec3(.05,.14,.11),vec3(.15,.065,.16),direction.x*.5+.5)*wishBand);
    gl_FragColor = vec4(mix(texColor, dark, night), 1.0);`);
  // At the two settled endpoints the other sky has exactly zero blend weight.
  // Skip that hidden FBM/scattering work; transitions retain both original paths.
  if(import.meta.env.DEV)sky.material.userData.referenceFragmentShader=sky.material.fragmentShader;
  sky.material.fragmentShader=sky.material.fragmentShader
    .replace('float horizon = exp(-abs(direction.y) * 3.7);','')
    .replace('vec3 direction = normalize( vWorldPosition - cameraPosition );',
      'vec3 direction = normalize( vWorldPosition - cameraPosition );\nvec3 texColor=vec3(0.0);\nfloat horizon=exp(-abs(direction.y)*3.7);\nif(night<1.0){')
    .replace('vec3 texColor = ( Lin + L0 )','texColor = ( Lin + L0 )')
    .replace('vec3 moonDir=normalize(vec3(-.88,.165,-.72));','}\nif(night>0.0){\nvec3 moonDir=normalize(vec3(-.88,.165,-.72));')
    .replace('gl_FragColor = vec4(mix(texColor, dark, night), 1.0);','texColor=mix(texColor,dark,night);\n}\ngl_FragColor=vec4(texColor,1.0);');
  sky.material.customProgramCacheKey=()=> 'spring-floating-sky-visible-branches-v3';
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
  for(const c of volumes.group.children){Object.assign(c.material.uniforms,{dusk:uniforms.dusk,night:uniforms.night});}
  const rainbow=makeMistRainbow(scene,time,sunDirection);
  return {sky,clouds:volumes.group,environment,rainbow,
    update(elapsed){uniforms.time.value=elapsed;volumes.update(elapsed);}};
}
