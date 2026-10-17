import type { StartMode } from "@splash/shared";

export type StartChoiceValue = { mode: StartMode | "invite"; inviteCode: string };

const OPTIONS: { mode: StartChoiceValue["mode"]; title: string; body: string; quiet?: boolean }[] = [
  {
    mode: "solo",
    title: "Just me for now",
    body: "A street of your own. Make things for yourself, and invite people you know whenever you like.",
  },
  {
    mode: "invite",
    title: "I have an invite",
    body: "Move in next to a friend. No awkward introductions: you already know each other.",
  },
  {
    mode: "match",
    title: "Match me with strangers",
    body: "Only if you don't know anyone here yet. You'll join an open street with people who like similar things.",
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
