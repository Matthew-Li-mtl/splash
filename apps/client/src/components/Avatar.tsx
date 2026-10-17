import { Link } from "react-router";
import { avatarColor, type PublicUser } from "@splash/shared";
import { assetUrl } from "../lib/api";

/** First letter of someone's name, emoji-safe. */
export const initial = (name: string) => Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "?";

export function Avatar({
  user,
  size = 40,
  link = false,
  src,
}: {
  user: Pick<PublicUser, "photoId" | "displayName" | "username">;
  size?: number;
  link?: boolean;
  /** Show this image instead of the saved photo (e.g. a preview before upload). */
  src?: string | null;
}) {
  const photo = src !== undefined ? src : user.photoId && assetUrl(user.photoId);
  const el = (
    <span
      className="avatar"
      style={
        photo
          ? { width: size, height: size, background: "var(--bg-2)" }
          : { width: size, height: size, background: avatarColor(user.username || user.displayName), color: "#fff", fontSize: size * 0.45 }
      }
      title={user.displayName}
      aria-label={user.displayName}
      role="img"
    >
      {photo ? <img src={photo} alt="" draggable={false} /> : initial(user.displayName)}
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
