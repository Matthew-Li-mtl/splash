import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Send } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { ErrorState, Spinner } from "../components/States";
import { errorMessage } from "../lib/api";
import { useMeStrict } from "../lib/auth";
import { useMarkRead, useMessages, useNeighborhood, useSendMessage } from "../lib/queries";
import { useToast } from "../lib/toast";
import { timeAgo } from "../lib/util";

export function Thread() {
  const { channel = "" } = useParams();
  const me = useMeStrict();
  const { data: hood } = useNeighborhood();
  const messages = useMessages(channel);
  const send = useSendMessage(channel);
  const markRead = useMarkRead(channel);
  const toast = useToast();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const isPorch = channel.startsWith("nb_");
  const otherId = isPorch ? null : channel.split("_").slice(1).find((id) => id !== me.id);
  const other = hood?.members.find((m) => m.id === otherId);
  const title = isPorch ? `${hood?.name ?? "Neighborhood"} porch` : (other?.displayName ?? "Conversation");
  const count = messages.data?.length ?? 0;
  const lastId = messages.data?.[count - 1]?.id;

  // Mark read and scroll down whenever a new message arrives.
  useEffect(() => {
    if (!messages.isSuccess) return;
    markRead.mutate();
    endRef.current?.scrollIntoView({ block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId, messages.isSuccess]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    send.mutate(value, {
      onError: (err) => {
        setText(value);
        toast(errorMessage(err), "error");
      },
    });
  };

  return (
    <div className="container chat">
      <div className="tool-head">
        <Link to="/talk" className="btn btn-ghost btn-icon btn-sm" aria-label="Back to conversations">
          <ArrowLeft size={20} />
        </Link>
        {other && <Avatar user={other} size={36} link />}
        <div className="grow">
          <h1 style={{ fontSize: "1.25rem" }}>{title}</h1>
          {isPorch && <p className="tiny muted">Everyone on your street can see this.</p>}
        </div>
      </div>

      <div className="chat-log">
        {messages.isPending ? (
          <Spinner />
        ) : messages.isError ? (
          <ErrorState error={messages.error} />
        ) : count === 0 ? (
          <p className="muted center" style={{ margin: "40px 0" }}>
            {isPorch ? "Quiet porch. Say good morning? ☕" : `Say hi to ${other?.displayName ?? "your neighbor"} 👋`}
          </p>
        ) : (
          messages.data.map((m, i) => {
            const mine = m.author.id === me.id;
            const prev = messages.data[i - 1];
            const grouped = prev && prev.author.id === m.author.id && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;
            return (
              <div key={m.id} className={`msg${mine ? " mine" : ""}`} style={grouped ? { marginTop: -6 } : undefined}>
                {!mine && (grouped ? <span style={{ width: 30, flex: "none" }} /> : <Avatar user={m.author} size={30} link />)}
                <div>
                  {!grouped && (
                    <div className="msg-meta" style={{ textAlign: mine ? "right" : "left" }}>
                      {mine ? "" : `${m.author.displayName} · `}
                      {timeAgo(m.createdAt)}
                    </div>
                  )}
                  <div className="bubble">{m.text}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          maxLength={2000}
          aria-label="Message"
        />
        <button className="btn btn-primary btn-icon" disabled={!text.trim()} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
