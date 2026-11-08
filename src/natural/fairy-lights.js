import {glowPoints} from './fireflies.js';
export function fairyLights(time,anchor){
  const positions=[];
  for(let i=0;i<28;i++){
    const t=i/27,a=t*5.3;
    positions.push(anchor.x+2.3*Math.sin(a),anchor.y+.45*Math.cos(a*3),anchor.z+.9*Math.cos(a));
  }
  return glowPoints('branch-fairy-lights',positions,time,'p.x+=.016*sin(clock+phase);',
    'vec3(1.,.76,.39)','90./-mv.z');
}
