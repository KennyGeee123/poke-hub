// Shared launch-polish primitives: skeletons, empty and error states.
import type { ReactNode } from "react";

export function SkeletonRows({ rows = 6, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="pv-skel-rows" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="pv-skel-row" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="pv-skel-block pv-skel-thumb" />
          <div className="pv-skel-lines">
            <div className="pv-skel-block pv-skel-l1" />
            <div className="pv-skel-block pv-skel-l2" />
          </div>
          <div className="pv-skel-block pv-skel-pill" />
        </div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function SkeletonCards({
  count = 8,
  label = "Loading cards",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div className="pv-skel-cards" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="pv-skel-cardtile">
          <div className="pv-skel-block pv-skel-art" />
          <div className="pv-skel-block pv-skel-l1" />
          <div className="pv-skel-block pv-skel-l2" />
        </div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  actions,
  tone = "default",
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={`pv-empty pv-state ${tone === "error" ? "is-error" : ""}`}
      role={tone === "error" ? "alert" : undefined}
    >
      {icon && (
        <div className="pv-state-icon" aria-hidden>
          {icon}
        </div>
      )}
      <div className="pv-empty-title">{title}</div>
      {children && <div className="pv-state-body">{children}</div>}
      {actions && <div className="pv-state-actions">{actions}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  message,
  onRetry,
  extra,
}: {
  title: string;
  message?: string | null;
  onRetry?: () => void;
  extra?: ReactNode;
}) {
  return (
    <EmptyState
      tone="error"
      icon="📡"
      title={title}
      actions={
        <>
          {onRetry && (
            <button type="button" className="pv-btn pv-btn-fill" onClick={onRetry}>
              ↻ Try again
            </button>
          )}
          {extra}
        </>
      }
    >
      {message || "The card servers didn’t answer. Check your connection and try again."}
    </EmptyState>
  );
}

/** Race a promise against a timeout so screens never hang on a stalled upstream. */
export function withTimeout<T>(p: Promise<T>, ms: number, msg = "Timed out"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
