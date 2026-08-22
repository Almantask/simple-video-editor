import { cn } from "../../lib/utils";

interface Option<T extends string> {
  id: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly Option<T>[] | Option<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex rounded-full bg-white/5 p-1">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "relative flex-1 rounded-full px-1.5 py-1.5 text-[11px] font-medium transition duration-180 sm:px-2 sm:text-xs",
              active ? "bg-white/10 text-text" : "text-muted hover:text-text",
            )}
          >
            {option.label}
            {active && <span className="absolute inset-x-3 bottom-0.5 h-px bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step ?? 0.01}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
