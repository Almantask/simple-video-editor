import { cn } from "../lib/utils";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={cn("font-serif tracking-tight text-text", compact ? "text-2xl" : "text-3xl")}>Loop</span>
      {!compact && (
        <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-label sm:inline">
          music videos in the browser
        </span>
      )}
    </div>
  );
}
