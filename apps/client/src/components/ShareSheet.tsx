import { useState } from "react";
import { useNavigate } from "react-router";
import { Globe, Lock } from "lucide-react";
import type { PostContentMap, PostDTO, PostKind, Visibility } from "@splash/shared";
import { errorMessage } from "../lib/api";
import { useCreatePost, useUpdatePost } from "../lib/queries";
import { useToast } from "../lib/toast";
import { clearLocal } from "../lib/util";
import type { EditorSource } from "../tools/useEditorSource";
import { Sheet } from "./Sheet";

interface Props<K extends PostKind> {
  open: boolean;
  onClose: () => void;
  kind: K;
  source: EditorSource<K>;
  getContent: () => PostContentMap[K];
  /** localStorage draft to clear once saved. */
  draftKey?: string;
  suggestedTitle?: string;
}

/** The "I'm done" step shared by every tool: name it, choose who sees it, save. */
export function ShareSheet<K extends PostKind>({ open, onClose, kind, source, getContent, draftKey, suggestedTitle }: Props<K>) {
  const editing = source.mode === "edit" ? source.post : undefined;
  const [title, setTitle] = useState(editing?.title ?? "");
  const [visibility, setVisibility] = useState<Visibility>(editing?.visibility ?? "neighbors");
  const create = useCreatePost<K>();
  const update = useUpdatePost();
  const toast = useToast();
  const navigate = useNavigate();
  const busy = create.isPending || update.isPending;

  const done = (post: PostDTO) => {
    if (draftKey) clearLocal(draftKey);
    toast(
      editing ? "Saved!" : visibility === "neighbors" ? "Shared with your neighbors 🎉" : "Saved to your private shelf 🔒",
    );
    navigate(`/p/${post.id}`, { replace: true });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const content = getContent();
    const onError = (err: unknown) => toast(errorMessage(err), "error");
    if (editing) {
      update.mutate({ id: editing.id, title, visibility, content }, { onSuccess: done, onError });
    } else {
      create.mutate(
        { kind, title, content, visibility, remixOf: source.mode === "remix" ? source.post?.id : undefined },
        { onSuccess: done, onError },
      );
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Save changes" : "Nice work! ✨"}>
      <form className="stack" onSubmit={save}>
        <label className="field">
          <span className="label">Give it a title (optional)</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={suggestedTitle ?? "Untitled"}
          />
        </label>
        <div className="option-list" role="radiogroup" aria-label="Who can see this">
          <button type="button" className="option" aria-pressed={visibility === "neighbors"} onClick={() => setVisibility("neighbors")}>
            <Globe size={20} />
            <span>
              <span className="bold">Share with my neighbors</span>
              <br />
              <span className="small muted">Your 20 neighbors can see it, react and reply.</span>
            </span>
          </button>
          <button type="button" className="option" aria-pressed={visibility === "private"} onClick={() => setVisibility("private")}>
            <Lock size={20} />
            <span>
              <span className="bold">Keep it to myself</span>
              <br />
              <span className="small muted">Saved on your profile, only you can see it. You can share later.</span>
            </span>
          </button>
        </div>
        <button className="btn btn-accent btn-block" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : visibility === "neighbors" ? "Share it" : "Save it"}
        </button>
      </form>
    </Sheet>
  );
}
