// Master prompt for the "AI paint" path of the Full Art Studio (Gemini image /
// Nano Banana). Shared by the server route and docs so the version is traceable.
// fa-v3.5: CURRENT-GEN FULL ART. Scarlet & Violet Ultra Rare (Black Bolt full arts
// still use this): the creature large on a flowing silk swirl in its type colour.
// Not a forest outpaint, not a yellow-frame card, not a second scene.

export const FULLART_PROMPT_VERSION = "fa-v3.5";

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
  holo: "Current-gen full-art foil: the silk swirl carries a fine cosmos texture and soft prismatic glints, the way a Scarlet & Violet Ultra Rare full art catches light. The creature stays clean and matte.",
  rainbow:
    "Rainbow full-art foil: pale iridescent bands (pink, cyan, gold) woven through the silk swirl only. The creature keeps its true colours.",
  gold: "Gold full-art foil: the silk swirl turns warm metallic gold with engraved highlights and a gilded rim light. The creature keeps its true colours.",
  alt: "Same current-gen full art, with a slightly deeper contrast in the silk and a stronger rim light on the creature. Still one type-colour swirl, not a new location.",
};

const ART_STYLE_BLOCKS: Record<AiArtStyle, string> = {
  faithful:
    "Official current-generation full-art illustration: crisp trading-card linework, clean cel-to-painter shading, the creature large and on-model, sitting on the silk swirl as if the original illustrator had drawn the Ultra Rare.",
  storybook:
    "Painterly current-gen full art: softer gouache edges on the SAME creature, still on the type-colour silk swirl. Do not invent a forest, city, or new habitat.",
  chibi:
    "Chibi current-gen full art: rounder proportions and big eyes, colours and markings intact, placed on the same type-colour silk swirl. No new setting.",
  neon: "Current-gen full art with neon rim light: magenta and cyan glow on the creature and along the silk ribbons. The swirl stays the type colour. No cyber city.",
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
 * fa-v3.5: paint a current-generation Ultra Rare full art.
 * The creature stays itself. The background becomes the type-colour silk swirl
 * used on Scarlet & Violet / Black Bolt full arts — not a copied habitat.
 */
export function buildFullArtPrompt(p: FullArtPromptInput): string {
  const sp = p.species;
  const type = p.type && TYPE_FX[p.type] ? p.type : "Colorless";
  const faithful = p.style === "faithful";
  const scene = p.sceneHint ? ` Keep a hint of ${p.sceneHint} only as colour, not as a new place.` : "";

  const task = `TASK (CURRENT-GEN FULL ART): Create a fan-made Ultra Rare full-art illustration, vertical, about 5:7, edge to edge. Place ${sp} LARGE in the middle of the card, the way a current Scarlet & Violet full art does. REPLACE the background with a flowing silk swirl in ${type} colours: smooth ribbons of light and dark ${type.toLowerCase()}, a soft sheen, no horizon, no forest, no room, no city. The top ~14% and bottom ~32% are silk only, calmer, so a name plate and attacks can sit there later. The creature may overlap the middle of those zones. Do not copy the rectangular crop's scenery.${scene}`;

  const preserve = faithful
    ? `PRESERVE: ${sp}'s identity, silhouette, pose, proportions, colours, markings, eyes and expression, exactly as in the reference. Do not redesign it. You may reveal a little more body where the crop cuts it off. Exactly one ${sp}.`
    : `PRESERVE: ${sp}'s identity, colours, markings and signature features so it is instantly the same creature. Only the rendering style changes. Exactly one ${sp}. The background is still the ${type} silk swirl.`;

  return `ROLE: You are the art director of the current Pokémon TCG full-art line, making a FAN-MADE Ultra Rare illustration.
Strictly no text, letters, numbers, logos, symbols, watermarks, signatures, card frames, borders, energy icons or UI of any kind. Output the artwork only.

REFERENCE: The attached image is the illustration window of a regular card. It shows ${sp}, a ${type}-type creature. Use it for the creature only. Discard its scenery.

${task}

${preserve}

COMPOSITION: ${sp} is the hero, centred, big enough to read as a full art (body about 18%–68% of the height). Silk swirl fills every edge. No yellow border, no text box, no second creature. A few ${TYPE_FX[type]} may drift in the silk, small, never covering the face.

ART STYLE: ${ART_STYLE_BLOCKS[p.style]}

FINISH: ${FINISH_BLOCKS[p.finish]}

QUALITY: Print-ready current-generation full art. Crisp creature, smooth silk, high detail on the face, no smear, no stretched pixels.

AVOID: ${FULLART_AVOID.join(", ")}, a forest background, a copied habitat, a muddy blur, a photograph of a physical card.`;
}
