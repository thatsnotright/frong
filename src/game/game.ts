import type { World } from "planck";
import { BELLY_SECONDS, BELLY_UP_GRACE, PHYS_DT, flyValue } from "./config";
import { Fly, type Rng } from "./fly";
import { Frog, type LegKeys } from "./frog";
import { createWorld, stepWorld } from "./physics";
import { Tongue } from "./tongue";

export type Phase = "title" | "playing" | "paused" | "over";
export type OverReason = "belly" | "starved";

export type GameEvent =
  | { type: "start" }
  | { type: "tongue"; locked: boolean }
  | { type: "hit" }
  | { type: "swallow"; points: number; seconds: number; x: number; y: number }
  | { type: "spawn" }
  | { type: "hop"; strength: number }
  | { type: "land"; impact: number }
  | { type: "turn" }
  | { type: "over"; reason: OverReason };

export type Keys = LegKeys & { space: boolean; t: boolean };

export interface Snapshot {
  phase: Phase;
  score: number;
  flies: number;
  flyAge: number;
  flyValue: number;
  /** 1 = just ate, 0 = starved. */
  belly: number;
  /** 0..1 progress toward a belly-up game over. */
  bellyUp: number;
  best: number;
  newBest: boolean;
  catchTimes: number[];
  overReason: OverReason | null;
  keys: Keys;
}

const NO_KEYS: Keys = { q: false, w: false, o: false, p: false, space: false, t: false };
const SNAPSHOT_INTERVAL = 1 / 15;
/** A turn pressed mid-hop (or with the tongue out) still happens if the frog can turn this soon after. */
const TURN_BUFFER = 0.3;

export class Game {
  world!: World;
  frog!: Frog;
  fly: Fly | null = null;
  tongue = new Tongue();
  phase: Phase = "title";
  keys: Keys = { ...NO_KEYS };

  score = 0;
  catchTimes: number[] = [];
  belly = BELLY_SECONDS;
  bellyUpTime = 0;
  overReason: OverReason | null = null;
  best: number;
  newBest = false;
  /** Seconds of simulated time, for animation. */
  time = 0;

  private acc = 0;
  private turnQueued = 0;
  private airTime = 0;
  private wasAirborne = false;
  private peakFallSpeed = 0;
  private snapshot!: Snapshot;
  private snapshotAge = 0;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(e: GameEvent) => void>();

  constructor(
    private rng: Rng = Math.random,
    private storage: { getBest(): number; setBest(n: number): void } = { getBest: () => 0, setBest: () => {} },
  ) {
    this.best = storage.getBest();
    this.reset();
    this.publish();
  }

  private reset() {
    this.world = createWorld();
    this.frog = new Frog(this.world, -3.5);
    this.tongue = new Tongue();
    this.score = 0;
    this.catchTimes = [];
    this.belly = BELLY_SECONDS;
    this.bellyUpTime = 0;
    this.overReason = null;
    this.newBest = false;
    this.acc = 0;
    this.turnQueued = 0;
    this.airTime = 0;
    this.wasAirborne = false;
    this.spawnFly();
  }

  private spawnFly() {
    this.fly = new Fly(this.rng, this.catchTimes.length);
    this.emit({ type: "spawn" });
  }

  start() {
    this.reset();
    this.phase = "playing";
    this.emit({ type: "start" });
    this.publish();
  }

  togglePause() {
    if (this.phase === "playing") this.phase = "paused";
    else if (this.phase === "paused") this.phase = "playing";
    this.keys = { ...NO_KEYS };
    this.publish();
  }

  pause() {
    if (this.phase === "playing") this.togglePause();
  }

  setKey(key: keyof Keys, down: boolean) {
    if (this.keys[key] === down) return;
    this.keys = { ...this.keys, [key]: down };
    if (key === "space" && down) this.lick();
    if (key === "t" && down && this.phase === "playing") this.turnQueued = TURN_BUFFER;
    this.publish();
  }

  releaseAll() {
    this.keys = { ...NO_KEYS };
    this.publish();
  }

