import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { Map as MapIcon, Play, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { BELLY_SECONDS, SCORING } from "../game/config";
import type { OverReason, Snapshot } from "../game/game";
import { LEVELS, MODES, type Mode } from "../game/levels";
import logo from "../frong.svg";
import { ControlsLegend } from "./KeyPad";

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-4 md:justify-end md:pr-[6%]">
      <Card
        className={cn(
          "w-[min(100%,34rem)] gap-5 border-white/70 bg-card/90 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-300",
          className,
        )}
      >
        {children}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary/70 px-3 py-2">
      <div className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className="font-display text-2xl leading-tight tabular-nums">{value}</div>
    </div>
  );
}

function ModePicker({ mode, onMode }: { mode: Mode; onMode: (mode: Mode) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        value={mode}
        onValueChange={(v) => v && onMode(v as Mode)}
        aria-label="Mode"
        className="w-full"
      >
        {MODES.map((m, i) => (
          <ToggleGroupItem
            key={m}
            value={m}
            className="h-auto flex-1 flex-col gap-1 py-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <span className="font-display text-lg leading-none tracking-wide">{LEVELS[m].name}</span>
            <Kbd className="h-4 min-w-4 bg-black/10 px-1 text-[10px] text-current">{i + 1}</Kbd>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-center text-sm text-muted-foreground">{LEVELS[mode].blurb}</p>
    </div>
  );
}

export function TitleScreen({ snap, onPlay, onMode }: { snap: Snapshot; onPlay: () => void; onMode: (mode: Mode) => void }) {
  const best = snap.best;
  return (
    <Panel>
      <CardHeader className="items-center justify-items-center text-center">
        <img src={logo} alt="" className="size-20 drop-shadow-md" />
        <CardTitle className="font-display text-6xl font-normal tracking-wide text-primary [text-shadow:0_3px_0_oklch(0.42_0.12_142)]">
          FRONG
        </CardTitle>
        <CardDescription className="text-base">Work one felt frog's legs, one muscle group at a time, and snatch flies with your tongue.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ModePicker mode={snap.mode} onMode={onMode} />
        <Separator />
        <ControlsLegend />
        <Separator />
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground [&_b]:text-foreground">
          <li>
            🪰 Each fly is worth up to <b>{SCORING.maxPoints.toLocaleString()} points</b>, and loses value every second it buzzes.
          </li>
          <li>
            🍽️ Each fly fills your belly. Go <b>{BELLY_SECONDS}s</b> without one and you starve.
          </li>
          <li>
            🙃 Land on your back for too long and it's <b>game over</b>.
          </li>
          <li>
            💦 In <b>Medium</b> and <b>Hard</b>, falling in the pond ends the run.
          </li>
        </ul>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button size="lg" className="h-12 w-full font-display text-xl tracking-wide" onClick={onPlay}>
          <Play className="size-5" /> Hop in
          <Kbd className="ml-1 bg-primary-foreground/20 text-primary-foreground">Space</Kbd>
        </Button>
        {best > 0 && (
          <p className="text-sm text-muted-foreground">
            Best on {LEVELS[snap.mode].name}: {best.toLocaleString()}
          </p>
        )}
        <Badge variant="secondary" className="hidden portrait:inline-flex">
          Tip: turn your phone sideways for a bigger pond
        </Badge>
      </CardFooter>
    </Panel>
  );
}

const ENDINGS: Record<OverReason, { emoji: string; title: string; text: string }> = {
  starved: { emoji: "🍽️", title: "Starved!", text: `${BELLY_SECONDS} seconds without a fly. Tragic.` },
  belly: { emoji: "🙃", title: "Belly up!", text: "Your frog flipped over and couldn't get up." },
  splash: { emoji: "💦", title: "Splash!", text: "Your frog fell in the pond. Felt doesn't swim." },
};

export function GameOverScreen({ snap, onPlay, onModes }: { snap: Snapshot; onPlay: () => void; onModes: () => void }) {
  const times = snap.catchTimes;
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
  const fastest = times.length ? Math.min(...times) : null;
  const ending = ENDINGS[snap.overReason ?? "starved"];
  return (
    <Panel>
      <CardHeader className="items-center justify-items-center text-center">
        <div className="text-5xl">{ending.emoji}</div>
        <CardTitle className="font-display text-5xl font-normal text-primary">{ending.title}</CardTitle>
        <CardDescription className="text-base">{ending.text}</CardDescription>
        <Badge variant="secondary">{LEVELS[snap.mode].name} mode</Badge>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="flex flex-col items-center">
          <div className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Final score</div>
          <div className="font-display text-6xl leading-none tabular-nums">{snap.score.toLocaleString()}</div>
          {snap.newBest && <Badge className="mt-2 bg-amber-400 text-amber-950">New best!</Badge>}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Flies" value={snap.flies} />
          <Stat label="Avg catch" value={avg === null ? "—" : `${avg.toFixed(1)}s`} />
          <Stat label="Fastest" value={fastest === null ? "—" : `${fastest.toFixed(1)}s`} />
          <Stat label="Best" value={snap.best.toLocaleString()} />
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2 sm:flex-row">
        <Button size="lg" className="h-12 w-full font-display text-xl tracking-wide sm:flex-1" onClick={onPlay}>
          <RotateCcw className="size-5" /> Again
          <Kbd className="ml-1 bg-primary-foreground/20 text-primary-foreground">Space</Kbd>
        </Button>
        <Button size="lg" variant="outline" className="h-12 w-full sm:w-auto" onClick={onModes}>
          <MapIcon /> Modes
        </Button>
      </CardFooter>
    </Panel>
  );
}

export function PauseScreen({ onResume, onRestart }: { onResume: () => void; onRestart: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-sky-950/20 p-4 backdrop-blur-[2px]">
      <Card className="w-[min(100%,22rem)] gap-4 border-white/70 bg-card/90 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-4xl font-normal text-primary">Paused</CardTitle>
          <CardDescription>The fly is waiting. Smugly.</CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-2">
          <Button size="lg" className="w-full font-display text-lg" onClick={onResume}>
            <Play /> Resume <Kbd className="ml-1 bg-primary-foreground/20 text-primary-foreground">Esc</Kbd>
          </Button>
          <Button size="lg" variant="outline" className="w-full" onClick={onRestart}>
            <RotateCcw /> Restart <Kbd className="ml-1">R</Kbd>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
