import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Play, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { BELLY_SECONDS, SCORING } from "../game/config";
import type { Snapshot } from "../game/game";
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

export function TitleScreen({ best, onPlay }: { best: number; onPlay: () => void }) {
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
        </ul>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button size="lg" className="h-12 w-full font-display text-xl tracking-wide" onClick={onPlay}>
          <Play className="size-5" /> Hop in
          <Kbd className="ml-1 bg-primary-foreground/20 text-primary-foreground">Space</Kbd>
        </Button>
        {best > 0 && <p className="text-sm text-muted-foreground">Best score: {best.toLocaleString()}</p>}
        <Badge variant="secondary" className="hidden portrait:inline-flex">
          Tip: turn your phone sideways for a bigger pond
        </Badge>
      </CardFooter>
    </Panel>
  );
}

export function GameOverScreen({ snap, onPlay }: { snap: Snapshot; onPlay: () => void }) {
  const times = snap.catchTimes;
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
  const fastest = times.length ? Math.min(...times) : null;
  const starved = snap.overReason === "starved";
  return (
    <Panel>
      <CardHeader className="items-center justify-items-center text-center">
        <div className="text-5xl">{starved ? "🍽️" : "🙃"}</div>
        <CardTitle className="font-display text-5xl font-normal text-primary">{starved ? "Starved!" : "Belly up!"}</CardTitle>
        <CardDescription className="text-base">
          {starved ? `${BELLY_SECONDS} seconds without a fly. Tragic.` : "Your frog flipped over and couldn't get up."}
        </CardDescription>
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
      <CardFooter>
        <Button size="lg" className="h-12 w-full font-display text-xl tracking-wide" onClick={onPlay}>
          <RotateCcw className="size-5" /> Again
          <Kbd className="ml-1 bg-primary-foreground/20 text-primary-foreground">Space</Kbd>
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
