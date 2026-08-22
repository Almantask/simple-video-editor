import { cn } from "../lib/utils";
import { Wordmark, LibraryLink } from "../components/Wordmark";
import { DropCard } from "../components/MediaDropzone";
import { Tutorial } from "../components/Tutorial";
import type { MediaAsset } from "../types";

export function Landing({
  video,
  audio,
  videoLoading,
  audioLoading,
  videoError,
  audioError,
  onVideo,
  onAudio,
}: {
  video: MediaAsset | null;
  audio: MediaAsset | null;
  videoLoading: boolean;
  audioLoading: boolean;
  videoError: string | null;
  audioError: string | null;
  onVideo: (file: File) => void | Promise<void>;
  onAudio: (file: File) => void | Promise<void>;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg text-text">
      <div className="vignette pointer-events-none absolute inset-0" />
      <header className="relative flex items-center justify-between px-8 py-6">
        <Wordmark />
        <LibraryLink />
      </header>
      <main className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pb-16 pt-4">
        <h1 className="max-w-3xl text-center font-serif text-5xl leading-tight text-text md:text-6xl">
          Make the video loop until the song ends.
        </h1>
        <p className="mt-4 max-w-xl text-center text-base text-muted">
          Drop a clip and a track. Speed ramps, lyrics, and sound visuals stay in this tab — then download the video or save it to the library.
        </p>
        {!video && !audio && !videoLoading && !audioLoading && (
          <div className="mt-10 w-full">
            <Tutorial />
          </div>
        )}
        <div
          className={cn(
            "grid w-full grid-cols-1 gap-6 md:grid-cols-2",
            video || audio || videoLoading || audioLoading ? "mt-14" : "mt-8",
          )}
        >
          <DropCard kind="video" asset={video} loading={videoLoading} error={videoError} onFile={onVideo} />
          <DropCard kind="audio" asset={audio} loading={audioLoading} error={audioError} onFile={onAudio} />
        </div>
        <p className="mt-10 text-xs tracking-wide text-label">Files never leave this tab.</p>
      </main>
    </div>
  );
}
