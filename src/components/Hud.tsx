import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { Bug, Pause, Play, RotateCcw, Trophy } from "lucide-react";
import { SCORING } from "../game/config";
import type { Snapshot } from "../game/game";

interface HudProps {
  snap: Snapshot;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  onPause: () => void;
  onRestart: () => void;
}

export function Hud({ snap, muted, onMutedChange, onPause, onRestart }: HudProps) {
  const hungry = snap.belly < 0.25;
  const valueFrac = (snap.flyValue - SCORING.minPoints) / (SCORING.maxPoints - SCORING.minPoints);
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:gap-3 sm:p-4">
        <Card className="pointer-events-auto min-w-24 gap-1 border-white/60 bg-card/85 px-3 py-2.5 shadow-lg backdrop-blur sm:min-w-32 sm:px-4 sm:py-3">
          <div className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Score</div>
          <div className="font-display text-2xl leading-none tabular-nums sm:text-4xl">{snap.score.toLocaleString()}</div>
          <div className="mt-1 flex items-center gap-3 text-sm font-semibold">
            <span className="flex items-center gap-1" title="Flies eaten">
              <Bug className="size-4 text-primary" /> {snap.flies}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground" title="Best score">
              <Trophy className="size-4 text-amber-500" /> {snap.best.toLocaleString()}
            </span>
          </div>
        </Card>

        <Card className="pointer-events-auto w-40 gap-1.5 border-white/60 bg-card/85 px-3 py-2.5 shadow-lg backdrop-blur sm:w-60 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="flex items-center gap-1.5">
              <Bug className="size-4" /> Fly {snap.flies + 1}
            </span>
            <span className="tabular-nums text-muted-foreground">{snap.flyAge.toFixed(1)}s</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={cn(
                "font-display text-3xl leading-none tabular-nums transition-colors",
                valueFrac > 0.6 ? "text-primary" : valueFrac > 0.25 ? "text-amber-500" : "text-orange-600",
              )}
            >
              {snap.flyValue}
              <span className="ml-1 font-sans text-xs font-semibold text-muted-foreground sm:hidden">pts</span>
            </span>
            <span className="hidden text-xs font-semibold text-muted-foreground sm:inline">pts if eaten now</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className={cn("text-[11px] font-bold tracking-wider uppercase", hungry ? "text-destructive" : "text-muted-foreground")}>Belly</span>
            <Progress
              value={snap.belly * 100}
              className={cn(
                "h-2.5 [&>[data-slot=progress-indicator]]:transition-none",
                hungry && "animate-pulse bg-destructive/20 [&>[data-slot=progress-indicator]]:bg-destructive",
              )}
            />
          </div>
        </Card>

        <Card className="pointer-events-auto flex-col items-center gap-1.5 border-white/60 bg-card/85 px-2 py-2 shadow-lg backdrop-blur sm:flex-row sm:gap-2 sm:px-3">
          <div className="flex items-center gap-2">
            <Switch id="sound" checked={!muted} onCheckedChange={(on) => onMutedChange(!on)} />
            <Label htmlFor="sound" className="hidden text-sm sm:block">
              Sound
            </Label>
          </div>
          <Separator orientation="vertical" className="hidden !h-6 sm:block" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={onPause} aria-label={snap.phase === "paused" ? "Resume" : "Pause"}>
                {snap.phase === "paused" ? <Play /> : <Pause />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Pause <Kbd>Esc</Kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={onRestart} aria-label="Restart">
                <RotateCcw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Restart <Kbd>R</Kbd>
            </TooltipContent>
          </Tooltip>
        </Card>
      </div>

      {snap.bellyUp > 0 && snap.phase === "playing" && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-destructive/90 px-6 py-3 text-white shadow-xl">
            <div className="animate-wobble font-display text-3xl [animation:frong-wobble_0.3s_ease-in-out_infinite]">Belly up!</div>
            <div className="text-sm font-semibold">Kick your legs to flip back over</div>
            <Progress value={(1 - snap.bellyUp) * 100} className="h-2 w-40 bg-white/30 [&>[data-slot=progress-indicator]]:bg-white" />
          </div>
        </div>
      )}
    </>
  );
}
