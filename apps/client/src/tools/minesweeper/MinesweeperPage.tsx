import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Flag, RotateCcw } from "lucide-react";
import type { Difficulty, PuzzleContent } from "@splash/shared";
import { formatDuration, randomSeed, seededRandom, shuffle, useStopwatch } from "../../lib/util";
import { PuzzleDone } from "../PuzzleDone";
import { TOOLS } from "../registry";
import { ToolHeader } from "../ToolHeader";
import "./minesweeper.css";

const SIZES: Record<Difficulty, { size: number; mines: number }> = {
  easy: { size: 9, mines: 10 },
  medium: { size: 12, mines: 22 },
  hard: { size: 16, mines: 44 },
};

interface Board {
  size: number;
  mines: boolean[];
  counts: number[];
  start: number;
}

function neighbors(i: number, size: number): number[] {
  const r = Math.floor(i / size);
  const c = i % size;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < size && cc >= 0 && cc < size) out.push(rr * size + cc);
    }
  return out;
}

/**
 * The whole board comes from the seed, including a safe opening area, so
 * neighbors who play a shared seed get exactly the same game.
 */
function makeBoard(seed: string, difficulty: Difficulty): Board {
  const { size, mines: count } = SIZES[difficulty];
  const rand = seededRandom(`mines-${difficulty}-${seed}`);
  const cells = size * size;
  const mineSet = new Set(shuffle([...Array(cells).keys()], rand).slice(0, count));
  const mines = Array.from({ length: cells }, (_, i) => mineSet.has(i));
  const counts = mines.map((_, i) => neighbors(i, size).filter((n) => mines[n]).length);
  const zeros = counts.map((n, i) => (n === 0 && !mines[i] ? i : -1)).filter((i) => i >= 0);
  const start = zeros.length ? zeros[Math.floor(rand() * zeros.length)] : mines.findIndex((m) => !m);
  return { size, mines, counts, start };
}

function flood(board: Board, from: number, revealed: boolean[]) {
  const next = revealed.slice();
  const stack = [from];
  while (stack.length) {
    const i = stack.pop()!;
    if (next[i] || board.mines[i]) continue;
    next[i] = true;
    if (board.counts[i] === 0) stack.push(...neighbors(i, board.size));
  }
  return next;
}

export default function MinesweeperPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const seed = params.get("seed");
  const difficulty = (params.get("difficulty") as Difficulty) || "easy";

  useEffect(() => {
    if (!seed) navigate(`/play/minesweeper?difficulty=${difficulty}&seed=${randomSeed()}`, { replace: true });
  }, [seed, difficulty, navigate]);

  if (!seed || !SIZES[difficulty]) return null;
  return <Minesweeper key={`${seed}-${difficulty}`} seed={seed} difficulty={difficulty} />;
}

type Status = "playing" | "won" | "lost";

