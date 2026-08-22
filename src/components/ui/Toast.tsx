import { useEffect } from "react";
import { cn } from "../../lib/utils";
import type { ToastMessage } from "../../types";
import { CloseIcon } from "../Icons";

export function Toast({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, 5200);
    return () => window.clearTimeout(id);
  }, [toast.id, onClose]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div
        className={cn(
          "pointer-events-auto glass flex max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm",
          toast.tone === "error" ? "text-rose" : "text-text",
        )}
      >
        <p className="pt-0.5 leading-snug">{toast.text}</p>
        <button type="button" className="rounded-full p-1 text-muted hover:text-text" onClick={onClose} aria-label="Dismiss">
          <CloseIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
