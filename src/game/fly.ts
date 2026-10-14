import { ARENA } from "./config";

export type Rng = () => number;

const MARGIN = 0.7;
const HOVER_MIN_Y = 1.1;

/**
 * A housefly that drops in from above the screen, then buzzes between random waypoints.
 * Flies get quicker and jumpier as the frog eats more of them.
 */
export class Fly {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  state: "descending" | "buzzing" | "caught" = "descending";
  /** Seconds since the fly appeared; this is the catch timer. */
  age = 0;

  private tx: number;
  private ty: number;
  private retargetIn = 0;
  private readonly maxSpeed: number;
  private readonly accel: number;
  private readonly hoverMaxY: number;
  private readonly startle: number;
  private phase: number;

  /**
   * `catches` is how many flies the frog has eaten so far. With `avoid`, the fly drops in at least
   * `distance` (horizontally) from `x`.
   */
  constructor(
    private rng: Rng,
    catches: number,
    avoid?: { x: number; distance: number },
  ) {
    this.x = Fly.spawnX(rng, avoid);
    this.y = ARENA.top + 0.9;
    this.maxSpeed = Math.min(4.2, 1.7 + catches * 0.14);
    this.accel = Math.min(16, 6 + catches * 0.5);
    this.hoverMaxY = Math.min(ARENA.flyCeiling, 4.2 + catches * 0.12);
    this.startle = Math.min(2.2, 0.9 + catches * 0.08);
    this.phase = rng() * 100;
    this.tx = this.x + (rng() - 0.5) * 3;
    this.ty = HOVER_MIN_Y + rng() * (this.hoverMaxY - HOVER_MIN_Y);
    this.clampTarget();
    this.vy = -this.maxSpeed;
  }

  private static spawnX(rng: Rng, avoid?: { x: number; distance: number }) {
    const lo = ARENA.left + MARGIN;
    const hi = ARENA.right - MARGIN;
    if (!avoid || avoid.distance <= 0) return lo + rng() * (hi - lo);
    // Pick uniformly from whatever parts of the arena are far enough away.
    const leftLen = Math.max(0, Math.min(hi, avoid.x - avoid.distance) - lo);
    const rightStart = Math.max(lo, avoid.x + avoid.distance);
    const rightLen = Math.max(0, hi - rightStart);
    if (leftLen + rightLen === 0) return avoid.x < 0 ? hi : lo;
    const r = rng() * (leftLen + rightLen);
    return r < leftLen ? lo + r : rightStart + (r - leftLen);
  }

  private clampTarget() {
    this.tx = Math.max(ARENA.left + MARGIN, Math.min(ARENA.right - MARGIN, this.tx));
    this.ty = Math.max(HOVER_MIN_Y, Math.min(this.hoverMaxY, this.ty));
  }

  private pickTarget() {
    const r = this.rng;
    // Mostly short hops around the current spot, occasionally a long dash across the pond.
    const far = r() < 0.25;
    this.tx = this.x + (r() - 0.5) * (far ? 10 : 4);
    this.ty = this.y + (r() - 0.5) * (far ? 4 : 2.2);
    this.clampTarget();
    this.retargetIn = 1.2 + r() * 2.6;
  }

  /** `threat` is the frog's mouth; a fly that gets too close darts away. */
  update(dt: number, threat: { x: number; y: number }) {
    if (this.state === "caught") return;
    this.age += dt;

    if (this.state === "descending") {
      if (this.y - this.ty < 0.4) {
        this.state = "buzzing";
        this.pickTarget();
      }
    } else {
      this.retargetIn -= dt;
      const dx = this.x - threat.x;
      const dy = this.y - threat.y;
      const d = Math.hypot(dx, dy);
      if (d < this.startle && this.retargetIn < 1.6) {
        // Dart away from the frog, biased upward.
        this.tx = this.x + (dx / (d || 1)) * 3 + (this.rng() - 0.5);
        this.ty = this.y + Math.abs(dy / (d || 1)) * 1.5 + 0.8;
        this.clampTarget();
        this.retargetIn = 1.8;
      }
      if (this.retargetIn <= 0 || Math.hypot(this.tx - this.x, this.ty - this.y) < 0.25) this.pickTarget();
    }

    // Seek with arrival, plus a wobble so the path never looks like a straight line.
    const ex = this.tx - this.x;
    const ey = this.ty - this.y;
    const dist = Math.hypot(ex, ey) || 1;
    const speed = Math.min(this.maxSpeed, dist * 2.2 + 0.35);
    const t = this.age * 6 + this.phase;
    const wobX = Math.sin(t * 1.3) * 0.9 + Math.sin(t * 2.9) * 0.5;
    const wobY = Math.cos(t * 1.7) * 0.7 + Math.sin(t * 3.7) * 0.4;
    const desiredX = (ex / dist) * speed + wobX;
    const desiredY = (ey / dist) * speed + wobY;
    const ax = desiredX - this.vx;
    const ay = desiredY - this.vy;
    const am = Math.hypot(ax, ay);
    const maxDv = this.accel * dt;
    const k = am > maxDv ? maxDv / am : 1;
    this.vx += ax * k;
    this.vy += ay * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.state === "buzzing") {
      this.x = Math.max(ARENA.left + 0.3, Math.min(ARENA.right - 0.3, this.x));
      this.y = Math.max(0.6, Math.min(ARENA.flyCeiling + 0.3, this.y));
    }
  }
}
