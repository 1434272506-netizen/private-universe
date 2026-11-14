import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ground,BENCH_SITE,CABIN_SITE,creekX} from './land.js';
import {material} from './materials.js';
import {mesh, curveTube} from './shared.js';

export function makeProps(parent) {
  const oak = material('wood', '#f0eadd');
  oak.roughness = .86;
  oak.bumpScale = .012;
  const hardware = new THREE.MeshStandardMaterial({color: '#72766b', roughness: .76, metalness: .18});
  const cream = new THREE.MeshStandardMaterial({color: '#dbd9ca', roughness: .74, metalness: .08});
  const doorCream = new THREE.MeshStandardMaterial({color: '#e6e1d1', roughness: .77, metalness: .06});
  const seam = new THREE.MeshStandardMaterial({color: '#666b60', roughness: .85});
  makeStonePath(parent);
  const bench = makeBench(parent, oak, hardware);
  const {mailbox, doorPivot} = makeMailbox(parent, oak, cream, doorCream, seam, hardware);
  const {balloons, rigs} = makeBalloons(parent);
  let mailboxOpen = false, previousElapsed;
  return {
    mailbox,
    bench,
    balloons,
    setMailboxOpen(open, {immediate = false} = {}) {
      mailboxOpen = Boolean(open);
      mailbox.userData.open = mailboxOpen;
      if (immediate) doorPivot.rotation.x = mailboxOpen ? Math.PI * .48 : 0;
    },
    update(elapsed) {
      const delta = previousElapsed == null ? 1 / 60 : Math.max(0, Math.min(.05, elapsed - previousElapsed));
      previousElapsed = elapsed;
      // A frozen environmental clock must not prevent a requested door change.
      doorPivot.rotation.x = THREE.MathUtils.damp(doorPivot.rotation.x, mailboxOpen ? Math.PI * .48 : 0, 5.5, delta || 1 / 60);
      for (let i = 0; i < rigs.length; i++) {
        const {rig, center, tail, phase, speed} = rigs[i];
        // Each balloon has its own small patch of air. The free string hangs
        // from the knot and moves with it, without any shared ground anchor.
        rig.position.set(
          center.x + Math.sin(elapsed * speed + phase) * .105,
          center.y + Math.sin(elapsed * speed * .73 + phase * 1.4) * .045,
          center.z + Math.cos(elapsed * speed * .81 + phase) * .075,
        );
        rig.rotation.z = Math.sin(elapsed * .39 + phase) * .025;
        rig.rotation.x = Math.sin(elapsed * .31 + phase * .8) * .016;
        tail.rotation.x = .035 + Math.sin(elapsed * .43 + phase) * .025;
        tail.rotation.z = Math.sin(elapsed * .36 + phase) * .045;
        tail.rotation.y = phase * .3 + Math.sin(elapsed * .21 + phase) * .12;
      }
    },
  };
}

// Two dry approaches meet the existing five stepping stones at the waterline.
function makeStonePath(parent) {
  const startX=CABIN_SITE.x+3.95*Math.sin(CABIN_SITE.yaw);
  const startZ=CABIN_SITE.z+3.95*Math.cos(CABIN_SITE.yaw);
  const bridgeWest = [-1.85, 0.15];
  const bridgeEast = [1.85, -0.22];
  const paths=[
    [[startX,startZ],[-2.17,2.22],[-1.95,.72],bridgeWest],
    [bridgeEast,[3.1,-.38],[6.0,1.15],[8.4,2.55],[BENCH_SITE.x-1.14,BENCH_SITE.z]]
  ];
  const slabs=[];
  for(const points of paths){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)));
    const count=Math.ceil(curve.getLength()/.67);
    for(let i=0;i<=count;i++){
      const {x,z}=curve.getPointAt(i/count);
      const slab=new THREE.IcosahedronGeometry(1,0);
      slab.scale(.28+.04*Math.sin(i*3),.072,.22);
      slab.rotateY(i*2.4);slab.translate(x,ground(x,z)+.035,z);slabs.push(slab);
    }
  }
  const path=mesh(parent,mergeGeometries(slabs),material('rock','#a9aa94'));
  path.name='porch-to-bench-stone-path';slabs.forEach(g=>g.dispose());
}

