import type { ImgHTMLAttributes } from "react";
import { useCardImageChain } from "@/lib/use-card-image";
import type { TCGCard } from "@/lib/pokemon-api";

type CardLike = Pick<TCGCard, "id" | "name" | "number" | "set" | "images">;

/** One card scan. The chain is Scrydex, then the proxy, then Art pending. */
export function CardScan({
  card,
  tile,
  alt,
  className,
  eager,
  ...rest
}: {
  card: CardLike;
  tile?: boolean;
  alt?: string;
  eager?: boolean;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "onLoad" | "onError" | "ref">) {
  const art = useCardImageChain(card, { tile });
  const name = card.name || "Card";
  return (
    <img
      {...rest}
      ref={art.ref}
      className={[className, art.loaded ? "loaded" : ""].filter(Boolean).join(" ")}
      src={art.src}
      alt={alt ?? (art.pending ? `${name} — art pending` : name)}
      loading={eager ? "eager" : (rest.loading ?? "lazy")}
      decoding={rest.decoding ?? "async"}
      data-art-pending={art.pending ? "1" : undefined}
      onLoad={art.onLoad}
      onError={art.onError}
    />
  );
}
