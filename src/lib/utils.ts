export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatTime(seconds: number, withTenths = false): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  if (withTenths) {
    return `${mm}:${s.toFixed(1).padStart(4, "0")}`;
  }
  const whole = Math.floor(s);
  return `${mm}:${String(whole).padStart(2, "0")}`;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function rateColor(rate: number): string {
  if (Math.abs(rate - 1) < 0.01) return "rgba(255,255,255,0.22)";
  if (rate < 1) return "var(--slow)";
  return "var(--accent)";
}

export function formatRate(rate: number): string {
  const rounded = Math.round(rate * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return `${rounded.toFixed(1)}x`;
  return `${rounded}x`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
