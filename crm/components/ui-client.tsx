"use client";

// Client-only design-system primitives that need browser APIs.
// Import from here (not ui.tsx) for Modal, Drawer, and Toast.

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// Shared backdrop/dialog helpers
// ---------------------------------------------------------------------------

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

function useEscapeKey(handler: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handler, active]);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = useCallback(onClose, [onClose]);

  useBodyScrollLock(open);
  useEscapeKey(close, open);

  // Focus the dialog panel when it opens
  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-hmd-teal-700/60 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl outline-none ${className}`}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <button
              onClick={close}
              aria-label="Close"
              className="rounded-lg p-1 text-muted transition-colors hover:bg-background hover:text-foreground"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Drawer (right-side slide-over)
// ---------------------------------------------------------------------------
export function Drawer({
  open,
  onClose,
  title,
  children,
  width = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(onClose, [onClose]);

  useBodyScrollLock(open);
  useEscapeKey(close, open);

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end"
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-hmd-teal-700/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative z-10 flex h-full w-full ${width} flex-col border-l border-border bg-surface shadow-2xl outline-none`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          {title ? (
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          ) : (
            <span />
          )}
          <button
            onClick={close}
            aria-label="Close drawer"
            className="rounded-lg p-1 text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Toast — imperative, no provider required
// ---------------------------------------------------------------------------

type ToastVariant = "default" | "success" | "warning" | "error";

interface ToastOptions {
  variant?: ToastVariant;
  duration?: number;
}

const TOAST_VARIANT_CLASSES: Record<ToastVariant, string> = {
  default: "bg-hmd-teal-600 text-white",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  error: "bg-danger text-white",
};

function getOrCreateToastContainer(): HTMLElement {
  const id = "__hmd-toast-container";
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.setAttribute(
      "style",
      [
        "position:fixed",
        "bottom:1.5rem",
        "right:1.5rem",
        "z-index:9999",
        "display:flex",
        "flex-direction:column",
        "gap:0.5rem",
        "pointer-events:none",
      ].join(";")
    );
    document.body.appendChild(el);
  }
  return el;
}

export function toast(message: string, options: ToastOptions = {}): void {
  if (typeof document === "undefined") return;

  const { variant = "default", duration = 3500 } = options;
  const container = getOrCreateToastContainer();

  const item = document.createElement("div");
  const variantCls = TOAST_VARIANT_CLASSES[variant];

  // Build class list manually (no Tailwind runtime — just inline styles + CSS vars)
  item.setAttribute(
    "style",
    [
      "pointer-events:auto",
      "display:inline-flex",
      "align-items:center",
      "gap:0.5rem",
      "border-radius:0.75rem",
      "padding:0.625rem 1rem",
      "font-size:0.875rem",
      "font-weight:500",
      "line-height:1.25rem",
      "box-shadow:0 4px 16px rgba(0,0,0,0.18)",
      "opacity:0",
      "transform:translateY(0.5rem)",
      "transition:opacity 200ms ease, transform 200ms ease",
    ].join(";")
  );

  // Apply variant color via CSS vars so we honour the brand tokens
  const variantStyles: Record<ToastVariant, { bg: string; color: string }> = {
    default: { bg: "var(--hmd-teal-600)", color: "#ffffff" },
    success: { bg: "var(--success)", color: "#ffffff" },
    warning: { bg: "var(--warning)", color: "#ffffff" },
    error: { bg: "var(--danger)", color: "#ffffff" },
  };
  item.style.background = variantStyles[variant].bg;
  item.style.color = variantStyles[variant].color;

  item.textContent = message;
  item.setAttribute("role", "status");
  item.setAttribute("aria-live", "polite");

  container.appendChild(item);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      item.style.opacity = "1";
      item.style.transform = "translateY(0)";
    });
  });

  // Auto-dismiss
  const dismissTimeout = setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateY(0.5rem)";
    setTimeout(() => {
      if (item.parentNode === container) {
        container.removeChild(item);
      }
    }, 220);
  }, duration);

  // Clean up timer if somehow item is removed early
  item.addEventListener("click", () => {
    clearTimeout(dismissTimeout);
    if (item.parentNode === container) container.removeChild(item);
  });
}

// Re-export for convenience so consumers can import everything from ui-client
export type { ToastVariant, ToastOptions };
