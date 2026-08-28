import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { BottomNav } from "./components/BottomNav";
import { EntryFlow } from "./components/EntryFlow";
import { DiscoverDeck } from "./components/DiscoverDeck";
import { MessagesExperience } from "./components/MessagesExperience";
import { GroupsExperience } from "./components/GroupsExperience";
import { ProfileExperience, type VenueProfile } from "./components/ProfileExperience";
import { api } from "./lib/api";
import { CompassPage } from "./pages/CompassPage";
import { isEntryDismissed, rememberEntryDismissal } from "./lib/entrySession";

type Landing = {
  event: { _id: string; name: string; priceCents: number; participantCount: number };
  venue: { _id: string; name: string; locationLabel?: string };
  avatars: unknown[];
};
type Me = { user: { id: string; firstName: string; email: string } };
type MyProfile = { profile: VenueProfile | null };
type AppConfig = { enabled: boolean; competitionEnabled: boolean; message: string };
type AccessStatus = { paid: boolean; status: string; amountCents: number; registeredCount: number };
type Candidate = { id: string; displayName: string; image: string };
type AppView = "home" | "discover" | "royal" | "messages" | "groups" | "privacy" | "profile";

const pageTitles: Record<Exclude<AppView, "home">, { eyebrow: string; title: string; description: string }> = {
  discover: { eyebrow: "LIVE VENUE", title: "People around you", description: "Only guests checked into tonight's room appear here." },
  royal: { eyebrow: "KING & QUEEN", title: "Crown the party", description: "Swipe every eligible event selfie once. The room decides tonight's winners." },
  messages: { eyebrow: "PRIVATE SIGNALS", title: "Messages", description: "Your mutual matches and tonight's conversations, all in one place." },
  groups: { eyebrow: "LIVE CREWS", title: "Move together", description: "Start a small group or find people heading to the same area." },
  privacy: { eyebrow: "YOUR CONTROL", title: "Tonight stays temporary", description: "Understand exactly what is shared, when it expires, and how to stop it." },
  profile: { eyebrow: "TONIGHT'S IDENTITY", title: "Your venue profile", description: "Choose how people see you during this event." }
};

function RoyalVoting({ eventId, enabled, canEnter, onRequireEntry }: { eventId: string; enabled: boolean; canEnter: boolean; onRequireEntry: () => void }) {
  const queryClient = useQueryClient();
  const candidate = useQuery({
    queryKey: ["royal-candidate", eventId],
    queryFn: () => api<{ candidate: Candidate | null; remaining: number }>(`/competition/${eventId}/candidate`),
    enabled: Boolean(eventId && enabled && canEnter),
    retry: false
  });
  const results = useQuery({
    queryKey: ["royal-results", eventId],
    queryFn: () => api<{ votingOpen: boolean; totalVotes: number; winners: Record<string, { displayName: string; image: string; votes: number } | null> | null }>(`/competition/${eventId}/results`),
    enabled: Boolean(eventId && canEnter),
    retry: false
  });
  const vote = useMutation({
    mutationFn: (direction: "left" | "right") => api(`/competition/${eventId}/vote`, { method: "POST", body: JSON.stringify({ candidateProfileId: candidate.data?.candidate?.id, direction }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["royal-candidate", eventId] });
      queryClient.invalidateQueries({ queryKey: ["royal-results", eventId] });
    }
  });
  const submitVote = (direction: "left" | "right") => {
    if (!candidate.data?.candidate || vote.isPending) return;
    vote.mutate(direction);
  };

  if (!canEnter) return <button type="button" onClick={onRequireEntry} className="royal-locked"><span>ROOM ACCESS REQUIRED</span><strong>Unlock voting</strong><small>Register and activate your $5 event pass first.</small></button>;
  if (!enabled) {
    const winners = results.data?.winners;
    return <section className="royal-results"><p>VOTING IS CLOSED</p><h2>TONIGHT'S ROYALTY</h2><div>{["queen", "king"].map((title) => { const winner = winners?.[title]; return <article key={title}>{winner?.image ? <img src={winner.image} alt="" /> : <div /> }<span>{title}</span><strong>{winner?.displayName || "To be revealed"}</strong>{winner && <small>{winner.votes} right swipes</small>}</article>; })}</div></section>;
  }
  if (candidate.isLoading) return <div className="royal-loading" role="status"><i/><span>SHUFFLING THE ROOM...</span></div>;
  if (candidate.isError) return <button className="royal-locked" onClick={() => candidate.refetch()}>Voting could not load. Try again.</button>;
  if (!candidate.data?.candidate) return <section className="royal-finished"><p>YOUR BALLOT IS COMPLETE</p><h2>YOU SAW EVERYONE.</h2><span>{results.data?.totalVotes || 0} votes are in. Winners appear after the team closes voting.</span></section>;
  const person = candidate.data.candidate;
  return <section className="royal-stage">
    <div className="royal-score"><span>{candidate.data.remaining} left in your deck</span><span>{results.data?.totalVotes || 0} room votes</span></div>
    <motion.article key={person.id} drag={vote.isPending ? false : "x"} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => { if (info.offset.x > 90) submitVote("right"); else if (info.offset.x < -90) submitVote("left"); }} initial={{ opacity: 0, scale: .94, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0 }}>
      <img src={person.image} alt={`${person.displayName}'s event selfie`} />
      <div><small>TONIGHT'S CONTENDER</small><h2>{person.displayName}</h2><p>Drag left or right</p></div>
    </motion.article>
    <div className="royal-actions"><button type="button" disabled={vote.isPending} onClick={() => submitVote("left")} aria-label="Swipe left">NO</button><button type="button" disabled={vote.isPending} onClick={() => submitVote("right")} aria-label="Swipe right">{vote.isPending ? "SAVING..." : "CROWN"}</button></div>
    {vote.isError && <p className="entry-form__error">{vote.error instanceof Error ? vote.error.message : "Vote could not be saved."}</p>}
  </section>;
}

