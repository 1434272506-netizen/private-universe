import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeLand,ground} from './land.js';
import {makePlants} from './plants.js';
import {makeWater} from './water.js';
import {makeProps} from './props.js';
import {makeAtmosphere} from './atmosphere.js';
import {prepareStories} from '../stories.js';
import {makeLighting} from './lighting.js';
import {loadCenterpieceTree} from './loveTree.js';
import {presentRibbon} from '../ribbon-transition.js';
import {prepareContentEditor} from '../content-editor.js';

const $=selector=>document.querySelector(selector);
const app=$('#app'),canvasUI=$('#garden-ui'),invitation=$('#invitation');
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion=motionQuery.matches;
const time={value:0},scene=new THREE.Scene();
scene.fog=new THREE.FogExp2('#d0e1e7',.0045);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
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
const camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.15,260);
const controls=new OrbitControls(camera,canvas);
Object.assign(controls,{enabled:false,enableDamping:true,dampingFactor:.065,enablePan:false,minDistance:13,maxDistance:55,minPolarAngle:.24,maxPolarAngle:1.38,rotateSpeed:.42,zoomSpeed:.6,autoRotateSpeed:.16});

const atmosphere=makeAtmosphere(scene,renderer,time);
scene.add(new THREE.HemisphereLight('#eaf0e9','#657651',1.05));
const sun=new THREE.DirectionalLight('#fff0d9',3.15);
sun.position.set(-9,14,8);sun.castShadow=true;
sun.shadow.mapSize.set(4096,4096);
Object.assign(sun.shadow.camera,{left:-13,right:13,top:12,bottom:-12,near:1,far:48});
sun.shadow.normalBias=.018;sun.shadow.bias=-.00012;sun.shadow.radius=3;
scene.add(sun);
const fill=new THREE.DirectionalLight('#d3e3ed',.40);fill.position.set(6,3,-8);scene.add(fill);

