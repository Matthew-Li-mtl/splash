import type { CollageText } from "@splash/shared";

/** Paper backgrounds, drawn with CSS in collage units (the stage is 800 × 1000). */
export const BACKGROUNDS: Record<string, { name: string; style: React.CSSProperties }> = {
  cream: { name: "Cream", style: { background: "#fbf3e4" } },
  white: { name: "White", style: { background: "#ffffff" } },
  grid: {
    name: "Graph",
    style: {
      backgroundColor: "#fdfbf6",
      backgroundImage: "linear-gradient(#dfe7f1 2px, transparent 2px), linear-gradient(90deg, #dfe7f1 2px, transparent 2px)",
      backgroundSize: "50px 50px",
    },
  },
  lined: {
    name: "Notebook",
    style: {
      backgroundColor: "#fffdf8",
      backgroundImage:
        "linear-gradient(90deg, transparent 88px, #f2b8b0 88px, #f2b8b0 91px, transparent 91px), repeating-linear-gradient(transparent 0 46px, #cfe0ee 46px 49px)",
    },
  },
  dots: {
    name: "Dots",
    style: { backgroundColor: "#fbf6ee", backgroundImage: "radial-gradient(#d3c6b2 3px, transparent 3.5px)", backgroundSize: "40px 40px" },
  },
  kraft: {
    name: "Kraft",
    style: {
      backgroundColor: "#c9a47a",
      backgroundImage:
        "radial-gradient(rgba(255,255,255,0.12) 2px, transparent 2.5px), radial-gradient(rgba(90,60,30,0.12) 2px, transparent 2.5px)",
      backgroundSize: "36px 36px, 52px 52px",
      backgroundPosition: "0 0, 18px 26px",
    },
  },
  blush: { name: "Blush", style: { background: "#f8ddd4" } },
  sage: { name: "Sage", style: { background: "#dde8da" } },
  sky: { name: "Sky", style: { background: "linear-gradient(#cfe3f2, #f3e9f1)" } },
  sunset: { name: "Sunset", style: { background: "linear-gradient(160deg, #fbd3a5, #f19c8f 55%, #9c7ab8)" } },
  night: {
    name: "Night",
    style: {
      backgroundColor: "#262a40",
      backgroundImage: "radial-gradient(#fff 1.5px, transparent 2px), radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1.5px)",
      backgroundSize: "130px 130px, 70px 70px",
      backgroundPosition: "10px 20px, 40px 55px",
    },
  },
};

export const COLORS = ["#2d2620", "#ffffff", "#e07a5f", "#f2c66d", "#5f9e7c", "#5f86c0", "#a173b3", "#f4a6b7", "#8fbcd4", "#c9a27a"];

export const FONTS: { id: CollageText["font"]; name: string; css: string }[] = [
  { id: "serif", name: "Serif", css: "var(--font-display)" },
  { id: "sans", name: "Rounded", css: "var(--font-body)" },
  { id: "hand", name: "Handwritten", css: "var(--font-hand)" },
  { id: "mono", name: "Typewriter", css: "var(--font-mono)" },
];

/** Google's Noto emoji artwork, pinned to a release so stickers never change under people. */
const NOTO_EMOJI = "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@v2.051";

/**
 * Vector Noto artwork for a sticker's emoji, so it looks the same on every device and
 * stays crisp at any size. Files are named by code point, without the FE0F selector.
 */
export function stickerUrl(emoji: string): string {
  const cps = Array.from(emoji, (c) => c.codePointAt(0)!).filter((cp) => cp !== 0xfe0f);
  const name = `emoji_u${cps.map((cp) => cp.toString(16).padStart(4, "0")).join("_")}.svg`;
  const isFlag = cps.length === 2 && cps.every((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff);
  return `${NOTO_EMOJI}/${isFlag ? "third_party/region-flags/waved-svg" : "svg"}/${name}`;
}

export const SHAPES = [
  { id: "tape", name: "Washi tape" },
  { id: "torn", name: "Paper scrap" },
  { id: "rect", name: "Square" },
  { id: "circle", name: "Circle" },
  { id: "star", name: "Star" },
  { id: "heart", name: "Heart" },
] as const;
