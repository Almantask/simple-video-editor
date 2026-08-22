import { fillAnalyserFromBuffer } from "./offline-analyser";
import { videoTime } from "./playback";
import type { EditorSession } from "./session";
import type { ExportResult } from "../types";

export interface MimeChoice {
  mime: string;
  ext: "mp4" | "webm";
  label: "MP4" | "WebM";
}

export function pickMime(): MimeChoice {
  return { mime: "video/mp4", ext: "mp4", label: "MP4" };
}

export interface ExportHandle {
  done: Promise<ExportResult>;
  cancel: () => void;
}

const FPS = 30;

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function decodeMusic(file: File): Promise<AudioBuffer> {
  const bytes = await file.arrayBuffer();
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(bytes.slice(0));
  } catch {
    throw new Error("Couldn't decode the music for download.");
  } finally {
    await ctx.close();
  }
}

export function startExport(
  session: EditorSession,
  options: {
    width: number;
    height: number;
    audioFile: File;
    onProgress?: (current: number, duration: number) => void;
  },
): ExportHandle {
  let cancelled = false;
  let output: { cancel: () => Promise<void> } | null = null;
  const { width, height, audioFile } = options;

  session.pause();
  session.beginExport(width, height);

  const cancel = () => {
    cancelled = true;
    void output?.cancel();
  };

  const done = (async (): Promise<ExportResult> => {
    try {
      if (cancelled) throw new DOMException("Export cancelled", "AbortError");

      const {
        AudioBufferSource,
        BufferTarget,
        CanvasSource,
        Mp4OutputFormat,
        Output,
        QUALITY_HIGH,
        WebMOutputFormat,
        getFirstEncodableAudioCodec,
        getFirstEncodableVideoCodec,
      } = await import("mediabunny");

      if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") {
        throw new Error("This browser cannot create a video file. Try Chrome or Edge.");
      }

      const videoCodec = await getFirstEncodableVideoCodec(["avc", "hevc", "av1", "vp9", "vp8"], {
        width,
        height,
        quality: QUALITY_HIGH,
      });
      if (!videoCodec) {
        throw new Error("This browser cannot encode video. Try Chrome or Edge.");
      }
      const mp4 = videoCodec === "avc" || videoCodec === "hevc" || videoCodec === "av1";
      const audioCodec = await getFirstEncodableAudioCodec(mp4 ? ["aac", "mp3"] : ["opus", "vorbis"], {
        quality: QUALITY_HIGH,
      });
      if (!audioCodec) {
        throw new Error("This browser cannot encode audio. Try Chrome or Edge.");
      }
      const mime = mp4 ? "video/mp4" : "video/webm";
      const ext = mp4 ? "mp4" : "webm";
      if (cancelled) throw new DOMException("Export cancelled", "AbortError");

      if (session.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        await new Promise<void>((resolve) => {
          const ready = () => {
            session.video.removeEventListener("loadeddata", ready);
            window.clearTimeout(timer);
            resolve();
          };
          session.video.addEventListener("loadeddata", ready);
          const timer = window.setTimeout(ready, 4000);
        });
      }

      const duration = session.duration();
      if (!(duration > 0)) throw new Error("The music duration is unknown.");

      const audioBuffer = await decodeMusic(audioFile);
      if (cancelled) throw new DOMException("Export cancelled", "AbortError");

      const target = new BufferTarget();
      const muxer = new Output({
        format: mp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
        target,
      });
      output = muxer;

      const videoSource = new CanvasSource(session.encodeTarget, {
        codec: videoCodec,
        quality: QUALITY_HIGH,
        keyFrameInterval: 2,
      });
      muxer.addVideoTrack(videoSource, { frameRate: FPS });

      const audioSource = new AudioBufferSource({
        codec: audioCodec,
        quality: QUALITY_HIGH,
      });
      muxer.addAudioTrack(audioSource);

      await muxer.start();
      if (cancelled) throw new DOMException("Export cancelled", "AbortError");
      await audioSource.add(audioBuffer);

      const frameDuration = 1 / FPS;
      const frameCount = Math.max(1, Math.ceil(duration * FPS));
      const freq = new Uint8Array(48);
      const wave = new Uint8Array(256);
      const videoDuration = session.video.duration;

      for (let i = 0; i < frameCount; i++) {
        if (cancelled) throw new DOMException("Export cancelled", "AbortError");
        const t = Math.min(duration, i * frameDuration);
        const mapped =
          Number.isFinite(videoDuration) && videoDuration > 0 ? videoTime(t, session.settings.segments, videoDuration) : 0;
        await session.seekVideo(mapped);
        fillAnalyserFromBuffer(audioBuffer, t, freq, wave);
        session.draw(t, freq, wave);
        await videoSource.add(t, frameDuration);
        options.onProgress?.(t, duration);
        if (i % 20 === 0) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      }

      if (cancelled) throw new DOMException("Export cancelled", "AbortError");
      await muxer.finalize();
      const buffer = target.buffer;
      if (!buffer) throw new Error("Download produced an empty file.");
      const blob = new Blob([buffer], { type: mime });
      const poster = session.posterJpeg();
      return {
        blob,
        mime,
        ext,
        poster,
        duration,
        width,
        height,
      };
    } catch (error) {
      if (cancelled || isAbort(error)) {
        throw error instanceof DOMException ? error : new DOMException("Export cancelled", "AbortError");
      }
      throw error;
    } finally {
      session.endExport();
    }
  })();

  return { done, cancel };
}

