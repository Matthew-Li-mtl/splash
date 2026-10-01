import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { Images, Music, PenLine, Puzzle, type LucideIcon } from "lucide-react";
import type { PostDTO, PostKind } from "@splash/shared";

/**
 * One entry per kind of post. To add a new creative tool:
 *   1. add its content type + kind in packages/shared/src/content.ts
 *   2. add its validation schema in apps/server/src/validation.ts
 *   3. add an editor route in App.tsx and an entry (with a viewer) here
 */
export interface ToolMeta {
  kind: PostKind;
  name: string;
  label: string;
  color: string;
  icon: LucideIcon;
  path: string;
  blurb: string;
  deco: string;
}

export const TOOLS: Record<PostKind, ToolMeta> = {
  writing: {
    kind: "writing",
    name: "Write",
    label: "Writing",
    color: "var(--c-write)",
    icon: PenLine,
    path: "/make/write",
    blurb: "A prompt, a challenge or a blank page. Six words counts.",
    deco: "✍️",
  },
  collage: {
    kind: "collage",
    name: "Collage",
    label: "Collage",
    color: "var(--c-collage)",
    icon: Images,
    path: "/make/collage",
    blurb: "Photos, stickers, paper scraps and doodles. Move things around until it feels right.",
    deco: "✂️",
  },
  song: {
    kind: "song",
    name: "Song maker",
    label: "Song",
    color: "var(--c-song)",
    icon: Music,
    path: "/make/song",
    blurb: "Tap the grid to make a tune. Every note is in key, so nothing sounds wrong.",
    deco: "🎶",
  },
  puzzle: {
    kind: "puzzle",
    name: "Puzzles",
    label: "Puzzle",
    color: "var(--c-puzzle)",
    icon: Puzzle,
    path: "/play",
    blurb: "Sudoku and Minesweeper. Share your time and see if neighbors can beat it.",
    deco: "🧩",
  },
};

export interface ViewerProps<K extends PostKind = PostKind> {
  post: PostDTO<K>;
  /** Feed cards are compact; the post page shows everything. */
  compact?: boolean;
}

export const VIEWERS: Record<PostKind, LazyExoticComponent<ComponentType<ViewerProps<any>>>> = {
  writing: lazy(() => import("./writing/WritingView")),
  collage: lazy(() => import("./collage/CollageView")),
  song: lazy(() => import("./song/SongView")),
  puzzle: lazy(() => import("./PuzzleView")),
};
