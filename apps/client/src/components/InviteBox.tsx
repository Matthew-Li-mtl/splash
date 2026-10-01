import { Copy } from "lucide-react";
import { useToast } from "../lib/toast";

/** Invite links always point at the hosted web app, even when shared from the mobile app. */
const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, "");

export function InviteBox({ code }: { code: string }) {
  const toast = useToast();
  const link = `${PUBLIC_URL}/welcome?invite=${encodeURIComponent(code)}`;

  const share = async () => {
    const text = "Come be my neighbor! A small, cozy place to make things.";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Splash", text, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      toast("Invite link copied!");
    } catch {
      // Share sheet dismissed, or clipboard blocked.
    }
  };

  return (
    <div className="invite-box">
      <span className="grow" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {code}
      </span>
      <button className="btn btn-primary btn-sm" onClick={share}>
        <Copy size={15} /> Share invite
      </button>
    </div>
  );
}
