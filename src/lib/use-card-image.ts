// One image pipeline for every card surface: real CDN art first, proxy retry on
// busy/failed CDNs, stall watchdog, placeholder-scan detection, and a branded
// "Art pending" tile at the end. A card is never left as a black box.
import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import type { TCGCard } from "@/lib/pokemon-api";
import { fallbackCardImages, isArtPending, looksLikePlaceholderScan } from "@/lib/card-images";

type ImgCard = Pick<TCGCard, "id" | "name" | "number" | "set" | "images">;

/** A visible image that has not painted after this long moves to the next source. */
export const IMAGE_STALL_MS = 9000;

export function useCardImageChain(card: ImgCard, opts?: { tile?: boolean }) {
  const tile = !!opts?.tile;
  const key = `${card.id}|${card.images?.small || ""}|${card.images?.large || ""}|${tile ? 1 : 0}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures every input
  const urls = useMemo(() => fallbackCardImages(card, { tile }), [key]);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setIdx(0);
    setLoaded(false);
  }, [key]);

  const last = urls.length - 1;
  const at = Math.min(idx, Math.max(0, last));
  const src = urls[at] || "";
  const pending = isArtPending(src);

  const advance = useCallback(() => {
    setIdx((i) => (i < last ? i + 1 : i));
  }, [last]);

  const onLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      if (at < last && looksLikePlaceholderScan(e.currentTarget)) {
        advance();
        return;
      }
      setLoaded(true);
    },
    [advance, at, last],
  );

  const onError = useCallback(() => {
    if (at < last) advance();
    else setLoaded(true);
  }, [advance, at, last]);

  // Cached images can finish before React attaches onLoad (hydration, fast
  // remounts in the virtual grid) — without this the tile stays at opacity 0.
  useEffect(() => {
    const el = ref.current;
    if (!el || loaded) return;
    if (el.complete && el.naturalWidth > 0 && !looksLikePlaceholderScan(el)) setLoaded(true);
  }, [src, loaded]);

  // Stall watchdog: a hung CDN request (no load, no error) used to leave a
  // black tile forever. Only counts while the tile is on screen.
  useEffect(() => {
    if (loaded || pending) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (timer) clearTimeout(timer);
        if (entry?.isIntersecting) {
          timer = setTimeout(() => {
            if (!el.complete || el.naturalWidth === 0) advance();
          }, IMAGE_STALL_MS);
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      io.disconnect();
    };
  }, [src, loaded, pending, advance]);

  return { ref, src, loaded, pending, onLoad, onError, urls };
}
