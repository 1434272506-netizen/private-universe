import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { creekX, creekSlope, ground, waterY, WATER_END } from './land.js';
import { rng } from './shared.js';

// Pin roots to the rendered riverbed; its triangulation differs slightly from ground().
export function bedSampler(island) {
  const terrain = island.getObjectByName('meadow-and-soil');
  const ray = new THREE.Raycaster(), origin = new THREE.Vector3(), down = new THREE.Vector3();
  island.updateWorldMatrix(true, true);
  return (x, z) => {
    if (!terrain) return ground(x, z);
    origin.set(x, 8, z); island.localToWorld(origin);
    down.set(0, -1, 0).transformDirection(island.matrixWorld);
    ray.set(origin, down);
    const hit = ray.intersectObject(terrain, false)[0];
    return hit ? island.worldToLocal(hit.point).y : ground(x, z);
  };
}

function makeWeeds(root, bed) {
  const random = rng(41381), pose = new THREE.Object3D(), color = new THREE.Color();
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 9).translate(0, .5, 0);
  const blades = new Float32Array(36 * 2), sites = [];
  const material = new THREE.MeshStandardMaterial({color:'#ffffff', roughness:.67, side:THREE.DoubleSide});
  const clock = {value:0}, cold = {value:0};
  const weeds = new THREE.InstancedMesh(geometry, material, 36);
  weeds.name = 'submerged-river-ribbon-weeds'; weeds.receiveShadow = true; root.add(weeds);
  const zSites = [-2.7, -1.2, .5, 2.8, 4.8, WATER_END - 1.6];
  let index = 0;
  for (let clump = 0; clump < zSites.length; clump++) {
    const z = zSites[clump], x = creekX(z) + (clump % 2 ? -.22 : .22);
    sites.push([x, bed(x,z), z]);
    for (let leaf = 0; leaf < 6; leaf++) {
      const angle = leaf * 2.399963, px = x + .025*Math.cos(angle), pz = z + .025*Math.sin(angle);
      const y = bed(px, pz), clearance = waterY(pz) - y - .026;
      const height = Math.max(.012, Math.min(.30, clearance)) * (.70+.27*random());
      pose.position.set(px, y+.002, pz);
      pose.rotation.set(0, Math.atan2(creekSlope(pz), 1), 0);
      pose.scale.set(.012+.010*random(), height, 1);
      pose.updateMatrix(); weeds.setMatrixAt(index,pose.matrix);
      color.set('#2d6a4f').lerp(new THREE.Color('#52b788'),random()); weeds.setColorAt(index,color);
      blades[index*2] = height; blades[index*2+1] = clump*.81+leaf*.63;
      index++;
    }
  }
  geometry.setAttribute('aWeed', new THREE.InstancedBufferAttribute(blades, 2));
  material.onBeforeCompile = shader => {
    shader.uniforms.uWeedClock = clock; shader.uniforms.uWeedWinter = cold;
    shader.vertexShader = `
      attribute vec2 aWeed;
      uniform float uWeedClock,uWeedWinter;
      varying float vWeedT;
      vec3 weedPosition,weedNormal;
      void bendWeed(){
        float t=position.y, height=aWeed.x, phase=uWeedClock*1.7+aWeed.y;
        float bend=.18+(.25*sin(phase-2.4*t)+.09*sin(phase*.57-1.2*t))*mix(1.,.15,uWeedWinter);
        float slope=2.*t*bend+t*t*(-.60*cos(phase-2.4*t)-.108*cos(phase*.57-1.2*t))*mix(1.,.15,uWeedWinter);
        float growth=mix(1.,.52,uWeedWinter);
        weedPosition=vec3(position.x*(1.-.94*t),t*growth,height*t*t*bend);
        weedNormal=normalize(vec3(0.,-height*slope,growth));
        vWeedT=t;
      }
    ` + shader.vertexShader
      .replace('#include <beginnormal_vertex>', 'bendWeed(); vec3 objectNormal=weedNormal;')
      .replace('#include <begin_vertex>', 'vec3 transformed=weedPosition;');
    shader.fragmentShader = 'varying float vWeedT;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb*=mix(.62,1.12,vWeedT);');
  };
  material.customProgramCacheKey = () => 'river-ribbons-quadratic-flow-v1';
  weeds.userData.clumps = sites;
  weeds.computeBoundingSphere(); weeds.boundingSphere.radius += .4;
  return (delta, winter, still) => {
    if (!still) clock.value += delta;
    cold.value = winter;
  };
}

