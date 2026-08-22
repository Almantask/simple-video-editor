import { DRIFT_THRESHOLD, MAX_RATE, MIN_RATE, MIN_SEGMENT, TIME_SNAP, type SpeedSegment } from "../types";

export function clampRate(rate: number): number {
  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}

export function snapTime(t: number): number {
  return Math.round(t / TIME_SNAP) * TIME_SNAP;
}

export function rateAt(t: number, segments: SpeedSegment[]): number {
  for (const segment of segments) {
    if (t >= segment.start && t < segment.end) return segment.rate;
  }
  return 1;
}

export function videoTime(t: number, segments: SpeedSegment[], videoDuration: number): number {
  if (t <= 0 || videoDuration <= 0 || !Number.isFinite(videoDuration)) return 0;
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  let acc = 0;
  let cursor = 0;
  for (const seg of sorted) {
    if (cursor >= t) break;
    const gapEnd = Math.min(t, seg.start);
    if (gapEnd > cursor) {
      acc += gapEnd - cursor;
      cursor = gapEnd;
    }
    if (cursor >= t) break;
    const segEnd = Math.min(t, seg.end);
    if (segEnd > cursor) {
      acc += (segEnd - cursor) * seg.rate;
      cursor = segEnd;
    }
  }
  if (t > cursor) acc += t - cursor;
  return acc % videoDuration;
}

export function loopDelta(actual: number, expected: number, duration: number): number {
  if (duration <= 0) return actual - expected;
  let delta = actual - expected;
  if (delta > duration / 2) delta -= duration;
  if (delta < -duration / 2) delta += duration;
  return delta;
}

export function driftThreshold(rate: number): number {
  return Math.max(DRIFT_THRESHOLD, DRIFT_THRESHOLD * Math.max(1, rate));
}

export function needsSeek(actual: number, expected: number, duration: number, rate = 1): boolean {
  return Math.abs(loopDelta(actual, expected, duration)) > driftThreshold(rate);
}

export function gapAround(origin: number, segments: SpeedSegment[], duration: number): { start: number; end: number } | null {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  let start = 0;
  let end = duration;
  for (const seg of sorted) {
    if (origin >= seg.start && origin < seg.end) return null;
    if (seg.end <= origin) start = Math.max(start, seg.end);
    if (seg.start > origin) {
      end = Math.min(end, seg.start);
      break;
    }
  }
  return { start, end };
}

export function createSegmentRange(
  t0: number,
  t1: number,
  segments: SpeedSegment[],
  duration: number,
): { start: number; end: number } | null {
  const origin = t0;
  const gap = gapAround(origin, segments, duration);
  if (!gap) return null;
  let start = snapTime(Math.min(t0, t1));
  let end = snapTime(Math.max(t0, t1));
  start = Math.max(gap.start, start);
  end = Math.min(gap.end, end);
  if (end - start < MIN_SEGMENT) {
    end = Math.min(gap.end, start + MIN_SEGMENT);
    start = Math.max(gap.start, end - MIN_SEGMENT);
  }
  if (end - start < MIN_SEGMENT) return null;
  return { start, end };
}

export function moveSegment(
  segment: SpeedSegment,
  nextStart: number,
  segments: SpeedSegment[],
  duration: number,
): SpeedSegment {
  const length = segment.end - segment.start;
  const others = segments.filter((s) => s.id !== segment.id).sort((a, b) => a.start - b.start);
  let min = 0;
  let max = duration - length;
  for (const other of others) {
    if (other.end <= segment.start + 1e-6) min = Math.max(min, other.end);
    if (other.start >= segment.end - 1e-6) max = Math.min(max, other.start - length);
  }
  const start = snapTime(Math.min(max, Math.max(min, nextStart)));
  return { ...segment, start, end: start + length };
}

export function resizeSegment(
  segment: SpeedSegment,
  edge: "start" | "end",
  time: number,
  segments: SpeedSegment[],
  duration: number,
): SpeedSegment {
  const others = segments.filter((s) => s.id !== segment.id).sort((a, b) => a.start - b.start);
  let min = 0;
  let max = duration;
  for (const other of others) {
    if (other.end <= segment.start + 1e-6) min = Math.max(min, other.end);
    if (other.start >= segment.end - 1e-6) max = Math.min(max, other.start);
  }
  if (edge === "start") {
    const start = snapTime(Math.min(segment.end - MIN_SEGMENT, Math.max(min, time)));
    return { ...segment, start };
  }
  const end = snapTime(Math.max(segment.start + MIN_SEGMENT, Math.min(max, time)));
  return { ...segment, end };
}

export function resolveInsertWindow(
  start: number,
  end: number,
  segments: SpeedSegment[],
  duration: number,
): { start: number; end: number } | null {
  const gap = gapAround(start, segments, duration);
  if (!gap) return null;
  const next = {
    start: snapTime(Math.max(gap.start, Math.min(start, duration))),
    end: snapTime(Math.min(gap.end, Math.max(end, start + MIN_SEGMENT))),
  };
  if (next.end - next.start < MIN_SEGMENT) return null;
  return next;
}
