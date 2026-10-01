import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Dices, Timer, X } from "lucide-react";
import type { WritingContent } from "@splash/shared";
import { ShareSheet } from "../../components/ShareSheet";
import { ErrorState, Spinner } from "../../components/States";
import { useToast } from "../../lib/toast";
import { formatDuration, plural, useLocalState } from "../../lib/util";
import { TOOLS } from "../registry";
import { ToolHeader } from "../ToolHeader";
import { useEditorSource, type EditorSource } from "../useEditorSource";
import { ACROSTIC_WORDS, CHALLENGES, words } from "./challenges";
import { dailyPrompt, randomPrompt } from "./prompts";
import "./writing.css";

type Mode = "prompt" | "challenge" | "free";

interface Draft {
  text: string;
  mode: Mode;
  prompt: string;
  challengeId: string;
  acrosticWord: string;
}

const DRAFT_KEY = "splash.draft.writing";
const pickWord = () => ACROSTIC_WORDS[Math.floor(Math.random() * ACROSTIC_WORDS.length)];

function encouragement(count: number) {
  if (count >= 600) return "Whoa. Novelist energy. ✨";
  if (count >= 300) return "That's a whole page!";
  if (count >= 150) return "Look at you go!";
  if (count >= 50) return "You're on a roll.";
  if (count >= 10) return "Nice start!";
  return "";
}

function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.18;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1);
    });
    setTimeout(() => void ctx.close(), 2000);
  } catch {
    // Audio not available; the toast is enough.
  }
}

export default function WritingEditor() {
  const source = useEditorSource("writing");
  if (source.loading) return <Spinner />;
  if (source.error) return <ErrorState error={source.error} />;
  return <Editor key={source.post?.id ?? "new"} source={source} />;
}

function initialDraft(source: EditorSource<"writing">, params: URLSearchParams): Draft {
  const c = source.post?.content;
  const base: Draft = { text: "", mode: "prompt", prompt: dailyPrompt().text, challengeId: "six", acrosticWord: pickWord() };
  if (c) {
    // A remix of writing = your own take on the same prompt or challenge.
    const challengeWord = c.challenge?.detail?.replace(/^Spell:\s*/, "");
    return {
      ...base,
      text: source.mode === "edit" ? c.text : "",
      mode: c.challenge ? "challenge" : c.prompt ? "prompt" : "free",
      prompt: c.prompt ?? base.prompt,
      challengeId: c.challenge?.id ?? base.challengeId,
      acrosticWord: challengeWord || base.acrosticWord,
    };
  }
  if (params.get("prompt")) return { ...base, prompt: params.get("prompt")! };
  return base;
}