function makeCrab(root, bed) {
  const z = WATER_END-1.28, x = creekX(z)+.06, floor = bed(x,z);
  const rocks = new THREE.Group(); rocks.name = 'crab-shoal-stones'; root.add(rocks);
  rocks.position.set(x,floor+.012,z); rocks.rotation.y = Math.atan2(creekSlope(z),1);
  const rockGeometry = new THREE.SphereGeometry(1,10,6);
  const rockMaterial = new THREE.MeshStandardMaterial({color:'#a0987f',roughness:.43});
  for (const [dx,dz,sx,sz] of [[0,0,.19,.12],[-.19,-.08,.12,.08],[.20,.07,.10,.065]]) {
    const rock = new THREE.Mesh(rockGeometry,rockMaterial);
    rock.position.set(dx,0,dz); rock.scale.set(sx,.025,sz); rock.receiveShadow=true; rocks.add(rock);
  }
  const crab = new THREE.Group(); crab.name = 'shallow-river-crab'; rocks.add(crab);
  const shell = new THREE.MeshStandardMaterial({color:'#ea580c',roughness:.40});
  const eyeMat = new THREE.MeshStandardMaterial({color:'#15251e',roughness:.18});
  const sphere = new THREE.SphereGeometry(1,10,6);
  function ellipsoid(parent, material, px,py,pz,sx,sy,sz) {
    const mesh = new THREE.Mesh(sphere,material);
    mesh.position.set(px,py,pz); mesh.scale.set(sx,sy,sz); parent.add(mesh); return mesh;
  }
  ellipsoid(crab,shell,0,.029,0,.056,.024,.040);
  for (const side of [-1,1]) {
    ellipsoid(crab,shell,side*.027,.054,.026,.005,.016,.005);
    ellipsoid(crab,eyeMat,side*.027,.067,.028,.008,.009,.008);
  }
  const up = new THREE.Vector3(0,1,0);
  function rod(a,b,r) {
    const d = new THREE.Vector3().subVectors(b,a), middle = a.clone().add(b).multiplyScalar(.5);
    return new THREE.CylinderGeometry(r*.65,r,d.length(),5)
      .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,d.normalize())).translate(...middle);
  }
  const legs = [];
  for (const side of [-1,1]) {
    for (let k=0;k<4;k++) {
      const leg = new THREE.Group(); leg.position.set(side*.042,.027,(k-1.5)*.018); crab.add(leg);
      const knee = new THREE.Vector3(side*.045,.008,(k-1.5)*.014);
      const foot = new THREE.Vector3(side*.068,-.026,(k-1.5)*.021);
      const pieces = [rod(new THREE.Vector3(),knee,.006),rod(knee,foot,.004)];
      const geometry = mergeGeometries(pieces); pieces.forEach(part=>part.dispose());
      leg.add(new THREE.Mesh(geometry,shell)); legs.push(leg);
    }
    const claw = new THREE.Group(); claw.position.set(side*.046,.032,.044); crab.add(claw);
    ellipsoid(claw,shell,side*.012,0,.011,.017,.013,.027);
    ellipsoid(claw,shell,side*.020,-.001,.037,.006,.008,.018).rotation.x=.20;
    ellipsoid(claw,shell,side*.005,-.001,.035,.006,.008,.018).rotation.x=-.20;
  }
  let gait=0;
  return (delta,winter,still) => {
    if (!still) gait += delta*(1-.85*winter);
    const dx=.066*Math.sin(gait*.35), moving=Math.cos(gait*.35);
    crab.position.set(dx,.025*Math.sqrt(1-(dx/.19)**2)+.002-.070*winter,0);
    crab.visible=winter<.96;
    for(let k=0;k<legs.length;k++) {
      const step=still?0:Math.sin(gait*3.2+(k%2)*Math.PI)*Math.abs(moving)*(1-winter);
      legs[k].rotation.y=.17*step;
      legs[k].rotation.z=(k<4?-1:1)*.16*Math.max(0,step);
    }
  };
}

/** Six submerged clumps and a single shoal crab. All resources belong to root. */
export function makeRiverbed(root,island,bed=bedSampler(island)) {
  const weeds=makeWeeds(root,bed), crab=makeCrab(root,bed);
  return {
    update(delta,winter,still) {
      weeds(delta,winter,still); crab(delta,winter,still);
    },
  };
}
