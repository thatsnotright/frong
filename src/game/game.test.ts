import { describe, expect, test } from "bun:test";
import { BELLY_SECONDS, DEG, PHYS_DT, flyValue } from "./config";
import { Game } from "./game";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function run(game: Game, seconds: number) {
  for (let t = 0; t < seconds; t += PHYS_DT) game.advance(PHYS_DT);
}

describe("frog", () => {
  test("sits still and upright when idle", () => {
    const game = new Game(seeded(1));
    game.start();
    run(game, 1);
    const before = game.frog.pose("torso");
    run(game, 2);
    const after = game.frog.pose("torso");
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.02);
    expect(after.angle / DEG).toBeGreaterThan(15);
    expect(after.angle / DEG).toBeLessThan(40);
  });

  test("P hops forward and lands on its feet", () => {
    const game = new Game(seeded(2));
    game.start();
    run(game, 1);
    const x0 = game.frog.pose("torso").x;
    game.setKey("p", true);
    run(game, 0.5);
    game.setKey("p", false);
    run(game, 2);
    expect(game.frog.pose("torso").x).toBeGreaterThan(x0 + 0.2);
    expect(Math.cos(game.frog.angle)).toBeGreaterThan(0.5);
    expect(game.phase).toBe("playing");
  });

  test("W+P leaps much further than P alone", () => {
    const game = new Game(seeded(3));
    game.start();
    run(game, 1);
    const x0 = game.frog.pose("torso").x;
    game.setKey("w", true);
    game.setKey("p", true);
    run(game, 0.5);
    game.releaseAll();
    run(game, 2);
    expect(game.frog.pose("torso").x - x0).toBeGreaterThan(2.5);
  });
});

describe("tongue", () => {
  test("catches a fly in its sights and scores it", () => {
    const game = new Game(seeded(4));
    game.start();
    run(game, 1);
    const fly = game.fly!;
    const mouth = game.frog.mouth();
    // Park the fly right in front of the frog's face.
    const place = () => {
      fly.x = mouth.x + Math.cos(mouth.angle) * 1.5;
      fly.y = mouth.y + Math.sin(mouth.angle) * 1.5;
      fly.vx = fly.vy = 0;
      fly.state = "buzzing";
    };
    place();
    fly.age = 3;
    const events: string[] = [];
    game.onEvent((e) => events.push(e.type));
    game.setKey("space", true);
    for (let t = 0; t < 1 && game.fly === fly; t += PHYS_DT) {
      if (fly.state !== "caught") place();
      game.advance(PHYS_DT);
    }
    expect(events).toContain("hit");
    expect(events).toContain("swallow");
    expect(game.catchTimes.length).toBe(1);
    expect(game.score).toBe(flyValue(game.catchTimes[0]!));
    expect(game.fly).not.toBe(fly);
  });

  test("misses when aimed away", () => {
    const game = new Game(seeded(5));
    game.start();
    run(game, 1);
    const fly = game.fly!;
    const mouth = game.frog.mouth();
    fly.x = mouth.x - 2;
    fly.y = mouth.y;
    fly.state = "buzzing";
    game.setKey("space", true);
    for (let t = 0; t < 0.5; t += PHYS_DT) {
      fly.x = mouth.x - 2;
      fly.y = mouth.y;
      game.advance(PHYS_DT);
    }
    expect(game.catchTimes.length).toBe(0);
  });
});

describe("rules", () => {
  test("fly value decays with time but never below the floor", () => {
    expect(flyValue(0)).toBe(1000);
    expect(flyValue(5)).toBeGreaterThan(flyValue(10));
    expect(flyValue(1000)).toBe(50);
  });

  test("the frog starves if it goes too long without a fly", () => {
    const game = new Game(seeded(6));
    game.start();
    run(game, BELLY_SECONDS - 1);
    expect(game.phase).toBe("playing");
    run(game, 2);
    expect(game.phase).toBe("over");
    expect(game.overReason).toBe("starved");
  });

  test("best score is persisted on game over", () => {
    let saved = 0;
    const game = new Game(seeded(7), { getBest: () => 100, setBest: (n) => (saved = n) });
    game.start();
    game.score = 500;
    run(game, BELLY_SECONDS + 1);
    expect(saved).toBe(500);
    expect(game.getSnapshot().newBest).toBe(true);
  });
});
