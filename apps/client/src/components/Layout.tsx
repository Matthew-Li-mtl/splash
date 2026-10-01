import { NavLink, Outlet, useLocation, Link } from "react-router";
import { House, MessageCircle, Puzzle, Sparkles, Users, type LucideIcon } from "lucide-react";
import { useMeStrict } from "../lib/auth";
import { useBadges, useNeighborhood } from "../lib/queries";
import { Avatar } from "./Avatar";
import { Logo } from "./Logo";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  dot?: boolean;
}

export function Layout() {
  const me = useMeStrict();
  const { data: hood } = useNeighborhood();
  const { data: badges } = useBadges();
  const { pathname } = useLocation();
  // Editors get the whole screen on phones; they have their own back button.
  const immersive = pathname.startsWith("/make/");

  const nav: NavItem[] = [
    { to: "/", label: "Home", icon: House },
    { to: "/make", label: "Make", icon: Sparkles },
    { to: "/play", label: "Play", icon: Puzzle, dot: !!badges?.yourTurn },
    { to: "/talk", label: "Talk", icon: MessageCircle, dot: !!badges?.unreadThreads },
    { to: "/neighbors", label: "Neighbors", icon: Users },
  ];

  const links = nav.map(({ to, label, icon: Icon, dot }) => (
    <NavLink key={to} to={to} end={to === "/"}>
      <Icon size={22} strokeWidth={2} aria-hidden="true" />
      <span>{label}</span>
      {dot && <span className="nav-dot" aria-label="new" />}
    </NavLink>
  ));

  return (
    <div className={`app-shell${immersive ? " immersive" : ""}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <Logo />
            <span>
              Splash
              {hood && <small>{hood.name}</small>}
            </span>
          </Link>
          <nav className="topnav" aria-label="Main">
            {links}
          </nav>
          <Link to="/me" className="topbar-me" aria-label="Your profile and settings">
            <Avatar user={me} size={38} />
          </Link>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Main">
        {links}
      </nav>
    </div>
  );
}
