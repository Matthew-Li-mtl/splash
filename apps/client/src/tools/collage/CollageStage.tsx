import { useRef, type CSSProperties } from "react";
import { COLLAGE_HEIGHT, COLLAGE_WIDTH, type CollageContent, type CollageElement } from "@splash/shared";
import { assetUrl } from "../../lib/api";
import { useElementWidth } from "../../lib/util";
import { BACKGROUNDS, FONTS } from "./palette";
import "./collage.css";

/** What an element looks like, independent of where it sits. */
function ElementVisual({ el }: { el: CollageElement }) {
  switch (el.type) {
    case "image":
      return (
        <div className={`c-img frame-${el.frame ?? "none"}`}>
          <img src={assetUrl(el.assetId)} alt="" draggable={false} loading="lazy" />
        </div>
      );
    case "text":
      return (
        <div
          className="c-text"
          style={{
            fontFamily: FONTS.find((f) => f.id === el.font)?.css,
            fontSize: el.size * el.scale,
            color: el.color,
            textAlign: el.align,
            background: el.background || undefined,
            padding: el.background ? `${0.25 * el.size * el.scale}px ${0.4 * el.size * el.scale}px` : 0,
          }}
        >
          {el.text || " "}
        </div>
      );
    case "sticker":
      return (
        <div className="c-sticker" style={{ fontSize: el.w * el.scale * 0.82 }}>
          {el.emoji}
        </div>
      );
    case "shape":
      if (el.shape === "heart") {
        return (
          <svg viewBox="0 0 100 90" className="c-fill" preserveAspectRatio="none">
            <path d="M50 88 8 46C-6 30 4 4 26 4c11 0 19 7 24 15C55 11 63 4 74 4c22 0 32 26 18 42Z" fill={el.color} />
          </svg>
        );
      }
      return <div className={`c-shape shape-${el.shape}`} style={{ "--c": el.color } as CSSProperties} />;
    case "drawing":
      return (
        <svg viewBox={`0 0 ${el.w} ${el.h}`} className="c-fill" overflow="visible">
          <path d={el.path} fill="none" stroke={el.color} strokeWidth={el.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export interface StageHandlers {
  selectedId: string | null;
  onElementPointerDown(e: React.PointerEvent, el: CollageElement): void;
  onHandlePointerDown(e: React.PointerEvent, el: CollageElement): void;
  onBackgroundPointerDown(e: React.PointerEvent): void;
}

/**
 * Renders a collage at any size. The 800 × 1000 canvas is drawn in collage units
 * and scaled with a CSS transform, so the feed and the editor share one renderer.
 */
export function CollageStage({
  collage,
  edit,
  overlay,
  stageRef,
}: {
  collage: CollageContent;
  edit?: StageHandlers;
  overlay?: (scale: number) => React.ReactNode;
  stageRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [outerRef, width] = useElementWidth<HTMLDivElement>();
  const scale = width / COLLAGE_WIDTH || 0;
  const innerRef = useRef<HTMLDivElement>(null);
  const bg = BACKGROUNDS[collage.background] ?? BACKGROUNDS.cream;

  return (
    <div ref={outerRef} className={`c-stage${edit ? " editing" : ""}`}>
      <div
        ref={(node) => {
          innerRef.current = node;
          if (stageRef) stageRef.current = node;
        }}
        className="c-inner"
        style={{ ...bg.style, width: COLLAGE_WIDTH, height: COLLAGE_HEIGHT, transform: `scale(${scale})` }}
        onPointerDown={edit?.onBackgroundPointerDown}
        data-scale={scale}
      >
        {scale > 0 &&
          collage.elements.map((el, i) => {
            const selected = edit?.selectedId === el.id;
            return (
              <div
                key={el.id}
                className={`c-el c-${el.type}-el${selected ? " selected" : ""}`}
                style={
                  {
                    left: el.x,
                    top: el.y,
                    width: el.w * el.scale,
                    height: el.type === "text" ? "auto" : el.h * el.scale,
                    zIndex: i + 1,
                    opacity: el.opacity ?? 1,
                    transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
                    "--ui": 1 / scale,
                  } as CSSProperties
                }
                onPointerDown={edit ? (e) => edit.onElementPointerDown(e, el) : undefined}
              >
                <ElementVisual el={el} />
                {selected && (
                  <div className="c-handle" onPointerDown={(e) => edit!.onHandlePointerDown(e, el)} aria-label="Rotate and resize" role="slider" aria-valuenow={Math.round(el.rotation)} />
                )}
              </div>
            );
          })}
        {scale > 0 && overlay?.(scale)}
      </div>
    </div>
  );
}
