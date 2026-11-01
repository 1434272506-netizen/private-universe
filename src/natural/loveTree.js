import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ground} from './land.js';
import {createAnchoredRibbon} from './ribbon.js';

/** Load the authored asset before the garden registers views and interactions. */
export async function loadCenterpieceTree(parent,time,{url=`${import.meta.env.BASE_URL}models/love-tree.glb`}={}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),45000);
  let gltf;
  try{
    const response=await fetch(url,{signal:controller.signal});
    if(!response.ok)throw new Error(`Tree asset request failed (${response.status})`);
    gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),new URL('.',new URL(url,location.href)).href);
  }finally{clearTimeout(timeout);}

  const tree=gltf.scene;
  tree.name='centerpiece-love-tree';
  tree.position.set(-4.1,ground(-4.1,-.6),-.6);
  const anchor=tree.getObjectByName('RibbonAnchor');
  if(!anchor)throw new Error('Tree asset must contain RibbonAnchor');
  const trunkMeshes=[];
  let triangles=0,leafMeshes=0;
  tree.traverse(object=>{
    if(!object.isMesh)return;
    triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;
    object.castShadow=true;object.receiveShadow=true;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    const isFoliage=materials.some(material=>/leaves|foliage/i.test(material?.name??''))||/leaves|foliage/i.test(object.name);
    if(isFoliage){
      leafMeshes++;object.userData.gardenFoliage=true;
      for(const material of materials){
        material.alphaTest=.45;material.transparent=false;material.depthWrite=true;
        material.side=THREE.DoubleSide;material.roughness=.88;
        material.color.multiply(new THREE.Color().setRGB(1.04,1.035,.96));
        if(object.geometry.attributes.uv)injectLeafShader(material,time);
      }
    }else{
      trunkMeshes.push(object);
      for(const material of materials){
        material.roughness=.95;
        material.color.multiply(new THREE.Color().setRGB(.82,.71,.57));
      }
    }
  });
  if(!trunkMeshes.length||!leafMeshes)throw new Error('Tree asset requires bark and foliage meshes');
  parent.add(tree);parent.updateWorldMatrix(true,true);
  const ribbon=createAnchoredRibbon(anchor,time);
  parent.updateWorldMatrix(true,true);
  const ribbonAnchor=ribbon.getWorldPosition(new THREE.Vector3());
  const bounds=new THREE.Box3().setFromObject(tree);
  const statistics={treeType:'authored-mtree',treeTriangles:Math.round(triangles),leafMeshes,ribbonAnchor:ribbonAnchor.toArray()};
  return {tree,ribbon,anchor,trunkMeshes,bounds,statistics};
}

function injectLeafShader(material,time){
  material.onBeforeCompile=shader=>{
    shader.uniforms.uTime=time;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        float leafFlex=uv.y*uv.y;
        float leafSway=sin(uTime*.95+position.x*.8+position.z*.7)*.018*leafFlex;
        transformed.x+=leafSway;
        transformed.z+=leafSway*.55;
      `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      #if NUM_DIR_LIGHTS > 0
        // Wrapped transmission admits light through thin, two-sided leaves.
        // Forward scattering increases toward the sun rather than flattening
        // the whole canopy with a constant emissive lift.
        float throughLight=pow(clamp((dot(-normal,directionalLights[0].direction)+.3)/1.3,0.0,1.0),1.25);
        float forwardScatter=pow(max(dot(-geometryViewDir,directionalLights[0].direction),0.0),3.0);
        outgoingLight+=diffuseColor.rgb*directionalLights[0].color
          *vec3(.12,.16,.05)*throughLight*(.45+.55*forwardScatter);
      #endif
      outgoingLight+=diffuseColor.rgb*vec3(.028,.040,.012);
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey=()=> 'love-tree-leaves-spring-v2';
}
