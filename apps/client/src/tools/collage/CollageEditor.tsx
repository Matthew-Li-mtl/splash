import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Camera,
  CopyPlus,
  Pencil,
  Redo2,
  Shapes,
  Sticker,
  Trash,
  Type,
  Undo2,
  Wallpaper,
} from "lucide-react";
import type { CollageContent, CollageElement, CollageImage, CollageText } from "@splash/shared";
import { ShareSheet } from "../../components/ShareSheet";
import { ErrorState, Spinner } from "../../components/States";
import { errorMessage } from "../../lib/api";
import { uploadImage } from "../../lib/image";
import { useToast } from "../../lib/toast";
import { clearLocal, uid } from "../../lib/util";
import { useHistory } from "../../lib/useHistory";
import { TOOLS } from "../registry";
import { ToolHeader } from "../ToolHeader";
import { useEditorSource, type EditorSource } from "../useEditorSource";
import { CollageStage, type StageHandlers } from "./CollageStage";
import { BACKGROUNDS, COLORS, FONTS, SHAPES, STICKERS } from "./palette";

const DRAFT_KEY = "splash.draft.collage";
const MAX_ELEMENTS = 200;

type Panel = "sticker" | "shape" | "background" | "draw" | null;
type Point = [number, number];
type NewElement = { [K in CollageElement["type"]]: Omit<Extract<CollageElement, { type: K }>, "id" | "x" | "y" | "rotation" | "scale"> }[CollageElement["type"]];

const jitter = (n: number) => (Math.random() * 2 - 1) * n;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function loadDraft(): CollageContent | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as CollageContent) : null;
  } catch {
    return null;
  }
}

