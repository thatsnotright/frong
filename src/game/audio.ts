import type { Game, GameEvent } from "./game";

/** Tiny Web Audio synth: every sound is generated, no assets. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private buzzGain: GainNode | null = null;
  private buzzPan: StereoPannerNode | null = null;
  private buzzOsc: OscillatorNode[] = [];
  muted: boolean;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  /** Must be called from a user gesture (key press / click) the first time. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.startBuzz();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.02);
  }

  private env(gain: GainNode, t: number, peak: number, attack: number, decay: number) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, peak, 0.008, dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private hiss(dur: number, peak: number, filter: BiquadFilterType, f0: number, f1: number, q = 1, delay = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t);
    bq.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this.env(g, t, peak, 0.005, dur);
    src.connect(bq).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private croak(pitch = 1, delay = 0) {
    const ctx = this.ctx!;
    for (const [i, len] of [0.13, 0.1].entries()) {
      const t = ctx.currentTime + delay + i * 0.17;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(95 * pitch * (1 + i * 0.25), t);
      osc.frequency.linearRampToValueAtTime(120 * pitch * (1 + i * 0.25), t + len);
      // Amplitude-modulate with a buzzy square for the "rrr" in ribbit.
      const am = ctx.createGain();
      am.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.type = "square";
      lfo.frequency.value = 32;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain).connect(am.gain);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 650 + i * 250;
      bp.Q.value = 2.5;
      const g = ctx.createGain();
      this.env(g, t, 0.5, 0.015, len);
      osc.connect(am).connect(bp).connect(g).connect(this.master);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + len + 0.05);
      lfo.stop(t + len + 0.05);
    }
  }

  private startBuzz() {
    const ctx = this.ctx!;
    this.buzzGain = ctx.createGain();
    this.buzzGain.gain.value = 0;
    this.buzzPan = ctx.createStereoPanner();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1100;
    bp.Q.value = 0.9;
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 7;
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = 14;
    wobble.connect(wobbleDepth);
    for (const f of [205, 211]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      wobbleDepth.connect(o.frequency);
      o.connect(bp);
      o.start();
      this.buzzOsc.push(o);
    }
    wobble.start();
    this.buzzOsc.push(wobble);
    bp.connect(this.buzzGain).connect(this.buzzPan).connect(this.master);
  }

  handle(e: GameEvent) {
    if (!this.ctx) return;
    switch (e.type) {
      case "tongue":
        this.hiss(0.09, 0.35, "bandpass", 900, 3200, 2.5);
        this.tone("sine", 260, 900, 0.08, 0.12);
        break;
      case "hit":
        this.hiss(0.05, 0.3, "lowpass", 2500, 600);
        this.tone("triangle", 1300, 1700, 0.05, 0.08);
        break;
      case "swallow": {
        this.tone("sine", 420, 110, 0.18, 0.5);
        this.tone("sine", 600, 950, 0.06, 0.18, 0.16);
        // Little reward arpeggio; brighter for quicker catches.
        const base = e.points > 700 ? 880 : e.points > 350 ? 784 : 659;
        [1, 1.25, 1.5].forEach((m, i) => this.tone("triangle", base * m, base * m, 0.12, 0.12, 0.22 + i * 0.07));
        break;
      }
      case "hop":
        this.tone("triangle", 160 + e.strength * 60, 380 + e.strength * 260, 0.14, 0.15 + e.strength * 0.15);
        break;
      case "land":
        if (e.impact < 0.08) break;
        this.tone("sine", 140, 45, 0.12, 0.25 + e.impact * 0.4);
        this.hiss(0.07, 0.12 + e.impact * 0.2, "lowpass", 600, 200);
        break;
      case "turn":
        // A quick felt swish as the frog spins around.
        this.hiss(0.16, 0.16, "bandpass", 500, 1600, 1.2);
        this.tone("triangle", 300, 420, 0.1, 0.06, 0.04);
        break;
      case "splash":
        this.hiss(0.45, 0.5, "lowpass", 3200, 300);
        this.hiss(0.25, 0.25, "bandpass", 1800, 700, 1.5, 0.05);
        // Bloop as it goes under.
        this.tone("sine", 520, 130, 0.22, 0.3, 0.08);
        break;
      case "start":
        this.croak(1.15);
        break;
      case "over": {
        const pitch = e.reason === "starved" ? 0.8 : e.reason === "splash" ? 0.9 : 1;
        this.croak(pitch, e.reason === "splash" ? 0.35 : 0);
        this.croak(pitch * 0.88, e.reason === "splash" ? 0.8 : 0.45);
        break;
      }
    }
  }

  /** Keep the fly's buzz panned to its position and louder when close to the frog. */
  update(game: Game) {
    if (!this.ctx || !this.buzzGain || !this.buzzPan) return;
    const fly = game.fly;
    const t = this.ctx.currentTime;
    let vol = 0;
    if (fly && game.phase !== "paused" && fly.state !== "caught") {
      const m = game.frog.mouth();
      const d = Math.hypot(fly.x - m.x, fly.y - m.y);
      vol = 0.025 + 0.09 / (1 + d * 0.6);
      if (game.phase !== "playing") vol *= 0.4;
    }
    this.buzzGain.gain.setTargetAtTime(vol, t, 0.05);
    if (fly) this.buzzPan.pan.setTargetAtTime(Math.max(-1, Math.min(1, fly.x / 9)), t, 0.05);
  }

  dispose() {
    for (const o of this.buzzOsc) o.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
