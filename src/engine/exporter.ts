import type { EditorSession } from "./session";

export interface MimeChoice {
  mime: string;
  ext: "mp4" | "webm";
  label: "MP4" | "WebM";
}

const CANDIDATES: MimeChoice[] = [
  { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4", label: "MP4" },
  { mime: "video/mp4", ext: "mp4", label: "MP4" },
  { mime: "video/webm;codecs=vp9,opus", ext: "webm", label: "WebM" },
  { mime: "video/webm;codecs=vp8,opus", ext: "webm", label: "WebM" },
  { mime: "video/webm", ext: "webm", label: "WebM" },
];

export function pickMime(): MimeChoice {
  if (typeof MediaRecorder === "undefined") {
    return { mime: "", ext: "webm", label: "WebM" };
  }
  for (const choice of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(choice.mime)) return choice;
  }
  return { mime: "", ext: "webm", label: "WebM" };
}

export function recorderSupported(): boolean {
  return typeof MediaRecorder !== "undefined";
}

export interface ExportHandle {
  done: Promise<{ blob: Blob; mime: string; ext: "mp4" | "webm"; poster: string }>;
  cancel: () => void;
}

export function startExport(
  session: EditorSession,
  options: {
    width: number;
    height: number;
    onProgress?: (current: number, duration: number) => void;
  },
): ExportHandle {
  let cancelled = false;
  let recorder: MediaRecorder | null = null;
  let canvasStream: MediaStream | null = null;

  const cancel = () => {
    cancelled = true;
    try {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch {
      /* ignore */
    }
    session.exporting = false;
    session.pause();
    canvasStream?.getVideoTracks().forEach((track) => track.stop());
  };

  const done = (async () => {
    if (!recorderSupported()) {
      throw new Error("This browser can't record video. Try Chrome, Edge, or Safari.");
    }
    const choice = pickMime();
    session.setCanvasSize(options.width, options.height);
    await session.ensureGraph();
    session.seek(0);
    session.draw();

    canvasStream = session.canvas.captureStream(30);
    const audioStream = session.getAudioStream();
    const mixed = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...(audioStream?.getAudioTracks() ?? []),
    ]);

    const bits = options.height >= 1080 ? 8_000_000 : 4_500_000;
    recorder = choice.mime
      ? new MediaRecorder(mixed, { mimeType: choice.mime, videoBitsPerSecond: bits })
      : new MediaRecorder(mixed, { videoBitsPerSecond: bits });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const stopped = new Promise<Blob>((resolve, reject) => {
      recorder!.onstop = () => {
        const type = recorder!.mimeType || choice.mime || "video/webm";
        resolve(new Blob(chunks, { type }));
      };
      recorder!.onerror = (event) => {
        const errorEvent = event as Event & { error?: Error };
        reject(errorEvent.error ?? new Error("Recording failed."));
      };
    });

    const previousEnded = session.onEnded;
    const finished = new Promise<void>((resolve) => {
      const finish = () => {
        session.onEnded = previousEnded;
        resolve();
      };
      session.onEnded = () => {
        previousEnded?.();
        finish();
      };
      const watch = () => {
        if (cancelled) {
          finish();
          return;
        }
        const duration = session.duration();
        const current = session.currentTime();
        options.onProgress?.(current, duration);
        if (duration > 0 && current >= duration - 0.05) {
          finish();
          return;
        }
        requestAnimationFrame(watch);
      };
      watch();
    });

    session.exporting = true;
    try {
      if (cancelled) throw new DOMException("Export cancelled", "AbortError");
      recorder.start(250);
      await session.play();
      if (cancelled) throw new DOMException("Export cancelled", "AbortError");
      await finished;
      await new Promise((r) => window.setTimeout(r, 120));
      if (recorder.state !== "inactive") recorder.stop();
      const blob = await stopped;
      if (cancelled) throw new DOMException("Export cancelled", "AbortError");
      const poster = session.posterJpeg();
      const mime = recorder.mimeType || choice.mime || blob.type;
      const ext = mime.includes("mp4") ? "mp4" : choice.ext;
      return { blob, mime, ext, poster };
    } finally {
      session.exporting = false;
      session.pause();
      canvasStream?.getVideoTracks().forEach((track) => track.stop());
    }
  })();

  return { done, cancel };
}
