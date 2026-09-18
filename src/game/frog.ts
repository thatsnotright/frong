import { Circle, Polygon, RevoluteJoint, Vec2, type Body, type World } from "planck";
import { DEG, TONGUE } from "./config";

export type LegKeys = { q: boolean; w: boolean; o: boolean; p: boolean };

/** All frog fixtures share a negative group so the ragdoll never collides with itself. */
const FROG_GROUP = -1;

export const FROG_DIMS = {
  thigh: { len: 0.5, r: 0.085 },
  shin: { len: 0.5, r: 0.065 },
  foot: { len: 0.46, r: 0.04 },
  arm: { len: 0.36, r: 0.05 },
  forearm: { len: 0.34, r: 0.042 },
  handR: 0.055,
  /** Anchor points in torso space (x points out of the frog's nose). */
  hip: { x: -0.4, y: -0.1 },
  shoulder: { x: 0.28, y: -0.14 },
  mouth: { x: 0.64, y: -0.05 },
  eye: { x: 0.3, y: 0.24, r: 0.15 },
};

/**
 * Torso outline (body + head, Kermit proportions: the head is most of it).
 * Counter-clockwise, torso space.
 */
const TORSO_OUTLINE: [number, number][] = [
  [-0.56, -0.02],
  [-0.47, -0.17],
  [-0.12, -0.24],
  [0.36, -0.22],
  [0.6, -0.11],
  [0.67, 0.02],
  [0.56, 0.17],
  [0.24, 0.25],
  [-0.16, 0.23],
  [-0.46, 0.13],
];

/** Joint angles are child.angle - parent.angle (reference angle 0), in radians. */
export const POSE = {
  torso: 27 * DEG,
  hip: { rest: -42 * DEG, flex: -8 * DEG, extend: -150 * DEG, lo: -165 * DEG, hi: -2 * DEG },
  knee: { rest: -138 * DEG, flex: -162 * DEG, extend: -6 * DEG, lo: -168 * DEG, hi: 0 },
  ankle: { rest: 150 * DEG, flex: 166 * DEG, extend: 12 * DEG, lo: 4 * DEG, hi: 172 * DEG },
  shoulder: { rest: -120 * DEG, rearUp: -112 * DEG, lo: -175 * DEG, hi: -30 * DEG },
  elbow: { rest: 40 * DEG, rearUp: -5 * DEG, lo: -25 * DEG, hi: 80 * DEG },
};

/** Motor tuning: kp converts angle error to motor speed; torque caps how hard the motor can push. */
export const MOTOR = {
  hip: { kp: 22, maxSpeed: 16, torque: 30, relax: 9.6 },
  knee: { kp: 26, maxSpeed: 24, torque: 34, relax: 10.8 },
  ankle: { kp: 26, maxSpeed: 26, torque: 16, relax: 6.6 },
  shoulder: { kp: 12, maxSpeed: 10, torque: 12, relax: 7 },
  elbow: { kp: 12, maxSpeed: 10, torque: 8, relax: 5 },
};

export const BODY = {
  torsoDensity: 1.0,
  legDensity: 2.0,
  footDensity: 2.2,
  armDensity: 1.6,
  torsoAngularDamping: 0.4,
  limbAngularDamping: 0.6,
  /** Torque pulling the torso back toward level while airborne (a frog's righting reflex). */
  airRighting: 8,
  airRightingDamping: 1,
  /**
   * On the ground the frog settles back into its sitting pose (unless Q is rearing it up on purpose),
   * so every hop starts from the same place instead of compounding the last landing.
   */
  groundRighting: 8,
  groundRightingDamping: 0.5,
  /** How far (0..1) the thigh follows a calf kick when Q/W are idle, and with what fraction of hip torque. */
  hipCoupling: 1,
  hipCouplingTorque: 0.7,
};

interface Servo {
  joint: RevoluteJoint;
  kp: number;
  maxSpeed: number;
  torque: number;
  relax: number;
}

export type FrogPartName = "torso" | "thigh" | "shin" | "foot" | "arm" | "forearm";

export interface PartPose {
  x: number;
  y: number;
  angle: number;
}

function capsulePoly(len: number, r: number): Polygon {
  const k = r * 0.5;
  return new Polygon([
    new Vec2(0, -r * 0.55),
    new Vec2(k, -r),
    new Vec2(len - k, -r),
    new Vec2(len, -r * 0.55),
    new Vec2(len, r * 0.55),
    new Vec2(len - k, r),
    new Vec2(k, r),
    new Vec2(0, r * 0.55),
  ]);
}

function polar(len: number, angle: number) {
  return { x: Math.cos(angle) * len, y: Math.sin(angle) * len };
}

