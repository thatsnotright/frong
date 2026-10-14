# Frong

A QWOP-style game about a felt frog with ping-pong-ball eyes. You don't steer the frog;
you work its muscles one group at a time and try to get its tongue onto a fly.

Built with Bun, TypeScript, three.js (rendering), planck.js (Box2D physics) and shadcn/ui.

## Play

```bash
bun install
bun dev          # http://localhost:3000 with hot reload
```

| Key         | Muscle         | What it does                                                                      |
| ----------- | -------------- | --------------------------------------------------------------------------------- |
| `Q`         | Thighs forward | Tucks the legs under and straightens the arms: the frog rears up                  |
| `W`         | Thighs back    | Shoves the legs backward                                                          |
| `O`         | Calves tuck    | Folds the shins into a crouch                                                     |
| `P`         | Calves kick    | Kicks the shins out: a hop                                                        |
| `Space`     | Tongue         | Licks along the head's direction (a ring marks a fly in reach)                    |
| `T`         | –              | Turn around (only with feet on the ground; a press mid-hop waits for the landing) |
| `1` `2` `3` | –              | Pick Easy / Medium / Hard on the title screen                                     |
| `Esc`       | –              | Pause                                                                             |
| `R`         | –              | Restart                                                                           |

Useful combos: `P` hops forward, `W`+`P` leaps (about 3.4 units), `Q`+`P` hops backward, `T` then
`W`+`P` to leap the other way, `Q` then lick for flies overhead. The on-screen keycaps can also be
held with a mouse or finger.

## Modes

| Mode   | Playfield                                                                                 |
| ------ | ----------------------------------------------------------------------------------------- |
| Easy   | Solid bank from wall to wall.                                                             |
| Medium | A pond in the middle. Get close to the edge before you leap it.                           |
| Hard   | Four lily pads in a pond, and each new fly appears at least 4.5 units away from the frog. |

Falling in the water ends the run. Each mode keeps its own best score.

## Rules

- One fly at a time drops in from the top of the screen; when it's eaten, another spawns at a random spot.
- A fly is worth `1000 × e^(−seconds / 15)` points (minimum 50), so the faster the catch, the more
  it's worth. Your score is the sum over every fly eaten.
- Each fly refills the frog's belly. Go 40 seconds without eating and the frog starves.
- Lie belly-up for more than 1.6 seconds and the run is over.
- In Medium and Hard, falling in the pond is game over too.
- Flies get faster and jumpier with every catch.

## Scripts

```bash
bun dev            # dev server with HMR
bun run build      # static build into dist/
bun run publish:pages  # build into ../thatsnotright.github.io/frong (no source maps)
bun start          # serve in production mode
bun test           # physics + rules tests (headless, no browser)
bun run typecheck
```

Add `?debug` to the URL to expose the running game as `window.frong` in the console.

## Publishing

Frong is published at <https://thatsnotright.github.io/frong/> from the
[thatsnotright.github.io](https://github.com/thatsnotright/thatsnotright.github.io) repo, checked
out next to this one. Run `bun run publish:pages`, then commit and push `frong/` in that repo.

## Layout

```
src/
  game/          headless game logic (runs under `bun test`)
    config.ts      arena, tongue, scoring, timer and pond constants
    levels.ts      Easy / Medium / Hard layouts: banks, lily pads, fly spawn distance
    frog.ts        planck ragdoll + QWOP muscle mapping, turning, and all physics tuning
    fly.ts         fly steering / wander / startle AI
    tongue.ts      sticky kinematic tongue with a small aim-assist cone
    game.ts        rules, scoring, events, and the React external store
    audio.ts       Web Audio synth (every sound is generated)
    runtime.ts     wires game + renderer + audio + keyboard into a frame loop
  render/        three.js: Kermit-style felt frog, fly, meadow/pond diorama, particles
  components/    shadcn HUD, title / game-over / pause screens, keypad
```

The physics tuning in `src/game/frog.ts` (`POSE`, `MOTOR`, `BODY`) was tuned against scripted
and random-mash simulations: single keys never flip the frog, but careless combos still can.
