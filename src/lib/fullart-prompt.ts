// Master prompt for the "AI paint" path of the Full Art Studio (Gemini image /
// Nano Banana). Shared by the server route and docs so the version is traceable.
// fa-v3.4: BACKGROUND CONTINUATION is the DEFAULT for EVERY style / finish.
// Finish the source art's own habitat (grass, plants, flowers, rock, water, sky)
// out to every edge — do NOT replace with unrelated scenery.

export const FULLART_PROMPT_VERSION = "fa-v3.4";

export const AI_FINISHES = ["holo", "rainbow", "gold", "alt"] as const;
export type AiFinish = (typeof AI_FINISHES)[number];

export const AI_ART_STYLES = ["faithful", "storybook", "chibi", "neon"] as const;
export type AiArtStyle = (typeof AI_ART_STYLES)[number];

export const AI_ART_STYLE_LABELS: Record<AiArtStyle, string> = {
  faithful: "Faithful extension",
  storybook: "Illustration rare",
  chibi: "Chibi",
  neon: "Neon",
};

const FINISH_BLOCKS: Record<AiFinish, string> = {
  holo: "A subtle textured holographic-foil feel: fine cosmos-style sparkle specks and soft prismatic glints catching the light across the CONTINUED background only, with crisp specular highlights suited to foil stamping, while the creature itself stays clean and readable.",
  rainbow:
    "A rainbow-foil feel: soft high-key pastel iridescent bands (pink, cyan, lilac, gold) sweeping diagonally through the CONTINUED background and light effects, with a faint etched linear texture. The creature keeps its own true colours.",
  gold: "A gold-foil feel: warm metallic gold highlights, a gilded rim light, a faint engraved gold texture and drifting gold dust in the CONTINUED environment, with deep amber shadows. Keep the creature's true colours; only the environment and light turn golden.",
  alt: "An alternate-art storytelling finish on the SAME continued habitat: deepen atmosphere and world-building detail within the existing plants/terrain/sky from the reference — more depth and a light painterly texture — while the creature keeps the same design and recognisable pose. Do not invent a new location.",
};

const ART_STYLE_BLOCKS: Record<AiArtStyle, string> = {
  faithful:
    "Match the reference's own art style exactly (brushwork, line quality, shading and palette), as if the original illustrator had painted a larger canvas of the SAME scene.",
  storybook:
    "Special Illustration Rare (SIR) storybook look: soft gouache/watercolour textures and gentle naturalistic light — applied while CONTINUING the reference's own habitat to full bleed. Keep the creature's design exact. Do not swap the setting.",
  chibi:
    "Cute chibi re-interpretation of the creature only: slightly larger head and rounder, softer proportions, big expressive eyes, clean cel shading. The BACKGROUND must still be a continuation of the reference habitat (same plants, ground, sky colours). Keep its colours, markings and signature features instantly recognisable.",
  neon: "Neon synthwave lighting on the CONTINUED reference habitat: glowing rim lights, magenta/cyan neon haze on the same plants/terrain/sky, light trails and reflective wet surfaces. Keep the creature's true colours readable under the glow. Do not replace the scene with a city/cyber backdrop.",
};

const TYPE_FX: Record<string, string> = {
  Grass: "drifting leaves and green light motes",
  Fire: "embers, heat shimmer and flame wisps",
  Water: "spray, bubbles and caustic light",
  Lightning: "crackling electric arcs and a yellow glow",
  Psychic: "a violet aura and floating crystals",
  Fighting: "dust, rock shards and impact streaks",
  Darkness: "smoky shadow tendrils and moonlight",
  Metal: "chrome sparks and steel glints",
  Dragon: "swirling wind and ribbons of light",
  Fairy: "pink sparkles and petals",
  Colorless: "wind streaks and soft clouds",
};

export const FULLART_AVOID = [
  "text",
  "letters",
  "typography",
  "numbers",
  "HP",
  "captions",
  "card name",
  "attack names",
  "any logo or brand mark",
  "trademark or copyright notices",
  "watermarks",
  "signatures",
  "energy symbols",
  "set symbols",
  '"ex" / "V" badges',
  "card frames",
  "yellow or silver borders",
  "rounded card corners",
  "text boxes",
  "UI or HUD",
  "a photo or mockup of a physical card",
  "hands",
  "humans",
  "extra limbs",
  "a duplicated or second creature",
  "a cropped-off subject",
  "an off-model face",
  "wrong colours or redesigned markings",
  "visible seams",
  "stretched pixels",
  "mirrored or repeated patterns",
  "a flat empty background",
  "heavy vignette",
  "blur",
  "low resolution",
  "a thick card border",
  "an opaque solid text box",
  "subject face in the bottom third",
  "JPEG artefacts",
  "a mirrored reflection",
  "unrelated scenery",
  "a brand-new location not in the reference",
  "replacing grass/plants/flowers/rock/water/sky with a different biome",
  "generic stock forest that ignores the reference foliage",
  "solid colour fill behind the creature",
];

