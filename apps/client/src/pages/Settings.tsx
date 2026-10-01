import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { MOVE_COOLDOWN_DAYS, type Avatar, type Me, type NeighborhoodDTO, type UpdateMeBody } from "@splash/shared";
import { AvatarPicker, InterestPicker } from "../components/Pickers";
import { api, errorMessage } from "../lib/api";
import { useAuth, useMeStrict } from "../lib/auth";
import { qk, useNeighborhood } from "../lib/queries";
import { useToast } from "../lib/toast";

export function Settings() {
  const me = useMeStrict();
  const { logout } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: hood } = useNeighborhood();

  const [displayName, setDisplayName] = useState(me.displayName);
  const [bio, setBio] = useState(me.bio);
  const [avatar, setAvatar] = useState<Avatar>(me.avatar);
  const [interests, setInterests] = useState(me.interests);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  const saveProfile = useMutation({
    mutationFn: (body: UpdateMeBody) => api<Me>("/api/me", { method: "PATCH", body }),
    onSuccess: (user) => {
      qc.setQueryData(qk.me, user);
      void qc.invalidateQueries({ queryKey: qk.neighborhood });
      toast("Profile saved.");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const changePassword = useMutation({
    mutationFn: () => api("/api/me/password", { method: "POST", body: { current, next } }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      toast("Password changed.");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const move = useMutation({
    mutationFn: () => api<{ user: Me; neighborhood: NeighborhoodDTO }>("/api/neighborhood/move", { method: "POST" }),
    onSuccess: ({ user, neighborhood }) => {
      qc.clear();
      qc.setQueryData(qk.me, user);
      qc.setQueryData(qk.neighborhood, neighborhood);
      toast(`Welcome to ${neighborhood.name}! 🏡`);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const nextMove = me.lastMovedAt ? new Date(Date.parse(me.lastMovedAt) + MOVE_COOLDOWN_DAYS * 86_400_000) : null;
  const canMove = !nextMove || nextMove.getTime() <= Date.now();

  const confirmMove = () => {
    const ok = window.confirm(
      `Move away from ${hood?.name ?? "your neighborhood"}? You'll get a new set of neighbors, and you can't move again for ${MOVE_COOLDOWN_DAYS} days.`,
    );
    if (ok) move.mutate();
  };

  return (
    <div className="container stack stack-lg">
      <div className="page-head">
        <div>
          <h1>You</h1>
          <p>
            <Link to={`/u/${me.username}`}>See your shelf</Link>
          </p>
        </div>
        <button className="btn btn-sm" onClick={logout}>
          <LogOut size={16} /> Sign out
        </button>
      </div>

      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          saveProfile.mutate({ displayName, bio, avatar, interests });
        }}
      >
        <h2>Profile</h2>
        <label className="field">
          <span className="label">Name</span>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} required />
        </label>
        <label className="field">
          <span className="label">A little about you</span>
          <textarea className="textarea" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} placeholder="Amateur baker, terrible at chess, learning ukulele." />
        </label>
        <div className="field">
          <span className="label">Avatar</span>
          <AvatarPicker value={avatar} onChange={setAvatar} name={displayName} />
        </div>
        <div className="field">
          <span className="label">Interests</span>
          <InterestPicker value={interests} onChange={setInterests} />
        </div>
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={saveProfile.isPending}>
          {saveProfile.isPending ? "Saving…" : "Save profile"}
        </button>
      </form>

      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          changePassword.mutate();
        }}
      >
        <h2>Password</h2>
        <label className="field">
          <span className="label">Current password</span>
          <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </label>
        <label className="field">
          <span className="label">New password</span>
          <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
        </label>
        <button className="btn" style={{ alignSelf: "flex-start" }} disabled={changePassword.isPending}>
          Change password
        </button>
      </form>

      <div className="card stack">
        <h2>Neighborhood</h2>
        <p className="muted">
          Neighborhoods are meant to stay put, which is how strangers become friends. If yours really isn't a fit,
          you can move, once every {MOVE_COOLDOWN_DAYS} days.
        </p>
        <button className="btn btn-danger" style={{ alignSelf: "flex-start" }} onClick={confirmMove} disabled={!canMove || move.isPending}>
          {canMove ? "Move to a new neighborhood" : `You can move again on ${nextMove!.toLocaleDateString()}`}
        </button>
      </div>
    </div>
  );
}
