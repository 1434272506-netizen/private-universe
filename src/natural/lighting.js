import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// AO describes solid contacts. Water, sky and fine moving vegetation should
// not turn into opaque occluders when the pass draws its normal/depth buffer.
class GardenContactPass extends GTAOPass {
  _overrideVisibility() {
    super._overrideVisibility();
    this.scene.traverse(object => {
      const material = object.material;
      if (object.visible && (object.userData.gardenAtmosphere || object.userData.gardenFoliage || object.isSprite || object.name === 'spring-sky'
        || object.name === 'patches-of-meadow-grass' || object.name === 'banyan-canopy'
        || material?.transparent)) {
        object.visible = false;
        this._visibilityCache.push(object);
      }
    });
  }
  setSize(width, height) {
    super.setSize(Math.max(1, Math.round(width * .5)), Math.max(1, Math.round(height * .5)));
  }
}

export function makeLighting(renderer, scene, camera, {cabin}={}) {
  const target = new THREE.WebGLRenderTarget(1, 1, {type: THREE.HalfFloatType});
  target.samples = Math.min(2, renderer.capabilities.maxSamples);
  const composer = new EffectComposer(renderer, target);
  const contact = new GardenContactPass(scene, camera, 1, 1);
  // Contact normals/depth must follow the same plush deformation as the colour pass.
  // Other geometry supplies the constant zero weight, so its contacts stay unchanged.
  if(cabin?.toys){
    contact.normalMaterial.defaultAttributeValues={pigletWeight:[0]};
    contact.normalMaterial.onBeforeCompile=shader=>cabin.toys.decorateShader(shader);
    contact.normalMaterial.customProgramCacheKey=()=> 'garden-contact-piglet-deformation-v1';
  }
  contact.updateGtaoMaterial({radius: .48, thickness: .7, distanceExponent: 1.5, distanceFallOff: .8, scale: 1, samples: 8});
  contact.updatePdMaterial({radius: 5, samples: 8});
  contact.blendIntensity = .44;
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(contact);
  composer.addPass(new OutputPass());
  renderer.info.autoReset = false;
  return {
    contact,
    get quality() {
      return {msaaSamples: target.samples, gtaoSamples: contact.gtaoMaterial.defines.SAMPLES,
        denoiseSamples: contact.pdMaterial.defines.SAMPLES, pixelRatio: renderer.getPixelRatio(), canvasAntialias: renderer.getContext().getContextAttributes().antialias};
    },
    resize(width, height) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(width, height);
    },
    render(delta) {
      renderer.info.reset();
      composer.render(delta);
    },
  };
}
