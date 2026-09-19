import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Props<T> = {
  items: T[];
  /** Stable key per item */
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Approx row height for scroll windowing (card + gap). */
  estimateHeight?: number;
  /** Columns hint for window math; CSS grid still decides layout. */
  minColWidth?: number;
  className?: string;
  /** Below this count, render everything (no window). */
  windowAbove?: number;
};

/**
 * Card grid that stays cheap for large sets:
 * - content-visibility on cells
 * - simple vertical windowing when item count is high (no extra deps)
 */
export function VirtualCardGrid<T>({
  items,
  getKey,
  renderItem,
  estimateHeight = 220,
  minColWidth = 135,
  className = "pv-card-grid",
  windowAbove = 48,
}: Props<T>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState({ start: 0, end: items.length });

  const cols = useMemo(() => {
    if (typeof window === "undefined") return 3;
    return Math.max(1, Math.floor(window.innerWidth / (minColWidth + 16)));
  }, [minColWidth, items.length]);

  useEffect(() => {
    if (items.length <= windowAbove) {
      setRange({ start: 0, end: items.length });
      return;
    }
    const el = scrollerRef.current;
    // Prefer nearest scrollable ancestor (lab body), else window
    const scrollRoot =
      (el?.closest(".pv-lab-body") as HTMLElement | null) ||
      (document.scrollingElement as HTMLElement | null);

    const update = () => {
      const rowH = estimateHeight;
      const viewH = scrollRoot
        ? Math.min(scrollRoot.clientHeight || window.innerHeight, window.innerHeight)
        : window.innerHeight;
      const scrollTop = scrollRoot ? scrollRoot.scrollTop : window.scrollY;
      const rows = Math.ceil(items.length / cols);
      const overscan = 3;
      const startRow = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
      const endRow = Math.min(rows, Math.ceil((scrollTop + viewH) / rowH) + overscan);
      setRange({
        start: startRow * cols,
        end: Math.min(items.length, endRow * cols),
      });
    };

    update();
    const target: any = scrollRoot || window;
    target.addEventListener?.("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      target.removeEventListener?.("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items.length, cols, estimateHeight, windowAbove]);

  if (items.length === 0) return <div className={className} ref={scrollerRef} />;

  if (items.length <= windowAbove) {
    return (
      <div className={className} ref={scrollerRef}>
        {items.map((item) => (
          <div key={getKey(item)} className="pv-virt-cell">
            {renderItem(item)}
          </div>
        ))}
      </div>
    );
  }

  const topPad = Math.floor(range.start / cols) * estimateHeight;
  const bottomRows = Math.ceil((items.length - range.end) / cols);
  const bottomPad = Math.max(0, bottomRows * estimateHeight);
  const slice = items.slice(range.start, range.end);

  return (
    <div className={className} ref={scrollerRef}>
      {topPad > 0 && <div className="pv-virt-spacer" style={{ gridColumn: "1 / -1", height: topPad }} aria-hidden />}
      {slice.map((item) => (
        <div key={getKey(item)} className="pv-virt-cell">
          {renderItem(item)}
        </div>
      ))}
      {bottomPad > 0 && <div className="pv-virt-spacer" style={{ gridColumn: "1 / -1", height: bottomPad }} aria-hidden />}
    </div>
  );
}
