import { useState } from "react";
import { Link } from "react-router";
import type { PuzzleContent } from "@splash/shared";
import { errorMessage } from "../lib/api";
import { useCreatePost } from "../lib/queries";
import { useToast } from "../lib/toast";
import { formatDuration } from "../lib/util";

const CHEERS = ["Nicely done!", "Look at you!", "Brilliant!", "You did it!", "Sharp as a tack!"];

/** Celebration + optional "share my time" for a finished puzzle. */
export function PuzzleDone({ result, onAgain, note }: { result: PuzzleContent; onAgain: () => void; note?: string }) {
  const create = useCreatePost<"puzzle">();
  const toast = useToast();
  const [shared, setShared] = useState<string | null>(null);
  const [cheer] = useState(() => CHEERS[Math.floor(Math.random() * CHEERS.length)]);

  const share = () =>
    create.mutate(
      { kind: "puzzle", content: result, visibility: "neighbors" },
      {
        onSuccess: (post) => {
          setShared(post.id);
          toast("Shared! Let's see if anyone can beat it. 🏁");
        },
        onError: (e) => toast(errorMessage(e), "error"),
      },
    );

  return (
    <div className="card stack center puzzle-done" style={{ alignItems: "center" }}>
      <div style={{ fontSize: "2.4rem" }}>🎉</div>
      <h2>{cheer}</h2>
      <p>
        Solved in <span className="bold">{formatDuration(result.timeMs)}</span>
        {note ? ` · ${note}` : ""}
      </p>
      <div className="row row-wrap" style={{ justifyContent: "center" }}>
        {shared ? (
          <Link to={`/p/${shared}`} className="btn btn-sm">
            See your post
          </Link>
        ) : (
          <button className="btn btn-accent btn-sm" onClick={share} disabled={create.isPending}>
            Share my time with neighbors
          </button>
        )}
        <button className="btn btn-sm" onClick={onAgain}>
          Play another
        </button>
      </div>
    </div>
  );
}
