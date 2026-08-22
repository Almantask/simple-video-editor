import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DoneModal } from "../components/DoneModal";
import { Inspector } from "../components/Inspector";
import { MediaChip } from "../components/MediaDropzone";
import { Timeline } from "../components/Timeline";
import { Transport } from "../components/Transport";
import { LibraryLink, Wordmark } from "../components/Wordmark";
import { Button } from "../components/ui/Button";
import { DownloadIcon, SaveIcon } from "../components/Icons";
import { startExport } from "../engine/exporter";
import { parseLyricsFile } from "../engine/lyrics";
import { EditorSession } from "../engine/session";
import { clampRate } from "../engine/playback";
import { isQuotaError, saveClip } from "../lib/library";
import { dataUrlToBlob } from "../lib/utils";
import type {
  ExportResolution,
  ExportResult,
  FitMode,
  InspectorTab,
  LyricLine,
  MediaAsset,
  SpeedSegment,
  VisualizerId,
} from "../types";

function defaultClipName(audio: MediaAsset): string {
  return `${(audio.title || audio.name.replace(/\.[^.]+$/, "")).replace(/[<>:"/\\|?*]/g, "")} - loop`;
}

export function Studio({
  video,
  audio,
  lyrics,
  lyricsEmbedded,
  onVideoFile,
  onAudioFile,
  onLyrics,
  notify,
}: {
  video: MediaAsset;
  audio: MediaAsset;
  lyrics: LyricLine[];
  lyricsEmbedded: boolean;
  onVideoFile: (file: File) => void | Promise<void>;
  onAudioFile: (file: File) => void | Promise<void>;
  onLyrics: (lines: LyricLine[], fromFile: boolean) => void;
  notify: (text: string, tone?: "info" | "error") => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<EditorSession | null>(null);
  const timeRef = useRef(0);
  const cancelExport = useRef<(() => void) | null>(null);
  const encodeLock = useRef<Promise<ExportResult> | null>(null);
  const encoded = useRef<{ key: string; result: ExportResult } | null>(null);

  const [tab, setTab] = useState<InspectorTab>("speed");
  const [segments, setSegments] = useState<SpeedSegment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showLyrics, setShowLyrics] = useState(true);
  const [lyricFontSize, setLyricFontSize] = useState(42);
  const [lyricColor, setLyricColor] = useState("#FFFFFF");
  const [visualizer, setVisualizer] = useState<VisualizerId>("bars");
  const [visualizerOpacity, setVisualizerOpacity] = useState(0.85);
  const [visualizerColor, setVisualizerColor] = useState("#22D3EE");
  const [resolution, setResolution] = useState<ExportResolution>(1080);
  const [fit, setFit] = useState<FitMode>("contain");
  const [exporting, setExporting] = useState(false);
  const [exportTime, setExportTime] = useState(0);
  const [transportVisible, setTransportVisible] = useState(true);
  const [done, setDone] = useState<ExportResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const duration = audio.duration;
  const encodeKey = useMemo(
    () =>
      JSON.stringify({
        video: video.url,
        audio: audio.url,
        resolution,
        fit,
        segments,
        lyrics,
        showLyrics,
        lyricFontSize,
        lyricColor,
        visualizer,
        visualizerOpacity,
        visualizerColor,
      }),
    [
      video.url,
      audio.url,
      resolution,
      fit,
      segments,
      lyrics,
      showLyrics,
      lyricFontSize,
      lyricColor,
      visualizer,
      visualizerOpacity,
      visualizerColor,
    ],
  );

  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;
    const canvas = canvasRef.current;
    if (!videoEl || !audioEl || !canvas) return;
    const session = new EditorSession(videoEl, audioEl, canvas);
    sessionRef.current = session;
    session.setCanvasSize(1920, 1080);
    session.onTime = (time) => {
      timeRef.current = time;
      setCurrentTime(time);
    };
    session.onEnded = () => setPlaying(false);
    session.startLoop();
    return () => {
      session.dispose();
      sessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onError = () => notify("Could not read the video. Drop it again.", "error");
    el.addEventListener("error", onError);
    el.src = video.url;
    el.load();
    return () => el.removeEventListener("error", onError);
  }, [video.url, notify]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onError = () => notify("Could not read the audio. Drop it again.", "error");
    el.addEventListener("error", onError);
    const wasPlaying = sessionRef.current?.playing;
    el.src = audio.url;
    el.load();
    sessionRef.current?.seek(0);
    setPlaying(false);
    if (wasPlaying) void sessionRef.current?.pause();
    return () => el.removeEventListener("error", onError);
  }, [audio.url, notify]);

  useEffect(() => {
    sessionRef.current?.updateSettings({
      segments: segments.map((s) => ({ ...s, rate: clampRate(s.rate) })),
      lyrics,
      showLyrics,
      lyricFontSize,
      lyricColor,
      visualizer,
      visualizerOpacity,
      visualizerColor,
      fit,
    });
  }, [segments, lyrics, showLyrics, lyricFontSize, lyricColor, visualizer, visualizerOpacity, visualizerColor, fit]);

  useEffect(() => {
    setSegments((prev) =>
      prev
        .map((segment) => ({ ...segment, end: Math.min(segment.end, audio.duration) }))
        .filter((segment) => segment.end - segment.start >= 0.15),
    );
  }, [audio.url, audio.duration]);

  useEffect(() => {
    const [w, h] = resolution === 1080 ? [1920, 1080] : [1280, 720];
    sessionRef.current?.setCanvasSize(w, h);
  }, [resolution]);

  useEffect(() => {
    if (!playing || exporting) {
      setTransportVisible(true);
      return;
    }
    let timer = window.setTimeout(() => setTransportVisible(false), 2000);
    const onMove = () => {
      setTransportVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTransportVisible(false), 2000);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousemove", onMove);
    };
  }, [playing, exporting]);

  const togglePlay = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || exporting) return;
    if (session.playing) {
      session.pause();
      setPlaying(false);
      return;
    }
    if (session.duration() > 0 && session.currentTime() >= session.duration() - 0.05) {
      session.seek(0);
    }
    await session.play();
    setPlaying(true);
  }, [exporting]);

  const seek = useCallback((time: number) => {
    sessionRef.current?.seek(time);
    setCurrentTime(time);
    timeRef.current = time;
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (exporting) return;
      if (event.code === "Space") {
        event.preventDefault();
        void togglePlay();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        seek(Math.max(0, timeRef.current - 5));
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        seek(Math.min(duration, timeRef.current + 5));
      } else if (event.code === "Home") {
        event.preventDefault();
        seek(0);
      } else if (event.code === "End") {
        event.preventDefault();
        seek(duration);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duration, exporting, seek, togglePlay]);

  const getTime = useCallback(() => timeRef.current, []);
  const getAnalyser = useCallback(() => {
    const session = sessionRef.current;
    return {
      freq: session?.freqData ?? new Uint8Array(64),
      time: session?.timeData ?? new Uint8Array(256),
    };
  }, []);

  const handleLyricsFile = async (file: File) => {
    try {
      const text = await file.text();
      const lines = parseLyricsFile(file.name, text);
      if (lines.length === 0) {
        notify("No timed lines found in that file.", "error");
        return;
      }
      onLyrics(lines, true);
      notify(`Loaded ${lines.length} lyric lines.`);
    } catch {
      notify("Couldn't read that lyrics file.", "error");
    }
  };

  const ensureEncode = async (): Promise<ExportResult> => {
    const session = sessionRef.current;
    if (!session) throw new Error("Nothing to download yet.");
    if (encoded.current?.key === encodeKey) return encoded.current.result;
    if (encodeLock.current) return encodeLock.current;
    const key = encodeKey;
    session.pause();
    setPlaying(false);
    setExporting(true);
    setExportTime(0);
    const height = resolution === 1080 ? 1080 : 720;
    const width = resolution === 1080 ? 1920 : 1280;
    const job = startExport(session, {
      width,
      height,
      audioFile: audio.file,
      onProgress: (current) => setExportTime(current),
    });
    cancelExport.current = job.cancel;
    encodeLock.current = job.done
      .then((result) => {
        encoded.current = { key, result };
        return result;
      })
      .finally(() => {
        encodeLock.current = null;
        cancelExport.current = null;
        setExporting(false);
        setPlaying(false);
      });
    return encodeLock.current;
  };

  const runDownload = async () => {
    if (exporting) return;
    try {
      const result = await ensureEncode();
      setDone(result);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "Download failed.";
      notify(message, "error");
    }
  };

  const persistToLibrary = async (result: ExportResult, name: string) => {
    const poster = dataUrlToBlob(result.poster) ?? new Blob([], { type: "image/jpeg" });
    await saveClip({
      name: name.replace(/\.(mp4|webm)$/i, "").trim() || defaultClipName(audio),
      duration: result.duration,
      width: result.width,
      height: result.height,
      mime: result.mime,
      ext: result.ext,
      poster,
      video: result.blob,
    });
    setSavedKey(encodeKey);
  };

  const runSaveLibrary = async (name = defaultClipName(audio)) => {
    if (exporting || saving) return;
    try {
      const result = await ensureEncode();
      setSaving(true);
      await persistToLibrary(result, name);
      notify("Saved to library.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (isQuotaError(error)) {
        notify("Not enough space in this browser. Download the file, or delete clips from the library.", "error");
        return;
      }
      const message = error instanceof Error ? error.message : "Couldn't save to the library.";
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const pct = duration > 0 ? Math.min(100, (exportTime / duration) * 100) : 0;
  const defaultName = defaultClipName(audio);

  return (
    <div className="flex h-dvh flex-col overflow-hidden overscroll-none bg-bg text-text pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {exporting && (
        <div className="h-0.5 bg-white/10">
          <div className="h-full bg-accent transition-[width] duration-180" style={{ width: `${pct}%` }} />
        </div>
      )}
      <header className="glass relative z-20 flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
        <Wordmark compact linked={!exporting} />
        <LibraryLink disabled={exporting} />
        <div className="order-3 flex min-w-0 flex-[1_1_100%] items-center gap-2 md:order-none md:flex-1 md:basis-auto">
          <MediaChip kind="video" asset={video} disabled={exporting} onFile={onVideoFile} />
          <MediaChip kind="audio" asset={audio} disabled={exporting} onFile={onAudioFile} />
        </div>
        {exporting ? (
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <span className="rounded-full bg-white/10 px-2 py-1 font-mono text-[10px] sm:px-3 sm:text-xs">
              Creating {Math.round(pct)}%
            </span>
            <Button
              onClick={() => {
                cancelExport.current?.();
                notify("Download cancelled.");
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 md:ml-0">
            <Button
              className="flex items-center gap-2 px-2 sm:px-3"
              aria-label="Save to library"
              onClick={() => void runSaveLibrary()}
            >
              <SaveIcon className="size-4" />
              <span className="hidden lg:inline">Save to library</span>
            </Button>
            <Button
              variant="solid"
              className="flex items-center gap-2 px-2 sm:px-4"
              aria-label="Download"
              onClick={() => void runDownload()}
            >
              <DownloadIcon className="size-4" />
              <span className="hidden lg:inline">Download</span>
            </Button>
          </div>
        )}
      </header>
      {exporting && (
        <div className="glass mx-3 mt-2 shrink-0 rounded-full px-3 py-1.5 text-center text-[11px] text-muted sm:mx-auto sm:mt-3 sm:px-4 sm:text-xs">
          Keep this tab open while the file is created.
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(140px,1fr)_auto_auto] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[minmax(0,1fr)_auto]">
        <div className="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col bg-black lg:col-start-1 lg:row-start-1">
          <div
            className="vignette relative flex min-h-[140px] min-w-0 flex-1 items-center justify-center p-3 sm:p-6"
            style={{ containerType: "size" }}
            onClick={() => {
              if (!exporting) void togglePlay();
            }}
          >
            <div
              className="relative aspect-video max-h-full overflow-hidden rounded-xl"
              style={{ width: "min(100%, calc(100cqh * 16 / 9))" }}
            >
              <video
                ref={videoRef}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-[0.02]"
                style={{ transform: "translateZ(0)" }}
                playsInline
                muted
                aria-hidden
              />
              <canvas
                ref={canvasRef}
                className="inner-bevel relative z-[1] h-full w-full rounded-xl bg-black"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 hidden lg:block">
              <Transport
                playing={playing}
                current={currentTime}
                duration={duration}
                visible={transportVisible || !playing}
                disabled={exporting}
                placement="overlay"
                onToggle={() => void togglePlay()}
                onSeek={seek}
              />
            </div>
          </div>
          <div className="shrink-0 border-t border-white/8 px-3 py-2 lg:hidden">
            <Transport
              playing={playing}
              current={currentTime}
              duration={duration}
              visible
              disabled={exporting}
              placement="docked"
              onToggle={() => void togglePlay()}
              onSeek={seek}
            />
          </div>
        </div>
        <div className="col-start-1 row-start-3 flex min-h-0 w-full lg:col-start-2 lg:row-start-1">
        <Inspector
          tab={tab}
          onTab={setTab}
          duration={duration}
          currentTime={currentTime}
          segments={segments}
          selectedId={selectedId}
          onSegments={setSegments}
          onSelect={setSelectedId}
          lyrics={lyrics}
          lyricsEmbedded={lyricsEmbedded}
          showLyrics={showLyrics}
          lyricFontSize={lyricFontSize}
          lyricColor={lyricColor}
          onShowLyrics={setShowLyrics}
          onLyricFontSize={setLyricFontSize}
          onLyricColor={setLyricColor}
          onLyricsFile={handleLyricsFile}
          visualizer={visualizer}
          visualizerOpacity={visualizerOpacity}
          visualizerColor={visualizerColor}
          onVisualizer={setVisualizer}
          onVisualizerOpacity={setVisualizerOpacity}
          onVisualizerColor={setVisualizerColor}
          getAnalyser={getAnalyser}
          resolution={resolution}
          fit={fit}
          onResolution={setResolution}
          onFit={setFit}
          exporting={exporting}
          onExport={() => void runDownload()}
          onSaveLibrary={() => void runSaveLibrary()}
          notify={notify}
        />
        </div>
        <div className="col-start-1 row-start-2 w-full lg:col-span-2 lg:col-start-1 lg:row-start-2">
      <Timeline
        duration={duration}
        peaks={audio.peaks}
        segments={segments}
        selectedId={selectedId}
        getTime={getTime}
        disabled={exporting}
        onSeek={seek}
        onChange={setSegments}
        onSelect={(id) => {
          setSelectedId(id);
          if (id) setTab("speed");
        }}
      />
        </div>
      </div>
      <audio ref={audioRef} className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0" />
      {done && (
        <DoneModal
          poster={done.poster}
          blob={done.blob}
          ext={done.ext}
          defaultName={defaultName}
          saving={saving}
          saved={savedKey === encodeKey}
          onSaveLibrary={(name) => void runSaveLibrary(name)}
          onClose={() => setDone(null)}
        />
      )}
    </div>
  );
}