function makeBench(parent, oak, hardware) {
  const bench = new THREE.Group();
  bench.name = 'oak-bench';
  bench.userData.interaction = 'bench';
  const {x,z} = BENCH_SITE, angle = -1.72, base = ground(x, z);
  bench.position.set(x, base, z);
  bench.rotation.y = angle;
  parent.add(bench);
  const woodParts = [], bolts = [];
  const plank = (width, height, depth, px, py, pz, tilt = 0) => {
    const part = new RoundedBoxGeometry(width, height, depth, 2, .009);
    part.rotateX(tilt);
    part.translate(px, py, pz);
    woodParts.push(part);
  };
  const localGround = (px, pz) => ground(
    x + Math.cos(angle) * px + Math.sin(angle) * pz,
    z - Math.sin(angle) * px + Math.cos(angle) * pz,
  ) - base;
  for (let i = 0; i < 4; i++) plank(1.95, .047, .108, 0, .49, -.18 + i * .12);
  for (let i = 0; i < 3; i++) plank(1.95, .103, .04, 0, .70 + i * .12, -.275, -.11);
  for (const px of [-.72, .72]) {
    for (const pz of [-.23, .17]) {
      const bottom = localGround(px, pz) - .012;
      const top = pz < 0 ? 1.0 : .47;
      plank(.071, top - bottom, .071, px, (top + bottom) / 2, pz);
    }
    plank(.065, .065, .47, px, .36, -.015);
    for (const pz of [-.15, .15]) {
      const bolt = new THREE.SphereGeometry(.013, 7, 4);
      bolt.scale(1, .25, 1);
      bolt.translate(px, .516, pz);
      bolts.push(bolt);
    }
  }
  plank(1.51, .061, .055, 0, .245, -.22);
  const woodenBench = mesh(bench, mergeGeometries(woodParts, false), oak);
  woodenBench.name = 'bench-oak-slats';
  woodParts.forEach(part => part.dispose());
  mesh(bench, mergeGeometries(bolts, false), hardware);
  bolts.forEach(part => part.dispose());
  makeArchiveBook(bench);
  return bench;
}

function makeMailbox(parent, oak, cream, doorCream, seam, hardware) {
  const mailbox = new THREE.Group();
  mailbox.name = 'cream-mailbox';
  mailbox.userData.interaction = 'mailbox';
  mailbox.userData.open = false;
  mailbox.position.set(4.7, ground(4.7, -2), -2);
  mailbox.rotation.y = .1;
  parent.add(mailbox);
  mesh(mailbox, new RoundedBoxGeometry(.105, 1.17, .105, 2, .007), oak, 0, .575, 0);
  mesh(mailbox, new RoundedBoxGeometry(.65, .047, .43, 2, .008), oak, 0, 1.16, 0);
  const shell = mailboxProfile(.24, .245);
  const hollow = mailboxProfile(.223, .233, .016);
  shell.holes.push(hollow);
  const body = new THREE.ExtrudeGeometry(shell, {
    depth: .68, bevelEnabled: true, bevelSegments: 2,
    steps: 1, bevelSize: .007, bevelThickness: .007, curveSegments: 24,
  });
  mesh(mailbox, body, cream, 0, 1.188, -.34);
  // Keep a real cavity behind the hinged door instead of exposing a solid cap.
  const insideCream = new THREE.MeshStandardMaterial({color: '#bdbbaa', roughness: .9, side: THREE.DoubleSide});
  mesh(mailbox, new THREE.ShapeGeometry(mailboxProfile(.225, .235), 24), insideCream, 0, 1.204, -.335);
  const doorPivot = new THREE.Group();
  doorPivot.name = 'mailbox-door-pivot';
  doorPivot.position.set(0, 1.202, .353);
  mailbox.add(doorPivot);
  const doorSeam = new THREE.ExtrudeGeometry(mailboxProfile(.234, .244), {
    depth: .009, bevelEnabled: true, bevelSize: .002, bevelThickness: .002,
    bevelSegments: 1, steps: 1, curveSegments: 24,
  });
  mesh(doorPivot, doorSeam, seam, 0, -.010, -.004);
  const front = new THREE.ShapeGeometry(mailboxProfile(.222, .237), 24);
  doorCream.side = THREE.DoubleSide;
  // Keep the enamel faces clear of the bevel cap, including its thickness.
  mesh(doorPivot, front, doorCream, 0, 0, .012);
  mesh(doorPivot, front.clone(), doorCream, 0, 0, -.011);
  mesh(doorPivot, new RoundedBoxGeometry(.205, .012, .008, 2, .003), seam, 0, .187, .013);
  mesh(doorPivot, new RoundedBoxGeometry(.052, .016, .045, 2, .004), hardware, 0, .048, .027);
  mesh(mailbox, new THREE.CylinderGeometry(.012, .012, .16, 8), hardware, -.15, 1.21, .358).rotation.z = Math.PI / 2;
  const lavender = new THREE.MeshStandardMaterial({color: '#a898bd', roughness: .82, metalness: .08});
  mesh(mailbox, new RoundedBoxGeometry(.015, .24, .026, 2, .004), lavender, .25, 1.49, .015);
  mesh(mailbox, new RoundedBoxGeometry(.016, .078, .13, 2, .006), lavender, .25, 1.61, .065);
  mesh(mailbox, new THREE.SphereGeometry(.018, 8, 6), hardware, .26, 1.375, .015);
  return {mailbox, doorPivot};
}

