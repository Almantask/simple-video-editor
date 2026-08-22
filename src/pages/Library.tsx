import { useCallback, useEffect, useMemo, useState } from "react";
import { DownloadIcon, PlayIcon, TrashIcon } from "../components/Icons";
import { LibraryLink, Wordmark } from "../components/Wordmark";
import { Button } from "../components/ui/Button";
import { deleteClip, getClipVideo, listClips } from "../lib/library";
import { downloadBlob, formatTime } from "../lib/utils";
import type { LibraryClipMeta } from "../types";

export function Library({
  canEdit,
  notify,
}: {
  canEdit: boolean;
  notify: (text: string, tone?: "info" | "error") => void;
}) {
  const [clips, setClips] = useState<LibraryClipMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<{ clip: LibraryClipMeta; url: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setClips(await listClips());
    } catch {
      setError("Couldn't read the library in this browser.");
      setClips([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (player) URL.revokeObjectURL(player.url);
    };
  }, [player]);

  const play = async (clip: LibraryClipMeta) => {
    try {
      const blob = await getClipVideo(clip.id);
      const url = URL.createObjectURL(blob);
      setPlayer((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { clip, url };
      });
    } catch {
      notify("Couldn't open that clip.", "error");
    }
  };

  const download = async (clip: LibraryClipMeta) => {
    try {
      const blob = await getClipVideo(clip.id);
      const filename = clip.name.endsWith(`.${clip.ext}`) ? clip.name : `${clip.name}.${clip.ext}`;
      downloadBlob(blob, filename);
    } catch {
      notify("Couldn't download that clip.", "error");
    }
  };

  const remove = async (clip: LibraryClipMeta) => {
    if (!window.confirm(`Delete “${clip.name}” from this browser?`)) return;
    try {
      await deleteClip(clip.id);
      if (player?.clip.id === clip.id) {
        URL.revokeObjectURL(player.url);
        setPlayer(null);
      }
      await refresh();
      notify("Removed from library.");
    } catch {
      notify("Couldn't delete that clip.", "error");
    }
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-bg text-text">
      <div className="vignette pointer-events-none absolute inset-0" />
      <header className="relative flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-8 sm:py-6">
        <Wordmark />
        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          {canEdit ? (
            <a href="#" className="text-[11px] font-medium uppercase tracking-[0.18em] text-label hover:text-text">
              Editor
            </a>
          ) : null}
          <LibraryLink active />
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-4 pb-[max(4rem,env(safe-area-inset-bottom))] sm:px-6">
        <h1 className="font-serif text-3xl text-text sm:text-4xl md:text-5xl">Library</h1>
        <p className="mt-3 max-w-xl text-sm text-muted">
          Clips you save stay in this browser until you delete them. They are not uploaded.
        </p>
        {error ? <p className="mt-8 text-sm text-rose">{error}</p> : null}
        {clips && clips.length === 0 && !error ? (
          <div className="mt-12 max-w-lg rounded-3xl border border-white/8 bg-white/5 px-6 py-10">
            <p className="text-sm text-muted">No clips yet. Make a video in the editor, then save it to the library.</p>
            <a href="#" className="mt-4 inline-block text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
              {canEdit ? "Back to editor" : "Start a clip"}
            </a>
          </div>
        ) : null}
        {clips && clips.length > 0 ? (
          <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {clips.map((clip) => (
              <li key={clip.id}>
                <ClipCard clip={clip} onPlay={() => void play(clip)} onDownload={() => void download(clip)} onDelete={() => void remove(clip)} />
              </li>
            ))}
          </ul>
        ) : null}
      </main>
      {player ? (
        <div className="fixed inset-0 z-40 grid place-items-end bg-black/70 p-0 sm:place-items-center sm:p-4">
          <div className="glass w-full max-w-3xl overflow-hidden rounded-t-[20px] sm:rounded-[20px]">
            <video src={player.url} controls autoPlay className="aspect-video w-full bg-black" />
            <div className="flex flex-wrap items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{player.clip.name}</div>
                <div className="font-mono text-[11px] text-muted">
                  {formatTime(player.clip.duration)} · {player.clip.height}p
                </div>
              </div>
              <Button className="flex items-center gap-2" onClick={() => void download(player.clip)}>
                <DownloadIcon className="size-4" />
                Download
              </Button>
              <Button onClick={() => {
                URL.revokeObjectURL(player.url);
                setPlayer(null);
              }}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ClipCard({
  clip,
  onPlay,
  onDownload,
  onDelete,
}: {
  clip: LibraryClipMeta;
  onPlay: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const posterUrl = useMemo(() => (clip.poster.size > 0 ? URL.createObjectURL(clip.poster) : ""), [clip.poster]);
  useEffect(() => {
    return () => {
      if (posterUrl) URL.revokeObjectURL(posterUrl);
    };
  }, [posterUrl]);
  const when = new Date(clip.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return (
    <article className="glass overflow-hidden rounded-[20px]">
      <button type="button" className="relative block aspect-video w-full bg-black" onClick={onPlay} aria-label={`Play ${clip.name}`}>
        {posterUrl ? <img src={posterUrl} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-well" />}
        <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition duration-180 hover:opacity-100">
          <span className="grid size-12 place-items-center rounded-full bg-black/60 text-text">
            <PlayIcon className="size-5" />
          </span>
        </span>
      </button>
      <div className="space-y-3 p-4">
        <div>
          <h2 className="truncate text-sm font-medium">{clip.name}</h2>
          <p className="mt-1 font-mono text-[11px] text-muted">
            {formatTime(clip.duration)} · {clip.height}p · {when}
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-xs sm:gap-2 sm:text-sm" onClick={onPlay}>
            <PlayIcon className="size-4" />
            Play
          </Button>
          <Button className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-xs sm:gap-2 sm:text-sm" onClick={onDownload}>
            <DownloadIcon className="size-4" />
            Download
          </Button>
          <Button variant="danger" className="px-2" onClick={onDelete} aria-label={`Delete ${clip.name}`}>
            <TrashIcon className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
