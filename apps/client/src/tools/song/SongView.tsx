import { Play, Square } from "lucide-react";
import type { ViewerProps } from "../registry";
import { player, usePlayer } from "./audio";
import { DRUM_COLORS, ROOTS, SCALES, rowCount, rowHue, totalSteps } from "./music";
import "./song.css";

/** A mini piano-roll of all three tracks, with a play button. */
export default function SongView({ post }: ViewerProps<"song">) {
  const song = post.content;
  const owner = `post-${post.id}`;
  const { playing, step } = usePlayer(owner);
  const steps = totalSteps(song);
  const melodyRows = rowCount(song, "melody");
  const bassRows = rowCount(song, "bass");

  // Layout in SVG units: melody on top, bass in the middle, drums along the bottom.
  const W = steps * 10;
  const melodyH = melodyRows * 5;
  const bassH = bassRows * 4;
  const drumH = 4 * 4;
  const gap = 6;
  const H = melodyH + gap + bassH + gap + drumH;
  // Stretch to a pleasant banner shape no matter how long the song is.
  const ratio = Math.min(5, Math.max(2.2, (W + 4) / (H + 4)));

  return (
    <div className="stack stack-sm">
      <svg className="song-mini" viewBox={`-2 -2 ${W + 4} ${H + 4}`} preserveAspectRatio="none" style={{ aspectRatio: ratio }} role="img" aria-label="Song notes">
        {playing && step >= 0 && <rect x={step * 10} y={-2} width={10} height={H + 4} fill="rgba(45,38,32,0.08)" />}
        {song.melody.notes.map(([s, r]) => (
          <rect key={`m${s}-${r}`} x={s * 10 + 1} y={(melodyRows - 1 - r) * 5} width={8} height={4.2} rx={1.5} fill={`hsl(${rowHue(song, r)} 68% 58%)`} />
        ))}
        {song.bass.notes.map(([s, r]) => (
          <rect key={`b${s}-${r}`} x={s * 10 + 1} y={melodyH + gap + (bassRows - 1 - r) * 4} width={8} height={3.4} rx={1.2} fill={`hsl(${rowHue(song, r)} 55% 42%)`} />
        ))}
        {song.drums.notes.map(([s, r]) => (
          <circle key={`d${s}-${r}`} cx={s * 10 + 5} cy={melodyH + gap + bassH + gap + (3 - r) * 4 + 2} r={1.8} fill={DRUM_COLORS[r]} />
        ))}
      </svg>
      <div className="row">
        <button
          className={`btn btn-sm${playing ? " on" : ""}`}
          onClick={() => (playing ? player.stop(owner) : player.play(owner, song))}
          aria-label={playing ? "Stop" : "Play song"}
        >
          {playing ? <Square size={14} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          {playing ? "Stop" : "Play"}
        </button>
        <span className="tiny muted">
          {song.bpm} bpm · {ROOTS[song.root]} {SCALES[song.scale].name.split(" (")[0].toLowerCase()} · {song.bars} bar{song.bars > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
