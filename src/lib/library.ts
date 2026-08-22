import type { LibraryClipMeta } from "../types";
import { newId } from "./utils";

const DB_NAME = "loop-library";
const DB_VERSION = 1;
const CLIPS = "clips";
const FILES = "files";

interface FileRecord {
  id: string;
  video: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CLIPS)) {
        db.createObjectStore(CLIPS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(FILES)) {
        db.createObjectStore(FILES, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the library."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Library request failed."));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Library transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Library transaction aborted."));
  });
}

export function isQuotaError(error: unknown): boolean {
  return (
    (error instanceof DOMException && (error.name === "QuotaExceededError" || error.code === 22)) ||
    (error instanceof Error && error.name === "QuotaExceededError")
  );
}

export async function listClips(): Promise<LibraryClipMeta[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(CLIPS, "readonly");
    const rows = await requestToPromise(tx.objectStore(CLIPS).getAll() as IDBRequest<LibraryClipMeta[]>);
    return rows.slice().sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    db.close();
  }
}

export async function getClipVideo(id: string): Promise<Blob> {
  const db = await openDb();
  try {
    const tx = db.transaction(FILES, "readonly");
    const row = await requestToPromise(tx.objectStore(FILES).get(id) as IDBRequest<FileRecord | undefined>);
    if (!row?.video) throw new Error("That clip is missing from this browser.");
    return row.video;
  } finally {
    db.close();
  }
}

export async function saveClip(input: {
  name: string;
  duration: number;
  width: number;
  height: number;
  mime: string;
  ext: string;
  poster: Blob;
  video: Blob;
}): Promise<LibraryClipMeta> {
  const clip: LibraryClipMeta = {
    id: newId(),
    name: input.name.trim() || "Untitled clip",
    createdAt: Date.now(),
    duration: input.duration,
    width: input.width,
    height: input.height,
    mime: input.mime,
    ext: input.ext,
    poster: input.poster,
  };
  const db = await openDb();
  try {
    const tx = db.transaction([CLIPS, FILES], "readwrite");
    tx.objectStore(CLIPS).put(clip);
    tx.objectStore(FILES).put({ id: clip.id, video: input.video } satisfies FileRecord);
    await txDone(tx);
    return clip;
  } finally {
    db.close();
  }
}

export async function deleteClip(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction([CLIPS, FILES], "readwrite");
    tx.objectStore(CLIPS).delete(id);
    tx.objectStore(FILES).delete(id);
    await txDone(tx);
  } finally {
    db.close();
  }
}