export type FullArtPromptInput = {
  species: string;
  type?: string;
  finish: AiFinish;
  style: AiArtStyle;
  sceneHint?: string;
};

/** Strip TCG suffixes/owner prefixes: "Blaine's Charizard ex" -> "Charizard". */
export function speciesFromCardName(name: string): string {
  return (
    name
      .replace(/^[\p{L}.\-' ]+['’]s\s+/u, "")
      .replace(/\b(ex|EX|GX|V|VMAX|VSTAR|V-UNION|BREAK|LV\.X|Prime|LEGEND|δ|☆|Star)\b/g, "")
      .replace(/\s+/g, " ")
      .trim() || name
  );
}

/**
 * fa-v3.4 DEFAULT for every style/finish: CONTINUATION / finish of the source
 * artwork's own background habitat to edge-to-edge full art. Style may restyle
 * brushwork or lighting; it must NOT invent a new scene.
 */
export function buildFullArtPrompt(p: FullArtPromptInput): string {
  const sp = p.species;
  const type = p.type && TYPE_FX[p.type] ? p.type : "Colorless";
  const scene = p.sceneHint
    ? `the existing scene (${p.sceneHint})`
    : "the existing scene and habitat shown in the reference (whatever plants, grass, flowers, trees, rock, water, sky or ground already appear at the edges of the art window)";
  const faithful = p.style === "faithful";

  const task = `TASK (BACKGROUND CONTINUATION — DEFAULT FOR ALL FULL ART): Create a full-art, edge-to-edge vertical portrait (card proportions, about 5:7) by FINISHING and EXTENDING this same artwork outward in every direction. Continue ${scene} naturally above, below and to the sides until it reaches every edge. Match lighting direction, palette, foliage shapes, flower types, terrain and level of detail so no seam, border or empty margin shows where the original ends. The bottom ~35% and top ~10% MUST be the same habitat continued — e.g. if the reference shows grass + white daisies + pink bell flowers + broad leaves + a vine, paint MORE of that grass/flowers/leaves/vine to the edges. Do NOT replace the background with unrelated scenery.`;

  const preserve = faithful
    ? `PRESERVE: ${sp}'s identity, silhouette, pose, proportions, colours, markings, eyes and expression, exactly as in the reference. Do not redesign it or add features. You may reveal more of its body or tail where the reference crops it off, consistent with the reference. Exactly one ${sp}. Also PRESERVE the habitat identity: same plant species, flower colours, ground materials and sky mood as the reference edges.`
    : `PRESERVE: ${sp}'s identity, colours, markings, eye colour and signature features so it is instantly recognisable as the same creature from the reference. Only the rendering style of the creature/light changes (as described in ART STYLE). Do not add features or accessories. Exactly one ${sp}. CRITICAL: still PRESERVE and CONTINUE the reference habitat — same plants/terrain/sky; style must not invent a new location.`;

  return `ROLE: You are a master trading-card illustrator making a FAN-MADE full-art illustration.
Strictly no text, letters, numbers, logos, symbols, watermarks, signatures, card frames, borders, energy icons or UI of any kind. Output the artwork only.

REFERENCE: The attached image is the illustration window cropped from a trading card. It shows ${sp}, a ${type}-type creature. It is the exact source artwork. Read the BACKGROUND at the edges of this crop carefully — that habitat is what you must continue.

${task}

${preserve}

COMPOSITION (Special Illustration Rare / full-art layout): Edge-to-edge full-bleed artwork that reaches every border — no card frame, no solid border, no text box painted into the image. ${sp} is a LARGE heroic focal point filling most of the card (face/upper body about 8%–65% of height), like modern SIR portraits. Keep the top ~8% a little calmer for name/HP text, but still paint CONTINUED canopy/sky/habitat there — never blank. The bottom ~30% MUST be a richly painted CONTINUATION of the same habitat — ground, foliage, flowers, rock, water, atmospheric depth — never blank, never mirrored, never a muddy stretched smear, never a different biome. Attack names will be drawn as floating stroked text with NO opaque chips or glass panels; art must remain clearly visible underneath. Every zone is fully painted at equal fidelity.

DEPTH & LIGHT: Clear foreground/midground/background separation, soft atmospheric perspective, a gentle rim light on ${sp}, and ${type}-themed ambient effects (${TYPE_FX[type]}) flowing toward the edges — woven into the continued habitat, not replacing it.

ART STYLE: ${ART_STYLE_BLOCKS[p.style]}

FINISH: ${FINISH_BLOCKS[p.finish]}

QUALITY: Polished modern trading-card illustration, crisp focal detail, high dynamic range, rich colour. Treat this as OUTPAINTING / habitat finish of the reference, not a redesign.

AVOID: ${FULLART_AVOID.join(", ")}.`;
}
