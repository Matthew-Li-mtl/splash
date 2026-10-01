import type { CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Flag, MessageCircle, RotateCcw } from "lucide-react";
import { GAMES, directChannel, getRules, type GameDTO, type MancalaState } from "@splash/shared";
import { Avatar } from "../components/Avatar";
import { ErrorState, Spinner } from "../components/States";
import { api, errorMessage } from "../lib/api";
import { useMeStrict } from "../lib/auth";
import { qk, useCreateGame, useGame } from "../lib/queries";
import { useToast } from "../lib/toast";
import { BOARDS, SEAT_COLORS, scoreOf } from "./boards";
import { describeGame, isMyTurn, opponentOf } from "./describe";

export default function GamePage() {
  const { id = "" } = useParams();
  const me = useMeStrict();
  const game = useGame(id);
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const rematch = useCreateGame();

  const refreshLists = () => {
    void qc.invalidateQueries({ queryKey: qk.games });
    void qc.invalidateQueries({ queryKey: qk.badges });
  };

  // Moves apply instantly using the shared rules; the server re-checks them.
  const move = useMutation({
    mutationFn: ({ move, moveCount }: { move: unknown; moveCount: number }) =>
      api<GameDTO>(`/api/games/${id}/move`, { method: "POST", body: { move, moveCount } }),
    onMutate: ({ move }) => {
      const g = qc.getQueryData<GameDTO>(qk.game(id));
      if (!g) return;
      const result = getRules(g.type)?.play(g.state, move, g.you);
      if (result?.ok) {
        qc.setQueryData<GameDTO>(qk.game(id), {
          ...g,
          state: result.state,
          moveCount: g.moveCount + 1,
          status: result.state.winner === null ? "active" : "finished",
        });
      }
    },
    onSuccess: (g) => {
      qc.setQueryData(qk.game(id), g);
      refreshLists();
    },
    onError: (e) => {
      toast(errorMessage(e), "error");
      void qc.invalidateQueries({ queryKey: qk.game(id) });
    },
  });

  const resign = useMutation({
    mutationFn: () => api<GameDTO>(`/api/games/${id}/resign`, { method: "POST" }),
    onSuccess: (g) => {
      qc.setQueryData(qk.game(id), g);
      refreshLists();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  if (game.isPending) return <Spinner />;
  if (game.isError) return <ErrorState error={game.error} />;

  const g = game.data;
  const rules = GAMES[g.type];
  const Board = BOARDS[g.type];
  const them = opponentOf(g);
  const score = scoreOf(g);
  const myTurn = isMyTurn(g);
  const note = g.type === "mancala" ? (g.state as MancalaState).note : null;

  const chip = (seat: 0 | 1) => {
    const player = g.players[seat];
    const turn = g.status === "active" && g.state.turn === seat;
    return (
      <div className={`player-chip${turn ? " turn" : ""}`} style={{ "--seat": SEAT_COLORS[seat] } as CSSProperties}>
        <Avatar user={player} size={34} />
        <span className="bold small">{player.id === me.id ? "You" : player.displayName}</span>
        {score ? <span className="bold">{score[seat]}</span> : <span className="seat-dot" />}
      </div>
    );
  };

  return (
    <div className="container stack" style={{ maxWidth: 680 }}>
      <div className="tool-head">
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate("/play")} aria-label="Back to games">
          <ArrowLeft size={20} />
        </button>
        <span style={{ fontSize: "1.6rem" }}>{rules.emoji}</span>
        <div className="grow">
          <h1 style={{ fontSize: "1.4rem" }}>{rules.title}</h1>
          <p className="tiny muted">{rules.blurb}</p>
        </div>
      </div>

      <div className="versus">
        {chip(0)}
        <span className="muted bold small">vs</span>
        {chip(1)}
      </div>

      <p className="game-status" aria-live="polite">
        {describeGame(g)}
        {g.status === "active" && note && g.state.turn === g.you && <span className="muted small"> · {note}</span>}
      </p>

      <Board game={g} canMove={myTurn && !move.isPending} onMove={(m: unknown) => move.mutate({ move: m, moveCount: g.moveCount })} />

      {g.status === "active" && !myTurn && (
        <p className="center small muted">
          No rush. {them.displayName} will get to it when they can, and you'll see a dot on Play when it's your turn.
        </p>
      )}

      <div className="row row-wrap" style={{ justifyContent: "center", gap: 8 }}>
        <Link to={`/talk/${directChannel(me.id, them.id)}`} className="btn btn-sm">
          <MessageCircle size={15} /> Message {them.displayName}
        </Link>
        {g.status === "active" ? (
          <button
            className="btn btn-sm btn-ghost btn-danger"
            onClick={() => window.confirm("Resign this game?") && resign.mutate()}
            disabled={resign.isPending}
          >
            <Flag size={15} /> Resign
          </button>
        ) : (
          <button
            className="btn btn-sm btn-accent"
            disabled={rematch.isPending}
            onClick={() =>
              rematch.mutate(
                { type: g.type, opponentId: them.id },
                { onSuccess: (next) => navigate(`/play/game/${next.id}`), onError: (e) => toast(errorMessage(e), "error") },
              )
            }
          >
            <RotateCcw size={15} /> Rematch
          </button>
        )}
      </div>
    </div>
  );
}
