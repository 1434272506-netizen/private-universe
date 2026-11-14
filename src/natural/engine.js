import {makeCreekEcology} from './creek-ecology.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeCreekChimes} from './chimes-audio.js';
import {makeStargazing} from './constellations.js';
import {makeMilestone} from './anniversary-milestone.js';
import {makeLand,ground,inside,creekX,WATER_END,CABIN_SITE,TREE_SITE,onCabinFloor} from './land.js';
import {makePlants,makeMeadowEcology} from './plants.js';
import {createButterflies} from './butterflies.js';
import {makeCreekRipples} from './creek-ripples.js';
import {makeWater} from './water.js';
import {makeCabin} from './cabin.js';
import {makeEstateFeatures} from './estate-features.js';
import {createNeuralFireflies} from './neural-fireflies.js';
import {createScenicTour} from './scenic-tour.js';
import {makeProps} from './props.js';
import {benchAtmosphere} from './bench-atmosphere.js';
import {makeAtmosphere} from './atmosphere.js';
import {prepareStories} from '../stories.js';
import {makeLighting} from './lighting.js';
import {loadCenterpieceTree} from './loveTree.js';
import {presentRibbon} from '../ribbon-transition.js';
import {prepareContentEditor} from '../content-editor.js';
import {prepareGardenAudio} from '../garden-audio.js';
import {prepareSurprises} from '../surprises.js';
import {createSurpriseWorld} from './surprises.js';
import {makeListeningPlayer} from './listening-player.js';
import {ceremonyPath,guidingPetals} from './ceremony.js';
import {createFallingFoliage} from './falling-foliage.js';
import '../local-garden.css';

const $=selector=>document.querySelector(selector);
const app=$('#app'),canvasUI=$('#garden-ui'),invitation=$('#invitation');
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion=motionQuery.matches;
const time={value:0},scene=new THREE.Scene();
scene.fog=new THREE.FogExp2('#e4ebdf',.0040);
// Geometry is antialiased in the composer's HDR target. The output canvas
// receives a fullscreen quad and needs no second multisample resolve.
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate=false;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.04;
const canvas=renderer.domElement;app.prepend(canvas);
canvas.setAttribute('aria-label','春日浮岛。拖动环绕，滚轮缩放，轻点白丝带、信箱或长椅。操作说明里也可用键盘探索。');
canvas.tabIndex=-1;
const camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.15,900);
const controls=new OrbitControls(camera,canvas);
Object.assign(controls,{enabled:false,enableDamping:true,dampingFactor:.065,enablePan:false,minDistance:13,maxDistance:55,minPolarAngle:.24,maxPolarAngle:1.38,rotateSpeed:.42,zoomSpeed:.6,autoRotateSpeed:.16});

const atmosphere=makeAtmosphere(scene,renderer,time);
const hemi=new THREE.HemisphereLight('#edf4fa','#60734c',.92);scene.add(hemi);
const sun=new THREE.DirectionalLight('#ffe5c4',3.65);
sun.position.set(-11,10.5,7.5);sun.castShadow=true;
sun.shadow.mapSize.set(4096,4096);
Object.assign(sun.shadow.camera,{left:-26,right:26,top:22,bottom:-22,near:.2,far:85});
sun.shadow.normalBias=.018;sun.shadow.bias=-.00012;sun.shadow.radius=3;
scene.add(sun);
const fill=new THREE.DirectionalLight('#d3e3ed',.28);fill.position.set(6,3,-8);scene.add(fill);

const island=makeLand(scene);
$('#loading').textContent='春风经过树梢，花园就快醒来了。';
const treeAsset=await loadCenterpieceTree(island,time);
const cabin=makeCabin();
cabin.group.position.set(CABIN_SITE.x,ground(CABIN_SITE.x,CABIN_SITE.z),CABIN_SITE.z);
cabin.group.rotation.y=CABIN_SITE.yaw;
island.add(cabin.group);
// Bind the existing PMREM explicitly: otherwise Three.js uses scene.environmentIntensity
// instead of the glass's per-material 5.5 -> 3.2 reflection control.
cabin.group.traverse(object=>{
 if(!object.isMesh)return;
 const materials=Array.isArray(object.material)?object.material:[object.material];
 for(const material of materials)if(material.isMeshPhysicalMaterial)material.envMap=scene.environment;
});
// Complete optional asynchronous fittings before fitting silhouettes and freezing obstacle boxes.
await cabin.loadParts?.(cabin.group);
const statistics={...makePlants(island,time,{includeTree:false}),...treeAsset.statistics};
const waterStatistics=makeWater(island,time),props=makeProps(island,time);
const estateFeatures=makeEstateFeatures(island,time);
const trunkObstacle=new THREE.Box3(
  new THREE.Vector3(TREE_SITE.x-1.35,-0.2,TREE_SITE.z-1.35),
  new THREE.Vector3(TREE_SITE.x+1.35,5.2,TREE_SITE.z+1.35)
);
const canopyObstacle=treeAsset.bounds.clone();canopyObstacle.min.y=Math.max(canopyObstacle.min.y,5.3);
const neuralFireflies=createNeuralFireflies(scene,{camera,lanternSites:estateFeatures.lanterns.sites,obstacles:[trunkObstacle,canopyObstacle,new THREE.Box3().setFromObject(cabin.group)],flowerMeshes:['sunflower-fields','lavender-terraces','bioluminescent-star-flora','daisy-centers'].map(name=>island.getObjectByName(name))});
// Scene-level placement keeps transient foliage out of the island silhouette
// fitting and the physical interaction/occlusion registries.
const benchTime=benchAtmosphere(scene,atmosphere,sun,hemi,fill,time,treeAsset.anchor.getWorldPosition(new THREE.Vector3()),renderer,cabin,estateFeatures);
const creekRipples=makeCreekRipples(renderer,time);
const creekEcology=makeCreekEcology(island,{creekRipples,reducedMotion:()=>reducedMotion});
const creekSurface=island.getObjectByName('creek-surface');
const rippleUniforms=creekSurface.material.userData.currentUniforms;
rippleUniforms.uRippleSimTex.value=creekRipples.getTexture();
rippleUniforms.uRippleStrength.value=1;
const fallingFoliage=createFallingFoliage(scene,{ground,reducedMotion});
const meadow=makeMeadowEcology(island),butterflies=createButterflies(scene,meadow.perches);
butterflies.setReducedMotion(reducedMotion);
Object.assign(statistics,meadow.statistics);
const surpriseWorld=createSurpriseWorld(island,time,{ground,reducedMotion:()=>reducedMotion});
const archiveBook=props.bench.getObjectByName('linen-memory-book');
if(archiveBook)archiveBook.userData.interaction='archive';
const listeningPlayer=makeListeningPlayer(props.bench);
let archivePetal;
if(archiveBook){
  archivePetal=new THREE.Mesh(new THREE.SphereGeometry(.028,8,6),new THREE.MeshStandardMaterial({color:'#b4a3c4',roughness:1}));
  archivePetal.name='new-archive-petal';archivePetal.scale.set(.6,.16,1);archivePetal.position.set(.19,.083,.07);archivePetal.visible=false;archiveBook.add(archivePetal);
  for(const name of ['lavender-bookmark','green-bookmark']){const mark=archiveBook.getObjectByName(name);if(mark)mark.visible=false;}
}
for(const balloon of props.balloons)balloon.userData.interaction='create-surprise';
for(const [x,y,z,scale] of [[-34,-20,-50,.32],[21,-24,-68,.25]]){
  const distant=makeLand(scene,{detail:'distant'});distant.name='distant-island';
  distant.scale.setScalar(scale);distant.position.set(x,y,z);
  distant.traverse(object=>{if(object.isMesh){object.castShadow=false;object.receiveShadow=false;}});
}
scene.updateMatrixWorld(true);
const lighting=makeLighting(renderer,scene,camera);
lighting.resize(innerWidth,innerHeight);