function VenuePage({ view }: { view: AppView }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const paymentConfirmationStarted = useRef(false);
  const [returnSessionId] = useState(() => {
    const parameters = new URLSearchParams(window.location.search);
    return parameters.get("access") === "success" ? parameters.get("session_id") || "" : "";
  });
  const [confirmingAccess, setConfirmingAccess] = useState(Boolean(returnSessionId));
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryDismissed, setEntryDismissed] = useState(() => isEntryDismissed(sessionStorage));
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  const config = useQuery({ queryKey: ["app-config"], queryFn: () => api<AppConfig>("/config"), retry: 1, refetchInterval: 5_000 });
  const landing = useQuery({ queryKey: ["landing"], queryFn: () => api<Landing>("/events/join/club-iskra-tonight"), enabled: config.data?.enabled === true, retry: 1 });
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/auth/me"), retry: false });
  const eventId = landing.data?.event._id || "";
  const access = useQuery({
    queryKey: ["access", eventId],
    queryFn: () => api<AccessStatus>(`/access/${eventId}/status`),
    enabled: Boolean(eventId && me.data),
    retry: false
  });
  const profile = useQuery({
    queryKey: ["my-profile", eventId],
    queryFn: () => api<MyProfile>(`/profiles/event/${eventId}/me`),
    enabled: Boolean(eventId && me.data && access.data?.paid)
  });

  useEffect(() => {
    if (me.isError && landing.data && !entryDismissed) setEntryOpen(true);
  }, [entryDismissed, landing.data, me.isError]);
  useEffect(() => {
    if (entryDismissed) return;
    if (me.data && access.isSuccess && !access.data.paid && !confirmingAccess) setEntryOpen(true);
    if (me.data && access.data?.paid && profile.isSuccess && !profile.data.profile) setEntryOpen(true);
  }, [me.data, access.data, access.isSuccess, confirmingAccess, entryDismissed, profile.data, profile.isSuccess]);
  useEffect(() => {
    if (!me.data || !eventId || !returnSessionId || paymentConfirmationStarted.current) return;
    paymentConfirmationStarted.current = true;
    api<{ paid: boolean }>("/access/complete", { method: "POST", body: JSON.stringify({ sessionId: returnSessionId }) })
      .then(async () => {
        queryClient.setQueryData<AccessStatus>(["access", eventId], (current) => ({
          paid: true,
          status: "paid",
          amountCents: current?.amountCents ?? 500,
          registeredCount: current?.registeredCount ?? 1
        }));
        await queryClient.invalidateQueries({ queryKey: ["my-profile", eventId] });
        window.history.replaceState({}, "", window.location.pathname);
        setConfirmingAccess(false);
        setEntryOpen(true);
      })
      .catch((error) => {
        paymentConfirmationStarted.current = false;
        setConfirmingAccess(false);
        setEntryOpen(true);
        setNotice(error instanceof Error ? error.message : "Payment confirmation failed.");
      });
  }, [eventId, me.data, queryClient, returnSessionId]);

  const logout = useMutation({
    mutationFn: () => api<{ ok: true }>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      setEntryOpen(true);
    }
  });

  function requireEntry() {
    if (!me.data || !access.data?.paid || !profile.data?.profile) {
      setEntryOpen(true);
      return false;
    }
    return true;
  }

  function dismissEntry() {
    rememberEntryDismissal(sessionStorage);
    setEntryDismissed(true);
    setEntryOpen(false);
  }

  if (config.isLoading || (config.data?.enabled && landing.isLoading)) return <main className="app-status" role="status"><span className="status-pulse" aria-hidden="true" />OPENING THE ROOM...</main>;
  if (config.isError) return <main className="app-status app-status--closed"><p>SIGNAL INTERRUPTED</p><h1>THE ROOM COULD NOT LOAD.</h1><span>Check your connection, then try again.</span><button type="button" onClick={() => config.refetch()}>Try again</button></main>;
  if (config.data?.enabled === false) return <main className="app-status app-status--closed"><p>ROOM OFFLINE</p><h1>THE NEXT SPARK IS COMING.</h1><span>{config.data?.message || "The ISKRA social room is currently closed."}</span></main>;
  if (landing.isError || !landing.data) return <main className="app-status"><p>ISKRA IS OFFLINE</p><button onClick={() => landing.refetch()}>Try again</button></main>;

  const activeProfile = profile.data?.profile;
  const liveCount = Math.max(access.data?.registeredCount || 0, landing.data.event.participantCount || 0);

  return (
    <main className="app-shell min-h-screen px-4 pt-6 text-ink sm:px-6" style={{ paddingBottom: "calc(8.5rem + env(safe-area-inset-bottom))" }}>
      <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2, ease: [0.22, 0.68, 0, 1] }} className={`app-frame app-frame--${view} mx-auto ${view === "messages" || view === "groups" || view === "profile" ? "max-w-3xl" : "max-w-md"}`}>
        {confirmingAccess && <div className="entry-payment-confirming" role="status"><span>SECURE PAYMENT</span><strong>Confirming your access...</strong><small>Keep this page open. Your profile builder will appear next.</small></div>}
        {view === "home" && <motion.section initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, ease: [0.22, 0.68, 0, 1] }} className="venue-hero overflow-hidden rounded-[2rem] border border-hairline bg-surface p-6 shadow-pulse">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs uppercase tracking-[0.35em] text-pink-ink">{landing.data.venue.name}</p><h1 className="mt-3 font-display text-4xl leading-tight">Meet people who are here tonight.</h1></div>
            <span className="shrink-0 rounded-full border border-hairline px-3 py-2 text-xs text-muted">{liveCount} live</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">Enter the venue-only room, meet people nearby, match privately, and use the consent-based compass to find each other.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => requireEntry() && navigate("/discover")} className="rounded-2xl bg-pink-fill px-5 py-3 font-semibold text-white">{activeProfile ? "Enter tonight" : "Join tonight"}</button>
            <button type="button" onClick={() => navigate("/discover")} className="rounded-2xl border border-hairline px-5 py-3 font-semibold text-muted">Preview vibe</button>
          </div>
          <div className="venue-hero__promises mt-6 grid grid-cols-3 gap-3 text-xs text-muted"><div className="rounded-2xl border border-hairline bg-white p-3">Mutual consent</div><div className="rounded-2xl border border-hairline bg-white p-3">Venue-only access</div><div className="rounded-2xl border border-hairline bg-white p-3">Profiles expire</div></div>
        </motion.section>}

        {view === "home" && <section className="mt-6 grid grid-cols-2 gap-3">
          <Link to="/discover" className="app-route-card app-route-card--wide"><span>01 / DISCOVER</span><strong>See who's here</strong><p>Live, temporary profiles from tonight's venue.</p></Link>
          <Link to="/messages" className="app-route-card"><span>02 / MESSAGES</span><strong>Talk to matches</strong></Link>
          <Link to="/groups" className="app-route-card"><span>03 / GROUPS</span><strong>Meet a crew</strong></Link>
          <Link to="/profile" className="app-route-card app-route-card--wide"><span>04 / PROFILE</span><strong>Control tonight's identity</strong><p>Edit your intentions, photo, and approximate area.</p></Link>
        </section>}

        {view !== "home" && <header className="app-page-header">
          <Link to="/" className="app-home-link">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 18l-6-6 6-6"/></svg>
            <span>ISKRA / Home</span>
          </Link>
          <p>{pageTitles[view].eyebrow}</p>
          <h1>{pageTitles[view].title}</h1>
          <span>{pageTitles[view].description}</span>
        </header>}

        {view === "profile" && <ProfileExperience profile={activeProfile} eventName={landing.data.event.name} venueName={landing.data.venue.name} onEdit={() => setEntryOpen(true)} />}

        {view === "discover" && <DiscoverDeck eventId={eventId} enabled={Boolean(activeProfile)} onRequireEntry={() => setEntryOpen(true)} />}

        {view === "royal" && <RoyalVoting eventId={eventId} enabled={Boolean(config.data?.competitionEnabled)} canEnter={Boolean(access.data?.paid && activeProfile)} onRequireEntry={() => setEntryOpen(true)} />}

        {view === "messages" && <MessagesExperience eventId={eventId} enabled={Boolean(activeProfile)} onRequireEntry={() => setEntryOpen(true)} />}

        {view === "groups" && <GroupsExperience eventId={eventId} enabled={Boolean(activeProfile)} onRequireEntry={() => setEntryOpen(true)} />}

        {view === "privacy" && <section className="mt-6 space-y-3"><article className="rounded-[2rem] border border-hairline bg-softpink/60 p-5"><p className="text-sm uppercase tracking-[0.3em] text-pink-ink">Temporary by design</p><h2 className="mt-2 text-xl font-semibold">Profiles expire after the event.</h2><p className="mt-3 text-sm leading-6 text-muted">Venue profiles and uploaded media are tied to tonight's cleanup window, not a permanent public dating profile.</p></article><article className="rounded-[2rem] border border-hairline bg-softpink/60 p-5"><p className="text-sm uppercase tracking-[0.3em] text-pink-ink">Mutual consent</p><h2 className="mt-2 text-xl font-semibold">Location sharing starts only together.</h2><p className="mt-3 text-sm leading-6 text-muted">The compass uses approximate club areas, requires both matches to accept, and can be stopped immediately by either person.</p></article>{me.data && <button type="button" onClick={() => logout.mutate()} className="w-full rounded-2xl border border-hairline p-4 text-sm text-muted">Sign out of {me.data.user.email}</button>}</section>}
      </motion.div>

      {/* Outside the page-transition wrapper on purpose. That wrapper animates
          a transform, and a transformed ancestor becomes the containing block
          for position:fixed descendants — so the nav was being anchored to it
          and sliding with every route change. */}
      <BottomNav eventId={eventId} enabled={Boolean(activeProfile)} />

      {entryOpen && <EntryFlow context={landing.data} hasAccount={Boolean(me.data)} access={access.data} existingProfile={activeProfile || null} onComplete={dismissEntry} onClose={dismissEntry} />}
      {notice && <button type="button" className="app-toast" onClick={() => setNotice("")}>{notice}<span>Dismiss</span></button>}
    </main>
  );
}

function App() {
  const location = useLocation();
  return <AppErrorBoundary resetKey={location.pathname}><Routes>
    <Route path="/" element={<VenuePage view="home" />} />
    <Route path="/discover" element={<VenuePage view="discover" />} />
    <Route path="/royal" element={<VenuePage view="royal" />} />
    <Route path="/radar" element={<Navigate to="/messages" replace />} />
    <Route path="/messages" element={<VenuePage view="messages" />} />
    <Route path="/messages/:conversationId" element={<VenuePage view="messages" />} />
    <Route path="/groups" element={<VenuePage view="groups" />} />
    <Route path="/groups/:groupId" element={<VenuePage view="groups" />} />
    <Route path="/privacy" element={<VenuePage view="privacy" />} />
    <Route path="/profile" element={<VenuePage view="profile" />} />
    <Route path="/matches/:matchId/compass" element={<CompassPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AppErrorBoundary>;
}

export default App;
