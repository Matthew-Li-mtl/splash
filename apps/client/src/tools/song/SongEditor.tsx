import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Eraser, Play, Settings2, Sparkles, Square } from "lucide-react";
import { DRUM_ROWS, type NoteCell, type ScaleId, type SongContent } from "@splash/shared";
import { ShareSheet } from "../../components/ShareSheet";
import { ErrorState, Spinner } from "../../components/States";
import { useLocalState } from "../../lib/util";
import { TOOLS } from "../registry";
import { ToolHeader } from "../ToolHeader";
import { useEditorSource, type EditorSource } from "../useEditorSource";
import { player, previewNote, usePlayer } from "./audio";
import {
  BASS_INSTRUMENTS,
  DRUM_COLORS,
  MELODY_INSTRUMENTS,
  ROOTS,
  SCALES,
  changeResolution,
  clampNotes,
  emptySong,
  rowCount,
  rowHue,
  starterGroove,
  totalSteps,
  type TrackId,
} from "./music";
import "./song.css";

const DRAFT_KEY = "splash.draft.song";
const OWNER = "song-editor";

export default function SongEditor() {
  const source = useEditorSource("song");
  if (source.loading) return <Spinner />;
  if (source.error) return <ErrorState error={source.error} />;
  return <Editor key={source.post?.id ?? "new"} source={source} />;
}

const TRACKS: { id: TrackId; label: string; emoji: string }[] = [
  { id: "melody", label: "Melody", emoji: "🎹" },
  { id: "bass", label: "Bass", emoji: "🎸" },
  { id: "drums", label: "Drums", emoji: "🥁" },
];