function Editor({ source }: { source: EditorSource<"writing"> }) {
  const [params] = useSearchParams();
  const toast = useToast();
  const isNew = source.mode === "new";
  const [draft, setDraft] = useLocalState<Draft>(isNew ? DRAFT_KEY : null, () => initialDraft(source, params));
  const [sharing, setSharing] = useState(false);
  const [sprintEnd, setSprintEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const textRef = useRef<HTMLTextAreaElement>(null);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  // Links like "today's prompt" override whatever prompt the saved draft had (but keep its text).
  useEffect(() => {
    if (!isNew) return;
    if (params.get("daily")) update({ mode: "prompt", prompt: dailyPrompt().text });
    else if (params.get("prompt")) update({ mode: "prompt", prompt: params.get("prompt")! });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grow the textarea with its content.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.text]);

  // Sprint timer.
  useEffect(() => {
    if (!sprintEnd) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= sprintEnd) {
        setSprintEnd(null);
        chime();
        toast(`Time! You wrote ${plural(words(textRef.current?.value ?? "").length, "word")}. 🎉`);
      }
    }, 500);
    return () => clearInterval(id);
  }, [sprintEnd, toast]);

  const count = words(draft.text).length;
  const challenge = CHALLENGES.find((c) => c.id === draft.challengeId) ?? CHALLENGES[0];
  const result = challenge.check(draft.text, draft.acrosticWord);

  const getContent = (): WritingContent => ({
    text: draft.text,
    ...(draft.mode === "prompt" ? { prompt: draft.prompt } : {}),
    ...(draft.mode === "challenge"
      ? {
          challenge: {
            id: challenge.id,
            label: challenge.label,
            detail: challenge.needsWord ? `Spell: ${draft.acrosticWord}` : undefined,
            met: result.met,
          },
        }
      : {}),
  });

  return (
    <div className="container stack">
      <ToolHeader
        tool={TOOLS.writing}
        title={source.mode === "edit" ? "Edit writing" : "Write"}
        subtitle={source.mode === "remix" ? `Your take on ${source.post?.author.displayName}'s ${source.post?.content.challenge ? "challenge" : "prompt"}` : undefined}
        onDone={() => setSharing(true)}
        doneDisabled={!draft.text.trim()}
      />

      <div className="segmented" role="group" aria-label="Writing mode" style={{ alignSelf: "flex-start" }}>
        {(["prompt", "challenge", "free"] as Mode[]).map((m) => (
          <button key={m} aria-pressed={draft.mode === m} onClick={() => update({ mode: m })}>
            {m === "prompt" ? "Prompt" : m === "challenge" ? "Challenge" : "Blank page"}
          </button>
        ))}
      </div>

      {draft.mode === "prompt" && (
        <div className="prompt-card">
          <p className="display">{draft.prompt}</p>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => update({ prompt: randomPrompt(draft.prompt).text })} aria-label="Different prompt" title="Different prompt">
            <Dices size={20} />
          </button>
        </div>
      )}

      {draft.mode === "challenge" && (
        <div className="stack stack-sm">
          <div className="chips">
            {CHALLENGES.map((c) => (
              <button key={c.id} className="chip" aria-pressed={c.id === challenge.id} onClick={() => update({ challengeId: c.id })}>
                <span aria-hidden="true">{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>
          <div className={`challenge-status${result.met ? " met" : ""}`}>
            <div className="grow">
              <p className="bold">
                {challenge.description}
                {challenge.needsWord && (
                  <>
                    {" "}
                    Spell <span className="acrostic-word">{draft.acrosticWord}</span>{" "}
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ verticalAlign: "middle" }} onClick={() => update({ acrosticWord: pickWord() })} aria-label="Different word">
                      <Dices size={16} />
                    </button>
                  </>
                )}
              </p>
              <p className="small">{result.met ? `✓ ${result.status}` : result.status}</p>
            </div>
          </div>
        </div>
      )}

      <div className="paper">
        <textarea
          ref={textRef}
          className="paper-text"
          value={draft.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder={draft.mode === "challenge" && challenge.id === "haiku" ? "An old silent pond…" : "Just start. You can't do this wrong."}
          aria-label="Your writing"
          spellCheck
          autoFocus={!source.post}
        />
      </div>

      <div className="writing-foot">
        <span className="bold">{plural(count, "word")}</span>
        <span className="encourage">{encouragement(count)}</span>
        <span className="grow" />
        {sprintEnd ? (
          <span className="row" style={{ gap: 4 }}>
            <Timer size={16} />
            <span className="bold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatDuration(Math.max(0, sprintEnd - now))}
            </span>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSprintEnd(null)} aria-label="Stop timer">
              <X size={16} />
            </button>
          </span>
        ) : (
          <span className="row" style={{ gap: 4 }}>
            <Timer size={16} className="muted" />
            <span className="small muted">Sprint:</span>
            {[5, 10, 15].map((min) => (
              <button
                key={min}
                className="btn btn-ghost btn-sm"
                style={{ padding: "0 8px" }}
                onClick={() => {
                  setNow(Date.now());
                  setSprintEnd(Date.now() + min * 60_000);
                  textRef.current?.focus();
                }}
              >
                {min}m
              </button>
            ))}
          </span>
        )}
      </div>

      <ShareSheet
        open={sharing}
        onClose={() => setSharing(false)}
        kind="writing"
        source={source}
        getContent={getContent}
        draftKey={isNew ? DRAFT_KEY : undefined}
        suggestedTitle={draft.mode === "challenge" ? challenge.label : undefined}
      />
    </div>
  );
}
