/**
 * @file components/Toast.tsx
 * @description Auto-dismissing toast notification. Mounts at a fixed position
 * (bottom-right) and disappears after `duration` ms. Calls `onClose` before unmounting.
 *
 * Usage:
 * ```tsx
 * const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
 * {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
 * ```
 */
"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  /** The message text to display. */
  message: string;
  /** Visual style. Defaults to "info". */
  type?: "info" | "success" | "error";
  /** Called when the toast dismisses (either by timeout or user click). */
  onClose?: () => void;
  /** Auto-dismiss delay in milliseconds. Defaults to 4000. */
  duration?: number;
}

export default function Toast({
  message,
  type = "info",
  onClose,
  duration = 4000,
}: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  if (!visible) return null;

  const colors = {
    info: "bg-surface-container border-primary text-on-surface",
    success: "bg-surface-container border-secondary text-on-surface",
    error: "bg-error-container border-error text-on-error-container",
  };

  const icons = {
    info: "info",
    success: "check_circle",
    error: "error",
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] max-w-sm custom-notch border px-5 py-4 shadow-lg flex items-start gap-3 ${colors[type]}`}
    >
      <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
        {icons[type]}
      </span>
      <p className="font-body-md text-body-md flex-1">{message}</p>
      <button
        onClick={() => { setVisible(false); onClose?.(); }}
        className="shrink-0 text-on-surface-variant hover:text-on-surface transition-colors ml-1"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
