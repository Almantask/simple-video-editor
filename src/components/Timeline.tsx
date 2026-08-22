import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createSegmentRange, moveSegment, resizeSegment } from "../engine/playback";
import { drawPeaks } from "../engine/waveform";
import { cn, formatRate, formatTime, newId, rateColor } from "../lib/utils";
import { RATE_PRESETS, type SpeedSegment } from "../types";
import { Button } from "./ui/Button";
import { Slider } from "./ui/Controls";
import { TrashIcon } from "./Icons";

interface TimelineProps {
  duration: number;
  peaks?: Float32Array;
  segments: SpeedSegment[];
  selectedId: string | null;
  getTime: () => number;
  disabled?: boolean;
  onSeek: (time: number) => void;
  onChange: (segments: SpeedSegment[]) => void;
  onSelect: (id: string | null) => void;
}

type Drag =
  | { kind: "create"; origin: number }
  | { kind: "move"; id: string; grab: number }
  | { kind: "resize"; id: string; edge: "start" | "end" }
  | { kind: "playhead" };

export function Timeline({
  duration,
  peaks,
  segments,
  selectedId,
  getTime,
  disabled,
  onSeek,
  onChange,
  onSelect,
}: TimelineProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
  const [hover, setHover] = useState<{ time: number; x: number } | null>(null);

  useEffect(() => {
    const canvas = waveRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
      drawPeaks(ctx, peaks, "rgba(255,255,255,0.16)");
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [peaks]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!playheadRef.current || duration <= 0) return;
      playheadRef.current.style.left = `${(getTime() / duration) * 100}%`;
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [duration, getTime]);

  const timeFromEvent = (event: { clientX: number }) => {
    const lane = rootRef.current;
    if (!lane || duration <= 0) return 0;
    const rect = lane.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    return x * duration;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    const target = event.target as HTMLElement;
    const time = timeFromEvent(event);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    if (target.dataset.edge && target.dataset.id) {
      dragRef.current = { kind: "resize", id: target.dataset.id, edge: target.dataset.edge as "start" | "end" };
      onSelect(target.dataset.id);
      return;
    }
    if (target.dataset.id) {
      const seg = segments.find((s) => s.id === target.dataset.id);
      if (seg) {
        dragRef.current = { kind: "move", id: seg.id, grab: time - seg.start };
        onSelect(seg.id);
      }
      return;
    }
    if (target.dataset.playhead !== undefined || target.dataset.ruler !== undefined) {
      dragRef.current = { kind: "playhead" };
      onSeek(time);
      return;
    }
    dragRef.current = { kind: "create", origin: time };
    onSelect(null);
    setDraft({ start: time, end: time });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const time = timeFromEvent(event);
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setHover({ time, x: event.clientX - rect.left });
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "playhead") {
      onSeek(time);
      return;
    }
    if (drag.kind === "create") {
      const range = createSegmentRange(drag.origin, time, segments, duration);
      setDraft(range);
      return;
    }
    const current = segments.find((s) => s.id === drag.id);
    if (!current) return;
    if (drag.kind === "move") {
      onChange(segments.map((s) => (s.id === current.id ? moveSegment(current, time - drag.grab, segments, duration) : s)));
    } else {
      onChange(segments.map((s) => (s.id === current.id ? resizeSegment(current, drag.edge, time, segments, duration) : s)));
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.kind === "create") {
      const range = createSegmentRange(drag.origin, timeFromEvent(event), segments, duration);
      if (range) {
        const id = newId();
        onChange([...segments, { id, start: range.start, end: range.end, rate: 2 }]);
        onSelect(id);
      }
    }
    setDraft(null);
  };

  const ticks = ticksFor(duration);
  const selected = segments.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="flex h-28 shrink-0 flex-col border-t border-white/8 bg-well px-3 py-2 sm:h-36 sm:px-4 lg:h-40">
      <div
        ref={rootRef}
        className="relative min-h-0 flex-1 touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
      >
        <div data-ruler className="relative h-6 cursor-ew-resize">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-label"
              style={{ left: `${(tick / duration) * 100}%` }}
            >
              {formatTime(tick)}
            </span>
          ))}
        </div>
        <div className="relative h-[calc(100%-1.5rem)] overflow-hidden rounded-xl border border-white/8 bg-black/40">
          <canvas ref={waveRef} className="absolute inset-0 h-full w-full" />
          {draft && duration > 0 && (
            <div
              className="absolute top-2 bottom-2 rounded-full bg-accent/30"
              style={{ left: `${(draft.start / duration) * 100}%`, width: `${((draft.end - draft.start) / duration) * 100}%` }}
            />
          )}
          {segments.map((segment) => {
            const left = (segment.start / duration) * 100;
            const width = ((segment.end - segment.start) / duration) * 100;
            const active = segment.id === selectedId;
            return (
              <div
                key={segment.id}
                data-id={segment.id}
                className={cn(
                  "absolute top-2 bottom-2 flex cursor-grab items-center justify-center rounded-full text-[11px] font-semibold text-bg",
                  active && "z-10",
                )}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: `linear-gradient(180deg, ${rateColor(segment.rate)}, color-mix(in srgb, ${rateColor(segment.rate)} 55%, #000))`,
                  opacity: 0.88,
                  boxShadow: active ? "0 0 0 1px var(--accent), 0 0 16px rgba(34,211,238,0.45)" : undefined,
                }}
              >
                <span data-id={segment.id} className="pointer-events-none">
                  {formatRate(segment.rate)}
                </span>
                <span data-id={segment.id} data-edge="start" className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize" />
                <span data-id={segment.id} data-edge="end" className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize" />
              </div>
            );
          })}
          {hover && !dragRef.current && (
            <div
              className="pointer-events-none absolute -top-1 z-20 rounded-md bg-black/80 px-2 py-0.5 font-mono text-[10px] text-muted"
              style={{ left: Math.min(Math.max(hover.x, 24), (rootRef.current?.clientWidth ?? 0) - 40) }}
            >
              {formatTime(hover.time, true)}
            </div>
          )}
          <div
            ref={playheadRef}
            data-playhead
            className="absolute top-0 z-20 h-full w-px cursor-ew-resize bg-accent"
            style={{ left: 0 }}
          >
            <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-accent" />
          </div>
        </div>
        {selected && (
          <div
            className="glass absolute bottom-[calc(100%+8px)] z-30 hidden w-64 rounded-2xl p-3 lg:block"
            style={{ left: `clamp(8px, ${(selected.start / duration) * 100}%, calc(100% - 16.5rem))` }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between text-xs text-muted">
              <span>
                {formatTime(selected.start, true)} – {formatTime(selected.end, true)}
              </span>
              <Button
                variant="danger"
                className="px-2 py-1"
                onClick={() => {
                  onChange(segments.filter((s) => s.id !== selected.id));
                  onSelect(null);
                }}
              >
                <TrashIcon className="size-4" />
              </Button>
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              {RATE_PRESETS.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    Math.abs(selected.rate - rate) < 0.01 ? "bg-accent text-bg" : "bg-white/10 text-muted hover:text-text",
                  )}
                  onClick={() => onChange(segments.map((s) => (s.id === selected.id ? { ...s, rate } : s)))}
                >
                  {formatRate(rate)}
                </button>
              ))}
            </div>
            <Slider
              min={0.25}
              max={4}
              step={0.05}
              value={selected.rate}
              onChange={(rate) => onChange(segments.map((s) => (s.id === selected.id ? { ...s, rate } : s)))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ticksFor(duration: number): number[] {
  if (duration <= 0) return [];
  const step = duration > 180 ? 30 : duration > 90 ? 15 : duration > 40 ? 10 : duration > 15 ? 5 : duration > 6 ? 2 : 1;
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 0.001; t += step) ticks.push(t);
  return ticks;
}
