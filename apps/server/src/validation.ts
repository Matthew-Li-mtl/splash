import { z } from "zod";
import { INTEREST_IDS, POST_KINDS, type PostKind } from "@splash/shared";

// Request validation. z.object strips unknown keys, so stored content only ever
// contains the fields declared here.

export const interestsSchema = z
  .array(z.string().refine((i) => INTEREST_IDS.includes(i), "Unknown interest."))
  .max(10, "Pick up to 10 interests.");

export const avatarSchema = z.object({
  emoji: z.string().min(1).max(16),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Pick a color."),
});

const color = z.string().max(40);
const noteCell = z.tuple([z.number().int().min(0).max(511), z.number().int().min(0).max(63)]);

const writing = z.object({
  text: z.string().trim().min(1, "Write something first!").max(20000),
  prompt: z.string().max(500).optional(),
  challenge: z
    .object({ id: z.string().max(40), label: z.string().max(80), detail: z.string().max(200).optional(), met: z.boolean() })
    .optional(),
});

const elementBase = {
  id: z.string().max(40),
  x: z.number(),
  y: z.number(),
  w: z.number().positive().max(5000),
  h: z.number().positive().max(5000),
  scale: z.number().positive().max(40),
  rotation: z.number(),
  opacity: z.number().min(0).max(1).optional(),
};

const collage = z.object({
  background: z.string().max(40),
  elements: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          ...elementBase,
          type: z.literal("image"),
          assetId: z.string().max(64),
          frame: z.enum(["none", "polaroid", "border", "round"]).optional(),
        }),
        z.object({
          ...elementBase,
          type: z.literal("text"),
          text: z.string().max(2000),
          font: z.enum(["serif", "sans", "hand", "mono"]),
          color,
          size: z.number().positive().max(400),
          align: z.enum(["left", "center", "right"]),
          background: color.optional(),
        }),
        z.object({ ...elementBase, type: z.literal("sticker"), emoji: z.string().max(16) }),
        z.object({
          ...elementBase,
          type: z.literal("shape"),
          shape: z.enum(["rect", "circle", "tape", "torn", "star", "heart"]),
          color,
        }),
        z.object({
          ...elementBase,
          type: z.literal("drawing"),
          path: z.string().max(80000),
          color,
          strokeWidth: z.number().positive().max(100),
        }),
      ]),
    )
    .min(1, "Add something to your collage first!")
    .max(200, "That's a lot of pieces! Try 200 or fewer."),
});

const song = z.object({
  bpm: z.number().int().min(40).max(240),
  bars: z.number().int().min(1).max(16),
  stepsPerBeat: z.number().int().min(1).max(4),
  scale: z.enum(["pentatonic", "major", "minor", "minorPentatonic", "blues"]),
  root: z.number().int().min(0).max(11),
  melody: z.object({ instrument: z.enum(["marimba", "piano", "synth", "pad", "bell"]), notes: z.array(noteCell).max(4000) }),
  bass: z.object({ instrument: z.enum(["pluck", "sub", "fuzz"]), notes: z.array(noteCell).max(4000) }),
  drums: z.object({ notes: z.array(noteCell).max(4000) }),
});

const puzzle = z.object({
  game: z.enum(["sudoku", "minesweeper"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  seed: z.string().max(80),
  timeMs: z.number().int().min(0).max(1e9),
  daily: z.string().max(20).optional(),
});

export const contentSchemas: Record<PostKind, z.ZodType> = { writing, collage, song, puzzle };

export const postKindSchema = z.enum(POST_KINDS as [PostKind, ...PostKind[]]);
export const visibilitySchema = z.enum(["neighbors", "private"]);
