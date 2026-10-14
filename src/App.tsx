import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Hud } from "./components/Hud";
import { KeyPad } from "./components/KeyPad";
import { GameOverScreen, PauseScreen, TitleScreen } from "./components/Screens";
import type { Keys } from "./game/game";
import { startFrong, type Frong } from "./game/runtime";
import "./index.css";

function Overlay({ frong }: { frong: Frong }) {
  const { game } = frong;
  const snap = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const [muted, setMuted] = useState(frong.sfx.muted);

  const onKey = (key: keyof Keys, down: boolean) => {
    frong.sfx.unlock();
    if (game.phase === "playing" || !down) game.setKey(key, down);
  };
  const onMutedChange = (m: boolean) => {
    frong.sfx.unlock();
    frong.setMuted(m);
    setMuted(m);
  };
  const togglePause = () => game.togglePause();

  return (
    <>
      {snap.phase !== "title" && (
        <Hud snap={snap} muted={muted} onMutedChange={onMutedChange} onPause={togglePause} onRestart={frong.play} />
      )}
      {snap.phase === "playing" && <KeyPad keys={snap.keys} onKey={onKey} />}
      {snap.phase === "title" && <TitleScreen snap={snap} onPlay={frong.play} onMode={frong.setMode} />}
      {snap.phase === "over" && <GameOverScreen snap={snap} onPlay={frong.play} onModes={() => frong.setMode(snap.mode)} />}
      {snap.phase === "paused" && <PauseScreen onResume={togglePause} onRestart={frong.play} />}
    </>
  );
}

export function App() {
  const stage = useRef<HTMLDivElement>(null);
  const [frong, setFrong] = useState<Frong | null>(null);

  useEffect(() => {
    const f = startFrong(stage.current!);
    setFrong(f);
    return () => {
      f.dispose();
      setFrong(null);
    };
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <main className="fixed inset-0 overflow-hidden">
        <div ref={stage} className="absolute inset-0" />
        {frong && <Overlay frong={frong} />}
      </main>
    </TooltipProvider>
  );
}

export default App;