// Fit the actual 3D silhouette, including instanced foliage, from every overview.
const points=[],temp=new THREE.Vector3(),matrix=new THREE.Matrix4();
island.traverse(object=>{
  if(!object.isMesh)return;
  const positions=object.geometry.attributes.position;
  if(object.isInstancedMesh){
    for(let i=0;i<object.count;i+=Math.max(1,Math.floor(object.count/400))){
      object.getMatrixAt(i,matrix);temp.setFromMatrixPosition(matrix).applyMatrix4(object.matrixWorld);points.push(temp.clone());
    }
  }else for(let i=0;i<positions.count;i+=Math.max(1,Math.floor(positions.count/700))){
    temp.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);points.push(temp.clone());
  }
});
// Authored foliage can extend beyond the sparse vertex samples used above.
for(const x of [treeAsset.bounds.min.x,treeAsset.bounds.max.x])
  for(const y of [treeAsset.bounds.min.y,treeAsset.bounds.max.y])
    for(const z of [treeAsset.bounds.min.z,treeAsset.bounds.max.z])points.push(new THREE.Vector3(x,y,z));
const target=new THREE.Vector3(-.4,1.7,0);
const directions={hero:[.12,.35,.93],side:[.94,.24,.25],overhead:[.15,.94,.31],opposite:[-.18,.53,-.86]};
const ribbon=island.getObjectByName('memory-ribbon'),redTies=[];
treeAsset.tree.traverse(object=>{if(object.name==='branch-red-silk')redTies.push(object);});
const anchors={
  ribbon:new THREE.Vector3(...(statistics.ribbonAnchor||[-2.64,3.49,.69])),
  mailbox:props.mailbox.position.clone().add(new THREE.Vector3(0,1.42,.2)),
  bench:props.bench.localToWorld(new THREE.Vector3(0,.94,-.275))
};
// Estate meshes store authored vertices in island coordinates; group origins are zero.
for(const [key,x,y,z] of [['swing',-15.5,1.9,-2],['picnic',13.2,.8,.8],['campfire',15,.5,-1.6],['telescope',18.2,1.6,1.8]]) anchors[key]=island.localToWorld(new THREE.Vector3(x,y,z));
const presets={
  meadow:{position:[-20.5,2.35,6.8],target:[-16.2,1.35,1.8],min:3.8,title:'风过金浪，花海正仰望晨光。',note:'Sunflowers & lavender in bloom.'},
  swing:{position:[-10.8,2.3,.85],target:[-15.5,2.05,-2],min:3.6,title:'秋千轻荡，春风都在耳畔。',note:'Swaying in the breeze together.'},
  picnic:{position:[15.8,2.05,3.6],target:[12.9,.85,.55],min:3.2,title:'把午后的时光铺在草地上。',note:'A picnic, just for us.'},
  campfire:{position:[17.6,2.25,-4.4],target:[14.6,.72,-1.4],min:3.5,title:'添一捧暖意，等星光落下。',note:'Warm embers under our sky.'},
  telescope:{position:[13.6,1.9,6.4],target:[19.4,3.55,-1.2],min:1.8,title:'顺着望远镜，仰望这片星海。',note:'Toward the crescent moon.'},
  waterfall:{target:[creekX(WATER_END),-1.65,WATER_END+.45],position:[creekX(WATER_END)+2.8,.4,WATER_END+8],min:3.5,title:'水落进云里。',note:'Where water meets the clouds.'},
  sky:{target:[-14,17,18],position:[3,2.3,6],min:8,title:'抬头，云正经过太阳。',note:'A little closer to the sky.'},
  tree:{target:[-3.4,2.5,.1],position:[-.3,4.3,9.3],min:6.8,title:'记忆，系在枝头。',note:'The memory ribbon.'},
  mailbox:{target:[4.65,1.65,-1.9],position:[6.2,3.25,3.9],min:4.3,title:'写给彼此的春天。',note:'Letters between us.'},
  bench:{target:[CABIN_SITE.x,2.1,CABIN_SITE.z],position:props.bench.position.clone().add(new THREE.Vector3(0,1.28,0)).toArray(),min:7,title:'坐一会儿，春天还很长。',note:'Stay a little longer.'},
  creek:{target:[.4,.45,.4],position:[3.4,3.7,5.8],min:4.5,title:'溪水经过。',note:'Let the afternoon flow.'}
};
// View from the open western foreground: the cabin roof no longer masks the sundial.
Object.assign(presets.tree,{target:[-10.6,3.6,-3.4],position:[-11.5,4.6,7.8],min:6.8});
let elapsed=0,lastFrame=performance.now(),ready=false,phase='invitation';
let currentView='hero',flight=null,intro=null,savedView=null,pendingStory=null,activePlace=null,activeDialog=null;
let shadowUntil=0,hintUntil=0,closing=false;
let ribbonPresentation=null;
let petalGuide=null,petalStart=0;
const openingPassphrase=String(import.meta.env.VITE_OPENING_PASSPHRASE||'').trim();
const openingFallback=String(import.meta.env.VITE_OPENING_FALLBACK??'春天').trim();
function clearPetals(){petalGuide?.dispose();petalGuide=null;}
let contentEditorOpen=false;
let pendingPlacement=null;
const auxiliaryPanels=new Set();
let sceneFrameRequested=true,overlayRenderPaused=false,overlayReadyAt=0,stableCameraFrames=0,renderCount=0;
const renderedPosition=camera.position.clone(),renderedTarget=controls.target.clone(),renderedRotation=camera.quaternion.clone();
function requestSceneFrame(){sceneFrameRequested=true;}
const ease=t=>t*t*t*(t*(t*6-15)+10);
function announce(text){$('#announcement').textContent=text;}
function setPhase(next){phase=next;app.dataset.phase=next;canvasUI.inert=next!=='exploring';updateAtmosphereVisibility();}
function setTour(active){if(active&&!reducedMotion)scenicTour.start();else scenicTour.stop();}
function hideHint(){$('#object-hint').hidden=true;delete canvas.dataset.hover;}
function closeHelp(){$('#help-panel').hidden=true;$('#help-toggle').setAttribute('aria-expanded','false');}
function openPanel(name){
  neuralFireflies.selectFly(-1);
  telescopeGaze.hidden=true;
  auxiliaryPanels.add(name);contentEditorOpen=true;overlayReadyAt=performance.now();requestSceneFrame();
  updateAtmosphereVisibility();
  closeHelp();hideHint();setTour(false);pendingStory=null;controls.enabled=false;
}
function closePanel(name){
  auxiliaryPanels.delete(name);contentEditorOpen=auxiliaryPanels.size>0;requestSceneFrame();
  updateAtmosphereVisibility();
  controls.enabled=phase==='exploring'&&!activeDialog&&!contentEditorOpen;
}
function updateAtmosphereVisibility(){
  const panel=$('#atmosphere-switcher');
  if(panel) panel.hidden=phase!=='exploring'||Boolean(activeDialog)||contentEditorOpen||Boolean(pendingPlacement);
}
function caption(which){
  updateAtmosphereVisibility();
  if(which!=='telescope')telescopeGaze.hidden=true;
  app.dataset.view=which;
  const preset=presets[which];
  $('#view-title').textContent=preset?.title||'风很轻，日子很慢。';
  $('#view-note').textContent=preset?.note||'Somewhere, just for us.';
}
function fitPosition(which='hero'){
  const dir=new THREE.Vector3(...directions[which]).normalize();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir).normalize();
  const up=new THREE.Vector3().crossVectors(dir,right).normalize();
  const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=0;
  for(const point of points){
    const relative=point.clone().sub(target),depth=relative.dot(dir);
    distance=Math.max(distance,Math.abs(relative.dot(right))/(tangent*camera.aspect*.77)+depth,Math.abs(relative.dot(up))/(tangent*.81)+depth);
  }
  return target.clone().addScaledVector(dir,distance);
}
function moveTo(position,lookAt,{duration=1.65,min=13,cosine=false,done=null}={}){
  controls.enableDamping=false;controls.update();
  const limits={minDistance:min,maxPolarAngle:gazing.active?Math.PI:['sky','telescope'].includes(currentView)?2.45:currentView==='bench'?1.65:1.38,maxDistance:Math.max(55,position.distanceTo(lookAt)*1.12)};
  // Authored low meadow/swing shots must survive OrbitControls handover unchanged.
  limits.maxPolarAngle=Math.max(limits.maxPolarAngle,Math.acos(THREE.MathUtils.clamp((position.y-lookAt.y)/position.distanceTo(lookAt),-1,1))+.001);
  const finish=()=>{Object.assign(controls,limits);controls.enableDamping=true;done?.();};
  if(reducedMotion||duration===0){
    flight=null;camera.position.copy(position);controls.target.copy(lookAt);Object.assign(controls,limits);controls.update();finish();
  }else{
    // Allow both endpoints until the camera has arrived; clamping to the
    // overview's minimum distance early would make a close view jump away.
    controls.minDistance=Math.min(min,camera.position.distanceTo(controls.target));
    controls.maxPolarAngle=Math.max(limits.maxPolarAngle,controls.getPolarAngle());
    controls.maxDistance=Math.max(limits.maxDistance,camera.position.distanceTo(controls.target));
    // Quintic easing has a maximum slope of 1.875. Bound visual travel per
    // rendered frame so a slow GPU cannot turn a smooth return into a jump.
    const travel=Math.max(camera.position.distanceTo(position),controls.target.distanceTo(lookAt));
    flight={from:camera.position.clone(),to:position.clone(),fromTarget:controls.target.clone(),toTarget:lookAt.clone(),cosine,start:performance.now(),time:0,maxStep:travel>0?.5*duration/(1.875*travel):duration,duration,done:finish};
  }
}
function frame(which='hero',smooth=false,options={}){
  if(!Object.hasOwn(directions,which)&&!Object.hasOwn(presets,which))which='hero';
  if(!options.tour)setTour(false);currentView=which;caption(which);
  const preset=presets[which];
  moveTo(preset?new THREE.Vector3(...preset.position):fitPosition(which),preset?new THREE.Vector3(...preset.target):target,{duration:smooth?1.65:0,min:preset?.min||13,...options});
}
function finishIntro(smooth=true,direct=false){
  intro=null;$('#skip-intro').hidden=true;controls.enabled=true;setPhase('exploring');
  frame(direct?'hero':'tree',smooth);
  if(!direct&&!reducedMotion){
    const guide=()=>{if(phase!=='exploring'||reducedMotion)return;clearPetals();petalGuide=guidingPetals(scene,anchors.ribbon);petalStart=elapsed;};
    if(flight){const done=flight.done;flight.done=()=>{done?.();guide();};}else guide();
  }
  announce(direct?'花园已打开。':'春风停在白丝带旁。可打开操作说明，用键盘探索花园。');
  canvas.focus({preventScroll:true});
}
function enter(direct=false){
  if(!ready||phase!=='invitation')return;
  const input=$('#passphrase-input'),value=input.value.trim();
  if(openingPassphrase&&value!==openingPassphrase&&(!openingFallback||value!==openingFallback)){
    $('#passphrase-form').hidden=false;$('#wax-seal').setAttribute('aria-expanded','true');
    $('#passphrase-error').hidden=false;$('#passphrase-error').textContent='暗号还差一点点，再想想属于我们的那一天。';input.setAttribute('aria-invalid','true');input.focus();return;
  }
  clearPetals();
  if(!direct)void gardenAudio.startCeremony();
  invitation.classList.add('is-leaving');invitation.inert=true;
  if(direct||reducedMotion){finishIntro(false,direct);return;}
  setPhase('intro');controls.enabled=false;controls.enableDamping=false;controls.minDistance=.5;
  const path=ceremonyPath(presets.tree.position,presets.tree.target);
  camera.position.copy(path.position.getPoint(0));controls.target.copy(path.target.getPoint(0));controls.update();
  intro={start:elapsed,duration:9,path};$('#skip-intro').hidden=false;$('#skip-intro').focus({preventScroll:true});
}
function snapshot(){return {position:camera.position.clone(),target:controls.target.clone(),min:controls.minDistance,view:currentView,width:innerWidth,height:innerHeight};}
function returnToGarden(){
  setTour(false);telescopeGaze.hidden=true;
  updateAtmosphereVisibility();
  if(pendingPlacement){finishPlacement(null);return;}
  const anniversaryCard=$('#anniversary-card');if(anniversaryCard?.open){anniversaryCard.close();return;}
  if(activeDialog){closeStory();return;}
  pendingStory=null;activePlace=null;props.setMailboxOpen(false,{immediate:reducedMotion});shadowUntil=elapsed+1.7;hideHint();
  $('#return-view').hidden=true;controls.enabled=true;
  if(savedView){
    const old=savedView;savedView=null;currentView=old.view;caption(currentView);
    if(old.width!==innerWidth||old.height!==innerHeight){frame('hero',true);return;}
    moveTo(old.position,old.target,{duration:1.45,min:old.min});
  }else frame('hero',true);
}
function showStory(kind){
  neuralFireflies.selectFly(-1);
  setTour(false);
  if(activePlace!==kind||phase!=='exploring'||contentEditorOpen)return;
  const dialog=$(kind==='ribbon'?'#memory-dialog':'#letter-dialog');
  const point=anchors[kind].clone().project(camera);
  const surface=dialog.querySelector('.story-surface');
  surface.style.setProperty('--origin-x',`${50+point.x*45}%`);
  surface.style.setProperty('--origin-y',`${50-point.y*45}%`);
  activeDialog=dialog;controls.enabled=false;dialog.classList.remove('is-closing');dialog.showModal();
  updateAtmosphereVisibility();
  overlayReadyAt=performance.now()+(reducedMotion?0:kind==='ribbon'?1050:850);requestSceneFrame();
  if(kind==='ribbon')ribbonPresentation=presentRibbon(dialog,{x:(point.x*.5+.5)*innerWidth,y:(-.5*point.y+.5)*innerHeight},{reducedMotion});
  dialog.querySelector('.close-story').focus({preventScroll:true});
}
function discover(kind){
  if(phase!=='exploring'||activeDialog||closing||contentEditorOpen||pendingPlacement)return;
  clearPetals();setTour(false);telescopeGaze.hidden=true;
  if(kind==='sky'){
    closeHelp();hideHint();setTour(false);savedView??=snapshot();activePlace='sky';
    $('#return-view').hidden=false;frame('sky',true);announce('抬头看太阳和云，点回到初见可返回。');return;
  }
  if(kind==='sound'){closeHelp();hideHint();setTour(false);gardenAudio.open();return;}
  if(kind==='anniversary'){milestone.open();return;}
  if(kind==='archive'||kind==='create-surprise'||kind.startsWith('surprise:')){
    closeHelp();hideHint();setTour(false);
    surprises.open(kind==='archive'?'archive':kind==='create-surprise'?'create':'surprise',kind.startsWith('surprise:')?kind.slice(9):undefined);
    return;
  }
  if(!Object.hasOwn(anchors,kind)&&kind!=='meadow')return;
  closeHelp();hideHint();setTour(false);pendingStory=null;$('#explore-hint').classList.remove('is-visible');
  savedView??=snapshot();activePlace=kind;$('#return-view').hidden=false;
  const which=kind==='ribbon'?'tree':kind,preset=presets[which];currentView=which;caption(which);
  moveTo(new THREE.Vector3(...preset.position),new THREE.Vector3(...preset.target),{duration:1.5,min:preset.min,done:()=>{
    if(activePlace!==kind)return;
    if(kind==='swing')estateFeatures.swing.nudge();
    if(kind==='campfire')estateFeatures.campfire.stoke();
    if(kind==='telescope')updateTelescopeGaze();
    if(kind==='mailbox'){props.setMailboxOpen(true,{immediate:reducedMotion});shadowUntil=elapsed+1.8;pendingStory={kind,at:elapsed+(reducedMotion?0:.65)};}
    else if(kind==='ribbon')showStory(kind);
  }});
  if(['meadow','swing','picnic','campfire','telescope'].includes(kind)){announce(preset.title);return;}
  announce(kind==='bench'?'坐在长椅上看一会儿风景。':kind==='ribbon'?'走近记忆树的白丝带。':'走近春日里的信箱。');
}
async function closeStory(){
  if(!activeDialog||closing)return;
  const dialog=activeDialog;closing=true;dialog.classList.add('is-closing');
  if(ribbonPresentation&&dialog.id==='memory-dialog')await ribbonPresentation.close({immediate:reducedMotion});
  else if(!reducedMotion)await new Promise(resolve=>setTimeout(resolve,350));
  dialog.close();ribbonPresentation?.dispose();ribbonPresentation=null;
  dialog.classList.remove('is-closing');activeDialog=null;closing=false;
  updateAtmosphereVisibility();
  returnToGarden();$('#help-toggle').focus({preventScroll:true});
}
prepareStories();
prepareContentEditor({
  onChange:prepareStories,
  onOpen:()=>openPanel('content'),onClose:()=>closePanel('content')
});
const gardenAudio=prepareGardenAudio({onOpen:()=>openPanel('sound'),onClose:()=>closePanel('sound')});
const chimes=makeCreekChimes(scene,gardenAudio),gazing=makeStargazing(scene,presets.bench,moveTo,frame);
const telescopeGaze=$('#telescope-gaze'),tourStatus=$('#tour-status');
function updateTelescopeGaze(){
  telescopeGaze.hidden=scenicTour.active||currentView!=='telescope'||gazing.active||phase!=='exploring'||!!activeDialog||contentEditorOpen||!!pendingPlacement||!!flight;
  telescopeGaze.textContent=(canvasUI.dataset.atmosphere||'day')==='day'?'🔭 切换夜幕 · 仰望星海':'🔭 透过望远镜观星';
}
$('#atmosphere-switcher').addEventListener('click',()=>queueMicrotask(updateTelescopeGaze));
telescopeGaze.addEventListener('click',()=>{setTour(false);telescopeGaze.hidden=true;gazing.enter();});
const scenicTour=createScenicTour({camera,controls,moveTo,frame,
  caption(key,w){currentView=key;caption(key);$('#view-title').textContent=w.title;$('#view-note').textContent=w.note;},
  onArrive(key){if(key==='swing')estateFeatures.swing.nudge();if(key==='campfire')estateFeatures.campfire.stoke();},
  onStateChange({active,waypoint}){
    controls.autoRotate=false;
    $('#tour').setAttribute('aria-pressed',String(active));$('#tour').textContent=active?'停在此刻':'缓缓环游';
    tourStatus.hidden=!active;
    if(active){telescopeGaze.hidden=true;$('#tour-chapter').textContent=waypoint.label+' · '+waypoint.title;}
    else {flight=null;controls.enableDamping=true;if(!activePlace&&currentView==='hero')$('#return-view').hidden=true;updateTelescopeGaze();}
    requestSceneFrame();
  }
});
$('#tour-next').addEventListener('click',()=>scenicTour.next());
const milestone=makeMilestone(island,{moveTo,frame,onOpen:()=>openPanel('anniversary'),onClose:()=>closePanel('anniversary'),stargaze:gazing.enter,currentView:()=>currentView});
const surprises=prepareSurprises({
  onOpen:()=>openPanel('surprises'),onClose:()=>closePanel('surprises'),requestPlacement,
  onWorldChange:(records,event)=>{
    surpriseWorld.sync(records,event);
    if(archiveBook){
      const archived=records.filter(record=>record.status==='archived');archiveBook.userData.hasNewArchives=archived.some(record=>!record.archiveSeenAt);
      archivePetal.visible=archiveBook.userData.hasNewArchives;
      for(const [owner,name] of [['purple','lavender-bookmark'],['green','green-bookmark']]){const mark=archiveBook.getObjectByName(name);if(mark)mark.visible=archived.some(record=>record.bookmarks?.[owner]);}
    }
    requestSceneFrame();
  }
});
const placementHint=document.createElement('aside');placementHint.id='placement-hint';placementHint.hidden=true;placementHint.setAttribute('role','status');
const placementText=document.createElement('p');placementText.textContent='轻点草地，放下这份惊喜。拖动仍可环绕花园。';
const placementCancel=document.createElement('button');placementCancel.type='button';placementCancel.textContent='取消选址';placementCancel.addEventListener('click',()=>finishPlacement(null));
placementHint.append(placementText,placementCancel);app.append(placementHint);
function requestPlacement(callback){
  pendingPlacement=callback;closeHelp();hideHint();setTour(false);pendingStory=null;flight=null;controls.enableDamping=true;controls.enabled=true;
  updateAtmosphereVisibility();
  canvasUI.inert=true;placementHint.hidden=false;canvas.dataset.placing='true';canvas.focus({preventScroll:true});
  announce('轻点主岛的草地选择气球位置，按 Esc 取消。');requestSceneFrame();
}
function finishPlacement(point){
  const callback=pendingPlacement;pendingPlacement=null;placementHint.hidden=true;delete canvas.dataset.placing;
  updateAtmosphereVisibility();
  canvasUI.inert=phase!=='exploring';callback?.(point);requestSceneFrame();
}
for(const dialog of document.querySelectorAll('.story-dialog')){
  dialog.querySelector('.close-story').addEventListener('click',closeStory);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeStory();});
  dialog.addEventListener('click',event=>{if(event.target===dialog)closeStory();});
}
$('#wax-seal').addEventListener('click',()=>{
  $('#passphrase-form').hidden=false;$('#wax-seal').setAttribute('aria-expanded','true');$('#passphrase-input').focus();
});
$('#passphrase-form').addEventListener('submit',event=>{event.preventDefault();enter(false);});
$('#passphrase-input').addEventListener('input',()=>{$('#passphrase-input').removeAttribute('aria-invalid');$('#passphrase-error').hidden=true;});
$('#enter-direct').addEventListener('click',()=>enter(true));
$('#skip-intro').addEventListener('click',()=>finishIntro(true));
$('#return-view').addEventListener('click',returnToGarden);
$('#reset').addEventListener('click',()=>{savedView=null;returnToGarden();});
$('#tour').hidden=reducedMotion;
$('#tour').addEventListener('click',()=>{
  if(scenicTour.active){scenicTour.stop();return;}
  if(pendingPlacement||activeDialog||contentEditorOpen)return;
  clearPetals();closeHelp();hideHint();savedView=null;activePlace=null;pendingStory=null;
  props.setMailboxOpen(false,{immediate:reducedMotion});
  $('#return-view').hidden=false;controls.enabled=true;scenicTour.start();
});
$('#help-toggle').addEventListener('click',()=>{const panel=$('#help-panel');panel.hidden=!panel.hidden;$('#help-toggle').setAttribute('aria-expanded',String(!panel.hidden));});
const skyButton=document.createElement('button');skyButton.type='button';skyButton.dataset.place='sky';skyButton.textContent='抬头看看天空 ↗';
$('#help-panel .help-places').append(skyButton);
document.querySelectorAll('[data-place]').forEach(button=>button.addEventListener('click',()=>discover(button.dataset.place)));
$('#replay').addEventListener('click',()=>{
  clearPetals();gardenAudio.stop();intro=null;$('#skip-intro').hidden=true;
  $('#passphrase-form').reset();$('#passphrase-form').hidden=true;$('#passphrase-error').hidden=true;$('#passphrase-input').removeAttribute('aria-invalid');$('#wax-seal').setAttribute('aria-expanded','false');
  closeHelp();savedView=null;pendingStory=null;activePlace=null;flight=null;setTour(false);props.setMailboxOpen(false,{immediate:reducedMotion});shadowUntil=elapsed+1.6;
  $('#return-view').hidden=true;setPhase('invitation');invitation.inert=false;invitation.classList.remove('is-leaving');controls.enabled=false;$('#wax-seal').focus({preventScroll:true});
});
document.addEventListener('pointerdown',event=>{if(!$('#help-panel').contains(event.target)&&!$('#help-toggle').contains(event.target))closeHelp();});
if(!document.fullscreenEnabled)$('#fullscreen').hidden=true;
$('#fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await app.requestFullscreen();}
  catch{announce('浏览器未能进入全屏，你仍可拖动浏览。');}
});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'进入全屏');requestSceneFrame();});
window.addEventListener('keydown',event=>{
  if(phase==='intro'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!['Shift','Control','Alt','Meta','Tab'].includes(event.key)){event.preventDefault();finishIntro(true);return;}
  if(pendingPlacement&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finishPlacement(null);return;}
  if(event.key==='Escape'||event.key.toLowerCase()==='r'){setTour(false);telescopeGaze.hidden=true;}
  if(contentEditorOpen)return;
  if(event.target instanceof HTMLElement&&(/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.target.isContentEditable))return;
  if(event.key==='Escape'){
    if(gazing.active){gazing.leave();return;}
    if(activeDialog)return;
    if(phase==='intro')finishIntro(true);else if(activePlace)returnToGarden();else closeHelp();
  }
  if(event.key.toLowerCase()==='r'&&phase==='exploring'&&!activeDialog){savedView=null;returnToGarden();}
});
controls.addEventListener('start',()=>{
  clearPetals();telescopeGaze.hidden=true;
  flight=null;pendingStory=null;controls.enableDamping=true;setTour(false);hideHint();
  $('#explore-hint').classList.remove('is-visible');
});
controls.addEventListener('change',requestSceneFrame);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestSceneFrame();});