function Editor({ source }: { source: EditorSource<"song"> }) {
  const isNew = source.mode === "new";
  const [song, setSong] = useLocalState<SongContent>(isNew ? DRAFT_KEY : null, () => source.post?.content ?? emptySong());
  const [track, setTrack] = useState<TrackId>("melody");
  const [showSettings, setShowSettings] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { playing, step: playStep } = usePlayer(OWNER);

  // Keep the sequencer in sync with edits; stop when leaving the page.
  useEffect(() => player.update(OWNER, song), [song]);
  useEffect(() => () => player.stop(OWNER), []);

  const notes = track === "drums" ? song.drums.notes : song[track].notes;
  const rows = rowCount(song, track);
  const steps = totalSteps(song);
  const active = useMemo(() => new Set(notes.map(([s, r]) => `${s}:${r}`)), [notes]);
  const empty = !song.melody.notes.length && !song.bass.notes.length && !song.drums.notes.length;

  const setNotes = (next: NoteCell[]) =>
    setSong((s) => (track === "drums" ? { ...s, drums: { notes: next } } : { ...s, [track]: { ...s[track], notes: next } }));

  // ----- painting: click/drag with a mouse, tap on touch screens (so swiping still scrolls) -----
  const paint = useRef<{ on: boolean } | null>(null);
  const lastPointer = useRef<string>("mouse");

  const setCell = (s: number, r: number, on: boolean) => {
    const key = `${s}:${r}`;
    if (active.has(key) === on) return;
    if (on) previewNote(song, track, r);
    setNotes(on ? [...notes, [s, r]] : notes.filter(([ns, nr]) => ns !== s || nr !== r));
  };

  const cellFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-cell]");
    if (!el) return null;
    return { s: Number(el.dataset.step), r: Number(el.dataset.row) };
  };

  useEffect(() => {
    const up = () => (paint.current = null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    lastPointer.current = e.pointerType;
    if (e.pointerType !== "mouse") return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    e.preventDefault();
    const on = !active.has(`${cell.s}:${cell.r}`);
    paint.current = { on };
    setCell(cell.s, cell.r, on);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!paint.current || e.pointerType !== "mouse") return;
    const cell = cellFromEvent(e);
    if (cell) setCell(cell.s, cell.r, paint.current.on);
  };

  const onClick = (e: React.MouseEvent) => {
    if (lastPointer.current === "mouse") return;
    const cell = cellFromEvent(e);
    if (cell) setCell(cell.s, cell.r, !active.has(`${cell.s}:${cell.r}`));
  };

  const togglePlay = () => (playing ? player.stop(OWNER) : player.play(OWNER, song));

  const rowLabel = (r: number) => (track === "drums" ? DRUM_ROWS[r] : "");
  const cellColor = (r: number) =>
    track === "drums" ? DRUM_COLORS[r] : `hsl(${rowHue(song, r)} 68% ${track === "bass" ? 46 : 58}%)`;

  return (
    <div className="container-wide stack">
      <ToolHeader
        tool={TOOLS.song}
        title={source.mode === "edit" ? "Edit song" : "Song maker"}
        subtitle={source.mode === "remix" ? `Remixing ${source.post?.author.displayName}'s song` : undefined}
        onDone={() => {
          player.stop(OWNER);
          setSharing(true);
        }}
        doneDisabled={empty}
      />

      <div className="song-transport panel">
        <button className={`btn play-btn${playing ? " on" : ""}`} onClick={togglePlay} aria-label={playing ? "Stop" : "Play"}>
          {playing ? <Square size={20} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>
        <label className="tempo">
          <span className="tiny muted bold">Tempo {song.bpm}</span>
          <input type="range" min={60} max={180} value={song.bpm} onChange={(e) => setSong((s) => ({ ...s, bpm: Number(e.target.value) }))} />
        </label>
        <div className="grow" />
        {empty && (
          <button className="btn btn-sm" onClick={() => setSong((s) => starterGroove(s))}>
            <Sparkles size={15} /> Give me a beat
          </button>
        )}
        <button className={`btn btn-sm btn-icon${showSettings ? " on" : ""}`} onClick={() => setShowSettings((v) => !v)} aria-label="Song settings" aria-expanded={showSettings}>
          <Settings2 size={18} />
        </button>
      </div>

      {showSettings && (
        <div className="panel song-settings">
          <label className="field">
            <span className="label">Scale</span>
            <select className="select" value={song.scale} onChange={(e) => setSong((s) => clampNotes({ ...s, scale: e.target.value as ScaleId }))}>
              {Object.entries(SCALES).map(([id, sc]) => (
                <option key={id} value={id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Key</span>
            <select className="select" value={song.root} onChange={(e) => setSong((s) => ({ ...s, root: Number(e.target.value) }))}>
              {ROOTS.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Length</span>
            <select className="select" value={song.bars} onChange={(e) => setSong((s) => clampNotes({ ...s, bars: Number(e.target.value) }))}>
              {[1, 2, 4, 8].map((b) => (
                <option key={b} value={b}>
                  {b} bar{b > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Grid</span>
            <select className="select" value={song.stepsPerBeat} onChange={(e) => setSong((s) => changeResolution(s, Number(e.target.value)))}>
              <option value={1}>Quarter notes</option>
              <option value={2}>Eighth notes</option>
              <option value={4}>Sixteenth notes</option>
            </select>
          </label>
        </div>
      )}

      <div className="row row-wrap spread" style={{ gap: 8 }}>
        <div className="segmented" role="group" aria-label="Track">
          {TRACKS.map((t) => (
            <button key={t.id} aria-pressed={track === t.id} onClick={() => setTrack(t.id)}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
        <div className="row row-wrap" style={{ gap: 6 }}>
          {track === "melody" &&
            MELODY_INSTRUMENTS.map((i) => (
              <button key={i.id} className="chip" aria-pressed={song.melody.instrument === i.id} onClick={() => setSong((s) => ({ ...s, melody: { ...s.melody, instrument: i.id } }))}>
                {i.emoji} {i.name}
              </button>
            ))}
          {track === "bass" &&
            BASS_INSTRUMENTS.map((i) => (
              <button key={i.id} className="chip" aria-pressed={song.bass.instrument === i.id} onClick={() => setSong((s) => ({ ...s, bass: { ...s.bass, instrument: i.id } }))}>
                {i.emoji} {i.name}
              </button>
            ))}
          <button className="btn btn-ghost btn-sm" onClick={() => setNotes([])} disabled={!notes.length} title="Clear this track">
            <Eraser size={15} /> Clear
          </button>
        </div>
      </div>

      <div className="song-scroll panel">
        <div
          className={`song-grid track-${track}`}
          style={{ "--steps": steps, "--rows": rows, "--spb": song.stepsPerBeat } as CSSProperties}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onClick={onClick}
          role="grid"
          aria-label={`${track} notes`}
        >
          {Array.from({ length: rows }, (_, i) => rows - 1 - i).map((r) => (
            <div key={r} className="song-row" role="row">
              {track === "drums" && <span className="drum-label">{rowLabel(r)}</span>}
              {Array.from({ length: steps }, (_, s) => {
                const on = active.has(`${s}:${r}`);
                const beatStart = s % song.stepsPerBeat === 0;
                const barStart = s % (song.stepsPerBeat * 4) === 0;
                return (
                  <div
                    key={s}
                    role="gridcell"
                    aria-selected={on}
                    data-cell=""
                    data-step={s}
                    data-row={r}
                    className={`song-cell${on ? " on" : ""}${s === playStep ? " now" : ""}${barStart ? " bar" : beatStart ? " beat" : ""}${Math.floor(s / (song.stepsPerBeat * 4)) % 2 ? " alt" : ""}`}
                    style={on ? ({ "--note": cellColor(r) } as CSSProperties) : undefined}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="tiny muted center">
        {track === "drums" ? "Tap to place a hit." : "Higher rows are higher notes. Tap to place one; click and drag to paint."} Changes play live.
      </p>

      <ShareSheet open={sharing} onClose={() => setSharing(false)} kind="song" source={source} getContent={() => song} draftKey={isNew ? DRAFT_KEY : undefined} suggestedTitle="A little tune" />
    </div>
  );
}
