import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { Layout } from "./components/Layout";
import { Spinner, WakingUp } from "./components/States";
import { useAuth } from "./lib/auth";
import { Home } from "./pages/Home";
import { Make } from "./pages/Make";
import { Play } from "./pages/Play";
import { Talk } from "./pages/Talk";
import { Thread } from "./pages/Thread";
import { Neighbors } from "./pages/Neighbors";
import { Profile } from "./pages/Profile";
import { PostPage } from "./pages/PostPage";
import { Settings } from "./pages/Settings";
import { Welcome } from "./pages/Welcome";
import { MovedIn } from "./pages/MovedIn";

// Tools and games are code-split: each loads only when opened.
const WritingEditor = lazy(() => import("./tools/writing/WritingEditor"));
const CollageEditor = lazy(() => import("./tools/collage/CollageEditor"));
const SongEditor = lazy(() => import("./tools/song/SongEditor"));
const SudokuPage = lazy(() => import("./tools/sudoku/SudokuPage"));
const MinesweeperPage = lazy(() => import("./tools/minesweeper/MinesweeperPage"));
const GamePage = lazy(() => import("./games/GamePage"));

function RequireAuth({ children }: { children: ReactNode }) {
  const { signedIn, user, loading } = useAuth();
  const location = useLocation();
  if (!signedIn) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  if (loading || !user) return <WakingUp />;
  return children;
}

export function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/welcome/*" element={<Welcome />} />
        <Route
          path="/moved-in"
          element={
            <RequireAuth>
              <MovedIn />
            </RequireAuth>
          }
        />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Home />} />
          <Route path="make" element={<Make />} />
          <Route path="make/write" element={<WritingEditor />} />
          <Route path="make/collage" element={<CollageEditor />} />
          <Route path="make/song" element={<SongEditor />} />
          <Route path="play" element={<Play />} />
          <Route path="play/sudoku" element={<SudokuPage />} />
          <Route path="play/minesweeper" element={<MinesweeperPage />} />
          <Route path="play/game/:id" element={<GamePage />} />
          <Route path="talk" element={<Talk />} />
          <Route path="talk/:channel" element={<Thread />} />
          <Route path="neighbors" element={<Neighbors />} />
          <Route path="u/:username" element={<Profile />} />
          <Route path="p/:id" element={<PostPage />} />
          <Route path="me" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
