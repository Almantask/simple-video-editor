import { useState } from "react";
import { downloadBlob } from "../lib/utils";
import { Button } from "./ui/Button";
import { CloseIcon, DownloadIcon } from "./Icons";

export function DoneModal({
  poster,
  blob,
  ext,
  defaultName,
  onClose,
}: {
  poster: string;
  blob: Blob;
  ext: string;
  defaultName: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4">
      <div className="glass w-full max-w-lg overflow-hidden rounded-[20px]">
        <div className="relative aspect-video bg-black">
          {poster ? <img src={poster} alt="" className="h-full w-full object-cover" /> : null}
          <button
            type="button"
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-black/50 text-text"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            aria-label="File name"
          />
          <div className="flex gap-2">
            <Button
              variant="solid"
              className="flex flex-1 items-center justify-center gap-2 py-2.5"
              onClick={() => {
                const filename = name.endsWith(`.${ext}`) ? name : `${name}.${ext}`;
                downloadBlob(blob, filename);
              }}
            >
              <DownloadIcon className="size-4" />
              Download
            </Button>
            <Button className="flex-1 py-2.5" onClick={onClose}>
              Keep editing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
