import { useEffect, useRef, type DragEvent } from "react";
import { currentLyric } from "../engine/lyrics";
import { resolveInsertWindow } from "../engine/playback";
import { pickMime } from "../engine/exporter";
import { drawVisualizerCard } from "../engine/visualizers";
import { cn, formatRate, formatTime, newId } from "../lib/utils";
import type {
  ExportResolution,
  FitMode,
  InspectorTab,
  LyricLine,
  SpeedSegment,
  VisualizerId,
} from "../types";
import { RATE_PRESETS } from "../types";
import { DownloadIcon, SaveIcon, TrashIcon, UploadIcon } from "./Icons";
import { Button, FieldLabel } from "./ui/Button";
import { SegmentedControl, Slider } from "./ui/Controls";

const TABS: { id: InspectorTab; label: string }[] = [
  { id: "speed", label: "Speed" },
  { id: "lyrics", label: "Lyrics" },
  { id: "visual", label: "Visual" },
  { id: "export", label: "File" },
];

const VISUALS: { id: VisualizerId; label: string }[] = [
  { id: "none", label: "None" },
  { id: "bars", label: "Bars" },
  { id: "wave", label: "Wave" },
  { id: "ring", label: "Ring" },
];

export interface InspectorProps {
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  duration: number;
  currentTime: number;
  segments: SpeedSegment[];
  selectedId: string | null;
  onSegments: (segments: SpeedSegment[]) => void;
  onSelect: (id: string | null) => void;
  lyrics: LyricLine[];
  lyricsEmbedded: boolean;
  showLyrics: boolean;
  lyricFontSize: number;
  lyricColor: string;
  onShowLyrics: (value: boolean) => void;
  onLyricFontSize: (value: number) => void;
  onLyricColor: (value: string) => void;
  onLyricsFile: (file: File) => void | Promise<void>;
  visualizer: VisualizerId;
  visualizerOpacity: number;
  visualizerColor: string;
  onVisualizer: (id: VisualizerId) => void;
  onVisualizerOpacity: (value: number) => void;
  onVisualizerColor: (value: string) => void;
  getAnalyser: () => { freq: Uint8Array; time: Uint8Array };
  resolution: ExportResolution;
  fit: FitMode;
  onResolution: (value: ExportResolution) => void;
  onFit: (value: FitMode) => void;
  exporting: boolean;
  onExport: () => void;
  onSaveLibrary: () => void;
  notify: (text: string, tone?: "info" | "error") => void;
}

export function Inspector(props: InspectorProps) {
  return (
    <aside className="glass flex h-72 w-full shrink-0 flex-col overflow-hidden lg:h-auto lg:w-[360px]">
      <div className="p-3">
        <SegmentedControl options={TABS} value={props.tab} onChange={props.onTab} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {props.tab === "speed" && <SpeedPanel {...props} />}
        {props.tab === "lyrics" && <LyricsPanel {...props} />}
        {props.tab === "visual" && <VisualPanel {...props} />}
        {props.tab === "export" && <ExportPanel {...props} />}
      </div>
    </aside>
  );
}

