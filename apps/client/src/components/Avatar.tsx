import { Link } from "react-router";
import type { PublicUser } from "@splash/shared";

export function Avatar({ user, size = 40, link = false }: { user: Pick<PublicUser, "avatar" | "displayName" | "username">; size?: number; link?: boolean }) {
  const el = (
    <span
      className="avatar"
      style={{ width: size, height: size, background: user.avatar.color, fontSize: size * 0.55 }}
      title={user.displayName}
      aria-label={user.displayName}
      role="img"
    >
      {user.avatar.emoji}
    </span>
  );
  return link ? (
    <Link to={`/u/${user.username}`} style={{ textDecoration: "none", borderRadius: "50%" }}>
      {el}
    </Link>
  ) : (
    el
  );
}
