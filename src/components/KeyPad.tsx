import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type { Keys } from "../game/game";

export const LEG_CONTROLS = [
  { key: "q", cap: "Q", label: "Thighs fwd", hint: "tuck & rear up" },
  { key: "w", cap: "W", label: "Thighs back", hint: "shove off" },
  { key: "o", cap: "O", label: "Calves tuck", hint: "crouch" },
  { key: "p", cap: "P", label: "Calves kick", hint: "hop" },
] as const satisfies readonly { key: keyof Keys; cap: string; label: string; hint: string }[];

interface KeyButtonProps {
  name: keyof Keys;
  cap: string;
  label: string;
  pressed: boolean;
  onKey: (key: keyof Keys, down: boolean) => void;
  className?: string;
}

/** A keycap that lights up with the keyboard and can also be held with a mouse or finger. */
function KeyButton({ name, cap, label, pressed, onKey, className }: KeyButtonProps) {
  const release = () => onKey(name, false);
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`${label} (${cap})`}
      aria-pressed={pressed}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onKey(name, true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "flex touch-none flex-col items-center gap-1 rounded-xl border-2 border-b-4 px-2 py-1.5 transition-all duration-75 select-none",
        "border-white/70 bg-card/85 text-card-foreground shadow-md backdrop-blur",
        pressed && "translate-y-0.5 border-b-2 border-primary bg-primary text-primary-foreground",
        className,
      )}
    >
      <span className="font-display text-xl leading-none pointer-coarse:text-2xl">{cap}</span>
      <span className={cn("text-[10px] leading-none font-bold tracking-wide uppercase", pressed ? "opacity-90" : "text-muted-foreground")}>
        {label}
      </span>
    </button>
  );
}

export function KeyPad({ keys, onKey }: { keys: Keys; onKey: (key: keyof Keys, down: boolean) => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto grid w-full max-w-md grid-cols-4 gap-1.5 sm:flex sm:w-auto sm:max-w-none sm:items-end sm:gap-2">
        {LEG_CONTROLS.slice(0, 2).map((c) => (
          <KeyButton key={c.key} name={c.key} cap={c.cap} label={c.label} pressed={keys[c.key]} onKey={onKey} className="sm:w-20 pointer-coarse:py-3" />
        ))}
        <KeyButton
          name="t"
          cap="T"
          label="Turn"
          pressed={keys.t}
          onKey={onKey}
          className="order-last border-sky-200/80 sm:order-none sm:ml-1 sm:w-20 pointer-coarse:py-3 [&[aria-pressed=true]]:border-sky-500 [&[aria-pressed=true]]:bg-sky-500"
        />
        <KeyButton
          name="space"
          cap="Space"
          label="Lick"
          pressed={keys.space}
          onKey={onKey}
          className="order-last col-span-3 border-pink-200/80 sm:order-none sm:mx-1 sm:w-36 pointer-coarse:py-3 [&[aria-pressed=true]]:border-pink-500 [&[aria-pressed=true]]:bg-pink-500"
        />
        {LEG_CONTROLS.slice(2).map((c) => (
          <KeyButton key={c.key} name={c.key} cap={c.cap} label={c.label} pressed={keys[c.key]} onKey={onKey} className="sm:w-20 pointer-coarse:py-3" />
        ))}
      </div>
    </div>
  );
}

/** Static legend for the title screen. */
export function ControlsLegend() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {LEG_CONTROLS.map((c) => (
        <div key={c.key} className="flex items-center gap-2">
          <Kbd className="h-7 min-w-7 bg-secondary font-display text-base text-secondary-foreground">{c.cap}</Kbd>
          <span>
            <span className="font-semibold">{c.label}</span> <span className="text-muted-foreground">· {c.hint}</span>
          </span>
        </div>
      ))}
      <div className="col-span-2 flex items-center gap-2">
        <Kbd className="h-7 bg-pink-100 px-3 font-display text-base text-pink-700">Space</Kbd>
        <span>
          <span className="font-semibold">Lick</span> <span className="text-muted-foreground">· the tongue shoots where the head points</span>
        </span>
      </div>
      <div className="col-span-2 flex items-center gap-2">
        <Kbd className="h-7 min-w-7 bg-sky-100 font-display text-base text-sky-700">T</Kbd>
        <span>
          <span className="font-semibold">Turn around</span> <span className="text-muted-foreground">· needs feet on the ground</span>
        </span>
      </div>
    </div>
  );
}
