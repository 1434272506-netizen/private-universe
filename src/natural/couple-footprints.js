import {BufferAttribute, BufferGeometry, MathUtils, Vector3} from 'three';
import {creekX} from './land.js';

// Two walkers follow the same bend. Their strides are slightly out of phase.
function footprintSites() {
  const sites = [], end = creekX(2.45) - 1.05;
  for (let step = 0; step < 8; step++) {
    for (const side of [-1, 1]) {
      const t = (step + .09 * side) / 7, arc = Math.PI * t;
      const x = MathUtils.lerp(-3.08, end, t), z = 2.56 - .11*t + .52*Math.sin(arc);
      const angle = Math.atan2(-.11 + .52*Math.PI*Math.cos(arc), end+3.08);
      const spacing = side * (.22 - .025*Math.sin(arc)) + (step%2 ? .047 : -.047);
      const yaw = angle + side*.07;
      sites.push({x:x-Math.sin(angle)*spacing, z:z+Math.cos(angle)*spacing,
        dx:Math.cos(yaw), dz:Math.sin(yaw), length:side<0?.208:.183, width:side<0?.104:.094});
    }
  }
  return sites;
}

// Split shared edges in both adjoining faces. This keeps the close-up relief
// watertight when the seasonal shader lifts the surrounding snow into drifts.
function refineTerrain(source, sites) {
  const channels = Object.entries(source.attributes).map(([name, attr]) =>
    ({name, attr, values:Array.from(attr.array)}));
  const positions = channels.find(channel => channel.name === 'position').values;
  const minX = Math.min(...sites.map(s=>s.x))-.33, maxX = Math.max(...sites.map(s=>s.x))+.33;
  const minZ = Math.min(...sites.map(s=>s.z))-.33, maxZ = Math.max(...sites.map(s=>s.z))+.33;
  let indices = Array.from(source.index.array);
  function interpolate(vertices) {
    const id = positions.length/3;
    for (const {attr, values} of channels) for (let k=0; k<attr.itemSize; k++) {
      let sum=0;
      for(const v of vertices) sum+=values[v*attr.itemSize+k];
      values.push(sum/vertices.length);
    }
    return id;
  }
  for (let pass=0; pass<3; pass++) {
    const edges=new Map(), next=[];
    function midpoint(a,b) {
      const ax=positions[3*a], az=positions[3*a+2], bx=positions[3*b], bz=positions[3*b+2];
      const x=(ax+bx)*.5, z=(az+bz)*.5;
      if(x<minX || x>maxX || z<minZ || z>maxZ || (ax-bx)**2+(az-bz)**2<.052**2) return -1;
      const key=Math.min(a,b)+','+Math.max(a,b);
      if(!edges.has(key)) edges.set(key,interpolate([a,b]));
      return edges.get(key);
    }
    for (let i=0; i<indices.length; i+=3) {
      const a=indices[i], b=indices[i+1], c=indices[i+2];
      const ab=midpoint(a,b), bc=midpoint(b,c), ca=midpoint(c,a);
      if(ab<0 && bc<0 && ca<0) next.push(a,b,c);
      else if(ab>=0 && bc>=0 && ca>=0) next.push(a,ab,ca, ab,b,bc, ca,bc,c, ab,bc,ca);
      else {
        const perimeter=[a,ab,b,bc,c,ca].filter(v=>v>=0), center=interpolate([a,b,c]);
        for(let j=0;j<perimeter.length;j++) next.push(center,perimeter[j],perimeter[(j+1)%perimeter.length]);
      }
    }
    indices=next;
  }
  const geometry=new BufferGeometry();
  for(const {name, attr, values} of channels)
    geometry.setAttribute(name,new BufferAttribute(new attr.array.constructor(values),attr.itemSize,attr.normalized));
  geometry.setIndex(indices);
  const position=geometry.attributes.position, normal=geometry.attributes.normal;
  const depths=new Float32Array(position.count*3), slopes=new Float32Array(depths.length);
  const n=new Vector3(), pressed=new Vector3();
  for(let i=0;i<position.count;i++){
    const x=position.getX(i), z=position.getZ(i);
    if(x<minX || x>maxX || z<minZ || z>maxZ) continue;
    for(const s of sites){
      const dx=x-s.x, dz=z-s.z;
      const along=(dx*s.dx+dz*s.dz)/s.length, across=(dz*s.dx-dx*s.dz)/s.width;
      const bowl=1-along*along-across*across;
      if(bowl<=0) continue;
      depths[3*i+1]=-.063*bowl*bowl;
      const gu=.252*bowl*along/s.length, gv=.252*bowl*across/s.width;
      n.fromBufferAttribute(normal,i).normalize();
      pressed.set(n.x-n.y*(gu*s.dx-gv*s.dz), n.y, n.z-n.y*(gu*s.dz+gv*s.dx));
      pressed.normalize().sub(n).toArray(slopes,3*i);
      break;
    }
  }
  geometry.morphTargetsRelative=true;
  geometry.morphAttributes.position=[new BufferAttribute(depths,3)];
  geometry.morphAttributes.normal=[new BufferAttribute(slopes,3)];
  geometry.morphAttributes.position[0].name='couple-snow-footprints';
  return geometry;
}

export function makeCoupleFootprints(island) {
  const terrain=island.getObjectByName('meadow-and-soil');
  if(!terrain?.geometry?.index) return null;
  const original=terrain.geometry, previousWeights=terrain.morphTargetInfluences, previousNames=terrain.morphTargetDictionary;
  const sites=footprintSites(), geometry=refineTerrain(original,sites);
  terrain.geometry=geometry; terrain.updateMorphTargets();
  return {
    sites,
    update(winter){terrain.morphTargetInfluences[0]=MathUtils.smoothstep(winter,.3,.68);},
    dispose(){
      terrain.geometry=original; terrain.morphTargetInfluences=previousWeights; terrain.morphTargetDictionary=previousNames;
      geometry.dispose();
    }
  };
}
