import { useEffect, useRef, useState } from "react";

// ---------- Seeded randomness (so neighbors get the same daily puzzle/prompt) ----------

function hashString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32 — small, fast, good enough for games. Returns floats in [0, 1). */
export function seededRandom(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const randomSeed = () => Math.random().toString(36).slice(2, 10);

export const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- Dates ----------

/** Local calendar date, e.g. "2026-09-30". Daily prompts/puzzles key off this. */
export function todayKey(date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

// ---------- Hooks ----------

/** State mirrored to localStorage, so unfinished work survives closing the tab. */
export function useLocalState<T>(key: string | null, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    if (key) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) return JSON.parse(stored) as T;
      } catch {
        // Ignore unreadable drafts.
      }
    }
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    if (!key) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage full or unavailable.
      }
    }, 300);
    return () => clearTimeout(id);
  }, [key, value]);

  return [value, setValue] as const;
}

export function clearLocal(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Milliseconds elapsed while `running`, ticking once a second. */
export function useStopwatch(running: boolean, initialMs = 0) {
  const [elapsed, setElapsed] = useState(initialMs);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(initialMs);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const id = setInterval(() => setElapsed(baseRef.current + Date.now() - startRef.current!), 250);
    return () => {
      baseRef.current += Date.now() - startRef.current!;
      clearInterval(id);
    };
  }, [running]);

  const reset = (ms = 0) => {
    baseRef.current = ms;
    startRef.current = Date.now();
    setElapsed(ms);
  };
  return [elapsed, reset] as const;
}

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
