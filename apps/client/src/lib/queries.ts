import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Badges,
  CommentDTO,
  CreatePostBody,
  GameDTO,
  GameType,
  Me,
  MessageDTO,
  NeighborhoodDTO,
  PostDTO,
  PostKind,
  PostPage,
  PublicUser,
  Reaction,
  ThreadSummary,
  UpdatePostBody,
} from "@splash/shared";
import { api } from "./api";

export const qk = {
  me: ["me"] as const,
  neighborhood: ["neighborhood"] as const,
  feed: ["feed"] as const,
  posts: (authorId: string) => ["posts", authorId] as const,
  post: (id: string) => ["post", id] as const,
  comments: (postId: string) => ["comments", postId] as const,
  user: (username: string) => ["user", username] as const,
  threads: ["threads"] as const,
  messages: (channel: string) => ["messages", channel] as const,
  games: ["games"] as const,
  game: (id: string) => ["game", id] as const,
  badges: ["badges"] as const,
};

const withBefore = (path: string, before: string | null) =>
  before ? `${path}${path.includes("?") ? "&" : "?"}before=${encodeURIComponent(before)}` : path;

/** The signed-in user. AuthProvider enables it once a session exists. */
export const useMe = (enabled = true) =>
  useQuery({ queryKey: qk.me, queryFn: () => api<Me>("/api/me"), enabled, staleTime: 60_000 });

export const useNeighborhood = () =>
  useQuery({ queryKey: qk.neighborhood, queryFn: () => api<NeighborhoodDTO>("/api/neighborhood"), staleTime: 60_000 });

/** Neighbors other than me. */
export function useNeighbors(meId: string | undefined): PublicUser[] {
  const { data } = useNeighborhood();
  return (data?.members ?? []).filter((m) => m.id !== meId);
}

export const useFeed = () =>
  useInfiniteQuery({
    queryKey: qk.feed,
    queryFn: ({ pageParam }) => api<PostPage>(withBefore("/api/posts/feed", pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
  });

export const useUserPosts = (authorId: string | undefined) =>
  useInfiniteQuery({
    queryKey: qk.posts(authorId ?? ""),
    queryFn: ({ pageParam }) => api<PostPage>(withBefore(`/api/posts?author=${authorId}`, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
    enabled: !!authorId,
  });

export const usePost = (id: string | null | undefined) =>
  useQuery({ queryKey: qk.post(id ?? ""), queryFn: () => api<PostDTO>(`/api/posts/${id}`), enabled: !!id });

export const useUser = (username: string) =>
  useQuery({ queryKey: qk.user(username), queryFn: () => api<PublicUser>(`/api/users/${username}`) });

/** Refresh every list a post might appear in. */
function useInvalidatePosts() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.feed });
    void qc.invalidateQueries({ queryKey: ["posts"] });
  };
}

export function useCreatePost<K extends PostKind>() {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (body: CreatePostBody<K>) => api<PostDTO<K>>("/api/posts", { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdatePostBody & { id: string }) =>
      api<PostDTO>(`/api/posts/${id}`, { method: "PATCH", body }),
    onSuccess: (post) => {
      qc.setQueryData(qk.post(post.id), post);
      invalidate();
    },
  });
}

export function useDeletePost() {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/posts/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useToggleReaction() {
  const qc = useQueryClient();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: ({ postId, emoji }: { postId: string; emoji: Reaction }) =>
      api<PostDTO>(`/api/posts/${postId}/reactions`, { method: "PUT", body: { emoji } }),
    onSuccess: (post) => {
      qc.setQueryData(qk.post(post.id), post);
      invalidate();
    },
  });
}

export const useComments = (postId: string, enabled = true) =>
  useQuery({
    queryKey: qk.comments(postId),
    queryFn: () => api<CommentDTO[]>(`/api/posts/${postId}/comments`),
    enabled,
  });

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (text: string) => api<CommentDTO>(`/api/posts/${postId}/comments`, { method: "POST", body: { text } }),
    onSuccess: (comment) => {
      qc.setQueryData<CommentDTO[]>(qk.comments(postId), (old) => [...(old ?? []), comment]);
      void qc.invalidateQueries({ queryKey: qk.post(postId) });
      invalidate();
    },
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api<void>(`/api/posts/${postId}/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: (_, commentId) => {
      qc.setQueryData<CommentDTO[]>(qk.comments(postId), (old) => old?.filter((c) => c.id !== commentId));
      void qc.invalidateQueries({ queryKey: qk.post(postId) });
    },
  });
}

// ---------- Talk ----------

export const useThreads = () =>
  useQuery({ queryKey: qk.threads, queryFn: () => api<ThreadSummary[]>("/api/messages/threads"), refetchInterval: 30_000 });

export const useMessages = (channel: string) =>
  useQuery({
    queryKey: qk.messages(channel),
    queryFn: () => api<MessageDTO[]>(`/api/messages/${channel}`),
    // Polling while the thread is open keeps us on plain HTTP (free-tier friendly, no sockets).
    refetchInterval: 5_000,
  });

export function useSendMessage(channel: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api<MessageDTO>(`/api/messages/${channel}`, { method: "POST", body: { text } }),
    onSuccess: (message) => {
      qc.setQueryData<MessageDTO[]>(qk.messages(channel), (old) => [...(old ?? []), message]);
      void qc.invalidateQueries({ queryKey: qk.threads });
    },
  });
}

export function useMarkRead(channel: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/messages/${channel}/read`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.threads });
      void qc.invalidateQueries({ queryKey: qk.badges });
    },
  });
}

// ---------- Games ----------

export const useGames = () =>
  useQuery({ queryKey: qk.games, queryFn: () => api<GameDTO[]>("/api/games"), refetchInterval: 30_000 });

export const useGame = (id: string) =>
  useQuery({
    queryKey: qk.game(id),
    queryFn: () => api<GameDTO>(`/api/games/${id}`),
    // Poll only while waiting on the other player.
    refetchInterval: (q) => {
      const g = q.state.data;
      return g && g.status === "active" && g.state.turn !== g.you ? 4_000 : false;
    },
  });

export function useCreateGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: GameType; opponentId: string }) => api<GameDTO>("/api/games", { method: "POST", body }),
    onSuccess: (game) => {
      qc.setQueryData(qk.game(game.id), game);
      void qc.invalidateQueries({ queryKey: qk.games });
    },
  });
}

export const useBadges = () =>
  useQuery({ queryKey: qk.badges, queryFn: () => api<Badges>("/api/me/badges"), refetchInterval: 60_000 });