// Direct picking uses the real meshes. A small screen-space tolerance makes
// the delicate ribbon reachable without introducing permanent floating labels.
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
const interactive=[ribbon,...redTies,props.mailbox,props.bench,milestone.plaque,estateFeatures.swing.group,estateFeatures.picnic.group,estateFeatures.campfire.group,estateFeatures.observatory.group,...props.balloons].filter(Boolean);
const occluders=[island.getObjectByName('meadow-and-soil'),island.getObjectByName('weathered-limestone-and-topsoil'),...treeAsset.trunkMeshes,...cabin.walls].filter(Boolean);
function pick(clientX,clientY){
  if(phase!=='exploring'||activeDialog||flight||intro||contentEditorOpen||pendingPlacement)return null;
  mouse.set(clientX/innerWidth*2-1,-clientY/innerHeight*2+1);raycaster.setFromCamera(mouse,camera);
  const hit=raycaster.intersectObjects([...interactive,...surpriseWorld.objects],true)[0];
  if(hit){
    const block=raycaster.intersectObjects(occluders,false)[0];
    if(!block||block.distance>hit.distance-.15){
      let object=hit.object;while(object&&!object.userData.interaction)object=object.parent;
      if(object)return object.userData.interaction;
    }
  }
  let closest=null,distance=28;
  const extraAnchors=surpriseWorld.objects.map(object=>[object.userData.interaction,object.getWorldPosition(new THREE.Vector3())]);
  if(archiveBook)extraAnchors.push(['archive',archiveBook.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.05,0))]);
  extraAnchors.push(['sound',listeningPlayer.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.06,0))]);
  for(const [kind,anchor] of [...Object.entries(anchors),...extraAnchors]){
    const p=anchor.clone().project(camera);if(p.z<0||p.z>1)continue;
    const d=Math.hypot((p.x*.5+.5)*innerWidth-clientX,(-p.y*.5+.5)*innerHeight-clientY);
    if(d>=distance)continue;
    const direction=anchor.clone().sub(camera.position);raycaster.set(camera.position,direction.clone().normalize());
    const block=raycaster.intersectObjects(occluders,false)[0];
    if(block&&block.distance<direction.length()-.55)continue;
    distance=d;closest=kind;
  }
  return closest;
}
let ripplePointerTime=0;
function disturbCreek(event,strength){
  if((reducedMotion&&event.type!=='pointerdown')||phase!=='exploring'||activeDialog||contentEditorOpen||flight||intro||pendingPlacement)return;
  if(strength>-.5&&performance.now()-ripplePointerTime<45)return;
  mouse.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);
  raycaster.setFromCamera(mouse,camera);
  const hit=raycaster.intersectObject(creekSurface,false)[0];
  if(!hit)return;
  const block=raycaster.intersectObjects([...occluders,...interactive],true)[0];
  if(block&&block.distance<hit.distance-.02)return;
  if(event.type==='pointerdown')chimes.strike(hit.point,!reducedMotion);
  if(reducedMotion)return;
  creekRipples.addImpulseWorld(hit.point.x,hit.point.z,.20,strength);
  creekEcology.disturb(hit.point.x,hit.point.z,Math.abs(strength));
  ripplePointerTime=performance.now();
}
let pressed=null;
canvas.addEventListener('pointerdown',event=>{cancelHover();hideHint();if(event.button===0&&phase==='exploring'&&!pendingPlacement&&!contentEditorOpen&&!activeDialog){mouse.set(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2);raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObject(island.getObjectByName('meadow-and-soil'),false)[0];if(hit)neuralFireflies.disturb(hit.point);}
  if(event.button===0)disturbCreek(event,-.55);if(event.button===0)pressed={x:event.clientX,y:event.clientY,id:event.pointerId,moved:false};});