function SpeedPanel({
  duration,
  currentTime,
  segments,
  selectedId,
  onSegments,
  onSelect,
  notify,
}: InspectorProps) {
  const selected = segments.find((s) => s.id === selectedId) ?? null;
  const addAt = (rate: number, start = currentTime, end = currentTime + 2) => {
    const range = resolveInsertWindow(start, end, segments, duration);
    if (!range) {
      notify("No space for a speed change there.", "error");
      return;
    }
    const segment: SpeedSegment = { id: newId(), start: range.start, end: range.end, rate };
    onSegments([...segments, segment]);
    onSelect(segment.id);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">Video only — music stays at 1x.</p>
      <div>
        <FieldLabel>Presets</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {RATE_PRESETS.map((rate) => (
            <button
              key={rate}
              type="button"
              className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-muted hover:text-text"
              onClick={() => (selected ? onSegments(segments.map((s) => (s.id === selected.id ? { ...s, rate } : s))) : addAt(rate))}
            >
              {formatRate(rate)}
            </button>
          ))}
        </div>
      </div>
      <AddInterval duration={duration} currentTime={currentTime} onAdd={(start, end) => addAt(2, start, end)} />
      {segments.length === 0 ? (
        <p className="text-sm text-muted">Drag on the timeline to add a speed change.</p>
      ) : (
        <ul className="space-y-2">
          {segments
            .slice()
            .sort((a, b) => a.start - b.start)
            .map((segment) => (
              <li
                key={segment.id}
                className={cn(
                  "rounded-2xl border px-3 py-2",
                  segment.id === selectedId ? "border-accent/50 bg-white/5" : "border-white/8",
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(segment.id)}>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-bg"
                      style={{ background: segment.rate < 1 ? "var(--slow)" : segment.rate > 1 ? "var(--accent)" : "rgba(255,255,255,0.35)" }}
                    >
                      {formatRate(segment.rate)}
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      {formatTime(segment.start, true)}–{formatTime(segment.end, true)}
                    </span>
                  </button>
                  <Button
                    variant="danger"
                    className="px-2 py-1"
                    onClick={() => {
                      onSegments(segments.filter((s) => s.id !== segment.id));
                      if (selectedId === segment.id) onSelect(null);
                    }}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
                {segment.id === selectedId && (
                  <div className="mt-2">
                    <Slider
                      min={0.25}
                      max={4}
                      step={0.05}
                      value={segment.rate}
                      onChange={(rate) => onSegments(segments.map((s) => (s.id === segment.id ? { ...s, rate } : s)))}
                    />
                  </div>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function AddInterval({
  duration,
  currentTime,
  onAdd,
}: {
  duration: number;
  currentTime: number;
  onAdd: (start: number, end: number) => void;
}) {
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <FieldLabel>Add interval</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          ref={startRef}
          type="number"
          min={0}
          max={duration}
          step={0.1}
          defaultValue={Number(currentTime.toFixed(1))}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-xs"
          aria-label="Start time"
        />
        <span className="text-label">–</span>
        <input
          ref={endRef}
          type="number"
          min={0}
          max={duration}
          step={0.1}
          defaultValue={Number(Math.min(duration, currentTime + 2).toFixed(1))}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-xs"
          aria-label="End time"
        />
        <Button
          onClick={() => {
            const start = Number(startRef.current?.value ?? currentTime);
            const end = Number(endRef.current?.value ?? currentTime + 2);
            onAdd(start, end);
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function LyricsPanel({
  lyrics,
  lyricsEmbedded,
  showLyrics,
  lyricFontSize,
  lyricColor,
  onShowLyrics,
  onLyricFontSize,
  onLyricColor,
  onLyricsFile,
  currentTime,
}: InspectorProps) {
  const current = currentLyric(lyrics, currentTime);
  const inputRef = useRef<HTMLInputElement>(null);
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void onLyricsFile(file);
  };
  return (
    <div className="space-y-5">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Show on video</span>
        <input type="checkbox" checked={showLyrics} onChange={(event) => onShowLyrics(event.target.checked)} />
      </label>
      {lyricsEmbedded && (
        <div className="rounded-full bg-accent/15 px-3 py-1 text-center text-xs font-medium text-accent">
          Embedded lyrics detected
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 px-4 py-6 text-sm text-muted hover:border-accent/40 hover:text-text"
      >
        <UploadIcon />
        Drop LRC or SRT
        <input
          ref={inputRef}
          type="file"
          accept=".lrc,.srt,text/plain"
          className="sr-only"
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            void Promise.resolve(onLyricsFile(file)).finally(() => {
              input.value = "";
            });
          }}
        />
      </button>
      <div>
        <FieldLabel>Current line</FieldLabel>
        <p className="min-h-12 rounded-2xl bg-white/5 px-3 py-3 text-sm" aria-live="polite">
          {current?.text || <span className="text-muted">No line at this time.</span>}
        </p>
      </div>
      <div>
        <FieldLabel>Size</FieldLabel>
        <Slider min={24} max={72} step={1} value={lyricFontSize} onChange={onLyricFontSize} />
      </div>
      <div>
        <FieldLabel>Color</FieldLabel>
        <div className="flex items-center gap-2">
          {["#FFFFFF", "#22D3EE", "#F472B6"].map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              className={cn("size-7 rounded-full border", lyricColor === color ? "border-accent" : "border-white/20")}
              style={{ background: color }}
              onClick={() => onLyricColor(color)}
            />
          ))}
          <input type="color" value={lyricColor} onChange={(event) => onLyricColor(event.target.value)} aria-label="Custom lyric color" />
        </div>
      </div>
    </div>
  );
}

function VisualPanel({
  visualizer,
  visualizerOpacity,
  visualizerColor,
  onVisualizer,
  onVisualizerOpacity,
  onVisualizerColor,
  getAnalyser,
}: InspectorProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {VISUALS.map((item) => (
          <VisualCard
            key={item.id}
            id={item.id}
            label={item.label}
            selected={visualizer === item.id}
            color={visualizerColor}
            getAnalyser={getAnalyser}
            onSelect={() => onVisualizer(item.id)}
          />
        ))}
      </div>
      <div>
        <FieldLabel>Opacity</FieldLabel>
        <Slider min={0.15} max={1} step={0.01} value={visualizerOpacity} onChange={onVisualizerOpacity} />
      </div>
      <div>
        <FieldLabel>Color</FieldLabel>
        <input type="color" value={visualizerColor} onChange={(event) => onVisualizerColor(event.target.value)} aria-label="Visualizer color" />
      </div>
    </div>
  );
}

function VisualCard({
  id,
  label,
  selected,
  color,
  getAnalyser,
  onSelect,
}: {
  id: VisualizerId;
  label: string;
  selected: boolean;
  color: string;
  getAnalyser: () => { freq: Uint8Array; time: Uint8Array };
  onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const { freq, time } = getAnalyser();
      drawVisualizerCard(ctx, id, freq, time, color, performance.now());
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [id, color, getAnalyser]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn("overflow-hidden rounded-2xl border text-left", selected ? "border-accent shadow-[0_0_20px_rgba(34,211,238,0.2)]" : "border-white/10")}
    >
      <canvas ref={canvasRef} className="h-20 w-full" />
      <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-label">{label}</div>
    </button>
  );
}

function ExportPanel({ resolution, fit, onResolution, onFit, exporting, onExport, onSaveLibrary }: InspectorProps) {
  const format = pickMime();
  return (
    <div className="space-y-5">
      <div>
        <FieldLabel>Resolution</FieldLabel>
        <SegmentedControl
          options={[
            { id: "720", label: "720p" },
            { id: "1080", label: "1080p" },
          ]}
          value={String(resolution) as "720" | "1080"}
          onChange={(id) => onResolution(Number(id) as ExportResolution)}
        />
      </div>
      <div>
        <FieldLabel>Fit</FieldLabel>
        <SegmentedControl
          options={[
            { id: "contain", label: "Contain" },
            { id: "cover", label: "Cover" },
          ]}
          value={fit}
          onChange={onFit}
        />
      </div>
      <div className="text-xs text-muted">
        Output format: <span className="rounded-full bg-white/10 px-2 py-0.5 font-medium text-text">{format.label}</span>
        <span className="mt-1 block text-[11px] text-label">WebM if this browser cannot encode MP4.</span>
      </div>
      <p className="rounded-2xl bg-white/5 px-3 py-3 text-xs leading-relaxed text-muted">
        Download builds the file in this tab. Keep the tab open until it finishes.
      </p>
      <Button variant="solid" className="flex w-full items-center justify-center gap-2 py-2.5" disabled={exporting} onClick={onExport}>
        <DownloadIcon className="size-4" />
        {exporting ? "Creating…" : "Download"}
      </Button>
      <Button className="flex w-full items-center justify-center gap-2 py-2.5" disabled={exporting} onClick={onSaveLibrary}>
        <SaveIcon className="size-4" />
        Save to library
      </Button>
    </div>
  );
}
