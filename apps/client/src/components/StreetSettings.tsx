import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MOVE_COOLDOWN_DAYS, type Me, type MoveBody, type NeighborhoodDTO } from "@splash/shared";
import { api, errorMessage } from "../lib/api";
import { useMeStrict } from "../lib/auth";
import { qk, useNeighborhood } from "../lib/queries";
import { useToast } from "../lib/toast";
import { StartChoice, startBody, type StartChoiceValue } from "./StartChoice";

/** Settings → Neighborhood: the invite-only switch, and moving to a different street. */
export function StreetSettings() {
  const me = useMeStrict();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: hood } = useNeighborhood();
  const [moving, setMoving] = useState(false);
  const [choice, setChoice] = useState<StartChoiceValue>({ mode: "solo", inviteCode: "" });

  const privacy = useMutation({
    mutationFn: (wantsPrivate: boolean) => api<Me>("/api/me", { method: "PATCH", body: { wantsPrivate } }),
    onSuccess: (user) => {
      qc.setQueryData(qk.me, user);
      void qc.invalidateQueries({ queryKey: qk.neighborhood });
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const move = useMutation({
    mutationFn: (body: MoveBody) => api<{ user: Me; neighborhood: NeighborhoodDTO }>("/api/neighborhood/move", { method: "POST", body }),
    onSuccess: ({ user, neighborhood }) => {
      qc.clear();
      qc.setQueryData(qk.me, user);
      qc.setQueryData(qk.neighborhood, neighborhood);
      setMoving(false);
      toast(`Welcome to ${neighborhood.name}! 🏡`);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const nextMatch = me.lastMovedAt ? new Date(Date.parse(me.lastMovedAt) + MOVE_COOLDOWN_DAYS * 86_400_000) : null;
  const canMatch = !nextMatch || nextMatch.getTime() <= Date.now();
  // Show the new position right away while the request is in flight (it snaps back if it fails).
  const wantsPrivate = privacy.isPending ? privacy.variables : me.wantsPrivate;
  const othersWantPrivate = !!hood?.inviteOnly && !me.wantsPrivate;

  const confirmMove = (e: React.FormEvent) => {
    e.preventDefault();
    if (choice.mode === "match" && !canMatch) {
      return toast(`You can be matched again on ${nextMatch!.toLocaleDateString()}.`, "error");
    }
    const where =
      choice.mode === "solo" ? "start a street of your own" : choice.mode === "invite" ? "move to your friend's street" : "be matched with strangers";
    const extra =
      choice.mode === "match"
        ? ` Your new street will be open to new people, and you can't be matched again for ${MOVE_COOLDOWN_DAYS} days.`
        : "";
    if (window.confirm(`Leave ${hood?.name ?? "your street"} and ${where}?${extra}`)) move.mutate(startBody(choice));
  };

  return (
    <div className="card stack">
      <h2>Neighborhood</h2>

      <label className="switch">
        <input
          type="checkbox"
          checked={wantsPrivate}
          disabled={privacy.isPending}
          onChange={(e) => privacy.mutate(e.target.checked)}
        />
        <span className="stack stack-sm">
          <span className="bold">Invite only</span>
          <span className="small muted">
            {wantsPrivate ? (
              <>
                <span className="bold">On.</span> Only people with your street's invite link can move in. Splash never
                matches strangers onto your street.
              </>
            ) : (
              <>
                <span className="bold">Off.</span> When your street has empty homes, Splash may match people who share
                your interests onto it (unless a neighbor turned invite only on).
              </>
            )}
          </span>
          <span className="small muted">
            If anyone on the street turns this on, the whole street is invite only. Neighbors aren't told who did.
            Invite links always work, and nobody who already lives here is moved.
          </span>
          {othersWantPrivate && <span className="small bold">Your street is invite only right now, because a neighbor asked for it.</span>}
        </span>
      </label>

      <div className="stack stack-sm" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <h3>Move</h3>
        <p className="muted small">
          Streets are meant to stay put. If yours isn't a fit, start your own, join a friend's, or (if you must) be
          matched with strangers, which you can do once every {MOVE_COOLDOWN_DAYS} days.
        </p>
        {moving ? (
          <form className="stack" onSubmit={confirmMove}>
            <StartChoice value={choice} onChange={setChoice} />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-danger" disabled={move.isPending}>
                {move.isPending ? "Moving…" : "Move"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setMoving(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => setMoving(true)}>
            Move to a different street
          </button>
        )}
      </div>
    </div>
  );
}