function runHover(event){
  if(!event.buttons)disturbCreek(event,-.16);
  if(gazing.active){
    hideHint();
    mouse.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);raycaster.setFromCamera(mouse,camera);
    if(gazing.hover(!event.buttons&&!flight&&!activeDialog&&!contentEditorOpen?raycaster:null))canvas.dataset.hover='star';
    return;
  }
  if(event.buttons){hideHint();return;}
  if(phase==='exploring'&&!activeDialog&&!contentEditorOpen&&!flight&&!intro){
    mouse.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);raycaster.setFromCamera(mouse,camera);
    const meadowHit=raycaster.intersectObject(island.getObjectByName('meadow-and-soil'),false)[0];
    if(meadowHit){butterflies.disturb(meadowHit.point);neuralFireflies.disturb(meadowHit.point);}
  }
  const kind=pick(event.clientX,event.clientY);if(!kind){hideHint();return;}
  const hint=$('#object-hint');hint.textContent=kind.startsWith('surprise:')?'风里藏着一点惊喜':{swing:'轻推秋千，让春风陪你',picnic:'在草地上，留住午后',campfire:'添一点暖意，等星光落下',telescope:'借望远镜，望向星海',meadow:'走近向日葵的晨光',anniversary:'翻看我们的时光',ribbon:'轻轻展开记忆丝带',mailbox:'这里，有一只信箱',bench:'坐一会儿',archive:archiveBook?.userData.hasNewArchives?'册子里，多了一页收藏':'翻翻长椅上的册子',sound:'听听风和溪水','create-surprise':'留一点小惊喜'}[kind];
  hint.style.left=`${Math.min(event.clientX+18,innerWidth-170)}px`;hint.style.top=`${Math.max(12,event.clientY-37)}px`;hint.hidden=false;canvas.dataset.hover=kind;
}
// Leading execution preserves single-step hover; trailing work uses only the
// final coordinates of a burst. Drag detection and button feedback stay immediate.
const hoverDiagnostics={runs:0,totalMs:0,pending:false};
let hoverLast=-Infinity,hoverTimer=null,hoverLatest=null;
function cancelHover(){
 if(hoverTimer!==null)clearTimeout(hoverTimer);
 hoverTimer=null;hoverLatest=null;hoverLast=-Infinity;hoverDiagnostics.pending=false;
}
function flushHover(){
 hoverTimer=null;const event=hoverLatest;hoverLatest=null;hoverDiagnostics.pending=false;
 if(!event)return;
 hoverLast=performance.now();
 try{runHover(event);}finally{hoverDiagnostics.runs++;hoverDiagnostics.totalMs+=performance.now()-hoverLast;}
}
canvas.addEventListener('pointermove',event=>{
 if(pressed&&Math.hypot(event.clientX-pressed.x,event.clientY-pressed.y)>6)pressed.moved=true;
 if(event.buttons){cancelHover();hideHint();gazing.hover(null);return;}
 hoverLatest={type:event.type,clientX:event.clientX,clientY:event.clientY,buttons:event.buttons};
 const delay=38-(performance.now()-hoverLast);
 if(delay<=0){if(hoverTimer!==null)clearTimeout(hoverTimer);flushHover();}
 else if(hoverTimer===null){hoverDiagnostics.pending=true;hoverTimer=setTimeout(flushHover,delay);}
});
canvas.addEventListener('pointerup',event=>{
  const start=pressed;pressed=null;
  if(start&&start.id===event.pointerId&&!start.moved&&event.button===0){
    if(pendingPlacement){
      mouse.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);raycaster.setFromCamera(mouse,camera);
      const earth=[island.getObjectByName('meadow-and-soil')];
      const hit=raycaster.intersectObjects(earth,false).find(hit=>hit.face?.normal.clone().transformDirection(hit.object.matrixWorld).y>.45&&Math.abs(hit.point.y-ground(hit.point.x,hit.point.z))<.25);
      if(hit&&!onCabinFloor(hit.point.x,hit.point.z))finishPlacement({x:hit.point.x,z:hit.point.z});else announce('这里没有可放置的草地，请轻点主岛的上表面。');
      return;
    }
    if(gazing.active){
      mouse.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);raycaster.setFromCamera(mouse,camera);
      if(!flight)gazing.pick(raycaster);return;
    }
    if(phase==='exploring'&&!activeDialog&&!contentEditorOpen&&!flight&&neuralFireflies.pick(event.clientX,event.clientY)){setTour(false);return;}
    const kind=pick(event.clientX,event.clientY);if(kind)discover(kind);
  }
});
canvas.addEventListener('pointercancel',()=>{cancelHover();pressed=null;hideHint();});
canvas.addEventListener('pointerleave',()=>{cancelHover();hideHint();gazing.hover(null);});

