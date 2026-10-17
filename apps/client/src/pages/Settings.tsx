import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import type { AuthResponse, Me, UpdateMeBody } from "@splash/shared";
import { DevicesCard } from "../components/DevicesCard";
import { InterestPicker, PhotoPicker } from "../components/Pickers";
import { api, assetUrl, errorMessage } from "../lib/api";
import { useAuth, useMeStrict } from "../lib/auth";
import { PROFILE_PHOTO, uploadImage } from "../lib/image";
import { qk } from "../lib/queries";
import { useToast } from "../lib/toast";
import { BlockedCard } from "../components/BlockedCard";
import { StreetSettings } from "../components/StreetSettings";

export function Settings() {
  const me = useMeStrict();
  const { logout, adoptSession } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();

  const [displayName, setDisplayName] = useState(me.displayName);
  const [bio, setBio] = useState(me.bio);
  const [interests, setInterests] = useState(me.interests);
  const [photoBusy, setPhotoBusy] = useState(false);
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

  // Photo changes save right away, separate from the rest of the profile form.
  const setPhoto = async (file: File | null) => {
    setPhotoBusy(true);
    try {
      const photoId = file ? (await uploadImage(file, PROFILE_PHOTO)).id : null;
      qc.setQueryData(qk.me, await api<Me>("/api/me", { method: "PATCH", body: { photoId } }));
      void qc.invalidateQueries({ queryKey: qk.neighborhood });
      toast(file ? "Looking good!" : "Photo removed.");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  const changePassword = useMutation({
    mutationFn: () => api<AuthResponse>("/api/me/password", { method: "POST", body: { current, next } }),
    onSuccess: (session) => {
      // The server signed out every device and started a new session for this one.
      adoptSession(session);
      void qc.invalidateQueries({ queryKey: ["sessions"] });
      setCurrent("");
      setNext("");
      toast("Password changed. Other devices were signed out.");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <div className="container stack stack-lg">
      <div className="page-head">
        <div>
          <h1>You</h1>
          <p>
            <Link to={`/u/${me.username}`}>See your shelf</Link>
          </p>
        </div>
        <button className="btn btn-sm" onClick={() => void logout()}>
          <LogOut size={16} /> Sign out
        </button>
      </div>

      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          saveProfile.mutate({ displayName, bio, interests });
        }}
      >
        <h2>Profile</h2>
        <div className="field">
          <span className="label">Photo</span>
          <PhotoPicker
            src={me.photoId && assetUrl(me.photoId)}
            name={displayName}
            username={me.username}
            busy={photoBusy}
            onPick={(file) => void setPhoto(file)}
            onRemove={() => void setPhoto(null)}
          />
        </div>
        <label className="field">
          <span className="label">Name</span>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} required />
        </label>
        <label className="field">
          <span className="label">A little about you</span>
          <textarea className="textarea" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} placeholder="Amateur baker, terrible at chess, learning ukulele." />
        </label>
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

      <DevicesCard />

      <StreetSettings />

      <BlockedCard />
    </div>
  );
}
