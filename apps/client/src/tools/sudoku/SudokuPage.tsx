import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Eraser, Lightbulb, Pencil } from "lucide-react";
import type { Difficulty, PuzzleContent } from "@splash/shared";
import { formatDuration, randomSeed, useLocalState, useStopwatch } from "../../lib/util";
import { PuzzleDone } from "../PuzzleDone";
import { TOOLS } from "../registry";
import { ToolHeader } from "../ToolHeader";
import { dailyPuzzle } from "./daily";
import { conflicts, generateSudoku, peers } from "./generator";
import "./sudoku.css";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

interface Progress {
  values: number[];
  notes: number[];
  elapsed: number;
  hints: number;
  done: boolean;
}

export default function SudokuPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const daily = params.get("daily") ? dailyPuzzle() : null;
  const seed = daily?.seed ?? params.get("seed");
  const difficulty = daily?.difficulty ?? ((params.get("difficulty") as Difficulty) || "medium");

  // Give every puzzle a seed in the URL, so it survives a refresh and can be shared.
  useEffect(() => {
    if (!seed) navigate(`/play/sudoku?difficulty=${difficulty}&seed=${randomSeed()}`, { replace: true });
  }, [seed, difficulty, navigate]);

  if (!seed) return null;
  return <Sudoku key={`${seed}-${difficulty}`} seed={seed} difficulty={difficulty} daily={daily?.day} />;
}

