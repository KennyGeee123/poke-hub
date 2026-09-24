#!/usr/bin/env python3
"""Render PokéVault pokéball mark to icon/splash PNG assets."""
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "resources"
PUB = ROOT / "public"


def draw_pokeball(size: int, bg=(11, 16, 32)) -> Image.Image:
    img = Image.new("RGBA", (size, size), (*bg, 255))
    d = ImageDraw.Draw(img)
    m = int(size * 0.08)
    d.ellipse([m, m, size - m, size - m], fill=(26, 26, 26, 255))
    d.pieslice([m, m, size - m, size - m], 180, 360, fill=(220, 38, 38, 255))
    d.pieslice([m, m, size - m, size - m], 0, 180, fill=(248, 250, 252, 255))
    band_h = max(2, int(size * 0.08))
    cy = size // 2
    d.rectangle([m, cy - band_h // 2, size - m, cy + band_h // 2], fill=(26, 26, 26, 255))
    stroke = max(2, int(size * 0.04))
    d.ellipse([m, m, size - m, size - m], outline=(26, 26, 26, 255), width=stroke)
    r1 = int(size * 0.12)
    r2 = int(size * 0.06)
    d.ellipse(
        [cy - r1, cy - r1, cy + r1, cy + r1],
        fill=(248, 250, 252, 255),
        outline=(26, 26, 26, 255),
        width=max(2, stroke),
    )
    d.ellipse([cy - r2, cy - r2, cy + r2, cy + r2], fill=(226, 232, 240, 255))
    return img


def main() -> None:
    RES.mkdir(exist_ok=True)
    PUB.mkdir(exist_ok=True)
    icon = draw_pokeball(1024)
    icon.convert("RGB").save(RES / "icon.png", "PNG")
    splash = Image.new("RGB", (2732, 2732), (11, 16, 32))
    ball = draw_pokeball(900).convert("RGBA")
    splash.paste(ball, ((2732 - 900) // 2, (2732 - 900) // 2), ball)
    splash.save(RES / "splash.png", "PNG")
    icon.resize((180, 180), Image.Resampling.LANCZOS).convert("RGB").save(
        PUB / "apple-touch-icon.png"
    )
    icon.resize((512, 512), Image.Resampling.LANCZOS).convert("RGB").save(PUB / "icon-512.png")
    icon.resize((192, 192), Image.Resampling.LANCZOS).convert("RGB").save(PUB / "icon-192.png")
    print("wrote", RES / "icon.png")
    print("wrote", RES / "splash.png")
    print("wrote", PUB / "apple-touch-icon.png")
    print("wrote", PUB / "icon-512.png")
    print("wrote", PUB / "icon-192.png")


if __name__ == "__main__":
    main()