export class Frog {
  readonly torso: Body;
  readonly thigh: Body;
  readonly shin: Body;
  readonly foot: Body;
  readonly arm: Body;
  readonly forearm: Body;

  private hip: Servo;
  private knee: Servo;
  private ankle: Servo;
  private shoulder: Servo;
  private elbow: Servo;

  constructor(private world: World, x: number) {
    const d = FROG_DIMS;
    const a0 = POSE.torso;

    // Lay out the rest pose relative to a torso at the origin, then lift it so the lowest point touches y=0.
    const rot = (px: number, py: number, a: number) => ({
      x: px * Math.cos(a) - py * Math.sin(a),
      y: px * Math.sin(a) + py * Math.cos(a),
    });
    const hipP = rot(d.hip.x, d.hip.y, a0);
    const thighA = a0 + POSE.hip.rest;
    const kneeP = { x: hipP.x + polar(d.thigh.len, thighA).x, y: hipP.y + polar(d.thigh.len, thighA).y };
    const shinA = thighA + POSE.knee.rest;
    const ankleP = { x: kneeP.x + polar(d.shin.len, shinA).x, y: kneeP.y + polar(d.shin.len, shinA).y };
    const footA = shinA + POSE.ankle.rest;
    const shoulderP = rot(d.shoulder.x, d.shoulder.y, a0);
    const armA = a0 + POSE.shoulder.rest;
    const elbowP = {
      x: shoulderP.x + polar(d.arm.len, armA).x,
      y: shoulderP.y + polar(d.arm.len, armA).y,
    };
    const foreA = armA + POSE.elbow.rest;

    const footBottom = Math.min(ankleP.y, ankleP.y + polar(d.foot.len, footA).y) - d.foot.r;
    const handBottom = elbowP.y + polar(d.forearm.len, foreA).y - d.handR;
    const lift = -Math.min(footBottom, handBottom) + 0.01;
    const at = (p: { x: number; y: number }) => new Vec2(x + p.x, p.y + lift);

    const fixture = (density: number, friction: number) => ({
      density,
      friction,
      restitution: 0,
      filterGroupIndex: FROG_GROUP,
    });

    this.torso = world.createBody({
      type: "dynamic",
      position: at({ x: 0, y: 0 }),
      angle: a0,
      angularDamping: BODY.torsoAngularDamping,
      linearDamping: 0.05,
    });
    this.torso.createFixture({
      shape: new Polygon(TORSO_OUTLINE.map(([px, py]) => new Vec2(px, py))),
      ...fixture(BODY.torsoDensity, 0.5),
      userData: "torso",
    });
    // Ping-pong eyes stick up above the head; give them a collider so they never sink into the ground.
    this.torso.createFixture({
      shape: new Circle(new Vec2(d.eye.x, d.eye.y), d.eye.r),
      ...fixture(0.2, 0.5),
      userData: "eyes",
    });

    const limb = (len: number, r: number, pos: { x: number; y: number }, angle: number, density: number, friction: number, tag: string) => {
      const b = world.createBody({
        type: "dynamic",
        position: at(pos),
        angle,
        angularDamping: BODY.limbAngularDamping,
        linearDamping: 0.05,
      });
      b.createFixture({ shape: capsulePoly(len, r), ...fixture(density, friction), userData: tag });
      return b;
    };

    // One simulated leg stands in for the near + far pair (density doubled); the renderer draws both.
    this.thigh = limb(d.thigh.len, d.thigh.r, hipP, thighA, BODY.legDensity, 0.6, "thigh");
    this.shin = limb(d.shin.len, d.shin.r, kneeP, shinA, BODY.legDensity, 0.6, "shin");
    this.foot = limb(d.foot.len, d.foot.r, ankleP, footA, BODY.footDensity, 1.6, "foot");
    this.arm = limb(d.arm.len, d.arm.r, shoulderP, armA, BODY.armDensity, 0.6, "arm");
    this.forearm = limb(d.forearm.len, d.forearm.r, elbowP, foreA, BODY.armDensity, 0.6, "forearm");
    this.forearm.createFixture({
      shape: new Circle(new Vec2(d.forearm.len, 0), d.handR),
      ...fixture(BODY.armDensity, 1.4),
      userData: "hand",
    });

    this.hip = this.servo(this.torso, this.thigh, at(hipP), POSE.hip, MOTOR.hip);
    this.knee = this.servo(this.thigh, this.shin, at(kneeP), POSE.knee, MOTOR.knee);
    this.ankle = this.servo(this.shin, this.foot, at(ankleP), POSE.ankle, MOTOR.ankle);
    this.shoulder = this.servo(this.torso, this.arm, at(shoulderP), POSE.shoulder, MOTOR.shoulder);
    this.elbow = this.servo(this.arm, this.forearm, at(elbowP), POSE.elbow, MOTOR.elbow);
  }

