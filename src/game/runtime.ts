import { GameView } from "../render/view";
import { Sfx } from "./audio";
import { Game, type Keys } from "./game";
import { MODES, type Mode } from "./levels";

const BEST_KEY = "frong.best";
const MUTED_KEY = "frong.muted";
const MODE_KEY = "frong.mode";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the game still works, it just forgets.
  }
}

/** Keys that are held during play (legs, and T to turn around). */
const PLAY_KEYS: Record<string, keyof Keys> = { KeyQ: "q", KeyW: "w", KeyO: "o", KeyP: "p", KeyT: "t" };
const MODE_DIGITS: Record<string, Mode> = { Digit1: "easy", Digit2: "medium", Digit3: "hard" };

export interface Frong {
  game: Game;
  sfx: Sfx;
  /** Starts (or restarts) a run. */
  play(): void;
  /** Picks the level for the next run (only between runs). */
  setMode(mode: Mode): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

/** Wires the game, renderer, audio and keyboard together and runs the frame loop. */
export function startFrong(container: HTMLElement): Frong {
  const savedMode = read(MODE_KEY) as Mode | null;
  const game = new Game(
    Math.random,
    {
      getBest: (mode) => Number(read(`${BEST_KEY}.${mode}`)) || 0,
      setBest: (mode, n) => write(`${BEST_KEY}.${mode}`, String(n)),
    },
    savedMode && MODES.includes(savedMode) ? savedMode : "easy",
  );
  const view = new GameView(container, game);
  const sfx = new Sfx(read(MUTED_KEY) === "1");
  const unsubSfx = game.onEvent((e) => sfx.handle(e));

  const play = () => {
    sfx.unlock();
    (document.activeElement as HTMLElement | null)?.blur?.();
    game.start();
  };

  const setMode = (mode: Mode) => {
    game.setMode(mode);
    write(MODE_KEY, mode);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    sfx.unlock();
    const held = PLAY_KEYS[e.code];
    if (held) {
      e.preventDefault();
      if (game.phase === "playing") game.setKey(held, true);
      return;
    }
    const mode = MODE_DIGITS[e.code];
    if (mode) {
      if (game.phase === "title" || game.phase === "over") setMode(mode);
      return;
    }
    switch (e.code) {
      case "Space":
        e.preventDefault();
        if (e.repeat) return;
        if (game.phase === "playing") game.setKey("space", true);
        else if (game.phase === "paused") game.togglePause();
        else play();
        break;
      case "Enter":
        e.preventDefault();
        if (game.phase === "paused") game.togglePause();
        else if (game.phase !== "playing") play();
        break;
      case "Escape":
        game.togglePause();
        break;
      case "KeyR":
        if (game.phase !== "title") play();
        break;
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    const held = PLAY_KEYS[e.code];
    if (held) game.setKey(held, false);
    if (e.code === "Space") {
      e.preventDefault();
      game.setKey("space", false);
    }
  };

  const onBlur = () => {
    game.releaseAll();
    game.pause();
  };
  const onVisibility = () => {
    if (document.hidden) onBlur();
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);

  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    game.advance(dt);
    view.render(dt);
    sfx.update(game);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  // `?debug` exposes the game on window for poking at it from the console.
  if (new URLSearchParams(location.search).has("debug")) Object.assign(window, { frong: { game, view, sfx } });

  return {
    game,
    sfx,
    play,
    setMode,
    setMuted(muted) {
      sfx.setMuted(muted);
      write(MUTED_KEY, muted ? "1" : "0");
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubSfx();
      sfx.dispose();
      view.dispose();
    },
  };
}
