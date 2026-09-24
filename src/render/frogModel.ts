import * as THREE from "three";
import { FROG_DIMS, type Frog } from "../game/frog";
import type { Tongue } from "../game/tongue";
import { PALETTE, feltMaterial } from "./materials";

const HIND_Z = 0.21;
const FRONT_Z = 0.17;
/** The far legs replay the near legs' joint angles this many seconds late, so the pair isn't in lockstep. */
const FAR_LAG = 0.045;

type V3 = [number, number, number];

function ellipsoid(mat: THREE.Material, r: V3, pos: V3, opts?: { thetaStart?: number; thetaLength?: number }) {
  const g = new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, opts?.thetaStart ?? 0, opts?.thetaLength ?? Math.PI);
  const m = new THREE.Mesh(g, mat);
  m.scale.set(...r);
  m.position.set(...pos);
  m.castShadow = true;
  return m;
}

/** A capsule running along +x from 0 to `len`, so it can hang off a joint like the physics segment. */
function limbMesh(mat: THREE.Material, len: number, r0: number, r1 = r0) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 14, 1);
  g.rotateZ(-Math.PI / 2);
  g.translate(len / 2, 0, 0);
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(g, mat);
  shaft.castShadow = true;
  group.add(shaft);
  for (const [x, r] of [
    [0, r0],
    [len, r1],
  ] as const) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
    knob.position.x = x;
    knob.castShadow = true;
    group.add(knob);
  }
  return group;
}

/** Kermit-style webbed paddle: a palm plus pointy felt toes fanning out flat along the ground. */
function paddle(mat: THREE.Material, toeLen: number, toeR: number, spread: number, count = 4) {
  const group = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat);
  palm.scale.set(toeLen * 0.45, toeR * 0.9, toeLen * 0.42);
  palm.position.x = toeLen * 0.25;
  palm.castShadow = true;
  group.add(palm);
  const coneGeo = new THREE.ConeGeometry(toeR, toeLen, 8);
  coneGeo.rotateZ(-Math.PI / 2);
  coneGeo.translate(toeLen / 2, 0, 0);
  const tips: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / (count - 1) - 0.5) * spread;
    const toe = new THREE.Mesh(coneGeo, mat);
    toe.scale.y = 0.55;
    toe.position.x = toeLen * 0.2;
    toe.rotation.y = a;
    toe.castShadow = true;
    group.add(toe);
    tips.push(new THREE.Vector3(toeLen * 0.2 + Math.cos(a) * toeLen * 0.82, 0, -Math.sin(a) * toeLen * 0.82));
  }
  // Webbing between the toes.
  const shape = new THREE.Shape();
  shape.moveTo(toeLen * 0.15, 0);
  for (const t of tips) shape.lineTo(t.x, t.z);
  shape.lineTo(toeLen * 0.15, 0);
  const web = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
  web.rotation.x = Math.PI / 2;
  web.position.y = -toeR * 0.1;
  group.add(web);
  return group;
}

interface LegRig {
  thigh: THREE.Group;
  shin: THREE.Group;
  foot: THREE.Group;
}
interface ArmRig {
  arm: THREE.Group;
  forearm: THREE.Group;
  hand: THREE.Group;
}

export class FrogModel {
  readonly root = new THREE.Group();
  private torso = new THREE.Group();
  private jawPivot = new THREE.Group();
  private throat: THREE.Mesh;
  private pupils: THREE.Group[] = [];
  private eyes: THREE.Mesh[] = [];
  private legs: LegRig[] = [];
  private arms: ArmRig[] = [];
  private tongueMesh: THREE.Mesh;
  private tongueTip: THREE.Mesh;
  private history: { t: number; hip: number; knee: number; ankle: number; shoulder: number; elbow: number }[] = [];
  private gulp = 0;
  private blink = 0;
  private nextBlink = 2;
  private jawOpen = 0;

