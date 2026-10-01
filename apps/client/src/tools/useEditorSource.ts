import { useSearchParams } from "react-router";
import type { PostDTO, PostKind } from "@splash/shared";
import { usePost } from "../lib/queries";

export interface EditorSource<K extends PostKind> {
  /** new = blank canvas, edit = changing your own post, remix = starting from someone's post. */
  mode: "new" | "edit" | "remix";
  post?: PostDTO<K>;
  loading: boolean;
  error: unknown;
}

/** Reads ?edit=<postId> or ?remix=<postId> so every editor can open existing work. */
export function useEditorSource<K extends PostKind>(kind: K): EditorSource<K> {
  const [params] = useSearchParams();
  const editId = params.get("edit");
  const remixId = params.get("remix");
  const query = usePost(editId ?? remixId);
  const post = query.data?.kind === kind ? (query.data as PostDTO<K>) : undefined;
  return {
    mode: editId ? "edit" : remixId ? "remix" : "new",
    post,
    loading: !!(editId ?? remixId) && query.isPending,
    error: query.error,
  };
}