/** Smooth a freehand stroke with quadratic curves through midpoints. */
function strokePath(points: Point[]): string {
  const r = Math.round;
  if (points.length === 1) return `M${r(points[0][0])} ${r(points[0][1])}l0.1 0`;
  let d = `M${r(points[0][0])} ${r(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    d += `Q${r(x1)} ${r(y1)} ${r((x1 + x2) / 2)} ${r((y1 + y2) / 2)}`;
  }
  const last = points[points.length - 1];
  return `${d}L${r(last[0])} ${r(last[1])}`;
}

export default function CollageEditor() {
  const source = useEditorSource("collage");
  if (source.loading) return <Spinner />;
  if (source.error) return <ErrorState error={source.error} />;
  return <Editor key={source.post?.id ?? "new"} source={source} />;
}

function Editor({ source }: { source: EditorSource<"collage"> }) {
  const isNew = source.mode === "new";
  const toast = useToast();
  const history = useHistory<CollageContent>(
    source.post?.content ?? (isNew ? loadDraft() : null) ?? { background: "cream", elements: [] },
  );
  const collage = history.value;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [color, setColor] = useState(COLORS[2]);
  const [drawWidth, setDrawWidth] = useState(8);
  const [stroke, setStroke] = useState<Point[] | null>(null);
  const [uploading, setUploading] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [focusText, setFocusText] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = collage.elements.find((e) => e.id === selectedId);

  // Autosave new collages locally so nothing is lost if the tab closes.
  useEffect(() => {
    if (!isNew) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(collage));
      } catch {
        // ignore
      }
    }, 400);
    return () => clearTimeout(id);
  }, [collage, isNew]);

  const mapEl = (c: CollageContent, id: string, patch: Partial<CollageElement>): CollageContent => ({
    ...c,
    elements: c.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as CollageElement) : e)),
  });
  const patchSelected = (patch: Partial<CollageElement>) => selectedId && history.commit((c) => mapEl(c, selectedId, patch));

  const add = (el: NewElement) => {
    if (collage.elements.length >= MAX_ELEMENTS) return toast("That's a full page! Remove something first.", "error");
    const full = { id: uid(), x: 400 + jitter(70), y: 480 + jitter(90), rotation: jitter(6), scale: 1, ...el } as CollageElement;
    history.commit((c) => ({ ...c, elements: [...c.elements, full] }));
    setSelectedId(full.id);
    setFocusText(full.type === "text");
    return full;
  };

  const onFiles = async (files: FileList | null) => {
    for (const file of Array.from(files ?? []).slice(0, 8)) {
      setUploading((n) => n + 1);
      try {
        const { id, width, height } = await uploadImage(file);
        let w = 360;
        let h = (w * height) / width;
        if (h > 440) {
          w = (w * 440) / h;
          h = 440;
        }
        add({ type: "image", assetId: id, w, h, frame: "polaroid" });
      } catch (err) {
        toast(errorMessage(err), "error");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  // ----- direct manipulation -----
  const gesture = useRef<
    | { kind: "move"; id: string; x0: number; y0: number; elX: number; elY: number }
    | { kind: "spin"; id: string; cx: number; cy: number; angle0: number; dist0: number; rot0: number; scale0: number }
    | null
  >(null);

  useEffect(() => {
    const scale = () => Number(stageRef.current?.dataset.scale) || 1;
    const move = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      if (g.kind === "move") {
        const s = scale();
        history.live((c) => mapEl(c, g.id, { x: clamp(g.elX + (e.clientX - g.x0) / s, 0, 800), y: clamp(g.elY + (e.clientY - g.y0) / s, 0, 1000) }));
      } else {
        const angle = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
        const dist = Math.hypot(e.clientX - g.cx, e.clientY - g.cy);
        let rotation = g.rot0 + ((angle - g.angle0) * 180) / Math.PI;
        const square = Math.round(rotation / 90) * 90;
        if (Math.abs(rotation - square) < 4) rotation = square; // gentle snap to straight
        history.live((c) => mapEl(c, g.id, { rotation, scale: clamp((g.scale0 * dist) / Math.max(g.dist0, 1), 0.12, 8) }));
      }
    };
    const up = () => {
      if (!gesture.current) return;
      gesture.current = null;
      history.end();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // history's methods are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlers: StageHandlers = {
    selectedId,
    onElementPointerDown(e, el) {
      e.stopPropagation();
      e.preventDefault();
      setSelectedId(el.id);
      setPanel(null);
      gesture.current = { kind: "move", id: el.id, x0: e.clientX, y0: e.clientY, elX: el.x, elY: el.y };
    },
    onHandlePointerDown(e, el) {
      e.stopPropagation();
      e.preventDefault();
      const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      gesture.current = {
        kind: "spin",
        id: el.id,
        cx,
        cy,
        angle0: Math.atan2(e.clientY - cy, e.clientX - cx),
        dist0: Math.hypot(e.clientX - cx, e.clientY - cy),
        rot0: el.rotation,
        scale0: el.scale,
      };
    },
    onBackgroundPointerDown() {
      setSelectedId(null);
    },
  };

  // ----- freehand drawing -----
  const stagePoint = (e: React.PointerEvent): Point => {
    const rect = stageRef.current!.getBoundingClientRect();
    const s = Number(stageRef.current!.dataset.scale) || 1;
    return [(e.clientX - rect.left) / s, (e.clientY - rect.top) / s];
  };

  const finishStroke = () => {
    if (!stroke || stroke.length === 0) return setStroke(null);
    const pad = drawWidth;
    const xs = stroke.map((p) => p[0]);
    const ys = stroke.map((p) => p[1]);
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const w = Math.max(Math.max(...xs) - minX + pad, 4);
    const h = Math.max(Math.max(...ys) - minY + pad, 4);
    const el = {
      id: uid(),
      type: "drawing" as const,
      x: minX + w / 2,
      y: minY + h / 2,
      w,
      h,
      scale: 1,
      rotation: 0,
      color,
      strokeWidth: drawWidth,
      path: strokePath(stroke.map(([x, y]) => [x - minX, y - minY])),
    };
    history.commit((c) => ({ ...c, elements: [...c.elements, el] }));
    setStroke(null);
  };

  const drawOverlay = (scale: number) =>
    panel === "draw" && (
      <div
        className="draw-layer"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setStroke([stagePoint(e)]);
        }}
        onPointerMove={(e) => {
          if (!stroke) return;
          const p = stagePoint(e);
          const last = stroke[stroke.length - 1];
          if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 3 / Math.max(scale, 0.3)) setStroke([...stroke, p]);
        }}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      >
        {stroke && (
          <svg width={800} height={1000} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <path d={strokePath(stroke)} fill="none" stroke={color} strokeWidth={drawWidth} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    );

  // ----- layer actions -----
  const removeSelected = () => {
    if (!selectedId) return;
    history.commit((c) => ({ ...c, elements: c.elements.filter((e) => e.id !== selectedId) }));
    setSelectedId(null);
  };
  const moveLayer = (dir: 1 | -1) =>
    history.commit((c) => {
      const i = c.elements.findIndex((e) => e.id === selectedId);
      const j = clamp(i + dir, 0, c.elements.length - 1);
      if (i < 0 || i === j) return c;
      const elements = c.elements.slice();
      [elements[i], elements[j]] = [elements[j], elements[i]];
      return { ...c, elements };
    });
  const duplicate = () => {
    if (!selected) return;
    const { id: _id, x, y, ...rest } = selected;
    add({ ...rest, x: x + 30, y: y + 30 } as unknown as NewElement);
  };

  // Keyboard shortcuts (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "Escape") {
        setSelectedId(null);
        setPanel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const togglePanel = (p: Panel) => {
    setSelectedId(null);
    setPanel((cur) => (cur === p ? null : p));
  };

  const toolButton = (label: string, icon: React.ReactNode, onClick: () => void, on = false) => (
    <button className={`btn btn-sm${on ? " on" : ""}`} onClick={onClick}>
      {icon} {label}
    </button>
  );

  return (
    <div className="container-wide stack">
      <ToolHeader
        tool={TOOLS.collage}
        title={source.mode === "edit" ? "Edit collage" : "Collage"}
        subtitle={source.mode === "remix" ? `Remixing ${source.post?.author.displayName}'s collage` : undefined}
        onDone={() => {
          setSelectedId(null);
          setPanel(null);
          setSharing(true);
        }}
        doneDisabled={collage.elements.length === 0 || uploading > 0}
      >
        <button className="btn btn-ghost btn-icon btn-sm" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo" title="Undo">
          <Undo2 size={18} />
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo" title="Redo">
          <Redo2 size={18} />
        </button>
      </ToolHeader>

      <div className="tool-tray">
        {toolButton(uploading ? "Adding…" : "Photo", <Camera size={16} />, () => fileRef.current?.click())}
        {toolButton("Text", <Type size={16} />, () => {
          setPanel(null);
          add({ type: "text", text: "Your words here", font: "hand", color: "#2d2620", size: 56, align: "center", w: 440, h: 80 });
        })}
        {toolButton("Sticker", <Sticker size={16} />, () => togglePanel("sticker"), panel === "sticker")}
        {toolButton("Shape", <Shapes size={16} />, () => togglePanel("shape"), panel === "shape")}
        {toolButton("Draw", <Pencil size={16} />, () => togglePanel("draw"), panel === "draw")}
        {toolButton("Paper", <Wallpaper size={16} />, () => togglePanel("background"), panel === "background")}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>

      <div className="collage-layout">
        <div className="collage-stage-wrap">
          <CollageStage collage={collage} edit={handlers} overlay={drawOverlay} stageRef={stageRef} />
        </div>

        <div className="collage-side panel stack">
          {panel === "sticker" && (
            <>
              <h3>Stickers</h3>
              <div className="mini-grid">
                {STICKERS.map((s) => (
                  <button key={s} onClick={() => add({ type: "sticker", emoji: s, w: 120, h: 120 })} aria-label={`Add ${s}`}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {panel === "shape" && (
            <>
              <h3>Shapes & paper</h3>
              <ColorRow value={color} onChange={setColor} />
              <div className="row row-wrap" style={{ gap: 6 }}>
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    className="btn btn-sm"
                    onClick={() => {
                      const size = { tape: [280, 64], torn: [320, 240], rect: [240, 240], circle: [220, 220], star: [220, 220], heart: [220, 200] }[s.id];
                      add({ type: "shape", shape: s.id, color, w: size[0], h: size[1] });
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {panel === "background" && (
            <>
              <h3>Paper</h3>
              <div className="mini-grid">
                {Object.entries(BACKGROUNDS).map(([id, bg]) => (
                  <button key={id} aria-pressed={collage.background === id} onClick={() => history.commit((c) => ({ ...c, background: id }))} title={bg.name} aria-label={bg.name}>
                    <span className="bg-swatch" style={{ ...bg.style, backgroundSize: "12px 12px" }} />
                  </button>
                ))}
              </div>
            </>
          )}

          {panel === "draw" && (
            <>
              <h3>Draw</h3>
              <p className="small muted">Draw right on the page. Each stroke becomes a piece you can move later.</p>
              <ColorRow value={color} onChange={setColor} />
              <label className="field">
                <span className="label small">Thickness</span>
                <input type="range" min={2} max={40} value={drawWidth} onChange={(e) => setDrawWidth(Number(e.target.value))} />
              </label>
              <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setPanel(null)}>
                Done drawing
              </button>
            </>
          )}

          {!panel && selected && (
            <ElementPanel
              el={selected}
              autoFocus={focusText}
              onChange={patchSelected}
              onLive={(patch) => selectedId && history.live((c) => mapEl(c, selectedId, patch))}
              onEnd={history.end}
              onTextFocus={() => setFocusText(false)}
            />
          )}

          {!panel && selected && (
            <div className="row row-wrap" style={{ gap: 6, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <button className="btn btn-sm" onClick={() => moveLayer(1)} title="Bring forward">
                <ArrowUpToLine size={15} /> Forward
              </button>
              <button className="btn btn-sm" onClick={() => moveLayer(-1)} title="Send backward">
                <ArrowDownToLine size={15} /> Back
              </button>
              <button className="btn btn-sm" onClick={duplicate} title="Duplicate">
                <CopyPlus size={15} /> Copy
              </button>
              <button className="btn btn-sm btn-danger" onClick={removeSelected} title="Delete">
                <Trash size={15} /> Remove
              </button>
            </div>
          )}

          {!panel && !selected && (
            <div className="stack stack-sm">
              <h3>{collage.elements.length ? "Keep going!" : "Start anywhere"}</h3>
              <p className="small muted">
                Add a photo, some words or a sticker. <span className="bold">Drag</span> pieces to move them, and use the{" "}
                <span className="bold">round handle</span> to spin and resize. Tap a piece to change it.
              </p>
              <p className="small muted">There's no wrong way to do this. Messy is charming.</p>
              {collage.elements.length > 0 && isNew && (
                <button
                  className="btn btn-ghost btn-sm btn-danger"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => {
                    if (!window.confirm("Start over with a blank page?")) return;
                    history.commit({ background: "cream", elements: [] });
                    clearLocal(DRAFT_KEY);
                  }}
                >
                  Start over
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ShareSheet open={sharing} onClose={() => setSharing(false)} kind="collage" source={source} getContent={history.get} draftKey={isNew ? DRAFT_KEY : undefined} suggestedTitle="A little collage" />
    </div>
  );
}

function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="swatches" role="group" aria-label="Color">
      {COLORS.map((c) => (
        <button key={c} className="swatch" style={{ background: c }} aria-pressed={value === c} aria-label={`Color ${c}`} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

function ElementPanel({
  el,
  autoFocus,
  onChange,
  onLive,
  onEnd,
  onTextFocus,
}: {
  el: CollageElement;
  autoFocus: boolean;
  onChange: (patch: Partial<CollageElement>) => void;
  /** Typing updates live and becomes one undo step when the field loses focus. */
  onLive: (patch: Partial<CollageElement>) => void;
  onEnd: () => void;
  onTextFocus: () => void;
}) {
  if (el.type === "text") {
    const patch = (p: Partial<CollageText>) => onChange(p);
    return (
      <div className="stack stack-sm">
        <h3>Text</h3>
        <textarea
          className="textarea"
          rows={3}
          value={el.text}
          maxLength={2000}
          autoFocus={autoFocus}
          onFocus={(e) => {
            onTextFocus();
            if (el.text === "Your words here") e.currentTarget.select();
          }}
          onChange={(e) => onLive({ text: e.target.value })}
          onBlur={onEnd}
        />
        <div className="chips">
          {FONTS.map((f) => (
            <button key={f.id} className="chip" aria-pressed={el.font === f.id} style={{ fontFamily: f.css }} onClick={() => patch({ font: f.id })}>
              {f.name}
            </button>
          ))}
        </div>
        <ColorRow value={el.color} onChange={(color) => patch({ color })} />
        <div className="row row-wrap" style={{ gap: 6 }}>
          <span className="small bold">Label:</span>
          {[undefined, "#ffffff", "#fbeab4", "#2d2620", "#f8ddd4"].map((bg) => (
            <button
              key={bg ?? "none"}
              className="swatch"
              style={{ background: bg ?? "repeating-linear-gradient(45deg, #fff 0 4px, #eee 4px 8px)", width: 28, height: 28 }}
              aria-pressed={el.background === bg}
              aria-label={bg ? `Label ${bg}` : "No label"}
              onClick={() => patch({ background: bg })}
            />
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Alignment" style={{ alignSelf: "flex-start" }}>
          {(["left", "center", "right"] as const).map((a) => (
            <button key={a} aria-pressed={el.align === a} onClick={() => patch({ align: a })}>
              {a[0].toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (el.type === "image") {
    return (
      <div className="stack stack-sm">
        <h3>Photo</h3>
        <div className="chips">
          {(["polaroid", "border", "round", "none"] as const).map((f) => (
            <button key={f} className="chip" aria-pressed={(el.frame ?? "none") === f} onClick={() => onChange({ frame: f } as Partial<CollageImage>)}>
              {f === "none" ? "No frame" : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (el.type === "shape" || el.type === "drawing") {
    return (
      <div className="stack stack-sm">
        <h3>{el.type === "shape" ? "Shape" : "Doodle"}</h3>
        <ColorRow value={el.color} onChange={(color) => onChange({ color })} />
        <label className="field">
          <span className="label small">See-through</span>
          <input type="range" min={0.2} max={1} step={0.05} value={el.opacity ?? 1} onChange={(e) => onChange({ opacity: Number(e.target.value) })} />
        </label>
      </div>
    );
  }
  return (
    <div className="stack stack-sm">
      <h3>Sticker {el.emoji}</h3>
      <p className="small muted">Drag the round handle to spin it or make it bigger.</p>
    </div>
  );
}
