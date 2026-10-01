import type { Difficulty } from "@splash/shared";
import { todayKey } from "../../lib/util";

/** The daily puzzle gets harder through the week, like a newspaper. */
export function dailyPuzzle(date = new Date()): { seed: string; difficulty: Difficulty; day: string } {
  const day = todayKey(date);
  const weekday = date.getDay(); // 0 = Sunday
  const difficulty: Difficulty = weekday <= 2 ? "easy" : weekday <= 4 ? "medium" : "hard";
  return { seed: `daily-${day}`, difficulty, day };
}
