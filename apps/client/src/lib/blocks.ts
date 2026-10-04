import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlockedUserDTO, ProfileDTO } from "@splash/shared";
import { api } from "./api";
import { qk } from "./queries";

const BLOCKS_KEY = ["blocks"] as const;

/** A profile as the viewer sees it, including whether the viewer blocked them. */
export const useProfile = (username: string) =>
  useQuery({ queryKey: qk.user(username), queryFn: () => api<ProfileDTO>(`/api/users/${username}`) });

export const useBlockedUsers = () =>
  useQuery({ queryKey: BLOCKS_KEY, queryFn: () => api<BlockedUserDTO[]>("/api/blocks") });

/**
 * Blocking or unblocking changes what almost every screen shows (feed, neighbors,
 * chats, games, counts), so refetch everything rather than patching caches piecemeal.
 */
function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useBlock() {
  const refreshAll = useRefreshAll();
  return useMutation({
    mutationFn: (userId: string) => api<void>("/api/blocks", { method: "POST", body: { userId } }),
    onSuccess: refreshAll,
  });
}

export function useUnblock() {
  const refreshAll = useRefreshAll();
  return useMutation({
    mutationFn: (userId: string) => api<void>(`/api/blocks/${userId}`, { method: "DELETE" }),
    onSuccess: refreshAll,
  });
}
