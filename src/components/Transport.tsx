import { cn, formatTime } from "../lib/utils";
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "./Icons";
import { Button } from "./ui/Button";

export function Transport({
  playing,
  current,
  duration,
  visible,
  disabled,
  placement = "overlay",
  onToggle,
  onSeek,
}: {
  playing: boolean;
  current: number;
  duration: number;
  visible: boolean;
  disabled?: boolean;
  placement?: "overlay" | "docked";
  onToggle: () => void;
  onSeek: (time: number) => void;
}) {
  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const docked = placement === "docked";
  return (
    <div
      className={cn(
        "z-10 flex justify-center transition-opacity duration-300",
        docked ? "relative" : "absolute inset-x-0 bottom-6",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div
        className={cn(
          "glass pointer-events-auto flex items-center gap-1 rounded-full px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2",
          docked ? "w-full" : "w-[min(560px,92%)]",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          variant="icon"
          className="hidden size-8 sm:grid"
          disabled={disabled}
          onClick={() => onSeek(Math.max(0, current - 5))}
          aria-label="Back 5 seconds"
        >
          <SkipBackIcon className="size-4" />
        </Button>
        <Button
          variant="icon"
          className="size-10 shrink-0 bg-white/10"
          disabled={disabled}
          onClick={onToggle}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button
          variant="icon"
          className="hidden size-8 sm:grid"
          disabled={disabled}
          onClick={() => onSeek(Math.min(duration, current + 5))}
          aria-label="Forward 5 seconds"
        >
          <SkipForwardIcon className="size-4" />
        </Button>
        <span className="w-[4.5rem] shrink-0 font-mono text-[10px] text-muted sm:w-24 sm:text-[11px]">
          {formatTime(current, !docked)} / {formatTime(duration)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={Math.min(current, duration || 0)}
          disabled={disabled || duration <= 0}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="min-w-0 flex-1"
          aria-label="Seek"
        />
        <span className="sr-only">{pct.toFixed(0)} percent</span>
      </div>
    </div>
  );
}
