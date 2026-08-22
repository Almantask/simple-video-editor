export type VisualizerId = "none" | "bars" | "wave" | "ring";
export type FitMode = "contain" | "cover";
export type InspectorTab = "speed" | "lyrics" | "visual" | "export";
export type ExportResolution = 720 | 1080;

export interface SpeedSegment {
  id: string;
  start: number;
  end: number;
  rate: number;
}

export interface LyricLine {
  start: number;
  end: number;
  text: string;
}

export interface MediaAsset {
  file: File;
  url: string;
  name: string;
  duration: number;
  thumbnail?: string;
  peaks?: Float32Array;
  title?: string;
  width?: number;
  height?: number;
}

export interface ToastMessage {
  id: number;
  text: string;
  tone: "info" | "error";
}

export interface ExportResult {
  blob: Blob;
  mime: string;
  ext: string;
  poster: string;
  duration: number;
  width: number;
  height: number;
}

export interface LibraryClipMeta {
  id: string;
  name: string;
  createdAt: number;
  duration: number;
  width: number;
  height: number;
  mime: string;
  ext: string;
  poster: Blob;
}

export const RATE_PRESETS = [0.25, 0.5, 1, 1.5, 2, 4] as const;
export const MIN_RATE = 0.25;
export const MAX_RATE = 4;
export const MIN_SEGMENT = 0.15;
export const TIME_SNAP = 0.1;
export const DRIFT_THRESHOLD = 0.12;