function mailboxProfile(radius, upright, base = 0) {
  const profile = new THREE.Shape();
  profile.moveTo(-radius, base);
  profile.lineTo(radius, base);
  profile.lineTo(radius, base + upright);
  profile.absarc(0, base + upright, radius, 0, Math.PI, false);
  profile.lineTo(-radius, base);
  return profile;
}

function makeArchiveBook(bench) {
  const book = new THREE.Group();
  book.name = 'linen-memory-book';
  book.position.set(.34, .521, .015);
  book.rotation.y = .13;
  bench.add(book);
  // A small closed object, awaiting real memories; it carries no invented text.
  const size = 128, fibers = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const weave = (x % 4 < 2 ? 1 : -1) * (y % 4 < 2 ? 1 : -1);
      const grain = Math.sin(x * 7.13 + y * 13.7) * 2;
      const value = 243 + weave * 5 + grain;
      fibers[offset] = fibers[offset + 1] = fibers[offset + 2] = value;
      fibers[offset + 3] = 255;
    }
  }
  const weave = new THREE.DataTexture(fibers, size, size, THREE.RGBAFormat);
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.repeat.set(3, 2);
  weave.colorSpace = THREE.SRGBColorSpace;
  weave.magFilter = THREE.LinearFilter;
  weave.minFilter = THREE.LinearMipmapLinearFilter;
  weave.generateMipmaps = true;
  weave.needsUpdate = true;
  const linen = new THREE.MeshStandardMaterial({
    color: '#d1c9b3', map: weave, bumpMap: weave, bumpScale: .0035, roughness: 1,
  });
  const paper = new THREE.MeshStandardMaterial({color: '#e6e0cf', roughness: 1});
  mesh(book, new RoundedBoxGeometry(.574, .012, .35, 2, .003), linen, 0, .006, 0);
  mesh(book, new RoundedBoxGeometry(.546, .045, .326, 2, .003), paper, .005, .034, .001);
  mesh(book, new RoundedBoxGeometry(.574, .012, .35, 2, .003), linen, 0, .065, 0);
  mesh(book, new RoundedBoxGeometry(.019, .071, .349, 2, .004), linen, -.28, .035, 0);
  for (const [x, color] of [[-.08, '#b7a7d6'], [.028, '#88a97b']]) {
    const positions = [], indices = [];
    for (const [z, y] of [[.10, .043], [.161, .043], [.185, .036], [.241, .017]]) {
      positions.push(x - .009, y, z, x + .009, y, z);
    }
    for (let i = 0; i < 3; i++) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const bookmark = mesh(book, geometry, new THREE.MeshStandardMaterial({color, roughness: .93, side: THREE.DoubleSide}));
    bookmark.name = color === '#b7a7d6' ? 'lavender-bookmark' : 'green-bookmark';
  }
}

function makeBalloons(parent) {
  const balloons = [], rigs = [];
  const string = new THREE.MeshStandardMaterial({color: '#d5cdbb', roughness: 1});
  const centers = [[5.48, 3.06, -2.82], [5.97, 3.42, -2.52], [6.40, 3.18, -2.91]];
  ['#b8a9c7', '#b3c5a8', '#ddd0b8'].forEach((colour, i) => {
    const rig = new THREE.Group();
    const center = new THREE.Vector3(...centers[i]);
    rig.position.copy(center);
    rig.name = `balloon-rig-${i + 1}`;
    parent.add(rig);
    const latex = new THREE.MeshPhysicalMaterial({
      color: colour, roughness: .53, metalness: 0, clearcoat: .10, clearcoatRoughness: .48,
    });
    const envelope = new THREE.SphereGeometry(.18, 22, 16);
    envelope.scale(.88, 1.13, .88);
    const knot = new THREE.ConeGeometry(.021, .047, 7);
    knot.translate(0, -.218, 0);
    const balloon = mesh(rig, mergeGeometries([envelope, knot], false), latex);
    balloon.name = `muted-balloon-${i + 1}`;
    envelope.dispose();
    knot.dispose();
    balloons.push(balloon);
    const rope = curveTube([
      [0, 0, 0],
      [.018, -.24, .014],
      [.09, -.64, -.018],
      [.035, -1.05 - i * .035, .04],
    ], .0027, .0024, 24, 4);
    const thread = mesh(rig, rope, string, 0, -.235, 0);
    thread.name = `free-balloon-thread-${i + 1}`;
    thread.castShadow = false;
    rigs.push({rig, center, tail: thread, phase: i * 2.07, speed: .18 + i * .023});
  });
  return {balloons, rigs};
}