const island=makeLand(scene);
$('#loading').textContent='春风经过树梢，花园就快醒来了。';
const treeAsset=await loadCenterpieceTree(island,time);
const statistics={...makePlants(island,time,{includeTree:false}),...treeAsset.statistics};
const waterStatistics=makeWater(island,time),props=makeProps(island,time);
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
const ribbon=island.getObjectByName('memory-ribbon');
const anchors={
  ribbon:new THREE.Vector3(...(statistics.ribbonAnchor||[-2.64,3.49,.69])),
  mailbox:props.mailbox.position.clone().add(new THREE.Vector3(0,1.42,.2)),
  bench:props.bench.position.clone().add(new THREE.Vector3(0,.7,0))
};
const presets={
  tree:{target:[-3.4,2.5,.1],position:[-.3,4.3,9.3],min:6.8,title:'记忆，系在枝头。',note:'The memory ribbon.'},
  mailbox:{target:[4.65,1.65,-1.9],position:[6.2,3.25,3.9],min:4.3,title:'写给彼此的春天。',note:'Letters between us.'},
  bench:{target:[-3.6,.8,-2.6],position:[4.2,ground(4.2,1.5)+1.28,2.7],min:7,title:'坐一会儿，春天还很长。',note:'Stay a little longer.'},
  creek:{target:[1.65,.65,.9],position:[10.7,7.6,13.2],min:8,title:'溪水经过。',note:'Let the afternoon flow.'}
};
const treeWidth=treeAsset.bounds.getSize(new THREE.Vector3()).x;
const ribbonTarget=anchors.ribbon.clone().add(new THREE.Vector3(-.15,-.08,0));
const treeViewOffset=new THREE.Vector3(.32,.12,.94).normalize().multiplyScalar(THREE.MathUtils.clamp(treeWidth*.78,7.8,10.5));
Object.assign(presets.tree,{target:ribbonTarget.toArray(),position:ribbonTarget.clone().add(treeViewOffset).toArray(),min:6.8});
let elapsed=0,lastFrame=performance.now(),ready=false,phase='invitation';
let currentView='hero',flight=null,intro=null,savedView=null,pendingStory=null,activePlace=null,activeDialog=null;
let shadowUntil=0,hintUntil=0,closing=false;
let ribbonPresentation=null;
let contentEditorOpen=false;
let sceneFrameRequested=true,overlayRenderPaused=false,overlayReadyAt=0,stableCameraFrames=0,renderCount=0;
const renderedPosition=camera.position.clone(),renderedTarget=controls.target.clone(),renderedRotation=camera.quaternion.clone();
function requestSceneFrame(){sceneFrameRequested=true;}
const ease=t=>t*t*t*(t*(t*6-15)+10);
function announce(text){$('#announcement').textContent=text;}
function setPhase(next){phase=next;app.dataset.phase=next;canvasUI.inert=next!=='exploring';}
function setTour(active){controls.autoRotate=active&&!reducedMotion;$('#tour').setAttribute('aria-pressed',String(controls.autoRotate));$('#tour').textContent=controls.autoRotate?'停在此刻':'缓缓环游';}
function hideHint(){$('#object-hint').hidden=true;delete canvas.dataset.hover;}
function closeHelp(){$('#help-panel').hidden=true;$('#help-toggle').setAttribute('aria-expanded','false');}
function caption(which){
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
function moveTo(position,lookAt,{duration=1.65,min=13,done=null}={}){
  controls.enableDamping=false;controls.update();
  const limits={minDistance:min,maxPolarAngle:currentView==='bench'?1.46:1.38,maxDistance:Math.max(55,position.distanceTo(lookAt)*1.12)};
  const finish=()=>{Object.assign(controls,limits);controls.enableDamping=true;done?.();};
  if(reducedMotion||duration===0){
    flight=null;camera.position.copy(position);controls.target.copy(lookAt);Object.assign(controls,limits);controls.update();finish();
  }else{
    // Allow both endpoints until the camera has arrived; clamping to the
    // overview's minimum distance early would make a close view jump away.
    controls.minDistance=Math.min(min,camera.position.distanceTo(controls.target));
    controls.maxPolarAngle=Math.max(limits.maxPolarAngle,controls.getPolarAngle());
    controls.maxDistance=Math.max(limits.maxDistance,camera.position.distanceTo(controls.target));
    flight={from:camera.position.clone(),to:position.clone(),fromTarget:controls.target.clone(),toTarget:lookAt.clone(),start:elapsed,duration,done:finish};
  }
}
function frame(which='hero',smooth=false){
  if(!Object.hasOwn(directions,which)&&!Object.hasOwn(presets,which))which='hero';
  setTour(false);currentView=which;caption(which);
  const preset=presets[which];
  moveTo(preset?new THREE.Vector3(...preset.position):fitPosition(which),preset?new THREE.Vector3(...preset.target):target,{duration:smooth?1.65:0,min:preset?.min||13});
}
function finishIntro(smooth=true){
  intro=null;$('#skip-intro').hidden=true;controls.enabled=true;setPhase('exploring');
  frame('hero',smooth);hintUntil=elapsed+7;
  $('#explore-hint').classList.add('is-visible');
  canvas.focus({preventScroll:true});
}
function enter(direct=false){
  if(!ready||phase!=='invitation')return;
  invitation.classList.add('is-leaving');invitation.inert=true;
  if(direct||reducedMotion){finishIntro(false);return;}
  setPhase('intro');controls.enabled=false;controls.enableDamping=false;controls.minDistance=.5;
  const from=new THREE.Vector3(-.6,4.2,11.6),fromTarget=new THREE.Vector3(-2,1.35,-.2);
  camera.position.copy(from);controls.target.copy(fromTarget);controls.update();
  intro={start:elapsed,duration:9,from,fromTarget,to:fitPosition('hero')};$('#skip-intro').hidden=false;$('#skip-intro').focus({preventScroll:true});
}
function snapshot(){return {position:camera.position.clone(),target:controls.target.clone(),min:controls.minDistance,view:currentView,width:innerWidth,height:innerHeight};}
function returnToGarden(){
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
  if(activePlace!==kind||phase!=='exploring'||contentEditorOpen)return;
  const dialog=$(kind==='ribbon'?'#memory-dialog':'#letter-dialog');
  const point=anchors[kind].clone().project(camera);
  const surface=dialog.querySelector('.story-surface');
  surface.style.setProperty('--origin-x',`${50+point.x*45}%`);
  surface.style.setProperty('--origin-y',`${50-point.y*45}%`);
  activeDialog=dialog;controls.enabled=false;dialog.classList.remove('is-closing');dialog.showModal();
  overlayReadyAt=performance.now()+(reducedMotion?0:kind==='ribbon'?1050:850);requestSceneFrame();
  if(kind==='ribbon')ribbonPresentation=presentRibbon(dialog,{x:(point.x*.5+.5)*innerWidth,y:(-.5*point.y+.5)*innerHeight},{reducedMotion});
  dialog.querySelector('.close-story').focus({preventScroll:true});
}
function discover(kind){
  if(!Object.hasOwn(anchors,kind)||phase!=='exploring'||activeDialog||closing||contentEditorOpen)return;
  closeHelp();hideHint();setTour(false);pendingStory=null;$('#explore-hint').classList.remove('is-visible');
  savedView??=snapshot();activePlace=kind;$('#return-view').hidden=false;
  const which=kind==='ribbon'?'tree':kind,preset=presets[which];currentView=which;caption(which);
  moveTo(new THREE.Vector3(...preset.position),new THREE.Vector3(...preset.target),{duration:1.5,min:preset.min,done:()=>{
    if(activePlace!==kind)return;
    if(kind==='mailbox'){props.setMailboxOpen(true,{immediate:reducedMotion});shadowUntil=elapsed+1.8;pendingStory={kind,at:elapsed+(reducedMotion?0:.65)};}
    else if(kind==='ribbon')showStory(kind);
  }});
  announce(kind==='bench'?'坐在长椅上看一会儿风景。':kind==='ribbon'?'走近记忆树的白丝带。':'走近春日里的信箱。');
}
async function closeStory(){
  if(!activeDialog||closing)return;
  const dialog=activeDialog;closing=true;dialog.classList.add('is-closing');
  if(ribbonPresentation&&dialog.id==='memory-dialog')await ribbonPresentation.close({immediate:reducedMotion});
  else if(!reducedMotion)await new Promise(resolve=>setTimeout(resolve,350));
  dialog.close();ribbonPresentation?.dispose();ribbonPresentation=null;
  dialog.classList.remove('is-closing');activeDialog=null;closing=false;
  returnToGarden();$('#help-toggle').focus({preventScroll:true});
}
prepareStories();
prepareContentEditor({
  onChange:prepareStories,
  onOpen:()=>{contentEditorOpen=true;overlayReadyAt=performance.now();requestSceneFrame();closeHelp();hideHint();setTour(false);pendingStory=null;controls.enabled=false;},
  onClose:()=>{contentEditorOpen=false;requestSceneFrame();controls.enabled=phase==='exploring'&&!activeDialog;}
});
for(const dialog of document.querySelectorAll('.story-dialog')){
  dialog.querySelector('.close-story').addEventListener('click',closeStory);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeStory();});
  dialog.addEventListener('click',event=>{if(event.target===dialog)closeStory();});
}
$('#enter').addEventListener('click',()=>enter(false));
$('#enter-direct').addEventListener('click',()=>enter(true));
$('#skip-intro').addEventListener('click',()=>finishIntro(true));
$('#return-view').addEventListener('click',returnToGarden);
$('#reset').addEventListener('click',()=>{savedView=null;returnToGarden();});
$('#tour').hidden=reducedMotion;
$('#tour').addEventListener('click',()=>{
  if(activePlace){
    returnToGarden();
    if(flight){const finish=flight.done;flight.done=()=>{finish?.();setTour(true);};return;}
  }else flight=null;
  controls.enableDamping=true;setTour(!controls.autoRotate);
});
$('#help-toggle').addEventListener('click',()=>{const panel=$('#help-panel');panel.hidden=!panel.hidden;$('#help-toggle').setAttribute('aria-expanded',String(!panel.hidden));});
document.querySelectorAll('[data-place]').forEach(button=>button.addEventListener('click',()=>discover(button.dataset.place)));
$('#replay').addEventListener('click',()=>{
  closeHelp();savedView=null;pendingStory=null;activePlace=null;flight=null;setTour(false);props.setMailboxOpen(false,{immediate:reducedMotion});shadowUntil=elapsed+1.6;
  $('#return-view').hidden=true;setPhase('invitation');invitation.inert=false;invitation.classList.remove('is-leaving');controls.enabled=false;$('#enter').focus({preventScroll:true});
});
document.addEventListener('pointerdown',event=>{if(!$('#help-panel').contains(event.target)&&!$('#help-toggle').contains(event.target))closeHelp();});
if(!document.fullscreenEnabled)$('#fullscreen').hidden=true;
$('#fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await app.requestFullscreen();}
  catch{announce('浏览器未能进入全屏，你仍可拖动浏览。');}
});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'进入全屏');requestSceneFrame();});
window.addEventListener('keydown',event=>{
  if(contentEditorOpen)return;
  if(event.target instanceof HTMLElement&&(/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.target.isContentEditable))return;
  if(event.key==='Escape'){
    if(activeDialog)return;
    if(phase==='intro')finishIntro(true);else if(activePlace)returnToGarden();else closeHelp();
  }
  if(event.key.toLowerCase()==='r'&&phase==='exploring'&&!activeDialog){savedView=null;returnToGarden();}
});
controls.addEventListener('start',()=>{
  flight=null;pendingStory=null;controls.enableDamping=true;setTour(false);hideHint();
  $('#explore-hint').classList.remove('is-visible');
});
controls.addEventListener('change',requestSceneFrame);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestSceneFrame();});

