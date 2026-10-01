import type { ViewerProps } from "../registry";
import { CollageStage } from "./CollageStage";

export default function CollageView({ post, compact }: ViewerProps<"collage">) {
  return (
    <div style={{ maxWidth: compact ? 460 : 640, margin: "0 auto" }}>
      <CollageStage collage={post.content} />
    </div>
  );
}
