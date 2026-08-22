import { parseBlob } from "music-metadata";
import type { LyricLine } from "../types";

const LRC_TAG = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
const LRC_HINT = /\[[0-9]{1,2}:[0-9]{2}/;
const SRT_TIME =
  /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/;

export function parseLrc(source: string): LyricLine[] {
  const timed: { t: number; text: string }[] = [];
  for (const raw of source.split(/\r?\n/)) {
    const tags = [...raw.matchAll(LRC_TAG)];
    if (tags.length === 0) continue;
    const text = raw.replace(/\[[^\]]*]/g, "").trim();
    if (!text) continue;
    for (const match of tags) {
      timed.push({ t: lrcStamp(match[1], match[2], match[3]), text });
    }
  }
  timed.sort((a, b) => a.t - b.t);
  return timed.map((line, i) => ({
    start: line.t,
    end: i < timed.length - 1 ? timed[i + 1].t : line.t + 5,
    text: line.text,
  }));
}

export function parseSrt(source: string): LyricLine[] {
  const blocks = source.replace(/^\uFEFF/, "").split(/\r?\n\r?\n/);
  const lines: LyricLine[] = [];
  for (const block of blocks) {
    const parts = block.trim().split(/\r?\n/);
    if (parts.length < 2) continue;
    const timeLine = parts[0].includes("-->") ? parts[0] : parts[1];
    const match = timeLine.match(SRT_TIME);
    if (!match) continue;
    const start = srtStamp(match[1], match[2], match[3], match[4]);
    const end = srtStamp(match[5], match[6], match[7], match[8]);
    const textStart = parts[0].includes("-->") ? 1 : 2;
    const text = parts
      .slice(textStart)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (text) lines.push({ start, end, text });
  }
  return lines;
}

export function parseLyricsFile(name: string, text: string): LyricLine[] {
  if (/\.srt$/i.test(name) || text.includes("-->")) return parseSrt(text);
  return parseLrc(text);
}

export function currentLyric(lines: LyricLine[], time: number): LyricLine | null {
  let found: LyricLine | null = null;
  for (const line of lines) {
    if (time >= line.start && time < line.end) found = line;
  }
  return found;
}

export async function extractEmbeddedLyrics(file: Blob): Promise<{
  title?: string;
  lines: LyricLine[];
  embedded: boolean;
}> {
  try {
    const meta = await parseBlob(file);
    const title = meta.common.title;
    const tags = meta.common.lyrics ?? [];
    for (const tag of tags) {
      if (tag.syncText && tag.syncText.length > 0) {
        const ms = tag.timeStampFormat === 2;
        const timed = tag.syncText
          .filter((entry) => entry.text.trim())
          .map((entry) => ({
            t: toSeconds(entry.timestamp ?? 0, ms),
            text: entry.text.trim(),
          }))
          .sort((a, b) => a.t - b.t);
        if (timed.length > 0) {
          return {
            title,
            embedded: true,
            lines: timed.map((line, i) => ({
              start: line.t,
              end: i < timed.length - 1 ? timed[i + 1].t : line.t + 5,
              text: line.text,
            })),
          };
        }
      }
      const text = tag.text ?? "";
      if (text && LRC_HINT.test(text)) {
        const lines = parseLrc(text);
        if (lines.length > 0) return { title, lines, embedded: true };
      }
    }
    return { title, lines: [], embedded: false };
  } catch {
    return { lines: [], embedded: false };
  }
}

function lrcStamp(min: string, sec: string, frac?: string): number {
  let extra = 0;
  if (frac) {
    extra = frac.length <= 2 ? Number(frac.padEnd(2, "0")) / 100 : Number(frac.padEnd(3, "0").slice(0, 3)) / 1000;
  }
  return Number(min) * 60 + Number(sec) + extra;
}

function srtStamp(h: string, m: string, s: string, ms: string): number {
  const millis = Number(ms.padEnd(3, "0").slice(0, 3));
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + millis / 1000;
}

function toSeconds(timestamp: number, milliseconds: boolean): number {
  if (milliseconds) return timestamp / 1000;
  return timestamp > 1000 ? timestamp / 1000 : timestamp;
}
