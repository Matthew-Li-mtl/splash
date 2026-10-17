import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Ellipsis, Pencil, Trash } from "lucide-react";
import type { PostDTO } from "@splash/shared";
import { errorMessage } from "../lib/api";
import { useDeletePost } from "../lib/queries";
import { useToast } from "../lib/toast";
import { TOOLS } from "../tools/registry";

/** The ⋯ menu on your own post cards, so you can edit or delete without opening the post. */
export function PostMenu({ post }: { post: PostDTO }) {
  // Where to draw the menu, in viewport coordinates. Cards clip their overflow, so the
  // menu is position: fixed under the button instead of absolutely inside the card.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const open = pos !== null;
  const ref = useRef<HTMLDivElement>(null);
  const remove = useDeletePost();
  const toast = useToast();

  const toggle = () => {
    if (open) return setPos(null);
    const r = ref.current!.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  // Close on a click outside the menu, Escape, or scrolling (which would leave it floating).
  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close);
    };
  }, [open]);

  const del = () => {
    setPos(null);
    if (!window.confirm("Delete this for good? This can't be undone.")) return;
    remove.mutate(post.id, {
      onSuccess: () => toast("Deleted."),
      onError: (e) => toast(errorMessage(e), "error"),
    });
  };

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        className="btn btn-ghost btn-icon btn-sm"
        onClick={toggle}
        aria-label="Post options"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={remove.isPending}
      >
        <Ellipsis size={18} />
      </button>
      {open && (
        <div className="menu card" role="menu" style={pos}>
          {post.kind !== "puzzle" && (
            <Link role="menuitem" className="menu-item" to={`${TOOLS[post.kind].path}?edit=${post.id}`}>
              <Pencil size={15} /> Edit
            </Link>
          )}
          <button role="menuitem" className="menu-item btn-danger" onClick={del}>
            <Trash size={15} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
