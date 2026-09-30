// Master prompt for the "AI paint" path of the Full Art Studio (Gemini image /
// Nano Banana). Shared by the server route and docs so the version is traceable.
// Merged from: PokéVault v1 (fidelity + overlay safe zones + strict no-text),
// Gemini's answer (sectioned brief, SAR storytelling direction, clean HUD zones)
// and ChatGPT's answer (explicit preserve list, duplicate/cropped-subject negatives).

export const FULLART_PROMPT_VERSION = "fa-v2";

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
  holo: "A subtle textured holographic-foil feel: fine cosmos-style sparkle specks and soft prismatic glints catching the light across the background, with crisp specular highlights suited to foil stamping, while the creature itself stays clean and readable.",
  rainbow:
    "A rainbow-foil feel: soft high-key pastel iridescent bands (pink, cyan, lilac, gold) sweeping diagonally through the background and light effects, with a faint etched linear texture. The creature keeps its own true colours.",
  gold: "A gold-foil feel: warm metallic gold highlights, a gilded rim light, a faint engraved gold texture and drifting gold dust in the environment, with deep amber shadows. Keep the creature's true colours; only the environment and light turn golden.",
  alt: "An alternate-art storytelling scene: widen into a cinematic, atmospheric moment in the creature's natural habitat that shows its personality, with more world-building, depth and a light painterly texture, while it keeps the same design and recognisable pose.",
};

const ART_STYLE_BLOCKS: Record<AiArtStyle, string> = {
  faithful:
    "Match the reference's own art style exactly (brushwork, line quality, shading and palette), as if the original illustrator had painted a larger canvas.",
  storybook:
    "Special-illustration-rare storybook look: soft gouache/watercolour textures, gentle naturalistic light, a cosy narrative setting and rich background storytelling. Keep the creature's design exact.",
  chibi:
    "Cute chibi re-interpretation: slightly larger head and rounder, softer proportions, big expressive eyes, clean cel shading and a playful pastel setting. Keep its colours, markings and signature features instantly recognisable.",
  neon: "Neon synthwave re-interpretation: a night scene with glowing rim lights, magenta/cyan neon haze, light trails and reflective wet surfaces in the environment. Keep the creature's true colours readable under the glow.",
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
  "JPEG artefacts",
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

export function buildFullArtPrompt(p: FullArtPromptInput): string {
  const sp = p.species;
  const type = p.type && TYPE_FX[p.type] ? p.type : "Colorless";
  const scene = p.sceneHint
    ? `the existing scene (${p.sceneHint})`
    : "the existing scene and habitat shown in the reference";
  return `ROLE: You are a master trading-card illustrator making a FAN-MADE full-art illustration.
Strictly no text, letters, numbers, logos, symbols, watermarks, signatures, card frames, borders, energy icons or UI of any kind. Output the artwork only.

REFERENCE: The attached image is the illustration window cropped from a trading card. It shows ${sp}, a ${type}-type creature. It is the exact source artwork.

TASK: Create a full-art, edge-to-edge vertical portrait (card proportions, about 5:7) by EXTENDING this same artwork outward in every direction. Continue ${scene} naturally above, below and to the sides, matching lighting direction, palette and level of detail so no seam or border shows where the original ends.

PRESERVE: ${sp}'s identity, silhouette, pose, proportions, colours, markings, eyes and expression, exactly as in the reference. Do not redesign it or add features. You may reveal more of its body or tail where the reference crops it off, consistent with the reference. Exactly one ${sp}.

COMPOSITION: ${sp} is the clear focal point, centred horizontally in the middle band (about 15%–65% of the height). The top ~12% and bottom ~30% are calmer, lower-detail continuation of the scene (sky, foliage, ground, energy swirls) with no important subject matter, because a name bar and attack panel are overlaid later. Those zones must still be fully painted, never blank.

DEPTH & LIGHT: Clear foreground/midground/background separation, soft atmospheric perspective, a gentle rim light on ${sp}, and ${type}-themed ambient effects (${TYPE_FX[type]}) flowing toward the edges.

ART STYLE: ${ART_STYLE_BLOCKS[p.style]}

FINISH: ${FINISH_BLOCKS[p.finish]}

QUALITY: Polished modern trading-card illustration, crisp focal detail, high dynamic range, rich colour.

AVOID: ${FULLART_AVOID.join(", ")}.`;
}
