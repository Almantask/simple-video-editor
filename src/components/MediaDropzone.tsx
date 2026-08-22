import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { cn, formatTime } from "../lib/utils";
import { drawPeaks } from "../engine/waveform";
import type { MediaAsset } from "../types";
import { FilmIcon, WaveIcon } from "./Icons";

type FileHandler = (file: File) => void | Promise<void>;

interface DropCardProps {
  kind: "video" | "audio";
  asset: MediaAsset | null;
  loading: boolean;
  error: string | null;
  onFile: FileHandler;
}

const ACCEPT = {
  video: "video/*,.mp4,.webm,.mov,.m4v",
  audio: "audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg",
};

function takePickedFile(event: ChangeEvent<HTMLInputElement>, onFile: FileHandler) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  void Promise.resolve(onFile(file)).finally(() => {
    input.value = "";
  });
}

export function DropCard({ kind, asset, loading, error, onFile }: DropCardProps) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = sparkRef.current;
    if (!canvas || !asset?.peaks) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawPeaks(ctx, asset.peaks, "rgba(34,211,238,0.55)");
    };
    resize();
  }, [asset]);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) void onFile(file);
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "group relative flex h-[280px] w-full cursor-pointer flex-col overflow-hidden rounded-[20px] text-left transition duration-180",
        error
          ? "border border-rose/70 bg-rose/5"
          : over
            ? "border border-accent bg-accent/10 shadow-[0_0_40px_rgba(34,211,238,0.18)] scale-[1.01]"
            : asset
              ? "border border-white/10 bg-surface"
              : "grid-texture border border-dashed border-white/15 bg-white/[0.02]",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="sr-only"
        onChange={(event) => takePickedFile(event, onFile)}
        onClick={(event) => event.stopPropagation()}
      />
      {asset ? (
        <>
          {kind === "video" && asset.thumbnail ? (
            <img src={asset.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
          ) : (
            <canvas ref={sparkRef} className="absolute inset-x-6 bottom-16 top-12 w-auto opacity-90" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
          <div className="relative mt-auto p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-label">{kind}</div>
            <div className="mt-1 truncate text-base font-medium">{asset.title || asset.name}</div>
            <div className="font-mono text-xs text-muted">{formatTime(asset.duration, true)}</div>
          </div>
          <span className="absolute right-4 top-4 rounded-full bg-black/50 px-3 py-1 text-xs text-text opacity-0 backdrop-blur-md transition duration-180 group-hover:opacity-100">
            Replace
          </span>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-white/5 text-accent">
            {kind === "video" ? <FilmIcon /> : <WaveIcon />}
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-label">{kind}</div>
            <div className="mt-2 text-base font-medium">Drop or click</div>
            <div className="mt-1 text-xs text-muted">
              {kind === "video" ? "MP4, WebM, MOV" : "MP3, WAV, FLAC, M4A"}
            </div>
          </div>
        </div>
      )}
      {loading && (
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="mb-2 text-xs text-muted">Reading…</div>
          <div className="reading-bar" />
        </div>
      )}
      {error && <p className="relative mt-auto p-5 text-sm text-rose">{error}</p>}
    </button>
  );
}

export function MediaChip({
  kind,
  asset,
  disabled,
  onFile,
}: {
  kind: "video" | "audio";
  asset: MediaAsset;
  disabled?: boolean;
  onFile: FileHandler;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      className="flex max-w-[220px] items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 text-left hover:border-white/20 disabled:opacity-40"
      title="Replace file"
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        className="sr-only"
        onChange={(event) => takePickedFile(event, onFile)}
        onClick={(event) => event.stopPropagation()}
      />
      {kind === "video" && asset.thumbnail ? (
        <img src={asset.thumbnail} alt="" className="size-7 rounded-full object-cover" />
      ) : (
        <span className="grid size-7 place-items-center rounded-full bg-accent/15 text-accent">
          {kind === "video" ? <FilmIcon className="size-3.5" /> : <WaveIcon className="size-3.5" />}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{asset.title || asset.name}</span>
        <span className="block font-mono text-[10px] text-muted">{formatTime(asset.duration)}</span>
      </span>
    </button>
  );
}
