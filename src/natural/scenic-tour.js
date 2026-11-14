import * as THREE from 'three';

const waypoints=[
  {key:'meadow',title:'风过金浪，向日葵正仰望晨光。',note:'Sunflowers & lavender in bloom.',position:[-20.5,2.35,6.8],target:[-16.2,1.35,1.8],drift:[.8,.25,-.4],min:3.8},
  {key:'swing',title:'秋千轻荡，春风都在耳畔。',note:'Swaying in the breeze together.',position:[-10.8,2.3,.85],target:[-15.5,2.05,-2],drift:[-.45,.15,-.25],min:3.6},
  {key:'tree',title:'记忆系在枝头，星轨见证时光。',note:'Astrolabe & the memory ribbon.',position:[-8.2,3.6,5.2],target:[-11.5,2.2,-3.2],drift:[.6,.3,.2],min:5.5},
  {key:'waterfall',title:'穿过木拱桥，水落进云里生出虹。',note:'Where creek meets the clouds.',position:[4.2,1.2,11.2],target:[.8,-.6,3.5],drift:[-.9,.3,-.3],min:3.5},
  {key:'campfire',title:'吉他、野餐毯与炉边微光。',note:'Warm embers under our sky.',position:[15.8,2.05,3.6],target:[13.9,.85,-.3],drift:[-.4,.12,-.5],min:3.2},
  {key:'telescope',title:'顺着黄铜望远镜，仰望这片星海。',note:'Toward the crescent moon and aurora.',position:[13.6,1.9,6.4],target:[19.4,3.55,-1.2],drift:[.3,.28,-.35],min:1.8},
  {key:'hero',title:'风很轻，日子很慢。',note:'Somewhere, just for us.',position:'hero',target:'hero',drift:[0,0,0],min:13}
].map((w,i)=>Object.freeze({...w,label:`0${i+1} / 07`}));

export function createScenicTour({moveTo,frame,caption,onArrive=()=>{},onStateChange=()=>{},camera,controls}) {
  let active=false,index=-1,arrived=false,dwell=0,generation=0,origin;
  const notify=()=>onStateChange({active,index,waypoint:waypoints[index]});
  function go(i){
    index=i;arrived=false;dwell=0;
    const token=++generation,w=waypoints[i];
    caption(w.key,w);notify();
    const done=()=>{
      if(!active||token!==generation)return;
      arrived=true;origin=camera?.position.clone();onArrive(w.key);
    };
    const options={duration:2.3,cosine:true,min:w.min,done};
    if(w.key==='hero')frame('hero',true,{...options,tour:true});
    else moveTo(new THREE.Vector3(...w.position),new THREE.Vector3(...w.target),options);
  }
  function stop(){
    if(!active)return;
    active=false;arrived=false;++generation;notify();
  }
  return {
    start(startIndex=0){active=true;go(Math.max(0,Math.min(6,Math.floor(startIndex)||0)));},
    next(){if(!active)return;if(index===6)stop();else go(index+1);},
    stop,
    update(delta){
      if(!active||!arrived)return;
      dwell+=Math.max(0,delta);
      if(camera&&controls&&origin){
        const amount=.10*(1-Math.cos(Math.PI*Math.min(1,dwell/3.2)));
        camera.position.copy(origin).addScaledVector(new THREE.Vector3(...waypoints[index].drift),amount);
      }
      if(dwell>=3.2){if(index===6)stop();else go(index+1);}
    },
    get active(){return active;},get index(){return index;}
  };
}