function Sudoku({ seed, difficulty, daily }: { seed: string; difficulty: Difficulty; daily?: string }) {
  const navigate = useNavigate();
  const { puzzle, solution } = useMemo(() => generateSudoku(seed, difficulty), [seed, difficulty]);
  const [progress, setProgress] = useLocalState<Progress>(`splash.sudoku.${difficulty}.${seed}`, () => ({
    values: puzzle.slice(),
    notes: Array(81).fill(0),
    elapsed: 0,
    hints: 0,
    done: false,
  }));
  const [selected, setSelected] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [elapsed] = useStopwatch(!progress.done, progress.elapsed);

  const { values, notes } = progress;
  const bad = useMemo(() => conflicts(values), [values]);
  const remaining = useMemo(() => {
    const counts = Array(10).fill(9);
    values.forEach((v) => v && counts[v]--);
    return counts;
  }, [values]);

  // Persist time occasionally so leaving and coming back keeps the clock.
  useEffect(() => {
    if (progress.done) return;
    const id = setInterval(() => setProgress((p) => ({ ...p, elapsed })), 5000);
    return () => clearInterval(id);
  });

  const update = (fn: (p: Progress) => Progress) =>
    setProgress((p) => {
      if (p.done) return p;
      const next = fn(p);
      const solved = next.values.every((v, i) => v === solution[i]);
      return solved ? { ...next, done: true, elapsed } : next;
    });

  const enter = (digit: number) => {
    if (selected === null || puzzle[selected]) return;
    update((p) => {
      const values = p.values.slice();
      const notes = p.notes.slice();
      if (notesMode && digit) {
        if (values[selected]) return p;
        notes[selected] ^= 1 << digit;
      } else {
        values[selected] = values[selected] === digit ? 0 : digit;
        notes[selected] = 0;
        // Placing a digit clears that pencil mark from its row, column and box.
        if (values[selected]) for (let j = 0; j < 81; j++) if (peers(selected, j)) notes[j] &= ~(1 << digit);
      }
      return { ...p, values, notes };
    });
  };

  const hint = () => {
    const target = selected !== null && !puzzle[selected] && values[selected] !== solution[selected]
      ? selected
      : values.findIndex((v, i) => v !== solution[i]);
    if (target < 0) return;
    setSelected(target);
    update((p) => {
      const values = p.values.slice();
      values[target] = solution[target];
      const notes = p.notes.slice();
      notes[target] = 0;
      return { ...p, values, notes, hints: p.hints + 1 };
    });
  };

  // Keyboard: digits, arrows, backspace, N for notes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) enter(Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") enter(0);
      else if (e.key.toLowerCase() === "n") setNotesMode((m) => !m);
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const cur = selected ?? 40;
        const r = Math.floor(cur / 9);
        const c = cur % 9;
        const next = { ArrowUp: [r - 1, c], ArrowDown: [r + 1, c], ArrowLeft: [r, c - 1], ArrowRight: [r, c + 1] }[e.key];
        if (next) setSelected(((next[0] + 9) % 9) * 9 + ((next[1] + 9) % 9));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const selValue = selected !== null ? values[selected] : 0;
  const result: PuzzleContent = { game: "sudoku", difficulty, seed, timeMs: progress.elapsed, ...(daily ? { daily } : {}) };

  return (
    <div className="container stack" style={{ maxWidth: 560 }}>
      <ToolHeader
        tool={{ ...TOOLS.puzzle, color: "var(--c-puzzle)" }}
        title={daily ? "Daily sudoku" : "Sudoku"}
        subtitle={`${difficulty[0].toUpperCase()}${difficulty.slice(1)}${daily ? " · same puzzle for your whole street" : ""}`}
      >
        <span className="bold" style={{ fontVariantNumeric: "tabular-nums" }} aria-label="Time">
          {formatDuration(progress.done ? progress.elapsed : elapsed)}
        </span>
      </ToolHeader>

      {progress.done && (
        <PuzzleDone
          result={result}
          note={progress.hints ? `${progress.hints} hint${progress.hints > 1 ? "s" : ""}` : "no hints!"}
          onAgain={() => navigate(`/play/sudoku?difficulty=${difficulty}&seed=${randomSeed()}`)}
        />
      )}

      <div className="sudoku" role="grid" aria-label="Sudoku board">
        {values.map((v, i) => {
          const given = !!puzzle[i];
          const isSel = i === selected;
          const related = selected !== null && !isSel && peers(selected, i);
          const same = !!v && v === selValue && !isSel;
          const r = Math.floor(i / 9);
          const c = i % 9;
          return (
            <button
              key={i}
              role="gridcell"
              className={[
                "sd-cell",
                given && "given",
                isSel && "sel",
                related && "related",
                same && "same",
                bad.has(i) && !given && "bad",
                c % 3 === 2 && c < 8 && "edge-r",
                r % 3 === 2 && r < 8 && "edge-b",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setSelected(i)}
              aria-label={`Row ${r + 1}, column ${c + 1}${v ? `, ${v}` : ", empty"}`}
            >
              {v ? (
                v
              ) : notes[i] ? (
                <span className="sd-notes">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <span key={d}>{notes[i] & (1 << d) ? d : ""}</span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {!progress.done && (
        <>
          <div className="sd-pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button key={d} className="sd-key" onClick={() => enter(d)} disabled={remaining[d] <= 0 && !notesMode} style={{ "--left": remaining[d] } as CSSProperties}>
                {d}
                <small>{remaining[d] > 0 ? remaining[d] : "✓"}</small>
              </button>
            ))}
          </div>
          <div className="row" style={{ justifyContent: "center", gap: 8 }}>
            <button className={`btn btn-sm${notesMode ? " on" : ""}`} onClick={() => setNotesMode((m) => !m)} aria-pressed={notesMode}>
              <Pencil size={15} /> Notes {notesMode ? "on" : "off"}
            </button>
            <button className="btn btn-sm" onClick={() => enter(0)}>
              <Eraser size={15} /> Erase
            </button>
            <button className="btn btn-sm" onClick={hint}>
              <Lightbulb size={15} /> Hint
            </button>
          </div>
          <div className="row" style={{ justifyContent: "center" }}>
            {DIFFICULTIES.filter((d) => d !== difficulty || daily).map((d) => (
              <button key={d} className="btn btn-ghost btn-sm" onClick={() => navigate(`/play/sudoku?difficulty=${d}&seed=${randomSeed()}`)}>
                New {d}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
