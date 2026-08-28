import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useAnimationControls, useMotionValue, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useDialogLifecycle } from "../hooks/useDialogLifecycle";
import { forgetDecided, readDecided, rememberDecided } from "../lib/decidedProfiles";

type Person = { id: string; userId: string; name: string; age: number | null; zone: string; intentions: string[]; bio: string; image: string | null };
type Decision = { matched: boolean; conversationId?: string; matchId?: string; message?: string; person?: { name: string; image: string | null } };

const zoneLabel = (zone: string) => zone.replace(/-/g, " ");

export function DiscoverDeck({ eventId, enabled, onRequireEntry }: { eventId: string; enabled: boolean; onRequireEntry: () => void }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  /* The queue is derived by removing decided ids rather than by holding a
     position in the array. An index survives a refetch that has reordered or
     shortened the list, and then points at the wrong person; a set of ids does
     not. */
  const [decided, setDecided] = useState<string[]>(() => readDecided(sessionStorage, eventId));
  const [lastPass, setLastPass] = useState<Person | null>(null);
  const [match, setMatch] = useState<Decision | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [layout, setLayout] = useState<"deck" | "grid">("deck");
  const [expanded, setExpanded] = useState<Person | null>(null);
  const matchDialogRef = useDialogLifecycle(Boolean(match), () => setMatch(null));
  const profileDialogRef = useDialogLifecycle(Boolean(expanded), () => setExpanded(null));
  const cardControls = useAnimationControls();
  const cardX = useMotionValue(0);
  const cardRotate = useTransform(cardX, [-220, 0, 220], [-8, 0, 8]);
  const likeOpacity = useTransform(cardX, [24, 110], [0, 1]);
  const passOpacity = useTransform(cardX, [-110, -24], [1, 0]);

  useEffect(() => { setDecided(readDecided(sessionStorage, eventId)); }, [eventId]);

  const deck = useQuery({ queryKey: ["discover-deck", eventId], queryFn: () => api<{ profiles: Person[]; remaining: number }>(`/social/discover/${eventId}`), enabled: Boolean(eventId && enabled) });

  const queue = useMemo(() => {
    const dropped = new Set(decided);
    return (deck.data?.profiles || []).filter((candidate) => !dropped.has(candidate.id));
  }, [deck.data?.profiles, decided]);
  const person = queue[0];
  const total = (deck.data?.profiles || []).length;
  const position = total - queue.length + 1;

  const decide = useMutation({ mutationFn: ({ person: target, decision }: { person: Person; decision: "pass" | "wave" }) => api<Decision>(`/social/profiles/${target.id}/decision`, { method: "POST", body: JSON.stringify({ decision }) }) });
  const undo = useMutation({
    mutationFn: (target: Person) => api(`/social/profiles/${target.id}/decision`, { method: "DELETE" }),
    onSuccess: (_result, target) => {
      forgetDecided(sessionStorage, eventId, target.id);
      setDecided((current) => current.filter((id) => id !== target.id));
      setLastPass(null);
      client.invalidateQueries({ queryKey: ["discover-deck", eventId] });
    }
  });

  const commit = useCallback((target: Person) => {
    rememberDecided(sessionStorage, eventId, target.id);
    setDecided((current) => current.includes(target.id) ? current : [...current, target.id]);
  }, [eventId]);

  /* One path for every way of deciding - swipe, buttons, keyboard, and the
     grid - so a person removed by one of them cannot linger in another. */
  const record = useCallback(async (target: Person, decision: "pass" | "wave") => {
    const result = await decide.mutateAsync({ person: target, decision });
    commit(target);
    setLastPass(decision === "pass" ? target : null);
    if (result.matched) setMatch(result);
    return result;
  }, [commit, decide]);

  const choose = useCallback(async (decision: "pass" | "wave") => {
    if (!person || choosing || decide.isPending) return;
    setChoosing(true);
    try {
      await Promise.all([
        record(person, decision),
        cardControls.start({ x: decision === "wave" ? window.innerWidth : -window.innerWidth, opacity: 0, transition: { duration: .24, ease: [0.22, 0.68, 0, 1] } })
      ]);
      cardX.set(0);
      cardControls.set({ x: 0, opacity: 1 });
    } catch {
      await cardControls.start({ x: 0, opacity: 1, transition: { duration: .22, ease: [0.22, 0.68, 0, 1] } });
    } finally {
      setChoosing(false);
    }
  }, [cardControls, cardX, choosing, decide.isPending, person, record]);

  const decideFromGrid = useCallback(async (target: Person, decision: "pass" | "wave") => {
    if (decide.isPending) return;
    try {
      const result = await record(target, decision);
      if (!result.matched) setExpanded(null);
    } catch {
      // The inline error below reports it; the tile stays so it can be retried.
    }
  }, [decide.isPending, record]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (layout !== "deck" || expanded || !person || choosing || decide.isPending || match || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      void choose(event.key === "ArrowRight" ? "wave" : "pass");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, choosing, decide.isPending, expanded, layout, match, person]);

  useEffect(() => {
    if (!person || layout !== "deck") return;
    cardX.set(0);
    cardControls.set({ x: 0, y: 14, scale: .98, opacity: 0 });
    cardControls.start({ x: 0, y: 0, scale: 1, opacity: 1, transition: { duration: .28, ease: [0.22, 0.68, 0, 1] } });
  }, [cardControls, cardX, layout, person?.id]);

  if (!enabled) return <button className="deck-locked" onClick={onRequireEntry}><strong>Enter the room first</strong><span>Your swipe deck opens after access and profile setup.</span></button>;
  if (deck.isLoading) return <div className="deck-status deck-status--loading" aria-label="Loading profiles"><i/><i/><i/></div>;
  if (deck.isError) return <button className="deck-status" onClick={() => deck.refetch()}>The deck could not load. Tap to retry.</button>;

  const layoutToggle = <div className="deck-layout" role="group" aria-label="Choose how profiles are shown">
    <button type="button" className={layout === "deck" ? "active" : ""} aria-pressed={layout === "deck"} onClick={() => setLayout("deck")}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="4" width="12" height="16" rx="2.5"/></svg>
      Cards
    </button>
    <button type="button" className={layout === "grid" ? "active" : ""} aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/></svg>
      Grid
    </button>
  </div>;

  const profileSheet = expanded && <div ref={profileDialogRef} className="profile-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-sheet-title">
    <section>
      <button type="button" className="profile-sheet__close" onClick={() => setExpanded(null)} aria-label="Close profile">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div className="profile-sheet__photo">
        {expanded.image ? <img src={expanded.image} alt={`${expanded.name}'s event profile`} /> : <div className="deck-card__fallback">{expanded.name.slice(0, 1)}</div>}
      </div>
      <div className="profile-sheet__body">
        <h2 id="profile-sheet-title">{expanded.name}{expanded.age ? <em>{expanded.age}</em> : null}</h2>
        <p className="deck-zone">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>
          {zoneLabel(expanded.zone)}
        </p>
        <p className="deck-bio">{expanded.bio}</p>
        <div className="deck-tags">{expanded.intentions.map((intent) => <b key={intent}>{intent}</b>)}</div>
      </div>
      <div className="profile-sheet__actions">
        <button className="deck-round deck-pass" type="button" aria-label={`Pass on ${expanded.name}`} disabled={decide.isPending} onClick={() => void decideFromGrid(expanded, "pass")}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <button className="deck-round deck-like" type="button" aria-label={`Like ${expanded.name}`} disabled={decide.isPending} onClick={() => void decideFromGrid(expanded, "wave")}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
    </section>
  </div>;

  if (!person) return <>
    {layoutToggle}
    <div className="deck-empty"><span>YOU CAUGHT UP</span><h2>THE ROOM IS STILL MOVING.</h2><p>New profiles will appear as guests join. Check Messages for your matches.</p><button onClick={() => navigate("/messages")}>Open messages</button>{lastPass && <button className="quiet" onClick={() => undo.mutate(lastPass)}>Undo last pass</button>}</div>
  </>;

  if (layout === "grid") return <section className="deck-shell">
    {layoutToggle}
    <p className="grid-count">{queue.length} {queue.length === 1 ? "person" : "people"} left to see</p>
    <ul className="profile-grid">
      {queue.map((candidate) => <li key={candidate.id}>
        <button type="button" onClick={() => setExpanded(candidate)} aria-label={`Open ${candidate.name}'s profile`}>
          {candidate.image ? <img src={candidate.image} alt="" loading="lazy" /> : <span className="deck-card__fallback">{candidate.name.slice(0, 1)}</span>}
          <span className="profile-grid__name">{candidate.name}{candidate.age ? <em>{candidate.age}</em> : null}</span>
        </button>
      </li>)}
    </ul>
    {decide.isError && <p className="entry-form__error">{decide.error.message}</p>}
    {profileSheet}
    {match && <MatchReveal match={match} dialogRef={matchDialogRef} onClose={() => setMatch(null)} navigate={navigate} />}
  </section>;

  return <section className="deck-shell">
    {layoutToggle}
    <div className="deck-progress"><span>{position} / {total}</span><i style={{ transform: `scaleX(${total ? position / total : 0})` }} /></div>
    <div className="deck-stack">
      {queue[1] && <article className="deck-card deck-card--behind" aria-hidden="true" />}
      <motion.article key={person.id} className="deck-card" style={{ x: cardX, rotate: cardRotate }} animate={cardControls} drag={choosing || decide.isPending ? false : "x"} dragConstraints={{ left: 0, right: 0 }} dragElastic={.72} onDragEnd={(_, info) => { if (Math.abs(info.offset.x) < 90) { cardControls.start({ x: 0, transition: { duration: .2, ease: [0.22, 0.68, 0, 1] } }); return; } void choose(info.offset.x > 0 ? "wave" : "pass"); }} initial={false}>
        {person.image ? <img src={person.image} alt={`${person.name}'s event profile`} draggable={false} /> : <div className="deck-card__fallback">{person.name.slice(0, 1)}</div>}
        <motion.strong className="deck-stamp deck-stamp--like" style={{ opacity: likeOpacity }}>LIKE</motion.strong>
        <motion.strong className="deck-stamp deck-stamp--pass" style={{ opacity: passOpacity }}>PASS</motion.strong>
        <div className="deck-card__scrim">
          <h2>{person.name}{person.age ? <em>{person.age}</em> : null}</h2>
          <p className="deck-zone">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>
            {zoneLabel(person.zone)}
          </p>
        </div>
      </motion.article>
      <div className="deck-actions">
      <button className="deck-round deck-pass" type="button" aria-label="Pass on this profile"
              disabled={choosing || decide.isPending} onClick={() => void choose("pass")}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <button className="deck-round deck-like" type="button" aria-label="Like this profile"
              disabled={choosing || decide.isPending} onClick={() => void choose("wave")}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20.5S3.8 14.9 3.8 9.4A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.2 2.8c0 5.5-8.2 11.1-8.2 11.1Z"/></svg>
      </button>
      </div>
    </div>
    <div className="deck-details" key={`${person.id}-details`}>
      <p className="deck-bio">{person.bio}</p>
      <div className="deck-tags">{person.intentions.map((intent) => <b key={intent}>{intent}</b>)}</div>
    </div>
    <p className="deck-hint">Swipe left to pass · right to like</p>
    {lastPass && <button className="deck-undo" disabled={undo.isPending} onClick={() => undo.mutate(lastPass)}>Undo last pass</button>}
    {decide.isError && <p className="entry-form__error">{decide.error.message}</p>}
    {match && <MatchReveal match={match} dialogRef={matchDialogRef} onClose={() => setMatch(null)} navigate={navigate} />}
  </section>;
}

function MatchReveal({ match, dialogRef, onClose, navigate }: { match: Decision; dialogRef: ReturnType<typeof useDialogLifecycle>; onClose: () => void; navigate: ReturnType<typeof useNavigate> }) {
  return <div ref={dialogRef} className="match-reveal" role="dialog" aria-modal="true" aria-labelledby="match-title">
    <div className="match-sparks" aria-hidden="true">{Array.from({ length: 12 }, (_, spark) => <i key={spark} style={{ "--spark": spark } as CSSProperties}/>)}</div>
    <section>
      {match.person?.image && <img src={match.person.image} alt="" />}
      <p>MUTUAL LIKE</p>
      <h2 id="match-title">YOU MATCHED.</h2>
      <p>Start a conversation now or keep moving through the room.</p>
      <button onClick={() => navigate(`/messages/${match.conversationId}`)}>Send a message</button>
      <button onClick={onClose}>Keep swiping</button>
    </section>
  </div>;
}
