import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api, SOCKET_ROOT } from "../lib/api";

type Thread = { id: string; matchId: string; peer: { id: string; name: string; image: string | null; zone: string }; preview: string; lastMessageAt: string; unread: number };
type ChatMessage = { id: string; clientId: string; body: string; mine: boolean; createdAt: string; readAt: string | null };
type Chat = { conversation: { id: string; matchId: string; peer: Thread["peer"] }; messages: ChatMessage[]; nextCursor: string | null };

function sameDay(one: string, two?: string) {
  if (!two) return false;
  const first = new Date(one);
  const second = new Date(two);
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}
function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tonight";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function MessageIcon({ name }: { name: "back" | "search" | "shield" | "send" | "spark" | "pin" }) {
  const paths = {
    back: <path d="m15 18-6-6 6-6"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    shield: <path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6l-7-3Z"/>,
    send: <><path d="m3 11 18-8-8 18-2-8-8-2Z"/><path d="m11 13 10-10"/></>,
    spark: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export function MessagesExperience({ eventId, enabled, onRequireEntry }: { eventId: string; enabled: boolean; onRequireEntry: () => void }) {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const lastReadRef = useRef("");
  const previousMessageCount = useRef(0);

  const threads = useQuery({ queryKey: ["conversations", eventId], queryFn: () => api<Thread[]>(`/social/conversations/event/${eventId}`), enabled: Boolean(eventId && enabled), refetchInterval: 15_000 });
  const chat = useQuery({ queryKey: ["messages", conversationId], queryFn: () => api<Chat>(`/social/conversations/${conversationId}/messages`), enabled: Boolean(conversationId && enabled) });

  useEffect(() => {
    if (!conversationId || lastReadRef.current === conversationId) return;
    lastReadRef.current = conversationId;
    api(`/social/conversations/${conversationId}/read`, { method: "POST" })
      .then(() => client.invalidateQueries({ queryKey: ["conversations", eventId] }))
      .catch(() => { lastReadRef.current = ""; });
  }, [client, conversationId, eventId]);
  useEffect(() => {
    if (!enabled) return;
    const socket = io(SOCKET_ROOT, { withCredentials: true });
    socket.emit("venue:join", { eventId });
    socket.on("message:created", ({ conversationId: incoming }: { conversationId: string }) => {
      client.invalidateQueries({ queryKey: ["conversations", eventId] });
      client.invalidateQueries({ queryKey: ["messages", incoming] });
    });
    return () => { socket.disconnect(); };
  }, [client, enabled, eventId]);
  useEffect(() => {
    const list = messageListRef.current;
    const messageCount = chat.data?.messages.length || 0;
    if (!list || !messageCount) return;
    const wasNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 140;
    if (previousMessageCount.current === 0 || wasNearBottom) list.scrollTo({ top: list.scrollHeight, behavior: previousMessageCount.current ? "smooth" : "instant" });
    previousMessageCount.current = messageCount;
  }, [chat.data?.messages.length]);
  useEffect(() => { setDraft(""); previousMessageCount.current = 0; }, [conversationId]);

  const send = useMutation({
    mutationFn: (body: string) => api<ChatMessage>(`/social/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ body, clientId: crypto.randomUUID() }) }),
    onSuccess: () => {
      setDraft("");
      client.invalidateQueries({ queryKey: ["messages", conversationId] });
      client.invalidateQueries({ queryKey: ["conversations", eventId] });
    }
  });
  const action = useMutation({
    mutationFn: (kind: "block" | "unmatch" | "report") => api(`/social/conversations/${conversationId}/${kind}`, { method: "POST", body: kind === "report" ? JSON.stringify({ category: "other", note: "Reported from conversation controls." }) : undefined }),
    onSuccess: () => { navigate("/messages"); client.invalidateQueries({ queryKey: ["conversations", eventId] }); }
  });

  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || send.isPending) return;
    send.mutate(body);
  }
  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  if (!enabled) return <button className="deck-locked" onClick={onRequireEntry}><strong>Messages unlock after entry</strong><span>Complete your profile to talk to mutual matches.</span></button>;
  if (conversationId && chat.isError) return <section className="nested-error"><button type="button" onClick={() => navigate("/messages")}>Back to messages</button><p>CONVERSATION UNAVAILABLE</p><h2>This chat could not load.</h2><span>{chat.error.message}</span><button type="button" onClick={() => chat.refetch()}>Try again</button></section>;

  if (conversationId) {
    const peer = chat.data?.conversation.peer;
    const messages = chat.data?.messages || [];
    const lastMineIndex = messages.reduce((latest, message, index) => message.mine ? index : latest, -1);
    return (
      <section className="chat-shell">
        <header className="chat-header">
          <button onClick={() => navigate("/messages")} aria-label="Back to messages"><MessageIcon name="back" /></button>
          {peer?.image ? <img src={peer.image} alt="" /> : <i>{peer?.name?.slice(0, 1) || ""}</i>}
          <div><strong>{peer?.name || "Conversation"}</strong><span><MessageIcon name="pin" /> {peer?.zone || "Venue match"} · expires tonight</span></div>
          <details>
            <summary aria-label="Conversation safety controls"><MessageIcon name="shield" /></summary>
            <div><span>Safety &amp; privacy</span><button disabled={action.isPending} onClick={() => action.mutate("report")}>Report</button><button disabled={action.isPending} onClick={() => action.mutate("unmatch")}>Unmatch</button><button disabled={action.isPending} onClick={() => action.mutate("block")}>Block</button></div>
          </details>
        </header>

        <div ref={messageListRef} className="chat-messages" aria-live="polite">
          {chat.isLoading && <div className="chat-skeleton" aria-label="Loading messages"><i/><i/><i/></div>}
          {messages.length === 0 && !chat.isLoading && <div className="chat-empty"><MessageIcon name="spark" /><strong>You matched.</strong><p>Start with something you noticed about their profile, then meet only when you both feel comfortable.</p></div>}
          {messages.map((message, index) => <div className="chat-message-row" key={message.id}>
            {!sameDay(message.createdAt, messages[index - 1]?.createdAt) && <p className="chat-day">{formatDay(message.createdAt)}</p>}
            <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * .025 }} className={message.mine ? "mine" : ""}>
              <p>{message.body}</p><span>{formatTime(message.createdAt)}</span>
            </motion.article>
            {index === lastMineIndex && <small className="chat-delivery">{message.readAt ? "Read" : "Sent"}</small>}
          </div>)}
        </div>

        {chat.data && <div className="chat-compass"><MessageIcon name="spark" /><div><strong>Ready to meet?</strong><span>Both people must consent before approximate guidance starts.</span></div><Link to={`/matches/${chat.data.conversation.matchId}/compass`}>Open compass</Link></div>}
        <form className="chat-composer" onSubmit={submit}>
          <textarea name="message" rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} maxLength={2000} autoComplete="off" placeholder={`Message ${peer?.name || "your match"}...`} aria-label="Message your match"/>
          <button type="submit" disabled={send.isPending || !draft.trim()} aria-label="Send message"><MessageIcon name="send" /></button>
        </form>
        {send.isError && <p className="entry-form__error" role="alert">{send.error.message} Your message is still here.</p>}
        {action.isError && <p className="entry-form__error" role="alert">{action.error.message}</p>}
      </section>
    );
  }

  const filtered = (threads.data || []).filter((thread) => thread.peer.name.toLowerCase().includes(search.toLowerCase()));
  const unread = filtered.reduce((sum, item) => sum + item.unread, 0);
  return (
    <section className="inbox-shell">
      <div className="inbox-top"><div><h2>Tonight's connections.</h2><p>Mutual matches stay private and disappear with the event.</p></div><span aria-live="polite">{unread} unread</span></div>
      <label className="inbox-search"><MessageIcon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your matches" aria-label="Search matches"/></label>
      {threads.isLoading && <div className="thread-skeleton" aria-label="Loading conversations"><i/><i/><i/></div>}
      {threads.isError && <button className="inbox-state" onClick={() => threads.refetch()}>Messages could not load. Retry.</button>}
      {threads.isSuccess && filtered.length === 0 && <div className="inbox-empty"><MessageIcon name="spark" /><strong>{search ? "NO MATCHES FOUND." : "YOUR NEXT HELLO STARTS IN DISCOVER."}</strong><p>{search ? "Try a different name." : "When two people like each other, the conversation appears here automatically."}</p>{!search && <Link to="/discover">Open Discover</Link>}</div>}
      <div className="thread-list">{filtered.map((thread, index) => <motion.div key={thread.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 7) * .04 }}><Link to={`/messages/${thread.id}`} className={thread.unread ? "thread-unread" : ""}>
        <div className="thread-avatar">{thread.peer.image ? <img src={thread.peer.image} alt="" /> : <i>{thread.peer.name.slice(0, 1)}</i>}</div>
        <div className="thread-copy"><div><strong>{thread.peer.name}</strong><small>Venue match</small></div><p>{thread.preview}</p><span><MessageIcon name="pin" /> {thread.peer.zone}</span></div>
        <div className="thread-meta">{thread.unread > 0 && <b>{thread.unread}</b>}<small>{formatTime(thread.lastMessageAt)}</small><MessageIcon name="back" /></div>
      </Link></motion.div>)}</div>
    </section>
  );
}
