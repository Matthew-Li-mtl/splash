import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Globe, Lock, Pencil, Repeat, Trash } from "lucide-react";
import { Comments } from "../components/Comments";
import { PostCard } from "../components/PostCard";
import { ErrorState, Spinner } from "../components/States";
import { errorMessage } from "../lib/api";
import { useMeStrict } from "../lib/auth";
import { useDeletePost, usePost, useUpdatePost } from "../lib/queries";
import { useToast } from "../lib/toast";
import { TOOLS } from "../tools/registry";

export function PostPage() {
  const { id = "" } = useParams();
  const me = useMeStrict();
  const post = usePost(id);
  const update = useUpdatePost();
  const remove = useDeletePost();
  const toast = useToast();
  const navigate = useNavigate();

  if (post.isPending) return <Spinner />;
  if (post.isError) return <ErrorState error={post.error} />;

  const p = post.data;
  const mine = p.author.id === me.id;
  const editable = p.kind !== "puzzle";
  const tool = TOOLS[p.kind];

  const toggleVisibility = () =>
    update.mutate(
      { id: p.id, visibility: p.visibility === "private" ? "neighbors" : "private" },
      {
        onSuccess: (next) => toast(next.visibility === "private" ? "Now only you can see this." : "Shared with your neighbors 🎉"),
        onError: (e) => toast(errorMessage(e), "error"),
      },
    );

  const del = () => {
    if (!window.confirm("Delete this for good? This can't be undone.")) return;
    remove.mutate(p.id, {
      onSuccess: () => {
        toast("Deleted.");
        navigate(-1);
      },
      onError: (e) => toast(errorMessage(e), "error"),
    });
  };

  return (
    <div className="container stack stack-lg">
      <div className="row">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginLeft: -8 }}>
          <ArrowLeft size={18} /> Back
        </button>
      </div>

      <PostCard post={p} compact={false} />

      <div className="row row-wrap" style={{ gap: 8 }}>
        {mine && editable && (
          <Link to={`${tool.path}?edit=${p.id}`} className="btn btn-sm">
            <Pencil size={15} /> Edit
          </Link>
        )}
        {!mine && editable && (
          <Link to={`${tool.path}?remix=${p.id}`} className="btn btn-sm">
            <Repeat size={15} /> Remix
          </Link>
        )}
        {mine && (
          <button className="btn btn-sm" onClick={toggleVisibility} disabled={update.isPending}>
            {p.visibility === "private" ? (
              <>
                <Globe size={15} /> Share with neighbors
              </>
            ) : (
              <>
                <Lock size={15} /> Make private
              </>
            )}
          </button>
        )}
        {mine && (
          <button className="btn btn-sm btn-ghost btn-danger" onClick={del} disabled={remove.isPending}>
            <Trash size={15} /> Delete
          </button>
        )}
      </div>

      <Comments post={p} />
    </div>
  );
}
