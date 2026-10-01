import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { ToolMeta } from "./registry";

/** Back button, tool badge, title and the primary "Done" action, shared by all editors. */
export function ToolHeader({
  tool,
  title,
  subtitle,
  onDone,
  doneLabel = "Done",
  doneDisabled,
  children,
}: {
  tool: ToolMeta;
  title: string;
  subtitle?: string;
  onDone?: () => void;
  doneLabel?: string;
  doneDisabled?: boolean;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const Icon = tool.icon;
  return (
    <div className="tool-head" style={{ "--tile": tool.color } as CSSProperties}>
      <button
        className="btn btn-ghost btn-icon btn-sm"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(tool.kind === "puzzle" ? "/play" : "/make"))}
        aria-label="Back"
      >
        <ArrowLeft size={20} />
      </button>
      <span className="tool-badge">
        <Icon size={20} />
      </span>
      <div className="grow">
        <h1>{title}</h1>
        {subtitle && <p className="tiny muted">{subtitle}</p>}
      </div>
      {children}
      {onDone && (
        <button className="btn btn-accent btn-sm" onClick={onDone} disabled={doneDisabled}>
          {doneLabel}
        </button>
      )}
    </div>
  );
}
