import { useState } from "react";
import { Plus } from "lucide-react";
import { REACTIONS, type PostDTO, type Reaction } from "@splash/shared";
import { useMeStrict } from "../lib/auth";
import { useNeighborhood, useToggleReaction } from "../lib/queries";
import { useToast } from "../lib/toast";
import { errorMessage } from "../lib/api";

export function Reactions({ post }: { post: PostDTO }) {
  const me = useMeStrict();
  const toggle = useToggleReaction();
  const toast = useToast();
  const { data: hood } = useNeighborhood();
  const [picking, setPicking] = useState(false);

  const nameOf = (id: string) => (id === me.id ? "You" : (hood?.members.find((m) => m.id === id)?.displayName ?? "A neighbor"));
  const react = (emoji: Reaction) => {
    setPicking(false);
    toggle.mutate({ postId: post.id, emoji }, { onError: (e) => toast(errorMessage(e), "error") });
  };

  return (
    <div className="row row-wrap" style={{ gap: 6, position: "relative" }}>
      {post.reactions.map((r) => (
        <button
          key={r.emoji}
          className={`reaction${r.userIds.includes(me.id) ? " mine" : ""}`}
          onClick={() => react(r.emoji as Reaction)}
          title={r.userIds.map(nameOf).join(", ")}
          aria-label={`${r.emoji} from ${r.userIds.map(nameOf).join(", ")}`}
        >
          <span>{r.emoji}</span>
          <span>{r.userIds.length}</span>
        </button>
      ))}
      <button className="reaction" onClick={() => setPicking((p) => !p)} aria-label="Add a reaction" aria-expanded={picking}>
        <Plus size={15} />
      </button>
      {picking && (
        <div className="reaction-picker" style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 5 }}>
          {REACTIONS.map((emoji) => (
            <button key={emoji} onClick={() => react(emoji)} aria-label={`React ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
