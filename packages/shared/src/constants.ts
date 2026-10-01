/** Each person gets this many neighbors, so a neighborhood holds NEIGHBORS_PER_USER + 1 people. */
export const NEIGHBORS_PER_USER = 20;
export const NEIGHBORHOOD_CAPACITY = NEIGHBORS_PER_USER + 1;

/** Moving neighborhoods is allowed, but rarely — stable groups are the point. */
export const MOVE_COOLDOWN_DAYS = 30;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export const REACTIONS = ["❤️", "✨", "😂", "👏", "🥹"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const AVATAR_EMOJIS = [
  "🦊", "🐻", "🐼", "🐨", "🐸", "🐙", "🦉", "🐝", "🦔", "🐢",
  "🐳", "🦋", "🐌", "🦜", "🐿️", "🦦", "🐞", "🐧", "🦩", "🐱",
  "🌻", "🌵", "🍄", "🌙", "⭐", "🔥", "🌈", "🍉", "🎈", "🪴",
] as const;

export const AVATAR_COLORS = [
  "#f4a261", "#e76f51", "#e9c46a", "#8ab17d", "#2a9d8f",
  "#90bede", "#7d8cc4", "#b392ac", "#f28482", "#c9ada7",
] as const;

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
