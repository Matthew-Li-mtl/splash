// Shapes the API sends and receives. Dates are ISO strings on the wire.

import type { PostContentMap, PostKind } from "./content";
import type { BaseGameState, GameType, Player } from "./games";

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  /** Uploaded profile photo (an asset id). Without one, people see their initial on a color. */
  photoId: string | null;
  bio: string;
  interests: string[];
  createdAt: string;
}

export interface Me extends PublicUser {
  neighborhoodId: string | null;
  lastMovedAt: string | null;
  /** This person asked for their street to be invite only. One such member makes the whole street invite only. */
  wantsPrivate: boolean;
}

/**
 * Where a new or moving person lives. "solo" starts a fresh street of their own (the default);
 * "match" puts them on an open street with strangers who share their interests (the last resort).
 * An invite code always wins over either.
 */
export type StartMode = "solo" | "match";

/**
 * Returned by register, login and refresh. The access token is short-lived and
 * kept in memory by the client; the refresh token travels in an httpOnly cookie.
 */
export interface AuthResponse {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  user: Me;
}

/** One signed-in device, for the "Signed-in devices" list in settings. */
export interface SessionDTO {
  id: string;
  device: string;
  lastUsedAt: string;
  createdAt: string;
  /** True for the device making the request. */
  current: boolean;
}

export interface RegisterBody {
  username: string;
  displayName: string;
  password: string;
  interests: string[];
  inviteCode?: string;
  start?: StartMode;
}

export interface LoginBody {
  username: string;
  password: string;
}

export type UpdateMeBody = Partial<Pick<Me, "displayName" | "bio" | "photoId" | "interests" | "wantsPrivate">>;

export interface MoveBody {
  start: StartMode;
  inviteCode?: string;
}

/** An open vote to rename the street. Passes when at least half of the current members vote yes. */
export interface NameProposalDTO {
  name: string;
  /** Null if the proposer is hidden from you by a block. */
  proposedBy: PublicUser | null;
  yesVotes: number;
  votesNeeded: number;
  votedByMe: boolean;
  expiresAt: string;
}

export interface NeighborhoodDTO {
  id: string;
  name: string;
  inviteCode: string;
  members: PublicUser[];
  capacity: number;
  createdAt: string;
  /** True if any member asked for invite only. Strangers are never matched onto an invite-only street. */
  inviteOnly: boolean;
  /** The founder may replace the default name once, without a vote. True only for the founder, until then. */
  canNameFreely: boolean;
  nameProposal: NameProposalDTO | null;
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
  /** Ended without a result because one player blocked the other. */
  cancelled: boolean;
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

// ---------- Blocking ----------

/** A profile as seen by the viewer. */
export interface ProfileDTO extends PublicUser {
  /** The viewer blocked this person (their content is hidden; the profile shows an Unblock option). */
  blockedByMe: boolean;
}

/** Someone the viewer has blocked, for the list in settings. */
export interface BlockedUserDTO {
  user: PublicUser;
  blockedAt: string;
}
