import { useState } from "react";
import { Send, X } from "lucide-react";
import type { PostDTO } from "@splash/shared";
import { errorMessage } from "../lib/api";
import { useMeStrict } from "../lib/auth";
import { useAddComment, useComments, useDeleteComment } from "../lib/queries";
import { useToast } from "../lib/toast";
import { timeAgo } from "../lib/util";
import { Avatar } from "./Avatar";
import { Spinner } from "./States";

export function Comments({ post }: { post: PostDTO }) {
  const me = useMeStrict();
  const { data: comments, isPending } = useComments(post.id);
  const add = useAddComment(post.id);
  const remove = useDeleteComment(post.id);
  const toast = useToast();
  const [text, setText] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    add.mutate(text.trim(), {
      onSuccess: () => setText(""),
      onError: (err) => toast(errorMessage(err), "error"),
    });
  };

  return (
    <section className="stack" aria-label="Comments">
      <h2 className="section-title">Replies</h2>
      {isPending ? (
        <Spinner />
      ) : comments?.length ? (
        comments.map((c) => (
          <div key={c.id} className="comment">
            <Avatar user={c.author} size={34} link />
            <div className="grow">
              <div className="tiny muted" style={{ marginBottom: 3 }}>
                <span className="bold" style={{ color: "var(--ink)" }}>
                  {c.author.displayName}
                </span>{" "}
                · {timeAgo(c.createdAt)}
              </div>
              <div className="row" style={{ alignItems: "flex-start", gap: 4 }}>
                <div className="bubble">{c.text}</div>
                {(c.author.id === me.id || post.author.id === me.id) && (
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => remove.mutate(c.id)}
                    aria-label="Delete reply"
                    title="Delete reply"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      ) : (
        <p className="muted small">No replies yet. Say something kind?</p>
      )}

      <form className="composer" style={{ position: "static" }} onSubmit={submit}>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={post.author.id === me.id ? "Add a note…" : `Reply to ${post.author.displayName}…`}
          maxLength={1000}
          aria-label="Write a reply"
        />
        <button className="btn btn-primary btn-icon" disabled={!text.trim() || add.isPending} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}
