/** Each person gets this many neighbors, so a neighborhood holds NEIGHBORS_PER_USER + 1 people. */
export const NEIGHBORS_PER_USER = 20;
export const NEIGHBORHOOD_CAPACITY = NEIGHBORS_PER_USER + 1;

/** Moving neighborhoods is allowed, but rarely — stable groups are the point. */
export const MOVE_COOLDOWN_DAYS = 30;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export const REACTIONS = ["❤️", "✨", "😂", "👏", "🥹"] as const;
export type Reaction = (typeof REACTIONS)[number];

/** Backgrounds for initials avatars, Google-style. All dark enough for white letters. */
export const AVATAR_COLORS = [
  "#c2185b", "#7b1fa2", "#512da8", "#1976d2", "#0277bd",
  "#00796b", "#388e3c", "#e64a19", "#5d4037", "#455a64",
] as const;

/** A person's initials color: picked from their username, so it never changes. */
export function avatarColor(username: string): string {
  let h = 0;
  for (const ch of username) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export interface Interest {
  id: string;
  label: string;
  emoji: string;
}

export const INTERESTS: Interest[] = [
  { id: "writing", label: "Writing", emoji: "✍️" },
  { id: "poetry", label: "Poetry", emoji: "📜" },
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "art", label: "Drawing & art", emoji: "🎨" },
  { id: "photography", label: "Photography", emoji: "📷" },
  { id: "puzzles", label: "Puzzles", emoji: "🧩" },
  { id: "games", label: "Games", emoji: "🎲" },
  { id: "books", label: "Books", emoji: "📚" },
  { id: "film", label: "Film & TV", emoji: "🎬" },
  { id: "nature", label: "Nature", emoji: "🌿" },
  { id: "gardening", label: "Gardening", emoji: "🌱" },
  { id: "cooking", label: "Cooking", emoji: "🍳" },
  { id: "crafts", label: "Crafts", emoji: "🧶" },
  { id: "fashion", label: "Fashion", emoji: "👗" },
  { id: "science", label: "Science", emoji: "🔭" },
  { id: "history", label: "History", emoji: "🏛️" },
  { id: "travel", label: "Travel", emoji: "🧭" },
  { id: "animals", label: "Animals", emoji: "🐾" },
  { id: "comedy", label: "Comedy", emoji: "😄" },
  { id: "fitness", label: "Movement", emoji: "🏃" },
];

export const INTEREST_IDS = INTERESTS.map((i) => i.id);
