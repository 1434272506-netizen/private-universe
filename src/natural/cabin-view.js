import * as THREE from 'three';
import {CABIN_SITE,ground} from './land.js';

// One window composition shared by direct discovery and the fifth tour chapter.
const cabinMatrix=new THREE.Matrix4().compose(
  new THREE.Vector3(CABIN_SITE.x,ground(CABIN_SITE.x,CABIN_SITE.z),CABIN_SITE.z),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),CABIN_SITE.yaw),
  new THREE.Vector3(1,1,1)
);
const world=point=>new THREE.Vector3(...point).applyMatrix4(cabinMatrix).toArray();
export const cabinView=Object.freeze({
  // The lower side position is inside the opaque corner logs; stay at the open pane.
  position:world([1.75,1.9,2.35]),target:world([.6,1,-.2]),min:.65,
  title:'屋里炉火正旺，小猪在替我们守着这个家。',
  note:'Warm hearth & sleepy piglet perched on the green-and-lavender sofa.'
});
const portraitView=Object.freeze({...cabinView,position:world([1.8,1.9,2.45]),target:world([1.05,.9,0])});
export const getCabinView=aspect=>aspect<.8?portraitView:cabinView;
