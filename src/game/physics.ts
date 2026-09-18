import { Edge, Vec2, World } from "planck";
import { ARENA, GRAVITY, PHYS_DT } from "./config";

export function createWorld() {
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
  edge(left - 20, ARENA.ground, right + 20, ARENA.ground, 1.0, "ground");
  edge(left, ARENA.ground - 1, left, ceiling, 0.3, "wall");
  edge(right, ARENA.ground - 1, right, ceiling, 0.3, "wall");
  edge(left, ceiling, right, ceiling, 0.3, "wall");
  return world;
}

export function stepWorld(world: World) {
  world.step(PHYS_DT, 10, 6);
}
