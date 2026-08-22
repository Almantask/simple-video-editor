import { drawFitted, drawSubtitle } from "./compositor";
import { currentLyric } from "./lyrics";
import { needsSeek, rateAt, videoTime } from "./playback";
import { drawVisualizer } from "./visualizers";
import type { FitMode, LyricLine, SpeedSegment, VisualizerId } from "../types";

export interface SessionSettings {
  fit: FitMode;
  visualizer: VisualizerId;
  visualizerOpacity: number;
  visualizerColor: string;
  showLyrics: boolean;
  lyricFontSize: number;
  lyricColor: string;
  lyrics: LyricLine[];
  segments: SpeedSegment[];
}

const defaultSettings = (): SessionSettings => ({
  fit: "contain",
  visualizer: "none",
  visualizerOpacity: 0.85,
  visualizerColor: "#22D3EE",
  showLyrics: true,
  lyricFontSize: 42,
  lyricColor: "#FFFFFF",
  lyrics: [],
  segments: [],
});

export class EditorSession {
  readonly video: HTMLVideoElement;
  readonly audio: HTMLAudioElement;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  settings: SessionSettings = defaultSettings();
  playing = false;
  exporting = false;
  freqData = new Uint8Array(1024);
  timeData = new Uint8Array(2048);

  onTime?: (t: number) => void;
  onEnded?: () => void;

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private raf = 0;
  private lastTimeNotify = 0;

  constructor(video: HTMLVideoElement, audio: HTMLAudioElement, canvas: HTMLCanvasElement) {
    this.video = video;
    this.audio = audio;
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D is unavailable in this browser.");
    this.ctx = ctx;

    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = "auto";
    audio.preload = "auto";
    audio.loop = false;

    audio.addEventListener("ended", this.handleEnded);
  }

  updateSettings(partial: Partial<SessionSettings>): void {
    this.settings = { ...this.settings, ...partial };
    if (!this.playing) this.draw();
  }

  setCanvasSize(width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.draw();
    }
  }

  currentTime(): number {
    return this.audio.currentTime || 0;
  }

  duration(): number {
    const d = this.audio.duration;
    return Number.isFinite(d) ? d : 0;
  }

  async ensureGraph(): Promise<void> {
    if (this.source && this.audioCtx) {
      if (this.audioCtx.state === "suspended") await this.audioCtx.resume();
      return;
    }
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(this.audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.72;
    const streamDest = ctx.createMediaStreamDestination();
    source.connect(analyser);
    analyser.connect(ctx.destination);
    analyser.connect(streamDest);
    this.audioCtx = ctx;
    this.source = source;
    this.analyser = analyser;
    this.streamDest = streamDest;
    this.freqData = new Uint8Array(analyser.frequencyBinCount);
    this.timeData = new Uint8Array(analyser.fftSize);
    if (ctx.state === "suspended") await ctx.resume();
  }

  getAudioStream(): MediaStream | null {
    return this.streamDest?.stream ?? null;
  }

  startLoop(): void {
    if (this.raf) return;
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      if (this.playing || this.exporting) this.syncVideo(false);
      this.sampleAnalyser();
      this.draw();
      const now = performance.now();
      if (now - this.lastTimeNotify > 50) {
        this.lastTimeNotify = now;
        this.onTime?.(this.currentTime());
      }
    };
    tick();
  }

  async play(): Promise<void> {
    await this.ensureGraph();
    this.syncVideo(true);
    try {
      await Promise.all([this.audio.play(), this.video.play()]);
    } catch {
      // Autoplay can still fail if the tab was backgrounded.
    }
    this.playing = true;
  }

  pause(): void {
    this.playing = false;
    this.audio.pause();
    this.video.pause();
    this.draw();
  }

  seek(time: number): void {
    const duration = this.duration();
    const next = Math.max(0, Math.min(time, duration > 0 ? duration : time));
    this.audio.currentTime = next;
    this.syncVideo(true);
    this.draw();
    this.onTime?.(next);
  }

  posterJpeg(): string {
    try {
      return this.canvas.toDataURL("image/jpeg", 0.86);
    } catch {
      return "";
    }
  }

  dispose(): void {
    this.pause();
    this.audio.removeEventListener("ended", this.handleEnded);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    void this.audioCtx?.close();
    this.audioCtx = null;
    this.source = null;
    this.analyser = null;
    this.streamDest = null;
  }

  private handleEnded = () => {
    this.playing = false;
    this.video.pause();
    this.draw();
    this.onEnded?.();
  };

  private sampleAnalyser(): void {
    if (!this.analyser) return;
    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);
  }

  private syncVideo(force: boolean): void {
    const videoDuration = this.video.duration;
    if (!videoDuration || !Number.isFinite(videoDuration)) return;
    const t = this.audio.currentTime || 0;
    const expected = videoTime(t, this.settings.segments, videoDuration);
    const rate = rateAt(t, this.settings.segments);
    if (Math.abs(this.video.playbackRate - rate) > 0.01) {
      try {
        this.video.playbackRate = rate;
      } catch {
        // Some browsers reject exotic rates; clamp happens upstream.
      }
    }
    if (force || needsSeek(this.video.currentTime, expected, videoDuration)) {
      try {
        this.video.currentTime = expected;
      } catch {
        // Ignore seek-before-ready.
      }
    }
  }

  draw(): void {
    const { ctx, canvas, video, settings } = this;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (video.readyState >= 2 && video.videoWidth > 0) {
      drawFitted(ctx, video, settings.fit);
    }
    drawVisualizer(
      ctx,
      settings.visualizer,
      this.freqData,
      this.timeData,
      settings.visualizerColor,
      settings.visualizerOpacity,
    );
    if (settings.showLyrics) {
      const line = currentLyric(settings.lyrics, this.currentTime());
      if (line) {
        const size = Math.max(16, settings.lyricFontSize * (canvas.height / 1080));
        drawSubtitle(ctx, line.text, size, settings.lyricColor);
      }
    }
  }
}
