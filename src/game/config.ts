export const DEG = Math.PI / 180;

/** Fixed physics timestep (seconds). Small steps keep the ragdoll stable under strong motors. */
export const PHYS_DT = 1 / 240;
export const GRAVITY = -16;

/** Playfield in world units. The camera always frames `left..right` and `ground..top`. */
export const ARENA = {
  left: -7,
  right: 7,
  ground: 0,
  /** Highest point the camera guarantees to show. Flies spawn just above it. */
  top: 7.2,
  /** Flies stay below this so they never hide behind the HUD. */
  flyCeiling: 5.6,
  /** Invisible lid so an over-enthusiastic frog can't leave the arena. */
  ceiling: 13,
};

export const TONGUE = {
  reach: 2.7,
  extendSpeed: 30,
  retractSpeed: 16,
  /** Half-angle of the aim-assist cone around the head direction. */
  assistCone: 28 * DEG,
  /** Extra forgiveness when testing the tongue against the fly. */
  hitRadius: 0.24,
  /** The mouth tilts slightly upward relative to the torso axis. */
  mouthTilt: 10 * DEG,
};

export const SCORING = {
  maxPoints: 1000,
  minPoints: 50,
  /** Seconds for a fly's value to fall to ~37% of max. */
  decaySeconds: 15,
};

/** Seconds the frog may lie on its back before the run ends. */
export const BELLY_UP_GRACE = 1.6;

export function flyValue(seconds: number): number {
  const v = SCORING.maxPoints * Math.exp(-seconds / SCORING.decaySeconds);
  return Math.max(SCORING.minPoints, Math.round(v));
}

/** A fly fills the frog's belly; if it empties before the next fly, the frog starves. */
export const BELLY_SECONDS = 40;

/** Seconds the frog spends spinning around to face the other way (T). */
export const TURN_SECONDS = 0.24;
