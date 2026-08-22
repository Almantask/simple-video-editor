import { drawFitted, drawSubtitle } from "./compositor";
import { currentLyric } from "./lyrics";
import { loopDelta, needsSeek, rateAt, videoTime } from "./playback";
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

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

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
  private source: MediaElementAudioSourceNode | null = null;
  private raf = 0;
  private rvfc = 0;
  private lastTimeNotify = 0;
  private lastRate = 1;
  private frameCache: HTMLCanvasElement | null = null;
  private cacheCtx: CanvasRenderingContext2D | null = null;
  private hasCache = false;
  private encodeCanvas: HTMLCanvasElement | null = null;
  private encodeCtx: CanvasRenderingContext2D | null = null;

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
    this.startFramePump();
  }

  updateSettings(partial: Partial<SessionSettings>): void {
    const fitChanged = partial.fit !== undefined && partial.fit !== this.settings.fit;
    this.settings = { ...this.settings, ...partial };
    if (fitChanged && this.videoFrameUsable()) this.captureVideoFrame();
    if (!this.playing && !this.exporting) this.draw();
  }

  setCanvasSize(width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.hasCache = false;
      if (this.videoFrameUsable()) this.captureVideoFrame();
      if (!this.exporting) this.draw();
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
    source.connect(analyser);
    analyser.connect(ctx.destination);
    this.audioCtx = ctx;
    this.source = source;
    this.analyser = analyser;
    this.freqData = new Uint8Array(analyser.frequencyBinCount);
    this.timeData = new Uint8Array(analyser.fftSize);
    if (ctx.state === "suspended") await ctx.resume();
  }

  startLoop(): void {
    if (this.raf) return;
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      if (this.exporting) return;
      if (this.playing) this.syncVideo(false);
      this.sampleAnalyser();
      if (!this.video.seeking) this.captureVideoFrame();
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
    if (this.exporting) return;
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
    this.captureVideoFrame();
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

  beginExport(width: number, height: number): void {
    this.exporting = true;
    this.playing = false;
    this.audio.pause();
    this.video.pause();
    this.video.autoplay = false;
    void this.audioCtx?.suspend();
    try {
      this.video.playbackRate = 1;
    } catch {
      /* ignore */
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Could not create an encode canvas.");
    this.encodeCanvas = canvas;
    this.encodeCtx = ctx;
    this.hasCache = false;
  }

  get encodeTarget(): HTMLCanvasElement {
    return this.encodeCanvas ?? this.canvas;
  }

  endExport(): void {
    this.audio.pause();
    this.video.pause();
    this.encodeCanvas = null;
    this.encodeCtx = null;
    this.exporting = false;
    this.hasCache = false;
    if (this.videoFrameUsable()) this.captureVideoFrame();
    this.draw();
  }

  seekVideo(time: number): Promise<void> {
    const video = this.video;
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return Promise.resolve();
    const next = ((time % duration) + duration) % duration;
    if (!video.seeking && Math.abs(video.currentTime - next) < 0.008) {
      this.captureVideoFrame();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let settled = false;
      const complete = () => {
        if (settled) return;
        settled = true;
        this.captureVideoFrame();
        resolve();
      };
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onSeeked);
        window.clearTimeout(failSafe);
        const tagged = video as VideoWithFrameCallback;
        if (typeof tagged.requestVideoFrameCallback === "function") {
          tagged.requestVideoFrameCallback(() => complete());
          window.setTimeout(complete, 100);
        } else {
          requestAnimationFrame(() => complete());
        }
      };
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onSeeked);
      const failSafe = window.setTimeout(onSeeked, 1500);
      try {
        video.pause();
        video.currentTime = next;
        if (this.exporting) {
          video.pause();
          this.audio.pause();
        }
      } catch {
        onSeeked();
      }
    });
  }

  posterJpeg(): string {
    try {
      return this.composeCanvas.toDataURL("image/jpeg", 0.86);
    } catch {
      return "";
    }
  }

  dispose(): void {
    this.pause();
    this.audio.removeEventListener("ended", this.handleEnded);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    const tagged = this.video as VideoWithFrameCallback;
    if (this.rvfc && tagged.cancelVideoFrameCallback) tagged.cancelVideoFrameCallback(this.rvfc);
    this.rvfc = 0;
    void this.audioCtx?.close();
    this.audioCtx = null;
    this.source = null;
    this.analyser = null;
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

  private startFramePump(): void {
    const video = this.video as VideoWithFrameCallback;
    if (typeof video.requestVideoFrameCallback !== "function") return;
    const pump = () => {
      this.rvfc = video.requestVideoFrameCallback!(pump);
      this.captureVideoFrame();
    };
    this.rvfc = video.requestVideoFrameCallback(pump);
  }

  private videoFrameUsable(): boolean {
    const video = this.video;
    return !video.seeking && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0;
  }

  captureVideoFrame(): void {
    if (!this.videoFrameUsable()) return;
    const { width, height } = this.composeCanvas;
    const ctx = this.ensureCache(width, height);
    const cache = this.frameCache!;
    try {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, cache.width, cache.height);
      drawFitted(ctx, this.video, this.settings.fit);
      this.hasCache = true;
    } catch {
      // Decoder glitches can throw from drawImage; keep the last good frame if we have one.
    }
  }

  private ensureCache(width: number, height: number): CanvasRenderingContext2D {
    if (!this.frameCache || this.frameCache.width !== width || this.frameCache.height !== height) {
      this.frameCache = document.createElement("canvas");
      this.frameCache.width = width;
      this.frameCache.height = height;
      this.cacheCtx = this.frameCache.getContext("2d", { alpha: false });
      this.hasCache = false;
    }
    if (!this.cacheCtx) throw new Error("Could not create a frame cache.");
    return this.cacheCtx;
  }

  private get composeCanvas(): HTMLCanvasElement {
    return this.exporting && this.encodeCanvas ? this.encodeCanvas : this.canvas;
  }

  private get composeCtx(): CanvasRenderingContext2D {
    return this.exporting && this.encodeCtx ? this.encodeCtx : this.ctx;
  }

  private syncVideo(force: boolean): void {
    const videoDuration = this.video.duration;
    if (!videoDuration || !Number.isFinite(videoDuration)) return;
    const t = this.audio.currentTime || 0;
    const expected = videoTime(t, this.settings.segments, videoDuration);
    const rate = rateAt(t, this.settings.segments);
    const rateChanged = Math.abs(this.lastRate - rate) > 0.01;
    this.lastRate = rate;
    if (Math.abs(this.video.playbackRate - rate) > 0.01) {
      try {
        this.video.playbackRate = rate;
      } catch {
        // Some browsers reject exotic rates; clamp happens upstream.
      }
    }
    if (!force && this.video.seeking) return;
    const drifted = needsSeek(this.video.currentTime, expected, videoDuration, rate);
    const rateNudge = rateChanged && Math.abs(loopDelta(this.video.currentTime, expected, videoDuration)) > 0.04;
    if (force || drifted || rateNudge) {
      try {
        this.video.currentTime = expected;
      } catch {
        // Ignore seek-before-ready.
      }
    }
  }

  draw(audioTime?: number, freq?: Uint8Array, time?: Uint8Array): void {
    const ctx = this.composeCtx;
    const canvas = this.composeCanvas;
    const { settings } = this;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (this.hasCache && this.frameCache) {
      ctx.drawImage(this.frameCache, 0, 0);
    } else if (this.videoFrameUsable()) {
      drawFitted(ctx, this.video, settings.fit);
    }
    const freqData = freq ?? this.freqData;
    const timeData = time ?? this.timeData;
    drawVisualizer(
      ctx,
      settings.visualizer,
      freqData,
      timeData,
      settings.visualizerColor,
      settings.visualizerOpacity,
    );
    if (settings.showLyrics) {
      const line = currentLyric(settings.lyrics, audioTime ?? this.currentTime());
      if (line) {
        const size = Math.max(16, settings.lyricFontSize * (canvas.height / 1080));
        drawSubtitle(ctx, line.text, size, settings.lyricColor);
      }
    }
  }
}