// Direct picking uses the real meshes. A small screen-space tolerance makes
// the delicate ribbon reachable without introducing permanent floating labels.
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
const interactive=[ribbon,props.mailbox,props.bench].filter(Boolean);
const occluders=[island.getObjectByName('meadow-and-soil'),island.getObjectByName('weathered-limestone-and-topsoil'),...treeAsset.trunkMeshes].filter(Boolean);
function pick(clientX,clientY){
  if(phase!=='exploring'||activeDialog||flight||intro||contentEditorOpen)return null;
  mouse.set(clientX/innerWidth*2-1,-clientY/innerHeight*2+1);raycaster.setFromCamera(mouse,camera);
  const hit=raycaster.intersectObjects(interactive,true)[0];
  if(hit){
    const block=raycaster.intersectObjects(occluders,false)[0];
    if(!block||block.distance>hit.distance-.15){
      let object=hit.object;while(object&&!object.userData.interaction)object=object.parent;
      if(object)return object.userData.interaction;
    }
  }
  let closest=null,distance=28;
  for(const [kind,anchor] of Object.entries(anchors)){
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
let pressed=null;
canvas.addEventListener('pointerdown',event=>{if(event.button===0)pressed={x:event.clientX,y:event.clientY,id:event.pointerId,moved:false};});
canvas.addEventListener('pointermove',event=>{
  if(pressed&&Math.hypot(event.clientX-pressed.x,event.clientY-pressed.y)>6)pressed.moved=true;
  if(event.buttons){hideHint();return;}
  const kind=pick(event.clientX,event.clientY);if(!kind){hideHint();return;}
  const hint=$('#object-hint');hint.textContent={ribbon:'轻轻展开白丝带',mailbox:'这里，有一只信箱',bench:'坐一会儿'}[kind];
  hint.style.left=`${Math.min(event.clientX+18,innerWidth-170)}px`;hint.style.top=`${Math.max(12,event.clientY-37)}px`;hint.hidden=false;canvas.dataset.hover=kind;
});
canvas.addEventListener('pointerup',event=>{
  const start=pressed;pressed=null;
  if(start&&start.id===event.pointerId&&!start.moved&&event.button===0){const kind=pick(event.clientX,event.clientY);if(kind)discover(kind);}
});
canvas.addEventListener('pointercancel',()=>{pressed=null;hideHint();});
canvas.addEventListener('pointerleave',hideHint);

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
    &&performance.now()>=overlayReadyAt&&elapsed>=shadowUntil&&stableCameraFrames>=2&&!sceneFrameRequested;
  if(overlayRenderPaused)return;
  elapsed+=delta;time.value=reducedMotion?0:elapsed;
  props.update(reducedMotion?0:elapsed);atmosphere.update?.(reducedMotion?0:elapsed);
  if(shadowUntil>elapsed)renderer.shadowMap.needsUpdate=true;
  if(intro){
    const t=Math.min(1,(elapsed-intro.start)/intro.duration),s=ease(t);
    camera.position.lerpVectors(intro.from,intro.to,s);controls.target.lerpVectors(intro.fromTarget,target,s);
    if(t===1)finishIntro(false);
  }
  if(flight){
    const t=Math.min(1,(elapsed-flight.start)/flight.duration),s=ease(t);
    camera.position.lerpVectors(flight.from,flight.to,s);controls.target.lerpVectors(flight.fromTarget,flight.toTarget,s);
    if(t===1){const done=flight.done;flight=null;controls.enableDamping=true;done?.();}
  }
  if(flight||intro)camera.lookAt(controls.target);else controls.update(delta);
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
    ready=true;document.documentElement.dataset.sceneReady='true';$('#loading').classList.add('is-ready');$('#enter').disabled=false;$('#enter-direct').hidden=false;
  }
}
await renderer.compileAsync(scene,camera);
renderer.shadowMap.needsUpdate=true;lastFrame=performance.now();requestAnimationFrame(animate);
renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();const error=$('#scene-error');error.hidden=false;error.textContent='画面暂时中断了，请刷新页面重新打开花园。';
});
renderer.domElement.addEventListener('webglcontextrestored',()=>{
  requestSceneFrame();renderer.shadowMap.needsUpdate=true;lastFrame=performance.now();$('#scene-error').hidden=true;
});
window.addEventListener('resize',()=>{
  requestSceneFrame();
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
  lighting.resize(innerWidth,innerHeight);
  if(intro)intro.to=fitPosition('hero');
  if(currentView==='hero'&&!intro&&!activePlace)frame('hero');
});
motionQuery.addEventListener('change',event=>{
  requestSceneFrame();
  reducedMotion=event.matches;
  $('#tour').hidden=reducedMotion;
  if(reducedMotion)props.setMailboxOpen(props.mailbox.userData.open,{immediate:true});
  if(reducedMotion){setTour(false);if(intro)finishIntro(false);if(flight){const f=flight;moveTo(f.to,f.toTarget,{duration:0,min:controls.minDistance,done:f.done});}}
});
if(import.meta.env.DEV)window.__PU={camera,controls,renderer,frame,statistics,waterStatistics,points,target,scene,props,anchors,treeAsset,lighting,occluders,interactive,discover,enter,returnToGarden,get currentView(){return currentView;},get flying(){return !!flight||!!intro;},get phase(){return phase;},get activePlace(){return activePlace;},get overlayRenderPaused(){return overlayRenderPaused;},get renderCount(){return renderCount;},get sceneTime(){return elapsed;}};
