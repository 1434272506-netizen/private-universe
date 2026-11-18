import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ground, creekX, TREE_SITE, waterY } from './land.js';

const v = (x, y, z) => new T.Vector3(x, y, z);
const { sin, cos, PI } = Math;
const { lerp, smoothstep, clamp } = T.MathUtils;
const ivory = '#f7f5e8', shadow = '#cbd5d3', ink = '#28322e';

function joint(parent, name, x = 0, y = 0, z = 0) {
  const node = new T.Group();
  node.name = name;
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}

// Bake colours and rigid details into one draw per independently animated joint.
function sculpt(parent, material, build) {
  const pieces = [], up = v(0, 1, 0), tint = new T.Color();
  function paint(geometry, hue) {
    tint.set(hue);
    const color = new Float32Array(geometry.attributes.position.count * 3);
    for (let k = 0; k < color.length; k += 3) tint.toArray(color, k);
    geometry.setAttribute('color', new T.BufferAttribute(color, 3));
    pieces.push(geometry);
  }
  function oval(hue, x, y, z, w, h, d, tilt = 0) {
    paint(new T.SphereGeometry(1, 10, 7).scale(w, h, d).rotateX(tilt).translate(x, y, z), hue);
  }
  function rod(hue, a, b, start, end = start) {
    const axis = v(...b).sub(v(...a)), length = axis.length();
    const q = new T.Quaternion().setFromUnitVectors(up, axis.normalize());
    const mid = v(...a).lerp(v(...b), .5);
    paint(new T.CylinderGeometry(end, start, length, 7).applyQuaternion(q).translate(mid.x, mid.y, mid.z), hue);
  }
  build(oval, rod);
  const geometry = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  const mesh = new T.Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Cast in island coordinates, keeping perches and paw marks attached even on a transformed island.
function surfaceProbe(root) {
  const caster = new T.Raycaster(), axis = v(0, -1, 0);
  return (target, x, z, ceiling, fallback, normal) => {
    if (!target) return fallback;
    target.updateWorldMatrix(true, false);
    caster.set(root.localToWorld(v(x, ceiling, z)), axis.clone().transformDirection(root.matrixWorld));
    const hit = caster.intersectObject(target, false)[0];
    if (!hit) return fallback;
    if (normal) {
      const local = new T.Matrix4().copy(root.matrixWorld).invert().multiply(target.matrixWorld);
      normal.copy(hit.face.normal).applyNormalMatrix(new T.Matrix3().getNormalMatrix(local));
    }
    return root.worldToLocal(hit.point).y;
  };
}

function makeEgret(root, island, feather, surface) {
  const bird = joint(root, 'wading-egret'), body = joint(bird, 'egret-body', 0, .63, 0);
  sculpt(body, feather, (oval, rod) => {
    oval(ivory, 0, .06, -.03, .17, .21, .38, -.19);
    rod(shadow, [0,.10,-.23], [0,.02,-.52], .11, .014);
  });
  const neck = joint(body, 'egret-neck', 0, .085, .17);
  sculpt(neck, feather, (oval, rod) => {
    rod(ivory, [0,0,0], [0,.22,.08], .112, .071);
    rod(ivory, [0,.21,.08], [0,.39,.006], .074, .056);
    rod(ivory, [0,.38,.006], [0,.50,.14], .057, .076);
    oval(ivory, 0,.51,.17, .094,.097,.136);
    rod('#eac56e', [0,.51,.275], [0,.483,.615], .044,.002);
    for (const s of [-1,1]) {
      oval('#d9ad4e', .083*s,.526,.194, .021,.027,.030);
      oval(ink, .098*s,.526,.203, .012,.016,.017);
    }
  });
  const wings = [], legs = [];
  for (const s of [-1,1]) {
    const wing = joint(body, 'egret-wing', .105*s,.143,.015);
    sculpt(wing, feather, (oval, rod) => {
      oval(ivory, .24*s,0,-.047, .30,.061,.166);
      for (let j = 0; j < 6; j++)
        rod(j % 2 ? '#e7eae1' : ivory, [(.26+.032*j)*s, -.002,-.12+.04*j],
          [(.56+.050*j)*s, .008+.004*j,-.255+.035*j], .047,.006);
    });
    wings.push(wing);
    const leg = joint(body, 'egret-leg', .062*s,-.065,0);
    sculpt(leg, feather, (_, rod) => {
      rod('#514e40', [0,0,0], [0,-.27,-.045], .020,.014);
      rod('#555641', [0,-.27,-.045], [0,-.55,.028], .014,.012);
      for (const toe of [-1, 0, 1])
        rod('#91805a', [0,-.55,.028], [.048*toe,-.558,.122-.012*Math.abs(toe)], .012,.004);
    });
    legs.push(leg);
  }
  const ax = 4.68, az = -3.00, bz = -3.16, bx = creekX(bz) - .91;
  const paddy = island.getObjectByName('paddy-sky-mirrors');
  const sites = [v(ax, surface(paddy,ax,az,12,ground(ax,az)+.13)-.074, az),
    v(bx, ground(bx,bz), bz)];
  const start = new T.Vector3(), target = new T.Vector3(), cam = new T.Vector3(), centre = new T.Vector3();
  let bank = 0, flight = 1, stride = 0, heading = .28, near = false, dormant = false;
  bird.position.copy(sites[0]); bird.rotation.y = heading;
  function takeOff() {
    if (flight < 1 || dormant) return false;
    start.copy(bird.position);
    bank = 1-bank; target.copy(sites[bank]); flight = 0;
    heading = Math.atan2(target.x - start.x, target.z - start.z);
    return true;
  }
  function update(dt, time, winter, still, camera) {
    dormant = winter > .50;
    if (camera) {
      centre.set(0,.68,0); bird.localToWorld(centre); camera.getWorldPosition(cam);
      const d = cam.distanceToSquared(centre);
      if (!near && d < 2.15**2 && !still) takeOff();
      if (d < 2.15**2) near = true;
      else if (d > 3.2**2) near = false;
    }
    const active = (1 - winter) * (still ? 0 : 1);
    let spread = 0, beat = 0, legTuck = 0;
    if (flight < 1) {
      flight = Math.min(1, flight + dt / (still ? .65 : 3.35));
      const p = smoothstep(flight,0,1), arc = 4*p*(1-p);
      bird.position.lerpVectors(start,target,p);
      bird.position.y += arc*(still ? .18 : 1.88);
      bird.position.z += arc*.43;
      spread = smoothstep(flight,0,.13)*(1-smoothstep(flight,.80,1));
      beat = still ? 0 : sin(PI*2*5*flight)*spread;
      legTuck = spread;
      if (flight === 1) stride = 0;
    } else {
      stride += dt * .88 * active;
      const site = sites[bank];
      bird.position.x = site.x + (1-cos(stride*.26))*.075;
      bird.position.z = site.z + sin(stride*.26)*.18;
      bird.position.y = bank ? ground(bird.position.x,bird.position.z) : site.y;
    }
    const t = 1 - Math.exp(-dt*5);
    bird.rotation.y += t * Math.atan2(sin(heading-bird.rotation.y),cos(heading-bird.rotation.y));
    const dip = Math.pow(Math.max(0, cos(stride*.76 - 2.4)), 9);
    neck.rotation.x = (1.91*dip*active + .19*winter)*(1-spread) + .63*spread;
    body.position.y = .63 + .015*sin(stride*2)*active;
    for (let k = 0; k < 2; k++) {
      const s = 2*k-1;
      wings[k].rotation.set(0,s*(1.41 - 1.39*spread),s*(.09 + beat*.67));
      legs[k].rotation.x = -1.30*legTuck + s*.16*sin(stride)*active*(1-legTuck);
    }
  }
  return { bird, update, takeOff };
}

function makeRobin(root, material, site, yaw, phase) {
  const perch = joint(root, phase ? 'swing-perched-robin' : 'bough-perched-robin');
  perch.position.copy(site); perch.rotation.y = yaw;
  const bark = '#72594e';
  sculpt(perch, material, (oval, rod) => {
    oval('#8c7960',0,.18,-.006,.126,.154,.167,-.19);
    oval('#e79a53',0,.193,.087,.104,.114,.109);
    rod('#665348',[0,.174,-.112],[0,.235,-.307],.063,.018);
    for (const s of [-1,1]) {
      rod(bark,[s*.04,.105,0],[s*.04,.015,.007],.008,.007);
      rod(bark,[s*.04,.015,.007],[s*.056,.006,.043],.008,.004);
    }
  });
  const head = joint(perch, 'robin-head', 0,.302,.065);
  sculpt(head, material, (oval, rod) => {
    oval('#907a5e',0,.044,0,.115,.108,.107);
    oval('#de8541',0,.025,.058,.103,.082,.075);
    rod('#553e32',[0,.024,.109],[0,.030,.192],.028,.002);
    for (const s of [-1,1]) oval('#241e18',.089*s,.061,.067,.017,.019,.016);
  });
  const wings = [-1,1].map(s => {
    const wing = joint(perch,'robin-wing',.098*s,.239,.004);
    sculpt(wing,material,(oval) => {
      oval('#796650',s*.013,-.048,-.037,.042,.075,.115,.37);
      oval('#ad926f',s*.043,-.053,-.052,.012,.023,.061,.42);
    });
    return wing;
  });
  return (time, winter, still) => {
    const activity = still ? 0 : 1-.60*winter, clock = time + phase;
    const look = Math.pow(Math.max(0,cos(clock*1.02)),5);
    head.rotation.set(.06 + activity*.088*sin(clock*.8), activity*.72*look*sin(clock*.51+.6), activity*.29*look);
    const shake = activity * Math.pow(Math.max(0,cos(clock*.67+1.3)),12) * sin(clock*30)*.18;
    wings[0].rotation.z = shake; wings[1].rotation.z = -shake;
  };
}

function makeBunny(root, island, fur, surface, snowHeight) {
  const rabbit = joint(root,'meadow-white-bunny'), pose = joint(rabbit,'bunny-breath-and-hop');
  const coat = '#f5f2e9', blush = '#e9adae';
  sculpt(pose,fur,(oval) => {
    oval(coat,0,.18,-.040,.194,.193,.259);
    oval('#fcfaf4',0,.216,-.294,.084,.081,.078);
    for (const s of [-1,1]) {
      oval('#e7e4dc',s*.144,.115,-.085,.082,.103,.147);
      oval(coat,s*.112,.042,.122,.055,.038,.096);
    }
  });
  const head = joint(pose,'bunny-head',0,.271,.147);
  sculpt(head,fur,(oval) => {
    oval(coat,0,.035,.006,.144,.134,.132);
    for (const s of [-1,1]) {
      oval('#fff9ee',s*.041,.007,.119,.051,.039,.040);
      oval('#342c2a',s*.104,.069,.090,.024,.029,.020);
      oval('#fff6e7',s*.113,.079,.102,.008,.008,.007);
    }
    oval('#c9858b',0,.025,.159,.025,.017,.012);
  });
  const ears = [-1,1].map(s => {
    const ear = joint(head,'bunny-ear',s*.064,.125,-.023);
    sculpt(ear,fur,(oval) => {
      oval(coat,0,.121,0,.045,.146,.035);
      oval(blush,0,.132,.024,.026,.103,.014);
    });
    ear.rotation.z = -.19*s;
    return ear;
  });

  const den = v(TREE_SITE.x+1.65,0,TREE_SITE.z+1.26);
  const terrain = island.getObjectByName('meadow-and-soil');
  const tracks = joint(root,'winter-rabbit-pawprints');
  const pads = [];
  for (let i=0; i<6; i++) {
    const x = den.x+.21+i*.16, z = den.z+.09*sin(i*1.8)+(i%2)*.07;
    const normal = v(0,1,0), y = surface(terrain,x,z,10,ground(x,z),normal);
    const paw = joint(tracks,'pawprint',x,y,z);
    paw.quaternion.setFromUnitVectors(v(0,1,0), normal);
    paw.rotateY(-1.15+.19*sin(i));
    sculpt(paw,fur,(oval) => {
      oval('#a6b9c8',0,.002,0,.033,.005,.034);
      for (let j=0; j<4; j++) {
        const a=(j-1.5)*.70;
        oval('#a6b9c8',.038*sin(a),.002,.035*cos(a),.011,.004,.014);
      }
    }).castShadow = false;
    pads.push({paw, y});
  }
  tracks.visible = false;
  const hearts = joint(root,'bunny-pink-hearts'), shape = new T.Shape();
  shape.moveTo(0,-.095); shape.bezierCurveTo(-.026,-.066,-.105,-.009,-.091,.045);
  shape.bezierCurveTo(-.081,.092,-.024,.107,0,.058);
  shape.bezierCurveTo(.036,.112,.090,.081,.094,.044);
  shape.bezierCurveTo(.101,-.006,.044,-.058,0,-.095);
  const geo = new T.ShapeGeometry(shape,6), color = new T.MeshBasicMaterial({color:'#f4a9c3',side:T.DoubleSide});
  for (let i=0; i<3; i++) hearts.add(new T.Mesh(geo,color));
  hearts.visible = false;
  const cameraPosition = new T.Vector3();
  let hopClock = Infinity, shelter = 0;
  function hop() {
    if (hopClock < 1.65) return false;
    hopClock = 0;
    return true;
  }
  function update(dt,time,winter,still,camera) {
    const previous = shelter;
    shelter += clamp(winter-shelter,-dt*.32,dt*.32);
    const migrating = Math.abs(shelter-previous) > .00001;
    const x = lerp(-1.9,den.x,shelter), z = lerp(-3.2,den.z,shelter);
    const reach = (x-creekX(z))/1.56, crossing = Math.max(0, 1-reach*reach);
    const terrainY = ground(x,z);
    const leap = migrating ? Math.max(0,Math.max(waterY(z)+.50,terrainY)-terrainY)*crossing + .32*crossing : 0;
    rabbit.position.set(x,terrainY + leap + snowHeight(x,z),z);
    const idleYaw = .48-.28*winter, travelYaw = shelter>previous ? -PI/2 : PI/2;
    const desiredYaw = migrating && !still ? travelYaw : idleYaw;
    rabbit.rotation.y += (1-Math.exp(-dt*7))*Math.atan2(sin(desiredYaw-rabbit.rotation.y),cos(desiredYaw-rabbit.rotation.y));
    hopClock += dt;
    const jumping = hopClock < 1.10, phase = (hopClock % .55)/.55;
    const air = jumping ? clamp((phase-.16)/.72,0,1) : 0;
    const arc = 4*air*(1-air);
    const load = jumping ? Math.max(0,1-Math.abs(phase-.14)/.14)+.68*Math.max(0,1-Math.abs(phase-.90)/.10) : 0;
    const breath = still ? 0 : .022*sin(time*2.2);
    const stretch = (still ? .27 : 1) * (.22*arc-.20*load);
    const sy = 1+stretch+breath-.18*winter, radial = 1/Math.sqrt(sy);
    pose.scale.set(radial,sy,radial);
    pose.position.y = arc*(still ? .06 : .42) + (migrating && !still ? .065*Math.abs(sin(shelter*PI*13)) : 0);
    head.rotation.x = .13+.17*winter - .16*arc;
    for (let k=0; k<2; k++)
      ears[k].rotation.x = -.035-.38*winter-.20*arc+(still ? 0 : .13*Math.pow(Math.max(0,cos(time*.89+k*2)),14)*sin(time*14));
    hearts.visible = hopClock < 1.65;
    if (hearts.visible) {
      hearts.position.copy(rabbit.position); hearts.position.y+=.53;
      if (camera) hearts.lookAt(camera.getWorldPosition(cameraPosition));
      for (let i=0; i<3; i++) {
        const age = clamp((hopClock-i*.18)/1.29,0,1), heart=hearts.children[i];
        heart.position.set((i-1)*(.07+.17*age), age*(still ? .16 : .77)+i*.035, .09);
        heart.rotation.z = (i-1)*(.14+.13*age);
        heart.scale.setScalar(smoothstep(age,0,.13)*(1-smoothstep(age,.58,1)));
      }
    }
    tracks.visible = winter>.30;
    if (tracks.visible) for (const mark of pads) {
      const p = mark.paw.position;
      p.y = mark.y+.007+snowHeight(p.x,p.z);
      mark.paw.scale.setScalar(smoothstep(winter,.30,.92));
    }
  }
  return { rabbit, update, hop };
}

export function makeWildlife(root, island, { camera, reducedMotion=false, snowHeight=()=>0 }={}) {
  const material = new T.MeshStandardMaterial({vertexColors:true, flatShading:true, roughness:.85});
  const surface = surfaceProbe(root);
  const egret = makeEgret(root,island,material,surface), bunny = makeBunny(root,island,material,surface,snowHeight);
  const tree = island.getObjectByName('centerpiece-love-tree');
  // The authored foreground bough passes through tree-local (1.65, 2.91, 1.29).
  const bough = tree ? root.worldToLocal(tree.localToWorld(v(1.65,2.91,1.29))) :
    v(TREE_SITE.x+2.89,ground(TREE_SITE.x,TREE_SITE.z)+5.10,TREE_SITE.z+2.26);
  bough.y = surface(tree?.getObjectByName('Bark_ContinuousTrunkAndRoots'),bough.x,bough.z,bough.y+.55,bough.y+.30);
  const beam = v(-16.29,ground(-15.5,-2)+3.195,-2);
  beam.y = surface(island.getObjectByName('swing-a-frame-timber'),beam.x,beam.z,beam.y+.5,beam.y);
  const robins = [makeRobin(root,material,bough,.63,0), makeRobin(root,material,beam,1.33,2.65)];
  const picker = new T.Raycaster(), targets=[bunny.rabbit,egret.bird], probe = new T.Vector3();
  function update(delta,time,winter,still=reducedMotion) {
    egret.update(delta,time,winter,still,camera);
    bunny.update(delta,time,winter,still,camera);
    for (const robin of robins) robin(time,winter,still);
  }
  function interact(point, ray) {
    let target;
    if (ray) {
      picker.ray.copy(ray.ray || ray);
      picker.near = ray.near ?? 0;
      picker.far = Math.min(ray.far ?? Infinity, point ? picker.ray.origin.distanceTo(point)+.012 : Infinity);
      for (const object of targets) object.updateWorldMatrix(true,true);
      target = picker.intersectObjects(targets,true)[0]?.object;
      while (target && !targets.includes(target)) target = target.parent;
    } else if (point) {
      for (const object of targets) {
        const radius = object===bunny.rabbit ? .51 : .78;
        probe.copy(point); object.worldToLocal(probe); probe.y-=radius*.85;
        if (probe.lengthSq()<radius*radius) { target=object; break; }
      }
    }
    if (target===bunny.rabbit) { bunny.hop(); return true; }
    if (target===egret.bird) { egret.takeOff(); return true; }
    return false;
  }
  update(0,0,0);
  return { update, interact };
}
