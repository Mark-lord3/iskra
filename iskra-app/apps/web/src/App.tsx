import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { BottomNav } from "./components/BottomNav";
import { EntryFlow } from "./components/EntryFlow";
import { ProfileCard } from "./components/ProfileCard";
import { api } from "./lib/api";
import { CompassPage } from "./pages/CompassPage";

type Landing = {
  event: { _id: string; name: string; priceCents: number; participantCount: number };
  venue: { _id: string; name: string; locationLabel?: string };
  avatars: unknown[];
};
type Me = { user: { id: string; firstName: string; email: string } };
type MyProfile = { profile: { _id: string; displayName: string; bio?: string; zone?: string; intentions: string[]; photos?: string[]; competitionEligible?: boolean } | null };
type AppConfig = { enabled: boolean; competitionEnabled: boolean; message: string };
type AccessStatus = { paid: boolean; status: string; amountCents: number; registeredCount: number };
type Candidate = { id: string; displayName: string; image: string };
type Person = { id: string; userId: string; name: string; age: number | null; zone: string; status: string; intentions: string[]; bio: string; image: string | null };
type Group = { _id: string; title: string; description?: string; meetingArea?: string; maxMembers: number };
type AppView = "home" | "discover" | "royal" | "radar" | "groups" | "privacy" | "profile";

const pageTitles: Record<Exclude<AppView, "home">, { eyebrow: string; title: string; description: string }> = {
  discover: { eyebrow: "LIVE VENUE", title: "People around you", description: "Only guests checked into tonight's room appear here." },
  royal: { eyebrow: "KING & QUEEN", title: "Crown the party", description: "Swipe every eligible event selfie once. The room decides tonight's winners." },
  radar: { eyebrow: "MATCH COMPASS", title: "Find each other", description: "Approximate venue guidance becomes available after a mutual wave." },
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

  if (!canEnter) return <button type="button" onClick={onRequireEntry} className="royal-locked"><span>ROOM ACCESS REQUIRED</span><strong>Unlock voting</strong><small>Register and activate your $5 event pass first.</small></button>;
  if (!enabled) {
    const winners = results.data?.winners;
    return <section className="royal-results"><p>VOTING IS CLOSED</p><h2>TONIGHT'S ROYALTY</h2><div>{["queen", "king"].map((title) => { const winner = winners?.[title]; return <article key={title}>{winner?.image ? <img src={winner.image} alt="" /> : <div /> }<span>{title}</span><strong>{winner?.displayName || "To be revealed"}</strong>{winner && <small>{winner.votes} right swipes</small>}</article>; })}</div></section>;
  }
  if (candidate.isLoading) return <p className="royal-loading">SHUFFLING THE ROOM...</p>;
  if (candidate.isError) return <button className="royal-locked" onClick={() => candidate.refetch()}>Voting could not load. Try again.</button>;
  if (!candidate.data?.candidate) return <section className="royal-finished"><p>YOUR BALLOT IS COMPLETE</p><h2>YOU SAW EVERYONE.</h2><span>{results.data?.totalVotes || 0} votes are in. Winners appear after the team closes voting.</span></section>;
  const person = candidate.data.candidate;
  return <section className="royal-stage">
    <div className="royal-score"><span>{candidate.data.remaining} left in your deck</span><span>{results.data?.totalVotes || 0} room votes</span></div>
    <motion.article key={person.id} drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => { if (info.offset.x > 90) vote.mutate("right"); else if (info.offset.x < -90) vote.mutate("left"); }} initial={{ opacity: 0, scale: .94, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0 }}>
      <img src={person.image} alt={`${person.displayName}'s event selfie`} />
      <div><small>TONIGHT'S CONTENDER</small><h2>{person.displayName}</h2><p>Drag left or right</p></div>
    </motion.article>
    <div className="royal-actions"><button type="button" disabled={vote.isPending} onClick={() => vote.mutate("left")} aria-label="Swipe left">NO</button><button type="button" disabled={vote.isPending} onClick={() => vote.mutate("right")} aria-label="Swipe right">CROWN</button></div>
    {vote.isError && <p className="entry-form__error">{vote.error instanceof Error ? vote.error.message : "Vote could not be saved."}</p>}
  </section>;
}

