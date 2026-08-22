import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type Variant = "solid" | "ghost" | "danger" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const styles: Record<Variant, string> = {
  solid:
    "rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-bg hover:brightness-110 disabled:opacity-40",
  ghost:
    "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-text hover:border-white/20 hover:bg-white/10 disabled:opacity-40",
  danger: "rounded-full px-3 py-1.5 text-sm font-medium text-rose hover:bg-rose/10 disabled:opacity-40",
  icon: "grid size-9 place-items-center rounded-full text-text hover:bg-white/10 disabled:opacity-40",
};

export function Button({ variant = "ghost", className, children, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn("transition duration-180", styles[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-label">{children}</div>;
}
