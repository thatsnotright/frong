import { Box, Edge, Vec2, World } from "planck";
import { ARENA, GRAVITY, PHYS_DT, POND } from "./config";
import { waterSpans, type Level } from "./levels";

export function createWorld(level: Level) {
  const world = new World({ gravity: new Vec2(0, GRAVITY) });
  const ground = world.createBody({ type: "static" });
  const { left, right, ceiling } = ARENA;
  const edge = (ax: number, ay: number, bx: number, by: number, friction: number, tag: string) =>
    ground.createFixture({
      shape: new Edge(new Vec2(ax, ay), new Vec2(bx, by)),
      friction,
      restitution: tag === "wall" ? 0.25 : 0,
      userData: tag,
    });

  const wet = waterSpans(level).length > 0;
  const floor = wet ? ARENA.ground - POND.depth : ARENA.ground;
  for (const l of level.land) {
    if (l.kind === "pad") {
      // Lily pads: thin slabs floating with their tops at the waterline.
      const hy = 0.06;
      ground.createFixture({
        shape: new Box((l.x1 - l.x0) / 2, hy, new Vec2((l.x0 + l.x1) / 2, ARENA.ground - hy)),
        friction: 1.0,
        userData: "pad",
      });
      continue;
    }
    // Banks run out past the walls at the arena edges and drop straight into the pond elsewhere.
    const x0 = l.x0 <= left ? left - 20 : l.x0;
    const x1 = l.x1 >= right ? right + 20 : l.x1;
    edge(x0, ARENA.ground, x1, ARENA.ground, 1.0, "ground");
    if (l.x0 > left) edge(l.x0, ARENA.ground, l.x0, floor, 0.3, "bank");
    if (l.x1 < right) edge(l.x1, ARENA.ground, l.x1, floor, 0.3, "bank");
  }
  if (wet) edge(left - 20, floor, right + 20, floor, 1.0, "pond");
  edge(left, floor - 1, left, ceiling, 0.3, "wall");
  edge(right, floor - 1, right, ceiling, 0.3, "wall");
  edge(left, ceiling, right, ceiling, 0.3, "wall");
  return world;
}

export function stepWorld(world: World) {
  world.step(PHYS_DT, 10, 6);
}
