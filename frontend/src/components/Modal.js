import { X } from "lucide-react";
import { useEffect } from "react";

export default function Modal({ open, onClose, title, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60" onClick={onClose}>
      <div
        data-testid="modal"
        className={`brutal-card w-full ${widths[size]} max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b-2 border-zinc-950 flex items-center justify-between bg-zinc-950 text-white">
          <h2 className="font-heading text-lg font-black uppercase tracking-tight">{title}</h2>
          <button onClick={onClose} data-testid="modal-close" className="p-1 hover:bg-[#FF4500]">
            <X className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t-2 border-zinc-950 bg-zinc-50 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