const queryView=new URLSearchParams(location.search).get('view');
frame(queryView||'hero');
function animate(now){
  requestAnimationFrame(animate);
  const delta=Math.min((now-lastFrame)/1000,.06);lastFrame=now;
  if(document.hidden)return;
  // Once reading covers a settled garden, keep the last frame rather than
  // competing with photo decoding and page transitions for the GPU. Keep the
  // scene clock still as well, so returning never jumps ahead through the wind.
  const covered=Boolean(activeDialog?.open||contentEditorOpen);
  overlayRenderPaused=ready&&covered&&!closing&&!flight&&!intro&&!pendingStory
    &&performance.now()>=overlayReadyAt&&elapsed>=shadowUntil&&stableCameraFrames>=2&&!sceneFrameRequested&&!surpriseWorld.flying;
  if(overlayRenderPaused)return;
  // The settled realm has its own sky. Only its camera and artwork need rendering.
  if(gazing.realm && !flight && currentView==='bench' && !covered && $('#garden-ui').dataset.atmosphere!=='day'){
    controls.update(delta);renderer.render(gazing.realm,camera);renderCount++;return;
  }
  if(!reducedMotion)creekEcology.update(delta,elapsed);
  if(!reducedMotion)creekRipples.update(delta);
  rippleUniforms.uRippleSimTex.value=creekRipples.getTexture();
  benchTime.update(now,delta,reducedMotion);
  cabin.updateSmoke(reducedMotion?0:elapsed);
  estateFeatures.update(reducedMotion?0:elapsed);
  neuralFireflies.update(delta,{warmth:benchTime.warmth,paused:covered||phase!=='exploring'||gazing.active,reducedMotion,available:phase==='exploring'&&!covered&&!pendingPlacement&&!gazing.active});
  gazing.update(currentView,phase==='exploring'&&!covered&&!pendingPlacement,elapsed,renderer,reducedMotion);
  chimes.update(delta);listeningPlayer.userData.update(delta,gardenAudio.musicPlaying&&!reducedMotion);
  elapsed+=delta;time.value=reducedMotion?0:elapsed;
  props.update(reducedMotion?0:elapsed);atmosphere.update?.(reducedMotion?0:elapsed);
  surpriseWorld.update(elapsed);
  if(shadowUntil>elapsed)renderer.shadowMap.needsUpdate=true;
  if(intro){
    const t=Math.min(1,(elapsed-intro.start)/intro.duration);
    // Preserve the first two 3-second stages; quintic braking on the last leg.
    const u=Math.max(0,(t-2/3)*3);
    const s=t<=2/3?t:2/3+(u+4*u**3-7*u**4+3*u**5)/3;
    camera.position.copy(intro.path.position.getPoint(s));controls.target.copy(intro.path.target.getPoint(s));
    if(t===1)finishIntro(false);
  }
  if(petalGuide&&!petalGuide.update(elapsed-petalStart))petalGuide=null;
  if(flight){
    flight.time=flight.cosine?(now-flight.start)/1000:flight.time+Math.min(delta,flight.maxStep);
    const t=Math.min(1,flight.time/flight.duration),s=flight.cosine?(1-Math.cos(Math.PI*t))/2:ease(t);
    camera.position.lerpVectors(flight.from,flight.to,s);controls.target.lerpVectors(flight.fromTarget,flight.toTarget,s);
    if(t===1){const done=flight.done;flight=null;controls.enableDamping=true;done?.();}
  }
  scenicTour.update(delta);
  if(currentView==='telescope'&&!telescopeGaze.hidden)updateTelescopeGaze();
  if(flight||intro)camera.lookAt(controls.target);else controls.update(delta);
  if(gazing.active)fallingFoliage.mesh.visible=false;
  else fallingFoliage.update(delta,{covered,reducedMotion});
  meadow.update(delta,{covered,reducedMotion});
  butterflies.update(delta,{covered,reducedMotion,windTime:fallingFoliage.mesh.userData.wind.clock});
  if(pendingStory&&elapsed>=pendingStory.at){const {kind}=pendingStory;pendingStory=null;showStory(kind);}
  if(hintUntil&&elapsed>hintUntil){hintUntil=0;$('#explore-hint').classList.remove('is-visible');}
  const cameraStill=camera.position.distanceToSquared(renderedPosition)<1e-12
    &&controls.target.distanceToSquared(renderedTarget)<1e-12
    &&1-Math.abs(camera.quaternion.dot(renderedRotation))<1e-12;
  stableCameraFrames=cameraStill?stableCameraFrames+1:0;
  renderedPosition.copy(camera.position);renderedTarget.copy(controls.target);renderedRotation.copy(camera.quaternion);
  lighting.render(delta);
  renderCount++;sceneFrameRequested=false;
  if(!ready){
    ready=true;document.documentElement.dataset.sceneReady='true';$('#loading').classList.add('is-ready');$('#enter').disabled=false;$('#wax-seal').disabled=false;$('#enter-direct').hidden=false;
  }
}
await Promise.all([renderer.compileAsync(scene,camera),gardenAudio.ready]);
renderer.shadowMap.needsUpdate=true;lastFrame=performance.now();requestAnimationFrame(animate);
renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();const error=$('#scene-error');error.hidden=false;error.textContent='画面暂时中断了，请刷新页面重新打开花园。';
});
renderer.domElement.addEventListener('webglcontextrestored',()=>{
  requestSceneFrame();renderer.shadowMap.needsUpdate=true;lastFrame=performance.now();$('#scene-error').hidden=true;
});
window.addEventListener('resize',()=>{
  requestSceneFrame();
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.setSize(innerWidth,innerHeight);
  lighting.resize(innerWidth,innerHeight);
  if(currentView==='hero'&&!intro&&!activePlace&&!scenicTour.active)frame('hero');
});
motionQuery.addEventListener('change',event=>{
  requestSceneFrame();
  reducedMotion=event.matches;
  fallingFoliage.setReducedMotion(reducedMotion);
  butterflies.setReducedMotion(reducedMotion);
  if(reducedMotion)clearPetals();
  $('#tour').hidden=reducedMotion;
  if(reducedMotion)props.setMailboxOpen(props.mailbox.userData.open,{immediate:true});
  if(reducedMotion){setTour(false);if(intro)finishIntro(false);if(flight){const f=flight;moveTo(f.to,f.toTarget,{duration:0,min:controls.minDistance,done:f.done});}}
});
if(import.meta.env.DEV)window.__PU={
  setAtmosphere(mode){
    const button=Array.from($('#atmosphere-switcher').querySelectorAll('[data-atmo]')).find(b=>b.dataset.atmo===mode);
    button?.click();
  },
  getAtmosphere(){return $('#garden-ui').dataset.atmosphere||'day';},
  hoverDiagnostics,neuralFireflies,ground,inside,scenicTour,presets,estateFeatures,gazing,creekEcology,creekRipples,meadow,butterflies,camera,controls,renderer,frame,statistics,waterStatistics,points,target,scene,props,anchors,treeAsset,lighting,occluders,interactive,discover,enter,returnToGarden,surpriseWorld,surprises,gardenAudio,listeningPlayer,archiveBook,get placementPending(){return Boolean(pendingPlacement);},get currentView(){return currentView;},get flying(){return !!flight||!!intro;},get phase(){return phase;},get activePlace(){return activePlace;},get overlayRenderPaused(){return overlayRenderPaused;},get renderCount(){return renderCount;},get sceneTime(){return elapsed;}};
