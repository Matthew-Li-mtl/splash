import type { StartMode } from "@splash/shared";

export type StartChoiceValue = { mode: StartMode | "invite"; inviteCode: string };

const OPTIONS: { mode: StartChoiceValue["mode"]; title: string; body: string; quiet?: boolean }[] = [
  {
    mode: "solo",
    title: "Just me for now",
    body: "Make a space for yourself! You can still invite people later if you'd like.",
  },
  {
    mode: "invite",
    title: "I have an invite",
    body: "Move in with your friends!",
  }
  {
    mode: "match",
    title: "Match me with strangers",
    body: "I don't know anyone who uses this app, but I'm willing to meet new people!",
    quiet: true,
  },
];

/** Where someone lives: their own street (the default), a friend's, or (last resort) strangers'. */
export function StartChoice({ value, onChange }: { value: StartChoiceValue; onChange: (v: StartChoiceValue) => void }) {
  return (
    <div className="choice-list" role="radiogroup" aria-label="Where will you live?">
      {OPTIONS.map((o) => (
        <label key={o.mode} className={`choice${o.quiet ? " choice-quiet" : ""}`}>
          <input type="radio" name="start" checked={value.mode === o.mode} onChange={() => onChange({ ...value, mode: o.mode })} />
          <span className="stack stack-sm grow">
            <span className="bold">{o.title}</span>
            <span className="small muted">{o.body}</span>
            {o.mode === "invite" && value.mode === "invite" && (
              <input
                className="input"
                value={value.inviteCode}
                onChange={(e) => onChange({ ...value, inviteCode: e.target.value })}
                placeholder="Invite code from a friend"
                autoCapitalize="none"
                aria-label="Invite code"
                autoFocus={!value.inviteCode}
                required
              />
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

/** The request fields for a choice: an invite code wins, otherwise solo or match. */
export const startBody = (v: StartChoiceValue) =>
  v.mode === "invite" ? { start: "solo" as const, inviteCode: v.inviteCode.trim() } : { start: v.mode };