  /** Space: flick the tongue toward wherever the head is pointing. */
  private lick() {
    if (this.phase !== "playing" || this.frog.turning) return;
    if (this.tongue.fire(this.frog.mouth(), this.fly)) {
      this.emit({ type: "tongue", locked: this.tongue.locked });
    }
  }

  advance(frameDt: number) {
    if (this.phase === "paused") return;
    this.acc += Math.min(frameDt, 0.1);
    while (this.acc >= PHYS_DT) {
      this.step(PHYS_DT);
      this.acc -= PHYS_DT;
    }
    this.snapshotAge += frameDt;
    if (this.snapshotAge >= SNAPSHOT_INTERVAL) this.publish();
  }

  private step(dt: number) {
    this.time += dt;
    const playing = this.phase === "playing";
    if (this.turnQueued > 0) {
      if (playing && this.tongue.state === "idle" && this.frog.turn()) {
        this.turnQueued = 0;
        this.emit({ type: "turn" });
      } else {
        this.turnQueued = Math.max(0, this.turnQueued - dt);
      }
    }
    this.frog.control(playing ? this.keys : NO_KEYS, dt);
    stepWorld(this.world);

    const mouth = this.frog.mouth();
    this.fly?.update(dt, mouth);

    const ev = this.tongue.update(dt, mouth, this.fly);
    if (ev === "hit") this.emit({ type: "hit" });
    if (ev === "swallow" && this.fly) this.swallow(mouth);

    this.trackHops(dt);
    if (!playing) return;

    this.belly -= dt;
    if (this.belly <= 0) {
      this.belly = 0;
      this.gameOver("starved");
      return;
    }

    if (this.frog.isBellyUp()) {
      this.bellyUpTime += dt;
      if (this.bellyUpTime >= BELLY_UP_GRACE) this.gameOver("belly");
    } else {
      this.bellyUpTime = Math.max(0, this.bellyUpTime - dt * 2);
    }
  }

  private swallow(mouth: { x: number; y: number }) {
    const fly = this.fly!;
    const seconds = fly.age;
    if (this.phase === "playing") {
      const points = flyValue(seconds);
      this.score += points;
      this.catchTimes = [...this.catchTimes, seconds];
      this.belly = BELLY_SECONDS;
      this.emit({ type: "swallow", points, seconds, x: mouth.x, y: mouth.y });
    }
    this.spawnFly();
    this.publish();
  }

  private trackHops(dt: number) {
    const grounded = this.frog.isGrounded();
    const v = this.frog.torso.getLinearVelocity();
    if (!grounded) {
      this.airTime += dt;
      this.peakFallSpeed = Math.max(this.peakFallSpeed, -v.y);
      if (!this.wasAirborne && this.airTime > 0.05) {
        this.wasAirborne = true;
        this.peakFallSpeed = 0;
        if (v.y > 1.5) this.emit({ type: "hop", strength: Math.min(1, v.y / 9) });
      }
    } else {
      if (this.wasAirborne && this.airTime > 0.15) {
        this.emit({ type: "land", impact: Math.min(1, this.peakFallSpeed / 10) });
      }
      this.airTime = 0;
      this.wasAirborne = false;
    }
  }

  private gameOver(reason: OverReason) {
    this.phase = "over";
    this.overReason = reason;
    this.keys = { ...NO_KEYS };
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = this.score > 0;
      this.storage.setBest(this.best);
    }
    this.emit({ type: "over", reason });
    this.publish();
  }

  // --- external store plumbing for React (useSyncExternalStore) ---

  private publish() {
    this.snapshotAge = 0;
    const flyAge = this.fly?.age ?? 0;
    this.snapshot = {
      phase: this.phase,
      score: this.score,
      flies: this.catchTimes.length,
      flyAge,
      flyValue: flyValue(flyAge),
      belly: this.belly / BELLY_SECONDS,
      bellyUp: Math.min(1, this.bellyUpTime / BELLY_UP_GRACE),
      best: this.best,
      newBest: this.newBest,
      catchTimes: this.catchTimes,
      overReason: this.overReason,
      keys: this.keys,
    };
    for (const l of this.listeners) l();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  onEvent(listener: (e: GameEvent) => void) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emit(e: GameEvent) {
    for (const l of this.eventListeners) l(e);
  }
}
