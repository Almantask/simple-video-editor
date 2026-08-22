import { useCallback, useEffect, useRef, useState } from "react";
import { DoneModal } from "../components/DoneModal";
import { Inspector } from "../components/Inspector";
import { MediaChip } from "../components/MediaDropzone";
import { Timeline } from "../components/Timeline";
import { Transport } from "../components/Transport";
import { Wordmark } from "../components/Wordmark";
import { Button } from "../components/ui/Button";
import { startExport } from "../engine/exporter";
import { parseLyricsFile } from "../engine/lyrics";
import { EditorSession } from "../engine/session";
import { clampRate } from "../engine/playback";
import { formatTime } from "../lib/utils";
import type {
  ExportResolution,
  FitMode,
  InspectorTab,
  LyricLine,
  MediaAsset,
  SpeedSegment,
  VisualizerId,
} from "../types";

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
  onVideoFile: (file: File) => void;
  onAudioFile: (file: File) => void;
  onLyrics: (lines: LyricLine[], fromFile: boolean) => void;
  notify: (text: string, tone?: "info" | "error") => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<EditorSession | null>(null);
  const timeRef = useRef(0);
  const cancelExport = useRef<(() => void) | null>(null);

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
  const [done, setDone] = useState<{ blob: Blob; ext: string; poster: string } | null>(null);

  const duration = audio.duration;

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
      setExportTime(time);
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
    el.src = video.url;
    el.load();
  }, [video.url]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const wasPlaying = sessionRef.current?.playing;
    el.src = audio.url;
    el.load();
    sessionRef.current?.seek(0);
    setPlaying(false);
    if (wasPlaying) void sessionRef.current?.pause();
  }, [audio.url]);

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

  const seek = useCallback(
    (time: number) => {
      sessionRef.current?.seek(time);
      setCurrentTime(time);
      timeRef.current = time;
    },
    [],
  );

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

  const runExport = async () => {
    const session = sessionRef.current;
    if (!session || exporting) return;
    session.pause();
    setPlaying(false);
    setExporting(true);
    setExportTime(0);
    const height = resolution === 1080 ? 1080 : 720;
    const width = resolution === 1080 ? 1920 : 1280;
    try {
      const job = startExport(session, {
        width,
        height,
        onProgress: (current) => setExportTime(current),
      });
      cancelExport.current = job.cancel;
      const result = await job.done;
      setDone({ blob: result.blob, ext: result.ext, poster: result.poster });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "Export failed.";
      notify(message, "error");
    } finally {
      cancelExport.current = null;
      setExporting(false);
      setPlaying(false);
    }
  };

  const pct = duration > 0 ? Math.min(100, (exportTime / duration) * 100) : 0;
  const defaultName = `${(audio.title || audio.name.replace(/\.[^.]+$/, "")).replace(/[<>:"/\\|?*]/g, "")} - loop`;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-text">
      {exporting && (
        <div className="h-0.5 bg-white/10">
          <div className="h-full bg-accent transition-[width] duration-180" style={{ width: `${pct}%` }} />
        </div>
      )}
      <header className="glass relative z-20 flex h-12 shrink-0 items-center gap-3 px-4">
        <Wordmark compact />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <MediaChip kind="video" asset={video} disabled={exporting} onFile={onVideoFile} />
          <MediaChip kind="audio" asset={audio} disabled={exporting} onFile={onAudioFile} />
        </div>
        {exporting ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs">
              Recording {formatTime(exportTime)} / {formatTime(duration)}
            </span>
            <Button
              onClick={() => {
                cancelExport.current?.();
                notify("Export cancelled.");
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="solid" onClick={() => void runExport()}>
            Export
          </Button>
        )}
      </header>
      {exporting && (
        <div className="glass mx-auto mt-3 rounded-full px-4 py-1.5 text-xs text-muted">Keep this tab in the foreground.</div>
      )}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          className="vignette relative flex min-h-0 min-w-0 flex-1 items-center justify-center bg-black p-6"
          onClick={() => {
            if (!exporting) void togglePlay();
          }}
        >
          <canvas
            ref={canvasRef}
            className="inner-bevel max-h-full max-w-full rounded-xl bg-black"
            style={{ aspectRatio: "16 / 9" }}
          />
          <div className="pointer-events-none absolute inset-0">
            <Transport
              playing={playing}
              current={currentTime}
              duration={duration}
              visible={transportVisible || !playing}
              disabled={exporting}
              onToggle={() => void togglePlay()}
              onSeek={seek}
            />
          </div>
        </div>
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
          onLyricsFile={(file) => void handleLyricsFile(file)}
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
          onExport={() => void runExport()}
          notify={notify}
        />
      </div>
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
      <video ref={videoRef} className="hidden" playsInline muted />
      <audio ref={audioRef} className="hidden" />
      {done && (
        <DoneModal
          poster={done.poster}
          blob={done.blob}
          ext={done.ext}
          defaultName={defaultName}
          onClose={() => setDone(null)}
        />
      )}
    </div>
  );
}
