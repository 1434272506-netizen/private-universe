import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {mesh} from './shared.js';

export function addRibbon(parent,x,y,z,time){
  const pieces=[];
  const strip=(points,width,lengthwiseFlex=1)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const vertices=[],uv=[],flex=[],ids=[],steps=36;
    for(let j=0;j<=steps;j++){
      const t=j/steps,p=curve.getPoint(t),tangent=curve.getTangent(t);
      const cross=new THREE.Vector3(-tangent.y,tangent.x,.12*Math.sin(t*5)).normalize();
      const w=width*(.92+.08*Math.sin(t*8));
      for(const side of [-1,1]){
        vertices.push(p.x+cross.x*w*side*.5,p.y+cross.y*w*side*.5,p.z+cross.z*w*side*.5);
        uv.push((side+1)*.5,t);flex.push(t*t*lengthwiseFlex);
      }
    }
    for(let j=0;j<steps;j++){const a=j*2;ids.push(a,a+1,a+2,a+1,a+3,a+2);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('silkFlex',new THREE.Float32BufferAttribute(flex,1));
    g.setIndex(ids);g.computeVertexNormals();pieces.push(g);
  };
  strip([[0,0,.04],[-.14,.14,.08],[-.30,.09,.05],[-.21,-.04,.06],[0,-.015,.05]],.07,.08);
  strip([[0,0,.05],[.15,.13,.10],[.28,.07,.08],[.19,-.06,.06],[0,-.015,.05]],.07,.08);
  strip([[-.025,-.015,.06],[-.10,-.30,.10],[-.04,-.61,.16],[-.16,-1.04,.22]],.105,1);
  strip([[.025,-.015,.065],[.14,-.25,.10],[.12,-.53,.18],[.22,-.82,.20]],.09,.8);
  const knot=new THREE.SphereGeometry(1,12,8);knot.scale(.061,.045,.036);knot.translate(0,-.015,.07);
  knot.setAttribute('silkFlex',new THREE.Float32BufferAttribute(new Float32Array(knot.attributes.position.count),1));pieces.push(knot);
  const geometry=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
  const silk=new THREE.MeshPhysicalMaterial({color:'#faf9f0',roughness:.63,metalness:0,sheen:.30,sheenRoughness:.85,sheenColor:'#fff9eb',side:THREE.DoubleSide});
  silk.onBeforeCompile=shader=>{
    shader.uniforms.uTime=time;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;attribute float silkFlex;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        transformed.x+=sin(uTime*.85+position.y*2.)*.055*silkFlex;
        transformed.z+=sin(uTime*1.07+position.y*2.4)*.045*silkFlex;
      `);
  };
  silk.customProgramCacheKey=()=> 'branch-silk-ribbon-v1';
  const ribbon=mesh(parent,geometry,silk,x,y,z);ribbon.name='memory-ribbon';
  ribbon.castShadow=false;ribbon.userData.interaction='ribbon';
  return ribbon;
}

export function createAnchoredRibbon(anchor,time){
  const ribbon=addRibbon(anchor,0,0,0,time);
  const scale=anchor.getWorldScale(new THREE.Vector3());
  ribbon.scale.set(1/scale.x,1/scale.y,1/scale.z);
  return ribbon;
}
