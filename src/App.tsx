import { useCallback, useEffect, useState } from "react";
import { Landing } from "./pages/Landing";
import { Studio } from "./pages/Studio";
import { Toast } from "./components/ui/Toast";
import { loadAudioFile, loadVideoFile } from "./lib/media";
import type { LyricLine, MediaAsset, ToastMessage } from "./types";

export default function App() {
  const [video, setVideo] = useState<MediaAsset | null>(null);
  const [audio, setAudio] = useState<MediaAsset | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsEmbedded, setLyricsEmbedded] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [studio, setStudio] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = useCallback((text: string, tone: "info" | "error" = "info") => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    const prevent = (event: DragEvent) => {
      event.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  useEffect(() => {
    if (video && audio) {
      const id = window.setTimeout(() => setStudio(true), 180);
      return () => window.clearTimeout(id);
    }
    setStudio(false);
  }, [video, audio]);

  const onVideo = async (file: File) => {
    setVideoLoading(true);
    setVideoError(null);
    try {
      const next = await loadVideoFile(file);
      setVideo((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return next;
      });
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : "Couldn't read that video.");
    } finally {
      setVideoLoading(false);
    }
  };

  const onAudio = async (file: File) => {
    setAudioLoading(true);
    setAudioError(null);
    try {
      const result = await loadAudioFile(file);
      setAudio((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return result.asset;
      });
      setLyrics(result.lyrics);
      setLyricsEmbedded(result.lyricsEmbedded);
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : "Couldn't read that audio.");
    } finally {
      setAudioLoading(false);
    }
  };

  return (
    <>
      {studio && video && audio ? (
        <Studio
          video={video}
          audio={audio}
          lyrics={lyrics}
          lyricsEmbedded={lyricsEmbedded}
          onVideoFile={(file) => void onVideo(file)}
          onAudioFile={(file) => void onAudio(file)}
          onLyrics={(lines, fromFile) => {
            setLyrics(lines);
            if (fromFile) setLyricsEmbedded(false);
          }}
          notify={notify}
        />
      ) : (
        <Landing
          video={video}
          audio={audio}
          videoLoading={videoLoading}
          audioLoading={audioLoading}
          videoError={videoError}
          audioError={audioError}
          onVideo={(file) => void onVideo(file)}
          onAudio={(file) => void onAudio(file)}
        />
      )}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}
