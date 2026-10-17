import { useRef } from "react";
import { Camera } from "lucide-react";
import { INTERESTS } from "@splash/shared";
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

/** Profile photo with upload/remove buttons. Without a photo it shows the initials avatar. */
export function PhotoPicker({
  src,
  name,
  username,
  busy = false,
  onPick,
  onRemove,
}: {
  src: string | null;
  name: string;
  username: string;
  busy?: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="row" style={{ gap: 14 }}>
      <Avatar user={{ photoId: null, displayName: name || "You", username }} src={src} size={72} />
      <div className="row row-wrap" style={{ gap: 6 }}>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Camera size={16} /> {busy ? "Uploading…" : src ? "Change photo" : "Add a photo"}
        </button>
        {src && !busy && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
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
