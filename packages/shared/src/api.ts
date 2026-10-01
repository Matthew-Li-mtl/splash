// Shapes the API sends and receives. Dates are ISO strings on the wire.

import type { PostContentMap, PostKind } from "./content";
import type { BaseGameState, GameType, Player } from "./games";

export interface Avatar {
  emoji: string;
  color: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatar: Avatar;
  bio: string;
  interests: string[];
  createdAt: string;
}

export interface Me extends PublicUser {
  neighborhoodId: string | null;
  lastMovedAt: string | null;
}

export interface AuthResponse {
  token: string;
  user: Me;
}

export interface RegisterBody {
  username: string;
  displayName: string;
  password: string;
  avatar: Avatar;
  interests: string[];
  inviteCode?: string;
}

export interface LoginBody {
  username: string;
  password: string;
}

export type UpdateMeBody = Partial<Pick<PublicUser, "displayName" | "bio" | "avatar" | "interests">>;

export interface NeighborhoodDTO {
  id: string;
  name: string;
  inviteCode: string;
  members: PublicUser[];
  capacity: number;
  createdAt: string;
}

export type Visibility = "neighbors" | "private";

export interface ReactionSummary {
  emoji: string;
  userIds: string[];
}

export interface PostDTO<K extends PostKind = PostKind> {
  id: string;
  kind: K;
  title: string;
  content: PostContentMap[K];
  visibility: Visibility;
  author: PublicUser;
  reactions: ReactionSummary[];
  commentCount: number;
  remixOf: { id: string; author: PublicUser | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostBody<K extends PostKind = PostKind> {
  kind: K;
  title?: string;
  content: PostContentMap[K];
  visibility: Visibility;
  remixOf?: string;
}

export interface UpdatePostBody {
  title?: string;
  content?: unknown;
  visibility?: Visibility;
}

export interface PostPage {
  posts: PostDTO[];
  /** Pass as `before` to get the next (older) page. null when there are no more. */
  nextBefore: string | null;
}

export interface CommentDTO {
  id: string;
  postId: string;
  author: PublicUser;
  text: string;
  createdAt: string;
}

export interface MessageDTO {
  id: string;
  channel: string;
  author: PublicUser;
  text: string;
  createdAt: string;
}

export interface ThreadSummary {
  channel: string;
  kind: "neighborhood" | "direct";
  title: string;
  /** For direct threads, the other person. */
  other: PublicUser | null;
  lastMessage: MessageDTO | null;
  unread: boolean;
}

export type GameStatus = "active" | "finished";

export interface GameDTO<S extends BaseGameState = BaseGameState> {
  id: string;
  type: GameType;
  players: [PublicUser, PublicUser];
  state: S;
  status: GameStatus;
  /** Which seat the requesting user is in. */
  you: Player;
  resignedBy: Player | null;
  moveCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Badges {
  yourTurn: number;
  unreadThreads: number;
}

export interface AssetUploadResponse {
  id: string;
  size: number;
}
