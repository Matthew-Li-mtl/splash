import { useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { AVATAR_COLORS, AVATAR_EMOJIS, USERNAME_PATTERN, type Avatar } from "@splash/shared";
import { Logo } from "../components/Logo";
import { AvatarPicker, InterestPicker } from "../components/Pickers";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";

export function Welcome() {
  // Only bounce people who arrive already signed in. Signing in or up here
  // navigates on its own (e.g. to the "moved in" screen), so don't race it.
  const { signedIn } = useAuth();
  const [arrivedSignedIn] = useState(signedIn);
  if (arrivedSignedIn) return <Navigate to="/" replace />;

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
          Make small things. Share them with 20 neighbors. That's it.
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
            <span className="bold">Make something in minutes.</span> Write, collage, make a tune, solve a puzzle. No
            learning curve.
          </p>
        </div>
        <div className="feature">
          <span className="feature-emoji">🏘️</span>
          <p>
            <span className="bold">Twenty neighbors, not a million strangers.</span> The same small group, so you
            actually get to know each other.
          </p>
        </div>
        <div className="feature">
          <span className="feature-emoji">🌙</span>
          <p>
            <span className="bold">A feed that ends.</span> Catch up with your street, then go live your life.
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

const randomItem = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState<Avatar>(() => ({ emoji: randomItem(AVATAR_EMOJIS), color: randomItem(AVATAR_COLORS) }));
  const [interests, setInterests] = useState<string[]>([]);
  const [inviteCode, setInviteCode] = useState(params.get("invite") ?? "");
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
      await register({ displayName, username, password, avatar, interests, inviteCode: inviteCode.trim() || undefined });
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
        <span className="label">Pick your look</span>
        <AvatarPicker value={avatar} onChange={setAvatar} name={displayName} />
      </div>
      <div className="field">
        <span className="label">What are you into?</span>
        <span className="hint">We'll try to put you on a street with people who like similar things.</span>
        <InterestPicker value={interests} onChange={setInterests} />
      </div>
      <label className="field">
        <span className="label">Invite code (optional)</span>
        <input className="input" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="From a friend's neighborhood" autoCapitalize="none" />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="btn btn-accent btn-block" disabled={busy}>
        {busy ? "Finding your street…" : "Move in"}
      </button>
    </form>
  );
}
