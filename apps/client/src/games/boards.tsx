import type { ComponentType, CSSProperties } from "react";
import {
  BOXES,
  FOUR_COLS,
  FOUR_ROWS,
  PITS,
  hIndex,
  pitIndex,
  storeOf,
  vIndex,
  type DotsMove,
  type DotsState,
  type FourInARowMove,
  type FourInARowState,
  type GameDTO,
  type GameType,
  type MancalaMove,
  type MancalaState,
  type Player,
} from "@splash/shared";
import "./games.css";

export const SEAT_COLORS = ["#e07a5f", "#e9b949"] as const;

export interface BoardProps<S, M> {
  game: GameDTO & { state: S };
  canMove: boolean;
  onMove: (move: M) => void;
}

// ---------- Four in a Row ----------

function FourBoard({ game, canMove, onMove }: BoardProps<FourInARowState, FourInARowMove>) {
  const { cells, last, winLine } = game.state;
  const win = new Set(winLine ?? []);
  return (
    <div className="four" style={{ "--you": SEAT_COLORS[game.you] } as CSSProperties}>
      {Array.from({ length: FOUR_COLS }, (_, c) => {
        const full = cells[c] !== null;
        return (
          <button key={c} className="four-col" disabled={!canMove || full} onClick={() => onMove({ col: c })} aria-label={`Drop in column ${c + 1}`}>
            {Array.from({ length: FOUR_ROWS }, (_, r) => {
              const i = r * FOUR_COLS + c;
              const v = cells[i];
              return (
                <span key={r} className="four-slot">
                  {v !== null && (
                    <span
                      className={`four-disc${i === last ? " dropped" : ""}${win.has(i) ? " win" : ""}`}
                      style={{ background: SEAT_COLORS[v], "--rows": r + 1 } as CSSProperties}
                    />
                  )}
                </span>
              );
            })}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Dots & Boxes ----------

function DotsBoard({ game, canMove, onMove }: BoardProps<DotsState, DotsMove>) {
  const { h, v, boxes, last } = game.state;
  const S = 100;
  const M = 24;
  const size = BOXES * S + M * 2;
  const isLast = (kind: "h" | "v", r: number, c: number) => last?.kind === kind && last.r === r && last.c === c;

  const line = (kind: "h" | "v", r: number, c: number, owner: Player | null) => {
    const x1 = M + c * S;
    const y1 = M + r * S;
    const x2 = kind === "h" ? x1 + S : x1;
    const y2 = kind === "h" ? y1 : y1 + S;
    const free = owner === null;
    return (
      <g key={`${kind}${r}-${c}`} className={`dots-line${free ? " free" : ""}${free && canMove ? " playable" : ""}`} onClick={free && canMove ? () => onMove({ kind, r, c }) : undefined}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} className="hit" />
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          className="ink"
          stroke={free ? undefined : SEAT_COLORS[owner]}
          strokeWidth={isLast(kind, r, c) ? 14 : 10}
        />
      </g>
    );
  };

  return (
    <svg className="dots" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Dots and boxes board" style={{ "--you": SEAT_COLORS[game.you] } as CSSProperties}>
      {boxes.map((owner, i) =>
        owner === null ? null : (
          <g key={`b${i}`}>
            <rect x={M + (i % BOXES) * S + 8} y={M + Math.floor(i / BOXES) * S + 8} width={S - 16} height={S - 16} rx={10} fill={SEAT_COLORS[owner]} opacity={0.35} />
            <text x={M + (i % BOXES) * S + S / 2} y={M + Math.floor(i / BOXES) * S + S / 2 + 12} textAnchor="middle" fontSize={34} fontWeight={800} fill="#2d2620">
              {game.players[owner].avatar.emoji}
            </text>
          </g>
        ),
      )}
      {Array.from({ length: BOXES + 1 }, (_, r) => Array.from({ length: BOXES }, (_, c) => line("h", r, c, h[hIndex(r, c)])))}
      {Array.from({ length: BOXES }, (_, r) => Array.from({ length: BOXES + 1 }, (_, c) => line("v", r, c, v[vIndex(r, c)])))}
      {Array.from({ length: (BOXES + 1) ** 2 }, (_, i) => (
        <circle key={`d${i}`} cx={M + (i % (BOXES + 1)) * S} cy={M + Math.floor(i / (BOXES + 1)) * S} r={9} fill="#2d2620" />
      ))}
    </svg>
  );
}

// ---------- Mancala ----------

function Seeds({ n }: { n: number }) {
  const shown = Math.min(n, 14);
  return (
    <span className="seeds" aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className="seed" style={{ "--h": (i * 47) % 360 } as CSSProperties} />
      ))}
    </span>
  );
}

function MancalaBoard({ game, canMove, onMove }: BoardProps<MancalaState, MancalaMove>) {
  const { board, last } = game.state;
  const me = game.you;
  const them: Player = me === 0 ? 1 : 0;
  const lastIndex = last ? pitIndex(last.player, last.pit) : -1;

  const pit = (owner: Player, k: number) => {
    const i = pitIndex(owner, k);
    const n = board[i];
    const playable = owner === me && canMove && n > 0;
    return (
      <button key={i} className={`pit${playable ? " playable" : ""}${i === lastIndex ? " last" : ""}`} disabled={!playable} onClick={() => onMove({ pit: k })} aria-label={`${owner === me ? "Your" : "Their"} pit with ${n} seeds`}>
        <Seeds n={n} />
        <span className="pit-count">{n}</span>
      </button>
    );
  };

  return (
    <div className="mancala">
      <div className="store" aria-label={`Their store: ${board[storeOf(them)]}`}>
        <Seeds n={board[storeOf(them)]} />
        <span className="pit-count">{board[storeOf(them)]}</span>
        <span className="store-label">{game.players[them].displayName}</span>
      </div>
      <div className="pits">
        <div className="pit-row">{Array.from({ length: PITS }, (_, k) => pit(them, PITS - 1 - k))}</div>
        <div className="pit-row">{Array.from({ length: PITS }, (_, k) => pit(me, k))}</div>
      </div>
      <div className="store mine" aria-label={`Your store: ${board[storeOf(me)]}`}>
        <Seeds n={board[storeOf(me)]} />
        <span className="pit-count">{board[storeOf(me)]}</span>
        <span className="store-label">You</span>
      </div>
    </div>
  );
}

export const BOARDS: Record<GameType, ComponentType<BoardProps<any, any>>> = {
  fourInARow: FourBoard,
  dotsAndBoxes: DotsBoard,
  mancala: MancalaBoard,
};

/** Score line for games that keep score. */
export function scoreOf(game: GameDTO): [number, number] | null {
  if (game.type === "dotsAndBoxes") return (game.state as DotsState).scores;
  if (game.type === "mancala") {
    const b = (game.state as MancalaState).board;
    return [b[storeOf(0)], b[storeOf(1)]];
  }
  return null;
}
