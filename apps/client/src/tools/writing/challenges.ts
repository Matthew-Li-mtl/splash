// Writing challenges: playful constraints with a live check, so finishing one
// feels like a small win.

export interface ChallengeResult {
  met: boolean;
  status: string;
}

export interface Challenge {
  id: string;
  label: string;
  emoji: string;
  description: string;
  check(text: string, word?: string): ChallengeResult;
  /** Acrostic needs a word to spell. */
  needsWord?: boolean;
}

export const words = (text: string) => text.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/** Rough English syllable count. Good enough for a haiku nudge, not a linguistics paper. */
export function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  return Math.max(1, w.match(/[aeiouy]{1,2}/g)?.length ?? 1);
}

const exactWords = (target: number) => (text: string): ChallengeResult => {
  const n = words(text).length;
  return {
    met: n === target,
    status: n === target ? `Exactly ${target} words. Perfect!` : n < target ? `${n} / ${target} words` : `${n} words, ${n - target} too many`,
  };
};

export const ACROSTIC_WORDS = ["HOME", "LIGHT", "SPRING", "COFFEE", "DREAM", "OCEAN", "MAPLE", "BREAD", "STARS", "QUIET", "WINDOW", "GARDEN", "MUSIC", "AUTUMN"];

export const CHALLENGES: Challenge[] = [
  {
    id: "six",
    label: "Six-word story",
    emoji: "6️⃣",
    description: "Tell a whole story in exactly six words.",
    check: exactWords(6),
  },
  {
    id: "fifty",
    label: "Fifty words",
    emoji: "🖐️",
    description: "A complete story in exactly 50 words. Not 49, not 51.",
    check: exactWords(50),
  },
  {
    id: "drabble",
    label: "Drabble",
    emoji: "💯",
    description: "A story of exactly 100 words.",
    check: exactWords(100),
  },
  {
    id: "haiku",
    label: "Haiku",
    emoji: "🍃",
    description: "Three lines: five syllables, then seven, then five.",
    check(text) {
      const counts = lines(text).map((l) => words(l).reduce((sum, w) => sum + syllables(w), 0));
      const met = counts.length === 3 && counts[0] === 5 && counts[1] === 7 && counts[2] === 5;
      const shown = counts.length ? counts.join(" · ") : "0";
      return { met, status: met ? "5 · 7 · 5. Lovely!" : `Syllables: ${shown} (aim for 5 · 7 · 5)` };
    },
  },
  {
    id: "noE",
    label: "No letter E",
    emoji: "🚫",
    description: "Write at least 30 words without using the letter E. Harder than it sounds!",
    check(text) {
      const es = (text.match(/e/gi) ?? []).length;
      const n = words(text).length;
      if (es > 0) return { met: false, status: `Oops, ${es} E${es === 1 ? "" : "s"} snuck in` };
      return { met: n >= 30, status: n >= 30 ? `${n} words, zero E's. Wow!` : `No E's so far · ${n} / 30 words` };
    },
  },
  {
    id: "acrostic",
    label: "Acrostic",
    emoji: "🔠",
    description: "The first letter of each line spells a word.",
    needsWord: true,
    check(text, word = "HOME") {
      const firsts = lines(text).map((l) => l.replace(/^[^\p{L}]+/u, "")[0]?.toUpperCase() ?? "");
      const progress = word
        .split("")
        .map((ch, i) => (firsts[i] === undefined ? "_" : firsts[i] === ch ? ch : "✗"))
        .join(" ");
      const met = firsts.length === word.length && firsts.every((ch, i) => ch === word[i]);
      return { met, status: met ? `${word}, spelled out. Nice!` : progress };
    },
  },
  {
    id: "oneSentence",
    label: "One long sentence",
    emoji: "🌊",
    description: "At least 40 words, all in a single sentence. Let it run on.",
    check(text) {
      const n = words(text).length;
      const breaks = (text.trim().replace(/[.!?…"”')\s]+$/, "").match(/[.!?](\s|$)/g) ?? []).length;
      if (breaks > 0) return { met: false, status: "That's more than one sentence" };
      return { met: n >= 40, status: n >= 40 ? `${n} words in one breath!` : `${n} / 40 words` };
    },
  },
];
