import { useState } from "react";
import { useNavigate } from "react-router";
import { GAMES, GAME_TYPES, type GameType, type PublicUser } from "@splash/shared";
import { errorMessage } from "../lib/api";
import { useMeStrict } from "../lib/auth";
import { useCreateGame, useNeighbors } from "../lib/queries";
import { useToast } from "../lib/toast";
import { Avatar } from "./Avatar";
import { Sheet } from "./Sheet";

/** Pick a game and a neighbor. Either can be preselected (e.g. from a profile page). */
export function StartGameSheet({
  open,
  onClose,
  opponent,
}: {
  open: boolean;
  onClose: () => void;
  opponent?: PublicUser;
}) {
  const me = useMeStrict();
  const neighbors = useNeighbors(me.id);
  const create = useCreateGame();
  const navigate = useNavigate();
  const toast = useToast();
  const [type, setType] = useState<GameType>("fourInARow");
  const [opponentId, setOpponentId] = useState<string | undefined>(opponent?.id);

  const start = () => {
    if (!opponentId) return;
    create.mutate(
      { type, opponentId },
      {
        onSuccess: (game) => navigate(`/play/game/${game.id}`),
        onError: (e) => toast(errorMessage(e), "error"),
      },
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title={opponent ? `Play with ${opponent.displayName}` : "Start a game"}>
      <div className="stack">
        <div className="option-list" role="radiogroup" aria-label="Game">
          {GAME_TYPES.map((t) => (
            <button key={t} type="button" className="option" aria-pressed={type === t} onClick={() => setType(t)}>
              <span style={{ fontSize: "1.6rem" }}>{GAMES[t].emoji}</span>
              <span>
                <span className="bold">{GAMES[t].title}</span>
                <br />
                <span className="small muted">{GAMES[t].blurb}</span>
              </span>
            </button>
          ))}
        </div>

        {!opponent && (
          <div className="field">
            <span className="label">Who do you want to play?</span>
            {neighbors.length === 0 ? (
              <p className="muted small">No neighbors yet. Once someone moves in, you can challenge them.</p>
            ) : (
              <div className="chips">
                {neighbors.map((n) => (
                  <button key={n.id} type="button" className="chip" aria-pressed={opponentId === n.id} onClick={() => setOpponentId(n.id)}>
                    <Avatar user={n} size={22} /> {n.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button className="btn btn-accent btn-block" disabled={!opponentId || create.isPending} onClick={start}>
          {create.isPending ? "Setting up the board…" : "Start — you go first"}
        </button>
      </div>
    </Sheet>
  );
}
