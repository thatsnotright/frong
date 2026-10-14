import { ARENA } from "./config";

export type Mode = "easy" | "medium" | "hard";
export const MODES: readonly Mode[] = ["easy", "medium", "hard"];

export interface Span {
  x0: number;
  x1: number;
}

export interface Level {
  mode: Mode;
  name: string;
  blurb: string;
  /** Solid ground with its top at y = 0, left to right. Everywhere else in the arena is pond. */
  land: (Span & { kind: "bank" | "pad" })[];
  /** Where the frog's torso starts. */
  frogX: number;
  /** New flies appear at least this far (horizontally) from the frog. */
  flyMinDistance: number;
}

const PAD_CENTERS = [-5.25, -1.75, 1.75, 5.25];
const PAD_HALF_WIDTH = 1.05;

export const LEVELS: Record<Mode, Level> = {
  easy: {
    mode: "easy",
    name: "Easy",
    blurb: "Solid ground, wall to wall.",
    land: [{ x0: ARENA.left, x1: ARENA.right, kind: "bank" }],
    frogX: -3.5,
    flyMinDistance: 0,
  },
  medium: {
    mode: "medium",
    name: "Medium",
    blurb: "A pond in the middle. Fall in and it's over.",
    land: [
      { x0: ARENA.left, x1: -1.1, kind: "bank" },
      { x0: 1.1, x1: ARENA.right, kind: "bank" },
    ],
    frogX: -3.5,
    flyMinDistance: 0,
  },
  hard: {
    mode: "hard",
    name: "Hard",
    blurb: "Four lily pads in a pond, and the flies keep their distance.",
    land: PAD_CENTERS.map((c) => ({ x0: c - PAD_HALF_WIDTH, x1: c + PAD_HALF_WIDTH, kind: "pad" as const })),
    frogX: PAD_CENTERS[1]! + 0.15,
    flyMinDistance: 4.5,
  },
};

/** Stretches of open water between the land, within the arena walls. */
export function waterSpans(level: Level): Span[] {
  const spans: Span[] = [];
  let x = ARENA.left;
  for (const l of level.land) {
    if (l.x0 > x) spans.push({ x0: x, x1: l.x0 });
    x = Math.max(x, l.x1);
  }
  if (x < ARENA.right) spans.push({ x0: x, x1: ARENA.right });
  return spans;
}
