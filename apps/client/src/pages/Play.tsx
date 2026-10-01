import { useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { Bomb, Grid3x3, Plus } from "lucide-react";
import { GAMES, type Difficulty, type GameDTO } from "@splash/shared";
import { Avatar } from "../components/Avatar";
import { StartGameSheet } from "../components/StartGameSheet";
import { EmptyState, Spinner } from "../components/States";
import { describeGame, isMyTurn, opponentOf } from "../games/describe";
import { useGames } from "../lib/queries";
import { timeAgo } from "../lib/util";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

function PuzzleTile({ to, title, blurb, color, icon }: { to: string; title: string; blurb: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="tile" style={{ "--tile": color, minHeight: 0 } as CSSProperties}>
      <span className="tile-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{blurb}</p>
      <div className="row row-wrap" style={{ gap: 6, marginTop: 4 }}>
        {DIFFICULTIES.map((d) => (
          <Link key={d} to={`${to}?difficulty=${d}`} className="btn btn-sm" style={{ textTransform: "capitalize" }}>
            {d}
          </Link>
        ))}
      </div>
    </div>
  );
}

function GameRow({ game }: { game: GameDTO }) {
  const them = opponentOf(game);
  const rules = GAMES[game.type];
  return (
    <Link to={`/play/game/${game.id}`} className="thread-row">
      <Avatar user={them} size={42} />
      <div className="grow">
        <div className="bold">
          {rules.emoji} {rules.title} <span className="muted" style={{ fontWeight: 600 }}>with {them.displayName}</span>
        </div>
        <div className="small muted">
          {describeGame(game)} · {timeAgo(game.updatedAt)}
        </div>
      </div>
      {isMyTurn(game) && <span className="unread-dot" aria-label="Your move" />}
    </Link>
  );
}

export function Play() {
  const { data: games, isPending } = useGames();
  const [starting, setStarting] = useState(false);
  const active = games?.filter((g) => g.status === "active") ?? [];
  const finished = games?.filter((g) => g.status === "finished") ?? [];

  return (
    <div className="container-wide stack stack-lg">
      <div className="page-head">
        <div>
          <h1>Play</h1>
          <p>Puzzles for quiet moments, games for you and a neighbor.</p>
        </div>
      </div>

      <section className="stack">
        <h2 className="section-title">Puzzles</h2>
        <div className="tiles">
          <div className="tile" style={{ "--tile": "var(--c-puzzle)", minHeight: 0 } as CSSProperties}>
            <span className="tile-icon">☀️</span>
            <h3>Daily sudoku</h3>
            <p>Same puzzle for your whole street today. Compare times!</p>
            <Link to="/play/sudoku?daily=1" className="btn btn-sm btn-primary" style={{ alignSelf: "flex-start", marginTop: 4 }}>
              Play today's
            </Link>
          </div>
          <PuzzleTile to="/play/sudoku" title="Sudoku" blurb="Fill the grid so every row, column and box has 1–9." color="var(--c-puzzle)" icon={<Grid3x3 size={24} />} />
          <PuzzleTile to="/play/minesweeper" title="Minesweeper" blurb="Clear the field. Numbers tell you how many mines are nearby." color="var(--c-write)" icon={<Bomb size={24} />} />
        </div>
      </section>

      <section className="stack">
        <div className="row spread">
          <h2 className="section-title">With your neighbors</h2>
          <button className="btn btn-sm btn-accent" onClick={() => setStarting(true)}>
            <Plus size={16} /> New game
          </button>
        </div>
        {isPending ? (
          <Spinner />
        ) : active.length === 0 && finished.length === 0 ? (
          <div className="card">
            <EmptyState emoji="🎲" title="No games yet">
              <p className="muted">Four in a Row, Dots & Boxes, Mancala. Take turns whenever you like, no rush.</p>
              <button className="btn btn-sm" onClick={() => setStarting(true)}>
                Challenge a neighbor
              </button>
            </EmptyState>
          </div>
        ) : (
          <div className="card" style={{ padding: 6 }}>
            {active.map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
            {finished.length > 0 && (
              <>
                <p className="section-title" style={{ padding: "12px 14px 4px" }}>
                  Recently finished
                </p>
                {finished.map((g) => (
                  <GameRow key={g.id} game={g} />
                ))}
              </>
            )}
          </div>
        )}
      </section>

      <StartGameSheet open={starting} onClose={() => setStarting(false)} />
    </div>
  );
}
