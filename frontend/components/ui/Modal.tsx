import { ReactNode } from "react";

interface ModalProps {
  children: ReactNode;
  onClose?: () => void;
  size?: "sm" | "md";
}

export function Modal({ children, onClose, size = "md" }: ModalProps) {
  const maxW = size === "sm" ? "max-w-sm" : "max-w-md";
  return (
    <div
      className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-slate-800 rounded-2xl p-6 w-full ${maxW} shadow-xl mx-4 border border-slate-200 dark:border-slate-700/60`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
