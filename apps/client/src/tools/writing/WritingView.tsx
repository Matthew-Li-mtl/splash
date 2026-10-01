import { Link } from "react-router";
import type { ViewerProps } from "../registry";
import "./writing.css";

export default function WritingView({ post, compact }: ViewerProps<"writing">) {
  const { text, prompt, challenge } = post.content;
  const long = text.length > 650 || text.split("\n").length > 10;

  return (
    <div>
      {prompt && (
        <p className="writing-prompt">
          <span className="bold">Prompt:</span> {prompt}
        </p>
      )}
      {challenge && (
        <p className="writing-prompt">
          <span className="bold">Challenge:</span> {challenge.label}
          {challenge.detail ? ` (${challenge.detail})` : ""} {challenge.met ? "✅" : ""}
        </p>
      )}
      <div className={`writing-view${compact && long ? " clamped" : ""}`}>{text}</div>
      {compact && long && (
        <Link to={`/p/${post.id}`} className="small bold" style={{ display: "inline-block", marginTop: 6 }}>
          Keep reading
        </Link>
      )}
    </div>
  );
}
