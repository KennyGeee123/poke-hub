import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { backSpriteFallback, backSpriteUrl, fallbackSpriteUrls, localGen5BackUrl, localGen5Url } from "@/lib/sprites";
import { eraSpriteUrls } from "@/lib/era-sprites";
import type { PokemonEraId } from "@/lib/adventure-engine";

/** Which era's game sprites to draw (battles set this; default is the full Black/White pixel set). */
export const SpriteEraContext = createContext<PokemonEraId | undefined>(undefined);

export function SpriteImg({
  name,
  className,
  back,
  alt,
  shiny,
}: {
  name: string;
  className?: string;
  back?: boolean;
  alt?: string;
  shiny?: boolean;
}) {
  const era = useContext(SpriteEraContext);
  const urls = useMemo(() => {
    // Pixel sprites by dex number first (era game set -> Black/White -> PokeAPI default,
    // every species #1-1025 covered), then the older name-based chain for anything unresolved.
    const pixel = [...(shiny ? eraSpriteUrls(name, era, !!back, true) : []), ...eraSpriteUrls(name, era, !!back)];
    const local = back ? localGen5BackUrl(name) : localGen5Url(name);
    const rest = back ? [backSpriteUrl(name), backSpriteFallback(name), ...fallbackSpriteUrls(name)] : fallbackSpriteUrls(name);
    const ordered = era ? [...pixel, ...(local ? [local] : []), ...rest] : [...(local ? [local] : []), ...pixel, ...rest];
    return [...new Set(ordered)];
  }, [name, back, era, shiny]);
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
  }, [name, back, era, shiny]);
  const src = urls[Math.min(i, urls.length - 1)] || "";
  return (
    <img
      className={className}
      src={src}
      alt={alt ?? name}
      onError={() => setI((n) => (n + 1 < urls.length ? n + 1 : n))}
    />
  );
}
