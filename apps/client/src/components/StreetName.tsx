import { useState } from "react";
import { NAME_PROPOSAL_DAYS, NEIGHBORHOOD_NAME_MAX, type NeighborhoodDTO } from "@splash/shared";
import { errorMessage } from "../lib/api";
import { useMeStrict } from "../lib/auth";
import { useStreetName } from "../lib/queries";
import { useToast } from "../lib/toast";

/**
 * Naming the street. The founder replaces the random default name once, freely. After that,
 * anyone can suggest a name, and it passes when at least half the street votes yes.
 */
export function StreetName({ hood }: { hood: NeighborhoodDTO }) {
  const me = useMeStrict();
  const toast = useToast();
  const street = useStreetName();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const proposal = hood.nameProposal;
  const busy = street.name.isPending || street.propose.isPending || street.vote.isPending || street.withdraw.isPending;

  const onError = (e: unknown) => toast(errorMessage(e), "error");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    const done = (next: NeighborhoodDTO) => {
      setDraft("");
      setEditing(false);
      toast(next.name === name ? `Welcome to ${name}! 🏡` : "Suggestion posted. Your neighbors can vote on it.");
    };
    if (hood.canNameFreely) street.name.mutate(name, { onSuccess: done, onError });
    else street.propose.mutate(name, { onSuccess: done, onError });
  };

  const form = (
    <form className="row row-wrap" style={{ gap: 8 }} onSubmit={submit}>
      <input
        className="input grow"
        style={{ minWidth: 0, flexBasis: 200 }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={NEIGHBORHOOD_NAME_MAX}
        placeholder={hood.name}
        aria-label="New street name"
        autoFocus
      />
      <button className="btn btn-primary" disabled={busy || !draft.trim()}>
        {hood.canNameFreely ? "Name it" : "Suggest"}
      </button>
    </form>
  );

  if (hood.canNameFreely) {
    return (
      <div className="card stack">
        <h3>Name your street</h3>
        <p className="muted small">
          You started {hood.name}, so you get to rename it once, no vote needed. After that, renaming takes a vote.
        </p>
        {form}
      </div>
    );
  }

  if (proposal) {
    const mine = proposal.proposedBy?.id === me.id;
    return (
      <div className="card stack">
        <h3>Rename the street to "{proposal.name}"?</h3>
        <p className="muted small">
          Suggested by {mine ? "you" : (proposal.proposedBy?.displayName ?? "a neighbor")}. It passes with{" "}
          {proposal.votesNeeded} yes {proposal.votesNeeded === 1 ? "vote" : "votes"} (half the street) and closes on{" "}
          {new Date(proposal.expiresAt).toLocaleDateString()}.
        </p>
        <p className="bold">
          {proposal.yesVotes} of {proposal.votesNeeded} yes
        </p>
        <div className="row row-wrap" style={{ gap: 8 }}>
          <button
            className={`btn btn-sm${proposal.votedByMe ? "" : " btn-primary"}`}
            disabled={busy}
            onClick={() => street.vote.mutate(!proposal.votedByMe, { onError })}
          >
            {proposal.votedByMe ? "Take back my yes" : "Vote yes"}
          </button>
          {mine && (
            <button className="btn btn-sm btn-ghost btn-danger" disabled={busy} onClick={() => street.withdraw.mutate(undefined, { onError })}>
              Withdraw
            </button>
          )}
        </div>
      </div>
    );
  }

  return editing ? (
    <div className="card stack">
      <h3>Suggest a new name</h3>
      <p className="muted small">
        If at least half the street votes yes within {NAME_PROPOSAL_DAYS} days, the street gets the new name.
      </p>
      {form}
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setEditing(false)}>
        Cancel
      </button>
    </div>
  ) : (
    <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setEditing(true)}>
      Suggest a new street name
    </button>
  );
}
