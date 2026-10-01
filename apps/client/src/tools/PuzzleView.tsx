import { Link } from "react-router";
import { formatDuration, todayKey } from "../lib/util";
import type { ViewerProps } from "./registry";

export default function PuzzleView({ post }: ViewerProps<"puzzle">) {
  const { game, difficulty, seed, timeMs, daily } = post.content;
  const isToday = daily === todayKey();
  const name = game === "sudoku" ? "Sudoku" : "Minesweeper";
  const link = isToday && game === "sudoku" ? "/play/sudoku?daily=1" : `/play/${game}?difficulty=${difficulty}&seed=${encodeURIComponent(seed)}`;

  return (
    <div className="puzzle-card">
      <div style={{ fontSize: "2.2rem" }}>{game === "sudoku" ? "🔢" : "💣"}</div>
      <div className="grow">
        <p>
          Solved {daily ? (isToday ? "today's" : `the ${daily}`) : "a"} <span className="bold">{difficulty}</span> {name}
          {daily ? " daily" : ""} in
        </p>
        <p className="display" style={{ fontSize: "1.8rem", fontWeight: 650, lineHeight: 1.1 }}>
          {formatDuration(timeMs)}
        </p>
      </div>
      <Link to={link} className="btn btn-sm">
        Try this one
      </Link>
    </div>
  );
}
