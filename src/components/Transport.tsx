import { cn, formatTime } from "../lib/utils";
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "./Icons";
import { Button } from "./ui/Button";

export function Transport({
  playing,
  current,
  duration,
  visible,
  disabled,
  onToggle,
  onSeek,
}: {
  playing: boolean;
  current: number;
  duration: number;
  visible: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onSeek: (time: number) => void;
}) {
  const pct = duration > 0 ? (current / duration) * 100 : 0;
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-6 z-10 flex justify-center transition-opacity duration-300",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div
        className="glass pointer-events-auto flex w-[min(560px,92%)] items-center gap-2 rounded-full px-3 py-2"
        onClick={(event) => event.stopPropagation()}
      >
        <Button variant="icon" className="size-8" disabled={disabled} onClick={() => onSeek(Math.max(0, current - 5))} aria-label="Back 5 seconds">
          <SkipBackIcon className="size-4" />
        </Button>
        <Button
          variant="icon"
          className="size-10 bg-white/10"
          disabled={disabled}
          onClick={onToggle}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button
          variant="icon"
          className="size-8"
          disabled={disabled}
          onClick={() => onSeek(Math.min(duration, current + 5))}
          aria-label="Forward 5 seconds"
        >
          <SkipForwardIcon className="size-4" />
        </Button>
        <span className="w-24 shrink-0 font-mono text-[11px] text-muted">
          {formatTime(current, true)} / {formatTime(duration)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={Math.min(current, duration || 0)}
          disabled={disabled || duration <= 0}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="flex-1"
          aria-label="Seek"
        />
        <span className="sr-only">{pct.toFixed(0)} percent</span>
      </div>
    </div>
  );
}
