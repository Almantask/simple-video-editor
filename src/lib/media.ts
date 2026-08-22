import { computePeaks } from "../engine/waveform";
import { extractEmbeddedLyrics } from "../engine/lyrics";
import type { LyricLine, MediaAsset } from "../types";

const VIDEO_OK = /\.(mp4|webm|mov|m4v)$/i;
const AUDIO_OK = /\.(mp3|wav|flac|m4a|aac|ogg|opus|wma)$/i;

export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/") || VIDEO_OK.test(file.name);
}

export function isAudioFile(file: File): boolean {
  return file.type.startsWith("audio/") || AUDIO_OK.test(file.name);
}

/**
 * Copy a picker File into an in-memory File.
 * Chromium revokes live file-input blobs (ERR_UPLOAD_FILE_CHANGED) if the
 * input is reset, the file is read twice, or the bytes change on disk.
 */
export async function detachFile(file: File): Promise<File> {
  const bytes = await file.arrayBuffer();
  return new File([bytes], file.name, {
    type: file.type,
    lastModified: Date.now(),
  });
}

export async function loadVideoFile(file: File): Promise<MediaAsset> {
  if (!isVideoFile(file)) throw new Error("Use an MP4, WebM, or MOV file.");
  const frozen = await detachFile(file);
  const url = URL.createObjectURL(frozen);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  try {
    await waitFor(video, "loadedmetadata");
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("This video has no readable duration.");
    }
    const duration = video.duration;
    const width = video.videoWidth;
    const height = video.videoHeight;
    const thumbnail = await captureFrame(video);
    video.removeAttribute("src");
    video.load();
    return {
      file: frozen,
      url,
      name: frozen.name,
      duration,
      thumbnail,
      width,
      height,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error instanceof Error ? error : new Error("This browser can't decode that video.");
  }
}

export interface AudioLoadResult {
  asset: MediaAsset;
  lyrics: LyricLine[];
  lyricsEmbedded: boolean;
}

export async function loadAudioFile(file: File): Promise<AudioLoadResult> {
  if (!isAudioFile(file)) throw new Error("Use an MP3, WAV, FLAC, or M4A file.");
  const frozen = await detachFile(file);
  const url = URL.createObjectURL(frozen);
  const audio = document.createElement("audio");
  audio.preload = "metadata";
  audio.src = url;
  try {
    await waitFor(audio, "loadedmetadata");
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      throw new Error("This track has no readable duration.");
    }
    const duration = audio.duration;
    audio.removeAttribute("src");
    audio.load();
    const [embedded, peaks] = await Promise.all([
      extractEmbeddedLyrics(frozen),
      computePeaks(frozen).catch(() => undefined),
    ]);
    return {
      lyrics: embedded.lines,
      lyricsEmbedded: embedded.embedded,
      asset: {
        file: frozen,
        url,
        name: frozen.name,
        duration,
        peaks,
        title: embedded.title,
      },
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error instanceof Error ? error : new Error("This browser can't decode that audio.");
  }
}

function waitFor(el: HTMLMediaElement, event: string, timeout = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out reading this file."));
    }, timeout);
    const ok = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error(mediaErrorMessage(el)));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      el.removeEventListener(event, ok);
      el.removeEventListener("error", fail);
    };
    el.addEventListener(event, ok, { once: true });
    el.addEventListener("error", fail, { once: true });
  });
}

function mediaErrorMessage(el: HTMLMediaElement): string {
  const code = el.error?.code;
  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "This browser can't decode that file.";
  }
  if (code === MediaError.MEDIA_ERR_NETWORK) {
    return "Could not read that file. Drop it again.";
  }
  return "This browser can't decode that file.";
}

async function captureFrame(video: HTMLVideoElement): Promise<string | undefined> {
  const stamp = Math.min(0.12, Math.max(0, video.duration * 0.05 || 0));
  if (video.readyState < 2) {
    try {
      await waitFor(video, "loadeddata", 8000);
    } catch {
      return undefined;
    }
  }
  try {
    if (Math.abs(video.currentTime - stamp) > 0.03) {
      const seeked = waitFor(video, "seeked", 8000);
      video.currentTime = stamp;
      await seeked;
    }
  } catch {
    // Use whatever frame is already decoded.
  }
  if (!video.videoWidth) return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = Math.max(1, Math.round((480 * video.videoHeight) / video.videoWidth));
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return undefined;
  }
}
