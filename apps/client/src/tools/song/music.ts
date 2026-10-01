import type { BassInstrument, MelodyInstrument, NoteCell, ScaleId, SongContent } from "@splash/shared";

export const SCALES: Record<ScaleId, { name: string; steps: number[] }> = {
  pentatonic: { name: "Pentatonic (can't go wrong)", steps: [0, 2, 4, 7, 9] },
  major: { name: "Major (bright)", steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: "Minor (moody)", steps: [0, 2, 3, 5, 7, 8, 10] },
  minorPentatonic: { name: "Minor pentatonic", steps: [0, 3, 5, 7, 10] },
  blues: { name: "Blues", steps: [0, 3, 5, 6, 7, 10] },
};

export const ROOTS = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export const MELODY_INSTRUMENTS: { id: MelodyInstrument; name: string; emoji: string }[] = [
  { id: "marimba", name: "Marimba", emoji: "🪵" },
  { id: "piano", name: "Keys", emoji: "🎹" },
  { id: "synth", name: "Synth", emoji: "👾" },
  { id: "pad", name: "Dreamy", emoji: "☁️" },
  { id: "bell", name: "Bells", emoji: "🔔" },
];

export const BASS_INSTRUMENTS: { id: BassInstrument; name: string; emoji: string }[] = [
  { id: "pluck", name: "Pluck", emoji: "🎸" },
  { id: "sub", name: "Deep", emoji: "🌊" },
  { id: "fuzz", name: "Fuzz", emoji: "⚡" },
];

export type TrackId = "melody" | "bass" | "drums";

/** Melody spans two octaves (plus the top root); bass spans one, two octaves lower. */
export function rowCount(song: SongContent, track: TrackId) {
  if (track === "drums") return 4;
  const n = SCALES[song.scale].steps.length;
  return track === "melody" ? n * 2 + 1 : n + 1;
}

export function rowToMidi(song: SongContent, track: "melody" | "bass", row: number) {
  const steps = SCALES[song.scale].steps;
  const base = track === "melody" ? 60 : 36;
  return base + song.root + 12 * Math.floor(row / steps.length) + steps[row % steps.length];
}

export const totalSteps = (song: SongContent) => song.bars * 4 * song.stepsPerBeat;

/** Color by scale degree, so the same note looks the same in every octave. */
export function rowHue(song: SongContent, row: number) {
  const n = SCALES[song.scale].steps.length;
  return Math.round(((row % n) / n) * 330 + 8);
}

export const DRUM_COLORS = ["#3d405b", "#e07a5f", "#e2a93b", "#a173b3"];

export function emptySong(): SongContent {
  return {
    bpm: 108,
    bars: 2,
    stepsPerBeat: 2,
    scale: "pentatonic",
    root: 0,
    melody: { instrument: "marimba", notes: [] },
    bass: { instrument: "pluck", notes: [] },
    drums: { notes: [] },
  };
}

/** Keep notes in range after changing length or scale. */
export function clampNotes(song: SongContent): SongContent {
  const steps = totalSteps(song);
  const fit = (notes: NoteCell[], rows: number) => notes.filter(([s, r]) => s < steps && r < rows);
  return {
    ...song,
    melody: { ...song.melody, notes: fit(song.melody.notes, rowCount(song, "melody")) },
    bass: { ...song.bass, notes: fit(song.bass.notes, rowCount(song, "bass")) },
    drums: { notes: fit(song.drums.notes, 4) },
  };
}

/** Re-time notes when switching between e.g. eighth and sixteenth notes. */
export function changeResolution(song: SongContent, stepsPerBeat: number): SongContent {
  const remap = (notes: NoteCell[]) =>
    notes
      .map(([s, r]): NoteCell | null => {
        const next = (s * stepsPerBeat) / song.stepsPerBeat;
        return Number.isInteger(next) ? [next, r] : null;
      })
      .filter((n): n is NoteCell => n !== null);
  return {
    ...song,
    stepsPerBeat,
    melody: { ...song.melody, notes: remap(song.melody.notes) },
    bass: { ...song.bass, notes: remap(song.bass.notes) },
    drums: { notes: remap(song.drums.notes) },
  };
}

/**
 * A friendly starting point: a basic beat and a bassline walking through a
 * classic chord loop, so a blank grid never feels intimidating.
 */
export function starterGroove(song: SongContent): SongContent {
  const spb = song.stepsPerBeat;
  const drums: NoteCell[] = [];
  const bass: NoteCell[] = [];
  const degreesInScale = SCALES[song.scale].steps.length;
  // I – V – vi – IV, approximated to the nearest available scale degree.
  const loop = degreesInScale >= 7 ? [0, 4, 5, 3] : [0, 3, 4, 2];
  for (let bar = 0; bar < song.bars; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      const step = (bar * 4 + beat) * spb;
      if (beat === 0 || beat === 2) drums.push([step, 0]);
      if (beat === 1 || beat === 3) drums.push([step, 1]);
      for (let sub = 0; sub < spb; sub += Math.max(1, spb / 2)) drums.push([step + sub, 2]);
    }
    const degree = loop[bar % loop.length];
    bass.push([bar * 4 * spb, degree], [(bar * 4 + 2) * spb, degree], [(bar * 4 + 3) * spb + spb / 2, degree]);
  }
  return {
    ...song,
    drums: { notes: drums.filter(([s]) => Number.isInteger(s)) },
    bass: { ...song.bass, notes: bass.filter(([s]) => Number.isInteger(s)) },
  };
}
