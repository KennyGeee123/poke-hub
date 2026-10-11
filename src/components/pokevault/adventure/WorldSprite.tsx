import { useEffect, useState } from "react";
import { worldSpriteUrls } from "@/lib/sprites";

/** Overworld sprite. Tries the animated frame, then each static fallback. */
export function WorldSprite({
  name,
  className,
  alt,
}: {
  name: string;
  className?: string;
  alt?: string;
}) {
  const urls = worldSpriteUrls(name);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    setFrame(0);
  }, [name]);
  const src = urls[Math.min(frame, urls.length - 1)];
  return (
    <img
      src={src}
      alt={alt || name}
      className={className}
      style={src.endsWith(".png") ? { imageRendering: "pixelated" } : undefined}
      onError={() => setFrame((n) => (n + 1 < urls.length ? n + 1 : n))}
    />
  );
}