function Minesweeper({ seed, difficulty }: { seed: string; difficulty: Difficulty }) {
  const navigate = useNavigate();
  const board = useMemo(() => makeBoard(seed, difficulty), [seed, difficulty]);
  const fresh = () => flood(board, board.start, Array(board.size ** 2).fill(false));
  const [revealed, setRevealed] = useState<boolean[]>(fresh);
  const [flags, setFlags] = useState<boolean[]>(() => Array(board.size ** 2).fill(false));
  const [status, setStatus] = useState<Status>("playing");
  const [exploded, setExploded] = useState<number | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsed, resetClock] = useStopwatch(started && status === "playing");
  const [finalTime, setFinalTime] = useState(0);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);

  const flagsLeft = SIZES[difficulty].mines - flags.filter(Boolean).length;

  const finishIfWon = (next: boolean[]) => {
    const won = next.every((r, i) => r || board.mines[i]);
    if (won) {
      setStatus("won");
      setFinalTime(elapsed);
      setFlags(board.mines.slice());
    }
  };

  const reveal = (i: number) => {
    if (status !== "playing" || flags[i]) return;
    setStarted(true);
    if (board.mines[i]) {
      setExploded(i);
      setStatus("lost");
      setRevealed(revealed.map((r, j) => r || board.mines[j]));
      return;
    }
    if (revealed[i]) {
      // Chord: a number with all its flags placed opens the rest of its neighbors.
      const around = neighbors(i, board.size);
      if (around.filter((n) => flags[n]).length !== board.counts[i]) return;
      let next = revealed;
      for (const n of around) {
        if (flags[n] || next[n]) continue;
        if (board.mines[n]) {
          setExploded(n);
          setStatus("lost");
          setRevealed(revealed.map((r, j) => r || board.mines[j]));
          return;
        }
        next = flood(board, n, next);
      }
      setRevealed(next);
      finishIfWon(next);
      return;
    }
    const next = flood(board, i, revealed);
    setRevealed(next);
    finishIfWon(next);
  };

  const toggleFlag = (i: number) => {
    if (status !== "playing" || revealed[i]) return;
    setStarted(true);
    setFlags((f) => f.map((v, j) => (j === i ? !v : v)));
    navigator.vibrate?.(15);
  };

  const retry = () => {
    setRevealed(fresh());
    setFlags(Array(board.size ** 2).fill(false));
    setStatus("playing");
    setExploded(null);
    setStarted(false);
    resetClock(0);
  };

  // Long-press to flag on touch screens.
  const onPointerDown = (i: number, e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    const timer = setTimeout(() => {
      if (press.current) press.current.fired = true;
      toggleFlag(i);
    }, 380);
    press.current = { timer, fired: false };
  };
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
  };
  const onClick = (i: number) => {
    const longPressed = press.current?.fired;
    press.current = null;
    if (longPressed) return;
    if (flagMode && !revealed[i]) toggleFlag(i);
    else reveal(i);
  };

  const result: PuzzleContent = { game: "minesweeper", difficulty, seed, timeMs: finalTime };

  return (
    <div className="container stack" style={{ maxWidth: 640 }}>
      <ToolHeader tool={{ ...TOOLS.puzzle, color: "var(--c-write)" }} title="Minesweeper" subtitle={`${difficulty[0].toUpperCase()}${difficulty.slice(1)} · ${SIZES[difficulty].mines} mines`}>
        <span className="row" style={{ gap: 12, fontVariantNumeric: "tabular-nums" }}>
          <span className="bold" aria-label="Flags left">
            🚩 {flagsLeft}
          </span>
          <span className="bold" aria-label="Time">
            {formatDuration(status === "won" ? finalTime : elapsed)}
          </span>
        </span>
      </ToolHeader>

      {status === "won" && <PuzzleDone result={result} onAgain={() => navigate(`/play/minesweeper?difficulty=${difficulty}&seed=${randomSeed()}`)} />}
      {status === "lost" && (
        <div className="card row row-wrap spread">
          <span>
            <span className="bold">Boom! 💥</span> <span className="muted">Happens to everyone. Same board again?</span>
          </span>
          <div className="row">
            <button className="btn btn-sm btn-primary" onClick={retry}>
              <RotateCcw size={15} /> Try again
            </button>
            <button className="btn btn-sm" onClick={() => navigate(`/play/minesweeper?difficulty=${difficulty}&seed=${randomSeed()}`)}>
              New board
            </button>
          </div>
        </div>
      )}

      <div className="ms-scroll">
        <div className={`ms-board${status !== "playing" ? " over" : ""}`} style={{ "--n": board.size } as CSSProperties} onContextMenu={(e) => e.preventDefault()}>
          {board.mines.map((mine, i) => {
            const open = revealed[i];
            const n = board.counts[i];
            return (
              <button
                key={i}
                className={`ms-cell${open ? " open" : ""}${i === exploded ? " boom" : ""}${i === board.start && !started ? " start" : ""}`}
                data-n={open && !mine ? n : undefined}
                onClick={() => onClick(i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  toggleFlag(i);
                }}
                onPointerDown={(e) => onPointerDown(i, e)}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                aria-label={open ? (mine ? "Mine" : n ? `${n}` : "Empty") : flags[i] ? "Flagged" : "Hidden"}
              >
                {open ? (mine ? "💣" : n || "") : flags[i] ? "🚩" : ""}
              </button>
            );
          })}
        </div>
      </div>

      {status === "playing" && (
        <div className="row" style={{ justifyContent: "center", gap: 8 }}>
          <button className={`btn btn-sm${flagMode ? " on" : ""}`} onClick={() => setFlagMode((f) => !f)} aria-pressed={flagMode}>
            <Flag size={15} /> Flag mode {flagMode ? "on" : "off"}
          </button>
          <span className="tiny muted">Tip: long-press or right-click to flag.</span>
        </div>
      )}
    </div>
  );
}