function VenuePage({ view }: { view: AppView }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [entryOpen, setEntryOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [notice, setNotice] = useState("");
  const [matchId, setMatchId] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);

  const config = useQuery({ queryKey: ["app-config"], queryFn: () => api<AppConfig>("/config"), retry: 1, refetchInterval: 10_000 });
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
  const discover = useQuery({
    queryKey: ["discover", eventId],
    queryFn: () => api<Person[]>(`/profiles/discover/${eventId}`),
    enabled: Boolean(view === "discover" && eventId && profile.data?.profile)
  });
  const groups = useQuery({
    queryKey: ["groups", eventId],
    queryFn: () => api<Group[]>(`/groups/${eventId}`),
    enabled: Boolean(view === "groups" && eventId && profile.data?.profile)
  });

  useEffect(() => {
    if (me.isError && landing.data) setEntryOpen(true);
  }, [landing.data, me.isError]);
  useEffect(() => {
    if (me.data && access.isSuccess && !access.data.paid) setEntryOpen(true);
    if (me.data && access.data?.paid && profile.isSuccess && !profile.data.profile) setEntryOpen(true);
  }, [me.data, access.data, access.isSuccess, profile.data, profile.isSuccess]);
  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const sessionId = parameters.get("session_id");
    if (!me.data || parameters.get("access") !== "success" || !sessionId) return;
    api<{ paid: boolean }>("/access/complete", { method: "POST", body: JSON.stringify({ sessionId }) })
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: ["access", eventId] });
        window.history.replaceState({}, "", window.location.pathname);
        setEntryOpen(true);
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "Payment confirmation failed."));
  }, [eventId, me.data, queryClient]);

  const wave = useMutation({
    mutationFn: (person: Person) => api<{ matched: boolean; matchId?: string; message: string }>(`/profiles/${person.id}/wave`, { method: "POST" }),
    onSuccess: (result) => {
      setNotice(result.message);
      if (result.matchId) setMatchId(result.matchId);
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Wave could not be sent.")
  });
  const createGroup = useMutation({
    mutationFn: (title: string) => api<Group>("/groups", {
      method: "POST",
      body: JSON.stringify({ eventId, title, description: "Open to meeting a new crew tonight.", meetingArea: "Main Bar", maxMembers: 8, mode: "open" })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", eventId] });
      setNotice("Your group is now live.");
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Group could not be created.")
  });
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

  if (config.isLoading || (config.data?.enabled && landing.isLoading)) return <main className="app-status">OPENING THE ROOM...</main>;
  if (config.isError || config.data?.enabled === false) return <main className="app-status app-status--closed"><p>ROOM OFFLINE</p><h1>THE NEXT SPARK IS COMING.</h1><span>{config.data?.message || "The ISKRA social room is currently closed."}</span></main>;
  if (landing.isError || !landing.data) return <main className="app-status"><p>ISKRA IS OFFLINE</p><button onClick={() => landing.refetch()}>Try again</button></main>;

  const activeProfile = profile.data?.profile;
  const people = discover.data || [];
  const liveCount = Math.max(access.data?.registeredCount || 0, landing.data.event.participantCount || 0, people.length + (activeProfile ? 1 : 0));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.22),_transparent_28%),linear-gradient(180deg,_#121214_0%,_#09090b_55%,_#050506_100%)] px-4 pb-28 pt-6 text-white sm:px-6">
      <div className="mx-auto max-w-md">
        {view === "home" && <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-pulse backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs uppercase tracking-[0.35em] text-ember-200">{landing.data.venue.name}</p><h1 className="mt-3 font-display text-4xl leading-tight">Meet people who are here tonight.</h1></div>
            <span className="shrink-0 rounded-full border border-white/10 px-3 py-2 text-xs text-white/70">{liveCount} live</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">Enter the venue-only room, meet people nearby, match privately, and use the consent-based compass to find each other.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => requireEntry() && navigate("/discover")} className="rounded-2xl bg-ember-500 px-5 py-3 font-semibold text-white">{activeProfile ? "Enter tonight" : "Join tonight"}</button>
            <button type="button" onClick={() => navigate("/discover")} className="rounded-2xl border border-white/10 px-5 py-3 font-semibold text-white/80">Preview vibe</button>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-white/60"><div className="rounded-2xl border border-white/10 bg-black/20 p-3">Mutual consent</div><div className="rounded-2xl border border-white/10 bg-black/20 p-3">Venue-only access</div><div className="rounded-2xl border border-white/10 bg-black/20 p-3">Profiles expire</div></div>
        </motion.section>}

        {view === "home" && <section className="mt-6 grid grid-cols-2 gap-3">
          <Link to="/discover" className="app-route-card app-route-card--wide"><span>01 / DISCOVER</span><strong>See who's here</strong><p>Live, temporary profiles from tonight's venue.</p></Link>
          <Link to="/radar" className="app-route-card"><span>02 / RADAR</span><strong>Find a match</strong></Link>
          <Link to="/groups" className="app-route-card"><span>03 / GROUPS</span><strong>Meet a crew</strong></Link>
          <Link to="/profile" className="app-route-card app-route-card--wide"><span>04 / PROFILE</span><strong>Control tonight's identity</strong><p>Edit your intentions, photo, and approximate area.</p></Link>
        </section>}

        {view !== "home" && <header className="app-page-header"><Link to="/">ISKRA / HOME</Link><p>{pageTitles[view].eyebrow}</p><h1>{pageTitles[view].title}</h1><span>{pageTitles[view].description}</span></header>}

        {view === "profile" && <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm text-white/50">Tonight's identity</p><h2 className="mt-1 text-lg font-semibold">{activeProfile ? activeProfile.displayName : "Create your venue profile"}</h2></div>
            {activeProfile ? <button type="button" onClick={() => setEntryOpen(true)} className="text-sm text-ember-200">Edit profile</button> : <button type="button" onClick={() => setEntryOpen(true)} className="text-sm text-ember-200">Get started</button>}
          </div>
          {activeProfile && <div className="mt-4 flex flex-wrap gap-2">{activeProfile.intentions.map((intent) => <span key={intent} className="rounded-full border border-ember-400/30 bg-ember-500/10 px-3 py-2 text-sm text-white/75">{intent}</span>)}</div>}
        </section>}

        {view === "discover" && <section className="mt-6 space-y-4">
          <div className="flex items-center justify-between"><div><p className="text-sm text-white/50">Discover</p><h2 className="text-xl font-semibold">People around you</h2></div><span className="text-xs text-ember-200">Checked in now</span></div>
          {!activeProfile && <button type="button" onClick={() => setEntryOpen(true)} className="w-full rounded-[2rem] border border-dashed border-white/15 p-8 text-left text-white/65"><strong className="block text-lg text-white">Enter the room to see people</strong><span className="mt-2 block text-sm">Create a temporary profile first.</span></button>}
          {activeProfile && discover.isLoading && <p className="py-10 text-center text-sm text-white/45">Looking around the venue...</p>}
          {activeProfile && discover.isError && <button type="button" onClick={() => discover.refetch()} className="w-full rounded-2xl border border-white/10 p-4">Could not load people. Try again.</button>}
          {activeProfile && discover.isSuccess && people.length === 0 && <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8"><h3 className="font-display text-2xl">You are early.</h3><p className="mt-2 text-sm leading-6 text-white/55">Your profile is live. New people will appear here as they check in.</p></div>}
          {people.map((person) => <ProfileCard key={person.id} {...person} onView={() => setSelectedPerson(person)} onWave={() => wave.mutate(person)} waving={wave.isPending && wave.variables?.id === person.id} />)}
        </section>}

        {view === "royal" && <RoyalVoting eventId={eventId} enabled={Boolean(config.data?.competitionEnabled)} canEnter={Boolean(access.data?.paid && activeProfile)} onRequireEntry={() => setEntryOpen(true)} />}

        {view === "radar" && <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between"><div><p className="text-sm text-white/50">Match compass</p><h2 className="text-xl font-semibold">Find a mutual match</h2></div><span className="text-xs text-white/45">No exact coordinates</span></div>
          <div className="relative mt-6 flex aspect-square items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(circle,_rgba(249,115,22,0.2),_rgba(255,255,255,0.03)_38%,_rgba(255,255,255,0.02)_60%,_transparent_68%)]"><div className="absolute inset-10 rounded-full border border-white/10"/><div className="absolute inset-20 rounded-full border border-white/10"/><div className="absolute inset-28 rounded-full border border-white/10"/><div className="absolute flex h-20 w-20 items-center justify-center rounded-full bg-white text-sm font-semibold text-night-950">You</div><p className="absolute bottom-10 max-w-52 text-center text-xs leading-5 text-white/45">When waves are mutual, your private compass opens here.</p></div>
        </section>}

        {view === "groups" && <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm text-white/50">Group hangouts</p><h2 className="text-xl font-semibold">Find a live crew</h2></div><button type="button" onClick={() => { if (!requireEntry()) return; const title = window.prompt("Name your group"); if (title?.trim()) createGroup.mutate(title.trim()); }} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/70">Create group</button></div>
          <div className="mt-4 space-y-3">{(groups.data || []).map((group) => <article key={group._id} className="rounded-3xl border border-white/10 bg-black/20 p-4"><h3 className="font-semibold">{group.title}</h3><p className="text-sm text-white/50">Up to {group.maxMembers} people · {group.meetingArea || "Venue"}</p><p className="mt-3 text-sm leading-6 text-white/65">{group.description}</p></article>)}{activeProfile && groups.isSuccess && groups.data.length === 0 && <p className="py-5 text-sm text-white/45">No live groups yet. Start the first one.</p>}</div>
        </section>}

        {view === "privacy" && <section className="mt-6 space-y-3"><article className="rounded-[2rem] border border-white/10 bg-white/5 p-5"><p className="text-sm uppercase tracking-[0.3em] text-ember-200">Temporary by design</p><h2 className="mt-2 text-xl font-semibold">Profiles expire after the event.</h2><p className="mt-3 text-sm leading-6 text-white/65">Venue profiles and uploaded media are tied to tonight's cleanup window, not a permanent public dating profile.</p></article><article className="rounded-[2rem] border border-white/10 bg-white/5 p-5"><p className="text-sm uppercase tracking-[0.3em] text-ember-200">Mutual consent</p><h2 className="mt-2 text-xl font-semibold">Location sharing starts only together.</h2><p className="mt-3 text-sm leading-6 text-white/65">The compass uses approximate club areas, requires both matches to accept, and can be stopped immediately by either person.</p></article>{me.data && <button type="button" onClick={() => logout.mutate()} className="w-full rounded-2xl border border-white/10 p-4 text-sm text-white/55">Sign out of {me.data.user.email}</button>}</section>}
        <BottomNav />
      </div>

      {entryOpen && <EntryFlow context={landing.data} hasAccount={Boolean(me.data)} access={access.data} existingProfile={activeProfile || null} onComplete={() => setEntryOpen(false)} onClose={() => setEntryOpen(false)} />}
      {selectedPerson && <div className="profile-dialog" role="dialog" aria-modal="true"><section><button type="button" className="profile-dialog__close" onClick={() => setSelectedPerson(null)}>Close</button>{selectedPerson.image ? <img src={selectedPerson.image} alt={selectedPerson.name} /> : <div className="profile-dialog__initial">{selectedPerson.name.slice(0, 1)}</div>}<p>{selectedPerson.zone}</p><h2>{selectedPerson.name}{selectedPerson.age ? `, ${selectedPerson.age}` : ""}</h2><p>{selectedPerson.bio}</p><div className="flex flex-wrap gap-2">{selectedPerson.intentions.map((intent) => <span key={intent}>{intent}</span>)}</div><button type="button" className="profile-dialog__wave" onClick={() => { wave.mutate(selectedPerson); setSelectedPerson(null); }}>Send private wave</button></section></div>}
      {notice && <button type="button" className="app-toast" onClick={() => setNotice("")}>{notice}<span>Dismiss</span></button>}
      {matchId && <div className="match-reveal" role="dialog" aria-modal="true"><section><p>MUTUAL WAVE</p><h2>IT'S A MATCH.</h2><p>You can now ask to share temporary venue guidance.</p><a href={`/matches/${matchId}/compass`}>Open match compass</a><button type="button" onClick={() => setMatchId("")}>Not now</button></section></div>}
    </main>
  );
}

function App() {
  return <Routes>
    <Route path="/" element={<VenuePage view="home" />} />
    <Route path="/discover" element={<VenuePage view="discover" />} />
    <Route path="/royal" element={<VenuePage view="royal" />} />
    <Route path="/radar" element={<VenuePage view="radar" />} />
    <Route path="/groups" element={<VenuePage view="groups" />} />
    <Route path="/privacy" element={<VenuePage view="privacy" />} />
    <Route path="/profile" element={<VenuePage view="profile" />} />
    <Route path="/matches/:matchId/compass" element={<CompassPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

export default App;
