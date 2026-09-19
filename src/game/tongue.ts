import { TONGUE } from "./config";
import type { Fly } from "./fly";

export interface Mouth {
  x: number;
  y: number;
  angle: number;
}

function wrapAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Distance from point (px,py) to segment (ax,ay)-(bx,by). */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export type TongueEvent = "hit" | "swallow" | null;

/**
 * A sticky, kinematic tongue. It shoots along the head direction (nudged toward the fly when the
 * fly is roughly in front of the frog), stays pinned to the head while out, and reels in whatever
 * it touches.
 */
export class Tongue {
  state: "idle" | "out" | "back" = "idle";
  length = 0;
  /** Aim relative to the head direction, fixed at the moment of firing. */
  relAngle = 0;
  holding = false;
  tipX = 0;
  tipY = 0;
  /** True when the aim assist locked onto the fly for the current shot. */
  locked = false;
  private cooldown = 0;

  /** Whether the fly is inside the aim-assist cone right now (drives the target reticle). */
  static inSights(mouth: Mouth, fly: Fly | null) {
    if (!fly || fly.state === "caught") return false;
    const dx = fly.x - mouth.x;
    const dy = fly.y - mouth.y;
    const d = Math.hypot(dx, dy);
    return d < TONGUE.reach + 0.2 && Math.abs(wrapAngle(Math.atan2(dy, dx) - mouth.angle)) < TONGUE.assistCone;
  }

  fire(mouth: Mouth, fly: Fly | null) {
    if (this.state !== "idle" || this.cooldown > 0) return false;
    this.relAngle = 0;
    this.locked = false;
    if (fly && Tongue.inSights(mouth, fly)) {
      // Lead the target by the time the tongue takes to get there.
      const d = Math.hypot(fly.x - mouth.x, fly.y - mouth.y);
      const lead = d / TONGUE.extendSpeed;
      const ax = fly.x + fly.vx * lead - mouth.x;
      const ay = fly.y + fly.vy * lead - mouth.y;
      this.relAngle = wrapAngle(Math.atan2(ay, ax) - mouth.angle);
      this.locked = true;
    }
    this.state = "out";
    this.length = 0;
    this.holding = false;
    this.tipX = mouth.x;
    this.tipY = mouth.y;
    return true;
  }

  update(dt: number, mouth: Mouth, fly: Fly | null): TongueEvent {
    if (this.state === "idle") {
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.length = 0;
      this.tipX = mouth.x;
      this.tipY = mouth.y;
      return null;
    }

    let event: TongueEvent = null;
    const prevX = this.tipX;
    const prevY = this.tipY;

    if (this.state === "out") {
      this.length = Math.min(TONGUE.reach, this.length + TONGUE.extendSpeed * dt);
      if (this.length >= TONGUE.reach) this.state = "back";
    } else {
      this.length = Math.max(0, this.length - TONGUE.retractSpeed * (this.holding ? 0.8 : 1) * dt);
    }

    const a = mouth.angle + this.relAngle;
    this.tipX = mouth.x + Math.cos(a) * this.length;
    this.tipY = mouth.y + Math.sin(a) * this.length;

    if (!this.holding && fly && fly.state !== "caught" && this.length > 0.15) {
      // The tip is sticky along its swept path; the outer half of the tongue is tacky too.
      const r = TONGUE.hitRadius;
      const midX = mouth.x + Math.cos(a) * this.length * 0.5;
      const midY = mouth.y + Math.sin(a) * this.length * 0.5;
      if (
        segDist(fly.x, fly.y, prevX, prevY, this.tipX, this.tipY) < r ||
        segDist(fly.x, fly.y, midX, midY, this.tipX, this.tipY) < r * 0.8
      ) {
        this.holding = true;
        fly.state = "caught";
        this.state = "back";
        event = "hit";
      }
    }

    if (this.holding && fly) {
      fly.x = this.tipX;
      fly.y = this.tipY;
    }

    if (this.state === "back" && this.length <= 0) {
      this.state = "idle";
      this.cooldown = 0.08;
      if (this.holding) {
        this.holding = false;
        event = "swallow";
      }
    }
    return event;
  }
}
