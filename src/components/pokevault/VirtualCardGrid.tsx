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
  /** Extra rows above/below the viewport. */
  overscanRows?: number;
};

/**
 * Card grid that only mounts visible (+ overscan) tiles for large lists.
 * Small lists render fully so Search/print queries never hide results.
 */
export function VirtualCardGrid<T>({
  items,
  getKey,
  renderItem,
  estimateHeight = 280,
  minColWidth = 135,
  className = "pv-card-grid",
  windowAbove = 36,
  overscanRows = 4,
}: Props<T>) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState({ start: 0, end: items.length });
  const [cols, setCols] = useState(3);

  useEffect(() => {
    const measure = () => {
      const el = gridRef.current;
      const width = el?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 400);
      setCols(Math.max(1, Math.floor(width / (minColWidth + 12))));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [minColWidth]);

  useEffect(() => {
    if (items.length <= windowAbove) {
      setRange({ start: 0, end: items.length });
      return;
    }

    const findScrollRoot = (): HTMLElement | Window => {
      const el = gridRef.current;
      let node: HTMLElement | null = el;
      while (node) {
        const style = getComputedStyle(node);
        const oy = style.overflowY;
        if (
          (oy === "auto" || oy === "scroll" || oy === "overlay") &&
          node.scrollHeight > node.clientHeight + 8
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return window;
    };

    const scrollRoot = findScrollRoot();

    const update = () => {
      const rowH = estimateHeight;
      const rows = Math.ceil(items.length / cols);
      let scrollTop = 0;
      let viewH = typeof window !== "undefined" ? window.innerHeight : 800;
      let offsetTop = 0;

      if (scrollRoot instanceof Window) {
        scrollTop = window.scrollY || document.documentElement.scrollTop;
        viewH = window.innerHeight;
        const rect = gridRef.current?.getBoundingClientRect();
        offsetTop = rect ? rect.top + scrollTop : 0;
      } else {
        scrollTop = scrollRoot.scrollTop;
        viewH = scrollRoot.clientHeight || window.innerHeight;
        const rootRect = scrollRoot.getBoundingClientRect();
        const gridRect = gridRef.current?.getBoundingClientRect();
        offsetTop = gridRect ? gridRect.top - rootRect.top + scrollTop : 0;
      }

      const relTop = Math.max(0, scrollTop - offsetTop);
      const startRow = Math.max(0, Math.floor(relTop / rowH) - overscanRows);
      const endRow = Math.min(rows, Math.ceil((relTop + viewH) / rowH) + overscanRows);
      setRange({
        start: startRow * cols,
        end: Math.min(items.length, endRow * cols),
      });
    };

    update();
    const opts: AddEventListenerOptions = { passive: true };
    scrollRoot.addEventListener("scroll", update, opts);
    window.addEventListener("resize", update);
    return () => {
      scrollRoot.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items.length, cols, estimateHeight, windowAbove, overscanRows]);

  const slice = useMemo(() => {
    if (items.length <= windowAbove) return items;
    return items.slice(range.start, range.end);
  }, [items, range.start, range.end, windowAbove]);

  if (items.length === 0) return <div className={className} ref={gridRef} />;

  if (items.length <= windowAbove) {
    return (
      <div className={className} ref={gridRef}>
        {items.map((item) => (
          <div
            key={getKey(item)}
            className="pv-virt-cell"
            style={{ contentVisibility: "auto", containIntrinsicSize: `auto ${estimateHeight}px` }}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    );
  }

  const topPad = Math.floor(range.start / cols) * estimateHeight;
  const bottomRows = Math.ceil((items.length - range.end) / cols);
  const bottomPad = Math.max(0, bottomRows * estimateHeight);

  return (
    <div className={className} ref={gridRef}>
      {topPad > 0 && (
        <div
          className="pv-virt-spacer"
          style={{ gridColumn: "1 / -1", height: topPad }}
          aria-hidden
        />
      )}
      {slice.map((item) => (
        <div
          key={getKey(item)}
          className="pv-virt-cell"
          style={{ contentVisibility: "auto", containIntrinsicSize: `auto ${estimateHeight}px` }}
        >
          {renderItem(item)}
        </div>
      ))}
      {bottomPad > 0 && (
        <div
          className="pv-virt-spacer"
          style={{ gridColumn: "1 / -1", height: bottomPad }}
          aria-hidden
        />
      )}
    </div>
  );
}
