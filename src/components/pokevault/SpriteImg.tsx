import { useEffect, useMemo, useState } from "react";
import { backSpriteFallback, backSpriteUrl, fallbackSpriteUrls } from "@/lib/sprites";

export function SpriteImg({
  name,
  className,
  back,
  alt,
}: {
  name: string;
  className?: string;
  back?: boolean;
  alt?: string;
}) {
  const urls = useMemo(() => {
    if (back) return [backSpriteUrl(name), backSpriteFallback(name), ...fallbackSpriteUrls(name)];
    return fallbackSpriteUrls(name);
  }, [name, back]);
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [name, back]);
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
