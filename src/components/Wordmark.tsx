import { cn } from "../lib/utils";

export function Wordmark({ compact = false, linked = true }: { compact?: boolean; linked?: boolean }) {
  const inner = (
    <>
      <span className={cn("font-serif tracking-tight text-text", compact ? "text-2xl" : "text-3xl")}>Loop</span>
      {!compact && (
        <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-label sm:inline">
          music videos in the browser
        </span>
      )}
    </>
  );
  if (!linked) {
    return <div className="flex items-baseline gap-3">{inner}</div>;
  }
  return (
    <a href="#" className="flex items-baseline gap-3" aria-label="Loop home">
      {inner}
    </a>
  );
}

export function LibraryLink({ active = false, disabled = false }: { active?: boolean; disabled?: boolean }) {
  const className = cn(
    "text-[11px] font-medium uppercase tracking-[0.18em] transition duration-180",
    disabled ? "pointer-events-none opacity-40" : active ? "text-accent" : "text-label hover:text-text",
  );
  if (disabled) return <span className={className}>Library</span>;
  return (
    <a href="#library" className={className}>
      Library
    </a>
  );
}
