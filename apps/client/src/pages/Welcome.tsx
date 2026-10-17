import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { USERNAME_PATTERN, type Me } from "@splash/shared";
import { Logo } from "../components/Logo";
import { WakingUp } from "../components/States";
import { InterestPicker, PhotoPicker } from "../components/Pickers";
import { StartChoice, startBody, type StartChoiceValue } from "../components/StartChoice";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PROFILE_PHOTO, uploadImage } from "../lib/image";
import { qk } from "../lib/queries";
import { useToast } from "../lib/toast";

export function Welcome() {
  // Only bounce people who arrive already signed in. Signing in or up here
  // navigates on its own (e.g. to the "moved in" screen), so don't race it.
  const { status } = useAuth();
  const [arrivedAs] = useState(status);
  // Still restoring a session from the refresh cookie: wait rather than flash the form.
  if (status === "checking") return <WakingUp />;
  if (arrivedAs === "signedIn" || (arrivedAs === "checking" && status === "signedIn")) return <Navigate to="/" replace />;

  return (
    <div className="welcome">
      <div className="welcome-card">
        <Routes>
          <Route index element={<Landing />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
        </Routes>
      </div>
    </div>
  );
}

function Landing() {
  const [params] = useSearchParams();
  const invite = params.get("invite");
  const suffix = invite ? `?invite=${encodeURIComponent(invite)}` : "";
  return (
    <div className="stack stack-lg">
      <div className="stack center" style={{ alignItems: "center" }}>
        <Logo className="brand-mark" />
        <h1 className="hero-title">Splash</h1>
        <p className="display" style={{ fontSize: "1.2rem", color: "var(--ink-2)" }}>
          Welcome to your neighborhood.
        </p>
      </div>

      {invite && (
        <div className="card card-flat center">
          <span className="bold">You've been invited to a neighborhood!</span> 🏡
        </div>
      )}

      <div className="card stack">
        <div className="feature">
          <span className="feature-emoji">🎨</span>
          <p>
            <span className="bold">Start making in seconds.</span> No learning curve!
          </p>
        </div>
        <div className="feature">
          <span className="feature-emoji">🪴</span>
          <p>
            Make a space for yourself, and invite people whenever you
            like.
          </p>
        </div>
        <div className="feature">
          <span className="feature-emoji">🏘️</span>
          <p>
            Stay connected with up to 20 of your friends!
          </p>
        </div>
        <div className="feature">
          <span className="feature-emoji">🌙</span>
          <p>
            <span className="bold">This feed actually ends.</span> Catch up then go live life!
          </p>
        </div>
      </div>

      <div className="stack stack-sm">
        <Link to={`/welcome/signup${suffix}`} className="btn btn-accent btn-block">
          Move in
        </Link>
        <Link to="/welcome/login" className="btn btn-ghost btn-block">
          I already live here
        </Link>
      </div>
    </div>
  );
}

function BackLink({ to = "/welcome" }: { to?: string }) {
  return (
    <Link to={to} className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", marginLeft: -8 }}>
      <ArrowLeft size={18} /> Back
    </Link>
  );
}

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login({ username, password });
      navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <BackLink />
      <h1>Welcome home</h1>
      <label className="field">
        <span className="label">Username</span>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required />
      </label>
      <label className="field">
        <span className="label">Password</span>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "Opening the door…" : "Sign in"}
      </button>
      <p className="small muted center">
        New here? <Link to="/welcome/signup">Move in</Link>
      </p>
    </form>
  );
}

function Signup() {
  const { register } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const [interests, setInterests] = useState<string[]>([]);
  const [where, setWhere] = useState<StartChoiceValue>(() => {
    const invite = params.get("invite");
    return invite ? { mode: "invite", inviteCode: invite } : { mode: "solo", inviteCode: "" };
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const usernameOk = USERNAME_PATTERN.test(username);

  const next = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!usernameOk) return setError("Usernames are 3–20 characters: lowercase letters, numbers or underscores.");
    if (password.length < 8) return setError("Passwords need at least 8 characters.");
    setStep(2);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register({ displayName, username, password, interests, ...startBody(where) });
      // Uploads need an account, so the photo goes up once they've moved in.
      if (photo) {
        try {
          const { id } = await uploadImage(photo, PROFILE_PHOTO);
          qc.setQueryData(qk.me, await api<Me>("/api/me", { method: "PATCH", body: { photoId: id } }));
        } catch {
          toast("Your photo didn't upload. You can add it from your profile.", "error");
        }
      }
      navigate("/moved-in", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  if (step === 1) {
    return (
      <form className="card stack" onSubmit={next}>
        <BackLink />
        <div>
          <p className="section-title">Step 1 of 2</p>
          <h1>Let's get you a key</h1>
        </div>
        <label className="field">
          <span className="label">What should neighbors call you?</span>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} placeholder="Sam" required autoFocus />
        </label>
        <label className="field">
          <span className="label">Username</span>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, "_"))}
            autoComplete="username"
            autoCapitalize="none"
            placeholder="sam_paints"
            required
          />
          <span className="hint">Lowercase letters, numbers and underscores.</span>
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          <span className="hint">At least 8 characters.</span>
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block">Next</button>
      </form>
    );
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", marginLeft: -8 }} onClick={() => setStep(1)}>
        <ArrowLeft size={18} /> Back
      </button>
      <div>
        <p className="section-title">Step 2 of 2</p>
        <h1>Make yourself at home</h1>
      </div>
      <div className="field">
        <span className="label">Add a photo (optional)</span>
        <PhotoPicker src={preview} name={displayName} username={username} onPick={setPhoto} onRemove={() => setPhoto(null)} />
      </div>
      <div className="field">
        <span className="label">What are you into?</span>
        <span className="hint">Shown on your profile. If you ask to be matched, we'll look for people who like similar things.</span>
        <InterestPicker value={interests} onChange={setInterests} />
      </div>
      <div className="field">
        <span className="label">Where will you live?</span>
        <StartChoice value={where} onChange={setWhere} />
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="btn btn-accent btn-block" disabled={busy}>
        {busy ? "Moving in…" : "Move in"}
      </button>
    </form>
  );
}
