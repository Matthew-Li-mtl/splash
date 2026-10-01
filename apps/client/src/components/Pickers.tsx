import { AVATAR_COLORS, AVATAR_EMOJIS, INTERESTS, type Avatar as AvatarValue } from "@splash/shared";
import { Avatar } from "./Avatar";

export function InterestPicker({ value, onChange, max = 10 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : value.length < max ? [...value, id] : value);
  return (
    <div className="chips" role="group" aria-label="Interests">
      {INTERESTS.map((i) => (
        <button key={i.id} type="button" className="chip" aria-pressed={value.includes(i.id)} onClick={() => toggle(i.id)}>
          <span aria-hidden="true">{i.emoji}</span> {i.label}
        </button>
      ))}
    </div>
  );
}

export function AvatarPicker({ value, onChange, name }: { value: AvatarValue; onChange: (v: AvatarValue) => void; name: string }) {
  return (
    <div className="stack">
      <div className="row" style={{ gap: 14 }}>
        <Avatar user={{ avatar: value, displayName: name || "You", username: "" }} size={64} />
        <div className="swatches" role="group" aria-label="Avatar color">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="swatch"
              style={{ background: color }}
              aria-pressed={value.color === color}
              aria-label={`Color ${color}`}
              onClick={() => onChange({ ...value, color })}
            />
          ))}
        </div>
      </div>
      <div className="picker-grid" role="group" aria-label="Avatar emoji">
        {AVATAR_EMOJIS.map((emoji) => (
          <button key={emoji} type="button" aria-pressed={value.emoji === emoji} onClick={() => onChange({ ...value, emoji })}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export function InterestChips({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <div className="chips" style={{ justifyContent: "inherit", gap: 5 }}>
      {ids.map((id) => {
        const i = INTERESTS.find((x) => x.id === id);
        return i ? (
          <span key={id} className="chip chip-static">
            {i.emoji} {i.label}
          </span>
        ) : null;
      })}
    </div>
  );
}
