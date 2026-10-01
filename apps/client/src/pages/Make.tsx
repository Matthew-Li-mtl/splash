import type { CSSProperties } from "react";
import { Link } from "react-router";
import { useMeStrict } from "../lib/auth";
import { TOOLS } from "../tools/registry";
import { randomPrompt } from "../tools/writing/prompts";
import { useState } from "react";
import { Dices } from "lucide-react";

export function Make() {
  const me = useMeStrict();
  const [idea, setIdea] = useState(() => randomPrompt());

  return (
    <div className="container-wide stack stack-lg">
      <div className="page-head">
        <div>
          <h1>Make something</h1>
          <p>Small is good. Done is better than perfect. Nobody's grading.</p>
        </div>
        <Link to={`/u/${me.username}`} className="btn btn-sm">
          Your shelf
        </Link>
      </div>

      <div className="tiles">
        {Object.values(TOOLS).map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.kind} to={tool.path} className="tile" style={{ "--tile": tool.color } as CSSProperties}>
              <span className="tile-icon">
                <Icon size={24} />
              </span>
              <h3>{tool.name}</h3>
              <p>{tool.blurb}</p>
              <span className="tile-deco" aria-hidden="true">
                {tool.deco}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="card row row-wrap" style={{ gap: 14 }}>
        <span style={{ fontSize: "1.8rem" }}>💡</span>
        <div className="grow">
          <p className="section-title">Need an idea?</p>
          <p className="display" style={{ fontSize: "1.1rem" }}>
            {idea.text}
          </p>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-icon" onClick={() => setIdea(randomPrompt())} aria-label="Another idea" title="Another idea">
            <Dices size={20} />
          </button>
          <Link to={`/make/write?prompt=${encodeURIComponent(idea.text)}`} className="btn btn-sm">
            Write it
          </Link>
        </div>
      </div>
    </div>
  );
}
