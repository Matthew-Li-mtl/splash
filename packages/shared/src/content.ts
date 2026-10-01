// Structured content for each kind of post. Store what was made (elements, notes,
// grids), never a rendered image, so creations stay editable/remixable and tiny.

export type PostKind = "writing" | "collage" | "song" | "puzzle";
export const POST_KINDS: PostKind[] = ["writing", "collage", "song", "puzzle"];

// ---------- Writing ----------

export interface WritingContent {
  text: string;
  prompt?: string;
  challenge?: { id: string; label: string; detail?: string; met: boolean };
}

// ---------- Collage ----------

export const COLLAGE_WIDTH = 800;
export const COLLAGE_HEIGHT = 1000;

interface CollageBase {
  id: string;
  /** Center position, in collage units (0..COLLAGE_WIDTH / 0..COLLAGE_HEIGHT). */
  x: number;
  y: number;
  /** Unscaled size in collage units. Rendered size = w * scale. */
  w: number;
  h: number;
  scale: number;
  rotation: number;
  opacity?: number;
}

export interface CollageImage extends CollageBase {
  type: "image";
  assetId: string;
  frame?: "none" | "polaroid" | "border" | "round";
}

export interface CollageText extends CollageBase {
  type: "text";
  text: string;
  font: "serif" | "sans" | "hand" | "mono";
  color: string;
  size: number;
  align: "left" | "center" | "right";
  background?: string;
}

export interface CollageSticker extends CollageBase {
  type: "sticker";
  emoji: string;
}

export interface CollageShape extends CollageBase {
  type: "shape";
  shape: "rect" | "circle" | "tape" | "torn" | "star" | "heart";
  color: string;
}

export interface CollageDrawing extends CollageBase {
  type: "drawing";
  /** SVG path data in a 0..w × 0..h box. */
  path: string;
  color: string;
  strokeWidth: number;
}

export type CollageElement = CollageImage | CollageText | CollageSticker | CollageShape | CollageDrawing;

export interface CollageContent {
  background: string;
  elements: CollageElement[];
}

// ---------- Song ----------

export type ScaleId = "pentatonic" | "major" | "minor" | "minorPentatonic" | "blues";
export type MelodyInstrument = "marimba" | "piano" | "synth" | "pad" | "bell";
export type BassInstrument = "pluck" | "sub" | "fuzz";

/** A note is [step, row]. Row 0 is the lowest pitch of the track's range. */
export type NoteCell = [number, number];

export interface SongContent {
  bpm: number;
  bars: number;
  /** Steps per beat (2 = eighth notes). Beats per bar is always 4. */
  stepsPerBeat: number;
  scale: ScaleId;
  /** Root note as a semitone offset from C (0 = C, 9 = A). */
  root: number;
  melody: { instrument: MelodyInstrument; notes: NoteCell[] };
  bass: { instrument: BassInstrument; notes: NoteCell[] };
  /** Drum rows: 0 kick, 1 snare, 2 hat, 3 clap. */
  drums: { notes: NoteCell[] };
}

export const DRUM_ROWS = ["Kick", "Snare", "Hat", "Clap"] as const;

// ---------- Puzzle results ----------

export type PuzzleGame = "sudoku" | "minesweeper";
export type Difficulty = "easy" | "medium" | "hard";

export interface PuzzleContent {
  game: PuzzleGame;
  difficulty: Difficulty;
  seed: string;
  timeMs: number;
  /** Set when this was the daily puzzle, e.g. "2026-09-30". */
  daily?: string;
}

export interface PostContentMap {
  writing: WritingContent;
  collage: CollageContent;
  song: SongContent;
  puzzle: PuzzleContent;
}