  private servo(
    a: Body,
    b: Body,
    anchor: Vec2,
    pose: { lo: number; hi: number },
    m: { kp: number; maxSpeed: number; torque: number; relax: number },
  ): Servo {
    const joint = this.world.createJoint(
      new RevoluteJoint({
        bodyA: a,
        bodyB: b,
        localAnchorA: a.getLocalPoint(anchor),
        localAnchorB: b.getLocalPoint(anchor),
        referenceAngle: 0,
        enableLimit: true,
        lowerAngle: pose.lo,
        upperAngle: pose.hi,
        enableMotor: true,
        maxMotorTorque: m.relax,
        motorSpeed: 0,
      }),
    ) as RevoluteJoint;
    return { joint, ...m };
  }

  private drive(s: Servo, target: number, active: boolean) {
    const err = target - s.joint.getJointAngle();
    const speed = Math.max(-s.maxSpeed, Math.min(s.maxSpeed, err * s.kp));
    s.joint.setMotorSpeed(speed);
    s.joint.setMaxMotorTorque(active ? s.torque : s.relax);
  }

  /**
   * QWOP mapping: Q/W swing the thighs (hips), O/P fold/kick the calves (knees + ankles).
   * Releasing both keys of a pair lets that joint drift back toward the sitting pose.
   * Call once per physics step.
   */
  control(keys: LegKeys) {
    if (keys.q || keys.w) {
      const hipTarget = keys.q && !keys.w ? POSE.hip.flex : keys.w && !keys.q ? POSE.hip.extend : POSE.hip.rest;
      this.drive(this.hip, hipTarget, true);
    } else {
      // Frog thigh muscles span the knee too: kicking the calves drags the thigh back with it,
      // so a lone P is a proper hop instead of a faceplant.
      const k = POSE.knee;
      const kick = Math.max(0, Math.min(1, (this.knee.joint.getJointAngle() - k.rest) / (k.extend - k.rest)));
      const target = POSE.hip.rest + (POSE.hip.extend - POSE.hip.rest) * kick * BODY.hipCoupling;
      this.drive(this.hip, target, false);
      if (keys.p && !keys.o) this.hip.joint.setMaxMotorTorque(this.hip.torque * BODY.hipCouplingTorque);
    }

    const kneeTarget = keys.o && !keys.p ? POSE.knee.flex : keys.p && !keys.o ? POSE.knee.extend : POSE.knee.rest;
    const ankleTarget = keys.o && !keys.p ? POSE.ankle.flex : keys.p && !keys.o ? POSE.ankle.extend : POSE.ankle.rest;
    this.drive(this.knee, kneeTarget, keys.o || keys.p);
    this.drive(this.ankle, ankleTarget, keys.o || keys.p);

    // Front legs are springs that prop the head up and soak up landings. Tucking the thighs (Q)
    // also straightens them, so the frog rears up and looks skyward.
    const rearUp = keys.q && !keys.w;
    this.drive(this.shoulder, rearUp ? POSE.shoulder.rearUp : POSE.shoulder.rest, rearUp);
    this.drive(this.elbow, rearUp ? POSE.elbow.rearUp : POSE.elbow.rest, rearUp);

    const a = this.torso.getAngle();
    const err = Math.atan2(Math.sin(POSE.torso - a), Math.cos(POSE.torso - a));
    if (!this.isGrounded()) {
      this.torso.applyTorque(err * BODY.airRighting - this.torso.getAngularVelocity() * BODY.airRightingDamping);
    } else if (Math.cos(a) > 0 && !keys.q) {
      this.torso.applyTorque(err * BODY.groundRighting - this.torso.getAngularVelocity() * BODY.groundRightingDamping);
    }
  }

  get angle() {
    return this.torso.getAngle();
  }

  /** World position of the mouth and the direction the head is pointing. */
  mouth() {
    const p = this.torso.getWorldPoint(new Vec2(FROG_DIMS.mouth.x, FROG_DIMS.mouth.y));
    return { x: p.x, y: p.y, angle: this.torso.getAngle() + TONGUE.mouthTilt };
  }

  /** True when the frog is upside down and resting on something. */
  isBellyUp() {
    return Math.cos(this.torso.getAngle()) < -0.25 && this.isGrounded();
  }

  isGrounded() {
    for (const b of [this.foot, this.forearm, this.torso, this.shin]) {
      for (let ce = b.getContactList(); ce; ce = ce.next) {
        if (ce.contact.isTouching()) return true;
      }
    }
    return false;
  }

  pose(part: FrogPartName): PartPose {
    const b = this[part];
    const p = b.getPosition();
    return { x: p.x, y: p.y, angle: b.getAngle() };
  }
}