  constructor() {
    const felt = feltMaterial();
    const feltDeep = feltMaterial(PALETTE.feltDark);
    const mouthMat = new THREE.MeshStandardMaterial({ color: PALETTE.mouth, roughness: 0.8, side: THREE.DoubleSide });
    const eyeMat = new THREE.MeshPhysicalMaterial({ color: PALETTE.eyeWhite, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.4 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: PALETTE.pupil, roughness: 0.3 });

    this.root.add(this.torso);
    const T = this.torso;

    // Body: a soft felt bean behind the big head.
    T.add(ellipsoid(felt, [0.46, 0.215, 0.26], [-0.17, -0.01, 0]));

    // Upper head dome (Kermit's head is mostly mouth).
    T.add(ellipsoid(felt, [0.37, 0.21, 0.32], [0.3, -0.04, 0], { thetaLength: Math.PI / 2 }));
    // Roof of the mouth, seen when the jaw drops.
    const roof = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mouthMat);
    roof.rotation.x = Math.PI / 2;
    roof.scale.set(0.36, 0.31, 1);
    roof.position.set(0.3, -0.041, 0);
    T.add(roof);

    // Lower jaw hinges at the back of the head like a puppet's.
    this.jawPivot.position.set(-0.04, -0.04, 0);
    T.add(this.jawPivot);
    const jaw = ellipsoid(felt, [0.36, 0.14, 0.31], [0.34, 0, 0], { thetaStart: Math.PI / 2, thetaLength: Math.PI / 2 });
    this.jawPivot.add(jaw);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mouthMat);
    floor.rotation.x = -Math.PI / 2;
    floor.scale.set(0.35, 0.3, 1);
    floor.position.set(0.34, 0.001, 0);
    this.jawPivot.add(floor);
    const restingTongue = ellipsoid(new THREE.MeshPhysicalMaterial({ color: PALETTE.tongue, roughness: 0.4, clearcoat: 1 }), [0.2, 0.04, 0.14], [0.3, 0.01, 0]);
    this.jawPivot.add(restingTongue);

    // Dark seam where the lips meet: Kermit's wide, wide mouth.
    const lip = new THREE.Mesh(new THREE.TorusGeometry(1, 0.026, 8, 64), new THREE.MeshStandardMaterial({ color: PALETTE.seam, roughness: 0.9 }));
    lip.rotation.x = Math.PI / 2;
    lip.scale.set(0.372, 0.322, 1);
    lip.position.set(0.3, -0.04, 0);
    T.add(lip);

    // Throat pouch that bulges when a fly goes down.
    this.throat = ellipsoid(felt, [0.16, 0.1, 0.17], [0.22, -0.16, 0]);
    this.throat.visible = false;
    T.add(this.throat);

    // Ping-pong-ball eyes perched on top of the head, sunk into felt sockets.
    const er = FROG_DIMS.eye.r;
    for (const side of [1, -1]) {
      const eye = ellipsoid(eyeMat, [er, er, er], [FROG_DIMS.eye.x, FROG_DIMS.eye.y, side * 0.135]);
      T.add(eye);
      this.eyes.push(eye);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(er * 0.9, 0.03, 10, 32), felt);
      rim.position.set(FROG_DIMS.eye.x, FROG_DIMS.eye.y - er * 0.42, side * 0.135);
      rim.rotation.x = Math.PI / 2;
      rim.castShadow = true;
      T.add(rim);
      const pivot = new THREE.Group();
      pivot.position.copy(eye.position);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), pupilMat);
      pupil.scale.set(er * 0.27, er * 0.52, er * 0.12);
      pupil.position.z = er * 0.97;
      pupil.rotation.z = side * 0.35;
      pivot.add(pupil);
      T.add(pivot);
      this.pupils.push(pivot);
    }

    // The famous pointy collar: a ring of flat felt petals around the neck.
    const petalGeo = new THREE.ConeGeometry(0.1, 0.27, 4);
    petalGeo.translate(0, 0.135, 0);
    const petals = 10;
    for (let i = 0; i < petals; i++) {
      const phi = (i / petals) * Math.PI * 2 + 0.31;
      const petal = new THREE.Mesh(petalGeo, feltDeep);
      petal.scale.set(0.3, 1, 1);
      const base = new THREE.Vector3(0, Math.cos(phi) * 0.15, Math.sin(phi) * 0.19);
      petal.position.set(-0.05, base.y, base.z);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), phi);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.35));
      petal.quaternion.copy(q);
      petal.castShadow = true;
      T.add(petal);
    }

    const d = FROG_DIMS;
    for (const side of [1, -1]) {
      const legMat = side > 0 ? felt : feltDeep;
      const leg: LegRig = {
        thigh: limbMesh(legMat, d.thigh.len, 0.085, 0.065),
        shin: limbMesh(legMat, d.shin.len, 0.06, 0.045),
        foot: new THREE.Group(),
      };
      const ankle = limbMesh(legMat, 0.16, 0.045, 0.04);
      leg.foot.add(ankle);
      const toes = paddle(legMat, 0.32, 0.035, 1.1);
      toes.position.x = 0.12;
      leg.foot.add(toes);
      this.legs.push(leg);
      this.root.add(leg.thigh, leg.shin, leg.foot);

      const arm: ArmRig = {
        arm: limbMesh(legMat, d.arm.len, 0.05, 0.042),
        forearm: limbMesh(legMat, d.forearm.len, 0.042, 0.035),
        hand: paddle(legMat, 0.17, 0.026, 1.0),
      };
      this.arms.push(arm);
      this.root.add(arm.arm, arm.forearm, arm.hand);
    }

    const tongueMat = new THREE.MeshPhysicalMaterial({ color: PALETTE.tongue, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.2 });
    this.tongueMesh = new THREE.Mesh(new THREE.BufferGeometry(), tongueMat);
    this.tongueMesh.castShadow = true;
    this.tongueMesh.frustumCulled = false;
    this.tongueTip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), tongueMat);
    this.tongueTip.castShadow = true;
    this.root.add(this.tongueMesh, this.tongueTip);
  }

  swallowed() {
    this.gulp = 1;
  }

  update(frog: Frog, tongue: Tongue, look: THREE.Vector3 | null, time: number, dt: number) {
    const tp = frog.pose("torso");
    this.torso.position.set(tp.x, tp.y, 0);
    this.torso.rotation.z = tp.angle;

    // Near legs come straight from physics.
    const place = (obj: THREE.Object3D, p: { x: number; y: number; angle: number }, z: number) => {
      obj.position.set(p.x, p.y, z);
      obj.rotation.set(0, 0, p.angle);
    };
    const near = this.legs[0]!;
    place(near.thigh, frog.pose("thigh"), HIND_Z);
    place(near.shin, frog.pose("shin"), HIND_Z);
    place(near.foot, frog.pose("foot"), HIND_Z);
    const nearArm = this.arms[0]!;
    place(nearArm.arm, frog.pose("arm"), FRONT_Z);
    place(nearArm.forearm, frog.pose("forearm"), FRONT_Z);

    // Far legs: same anchors, joint angles replayed slightly late.
    const ta = tp.angle;
    const rel = {
      t: time,
      hip: frog.pose("thigh").angle - ta,
      knee: frog.pose("shin").angle - frog.pose("thigh").angle,
      ankle: frog.pose("foot").angle - frog.pose("shin").angle,
      shoulder: frog.pose("arm").angle - ta,
      elbow: frog.pose("forearm").angle - frog.pose("arm").angle,
    };
    // Only record when simulated time moves, so a paused game doesn't pile up samples.
    if (time > (this.history.at(-1)?.t ?? -1)) this.history.push(rel);
    while (this.history.length > 2 && this.history[1]!.t <= time - FAR_LAG) this.history.shift();
    const lag = this.history[0]!;
    const d = FROG_DIMS;
    const far = this.legs[1]!;
    const hip = this.torsoPoint(tp, d.hip.x, d.hip.y);
    const thighA = ta + lag.hip;
    const knee = { x: hip.x + Math.cos(thighA) * d.thigh.len, y: hip.y + Math.sin(thighA) * d.thigh.len };
    const shinA = thighA + lag.knee;
    const ankle = { x: knee.x + Math.cos(shinA) * d.shin.len, y: knee.y + Math.sin(shinA) * d.shin.len };
    place(far.thigh, { ...hip, angle: thighA }, -HIND_Z);
    place(far.shin, { ...knee, angle: shinA }, -HIND_Z);
    place(far.foot, { ...ankle, angle: shinA + lag.ankle }, -HIND_Z);
    const farArm = this.arms[1]!;
    const sh = this.torsoPoint(tp, d.shoulder.x, d.shoulder.y);
    const armA = ta + lag.shoulder;
    const elbow = { x: sh.x + Math.cos(armA) * d.arm.len, y: sh.y + Math.sin(armA) * d.arm.len };
    place(farArm.arm, { ...sh, angle: armA }, -FRONT_Z);
    place(farArm.forearm, { ...elbow, angle: armA + lag.elbow }, -FRONT_Z);

    // Hands stay roughly flat, fingers forward.
    for (const [i, rig] of this.arms.entries()) {
      const fa = rig.forearm.rotation.z;
      rig.hand.position.set(
        rig.forearm.position.x + Math.cos(fa) * d.forearm.len,
        rig.forearm.position.y + Math.sin(fa) * d.forearm.len - 0.01,
        i === 0 ? FRONT_Z : -FRONT_Z,
      );
      rig.hand.rotation.z = ta * 0.35;
    }

    // Pupils follow the fly (and drift toward the camera, cartoon-style).
    const target = look ? look.clone() : new THREE.Vector3(tp.x + Math.cos(ta) * 4, tp.y + Math.sin(ta) * 4 + 0.5, 0);
    target.z += 2.5;
    for (const p of this.pupils) p.lookAt(target);

    // Occasional blink: squash the eyes.
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 1;
      this.nextBlink = 2 + Math.random() * 4;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    const lid = 1 - Math.sin(this.blink * Math.PI) * 0.85;
    for (const e of this.eyes) e.scale.y = FROG_DIMS.eye.r * lid;
    for (const p of this.pupils) p.scale.y = lid;

    // Jaw flaps open with the tongue, puppet style.
    const wantOpen = tongue.state !== "idle" ? 0.55 : this.gulp > 0.6 ? 0.25 : 0;
    this.jawOpen += (wantOpen - this.jawOpen) * Math.min(1, dt * 30);
    this.jawPivot.rotation.z = -this.jawOpen;

    this.gulp = Math.max(0, this.gulp - dt * 1.6);
    const bulge = Math.sin(Math.min(1, this.gulp) * Math.PI);
    this.throat.visible = bulge > 0.02;
    this.throat.scale.set(0.16 * (0.6 + bulge * 0.6), 0.1 * (0.5 + bulge * 0.9), 0.17 * (0.6 + bulge * 0.6));

    this.updateTongue(tp, tongue, time);
  }

  private torsoPoint(tp: { x: number; y: number; angle: number }, lx: number, ly: number) {
    const c = Math.cos(tp.angle);
    const s = Math.sin(tp.angle);
    return { x: tp.x + lx * c - ly * s, y: tp.y + lx * s + ly * c };
  }

  private updateTongue(tp: { x: number; y: number; angle: number }, tongue: Tongue, time: number) {
    const out = tongue.state !== "idle" && tongue.length > 0.05;
    this.tongueMesh.visible = out;
    this.tongueTip.visible = out;
    if (!out) return;
    const base = this.torsoPoint(tp, 0.42, -0.06);
    const start = new THREE.Vector3(base.x, base.y, 0);
    const end = new THREE.Vector3(tongue.tipX, tongue.tipY, 0);
    const mid = start.clone().lerp(end, 0.5);
    // A little sag and wiggle so it reads as wet and floppy rather than a laser.
    const len = start.distanceTo(end);
    mid.y -= len * (tongue.state === "back" ? 0.12 : 0.04);
    mid.z += Math.sin(time * 40) * 0.02 * len;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    this.tongueMesh.geometry.dispose();
    this.tongueMesh.geometry = new THREE.TubeGeometry(curve, 20, 0.045, 8, false);
    this.tongueTip.position.copy(end);
  }
}
