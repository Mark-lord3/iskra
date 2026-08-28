import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

type Group = {
  _id: string;
  title: string;
  description: string;
  category: string;
  meetingArea: string;
  mode: string;
  memberCount: number;
  maxMembers: number;
  joined: boolean;
  isHost: boolean;
  full: boolean;
  host: { name: string; image: string | null };
  members?: Array<{ id: string; role: string; name: string; image: string | null }>;
};
type GroupMessage = { id: string; body: string; mine: boolean; sender: string; createdAt: string };
type CreatorPreview = { title: string; category: string; meetingArea: string; maxMembers: number };

const filters = [["", "All crews"], ["dancing", "Dancing"], ["drinks", "Drinks"], ["new-friends", "New friends"], ["networking", "Networking"], ["hangout", "Hangout"]];

function label(value: string) {
  return value.replaceAll("-", " ");
}

function CrewIcon({ name }: { name: "people" | "pin" | "spark" | "lock" | "arrow" | "back" }) {
  const paths = {
    people: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20v-2.2A4.8 4.8 0 0 1 8.3 13h1.4a4.8 4.8 0 0 1 4.8 4.8V20M14 14.5h2.5a4 4 0 0 1 4 4V20"/></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/></>,
    spark: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
    back: <path d="m15 18-6-6 6-6"/>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

function GroupCard({ group }: { group: Group }) {
  const spots = Math.max(group.maxMembers - group.memberCount, 0);
  return (
    <Link className={`crew-card${group.joined ? " crew-card--joined" : ""}`} to={`/groups/${group._id}`}>
      <div className="crew-card__top">
        <span>{label(group.category)}</span>
        <small>{group.joined ? "Your crew" : group.full ? "Full" : `${spots} ${spots === 1 ? "spot" : "spots"} left`}</small>
      </div>
      <div className="crew-card__mark" aria-hidden="true">{group.title.slice(0, 2)}</div>
      <div className="crew-card__content"><h3>{group.title}</h3><p>{group.description}</p></div>
      <div className="crew-card__host">
        {group.host.image ? <img src={group.host.image} alt="" /> : <i>{group.host.name.slice(0, 1)}</i>}
        <span><small>Hosted by</small><strong>{group.host.name}</strong></span>
      </div>
      <footer>
        <span><CrewIcon name="pin" /> {group.meetingArea}</span>
        <span><CrewIcon name="people" /> {group.memberCount}/{group.maxMembers}</span>
        <CrewIcon name="arrow" />
      </footer>
    </Link>
  );
}

export function GroupsExperience({ eventId, enabled, onRequireEntry }: { eventId: string; enabled: boolean; onRequireEntry: () => void }) {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [creatorPreview, setCreatorPreview] = useState<CreatorPreview>({ title: "Your crew name", category: "dancing", meetingArea: "Main Bar", maxMembers: 8 });

  const groups = useQuery({
    queryKey: ["groups-v2", eventId, filter],
    queryFn: () => api<Group[]>(`/groups/${eventId}${filter ? `?category=${filter}` : ""}`),
    enabled: Boolean(eventId && enabled && !groupId)
  });
  const detail = useQuery({ queryKey: ["group-detail", groupId], queryFn: () => api<Group>(`/groups/detail/${groupId}`), enabled: Boolean(groupId && enabled) });
  const messages = useQuery({ queryKey: ["group-messages", groupId], queryFn: () => api<GroupMessage[]>(`/groups/${groupId}/messages`), enabled: Boolean(groupId && detail.data?.joined), refetchInterval: 10_000 });
  const create = useMutation({
    mutationFn: (body: object) => api<Group>("/groups", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (group) => { setCreating(false); navigate(`/groups/${group._id}`); }
  });
  const membership = useMutation({
    mutationFn: (joined: boolean) => api(`/groups/${groupId}/join`, { method: joined ? "DELETE" : "POST" }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["group-detail", groupId] });
      client.invalidateQueries({ queryKey: ["groups-v2", eventId] });
    }
  });
  const send = useMutation({
    mutationFn: (body: string) => api(`/groups/${groupId}/messages`, { method: "POST", body: JSON.stringify({ body, clientId: crypto.randomUUID() }) }),
    onSuccess: () => { setDraft(""); client.invalidateQueries({ queryKey: ["group-messages", groupId] }); }
  });
  const report = useMutation({ mutationFn: () => api(`/groups/${groupId}/report`, { method: "POST", body: JSON.stringify({ note: "Reported from group controls." }) }) });

  function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    create.mutate({ eventId, title: values.title, description: values.description, category: values.category, meetingArea: values.meetingArea, maxMembers: Number(values.maxMembers), mode: values.mode });
  }
  function updatePreview(event: FormEvent<HTMLFormElement>) {
    const values = new FormData(event.currentTarget);
    setCreatorPreview({
      title: String(values.get("title") || "Your crew name"),
      category: String(values.get("category") || "dancing"),
      meetingArea: String(values.get("meetingArea") || "Main Bar"),
      maxMembers: Number(values.get("maxMembers") || 8)
    });
  }
  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (body && !send.isPending) send.mutate(body);
  }

  if (!enabled) return <button className="deck-locked" onClick={onRequireEntry}><strong>Groups unlock after entry</strong><span>Complete your profile to find a crew.</span></button>;

  if (groupId) {
    const group = detail.data;
    return (
      <section className="group-detail">
        <button className="group-back" onClick={() => navigate("/groups")}><CrewIcon name="back" /> Back to crews</button>
        {detail.isLoading && <div className="group-detail-skeleton" aria-label="Loading group"><i/><i/><i/></div>}
        {detail.isError && <div className="nested-error"><p>GROUP UNAVAILABLE</p><h2>This crew could not load.</h2><span>{detail.error.message}</span><button type="button" onClick={() => detail.refetch()}>Try again</button></div>}
        {group && <>
          <header className="group-detail__hero">
            <div className="group-detail__signal"><CrewIcon name="spark" /><span>{label(group.category)} · {group.meetingArea}</span></div>
            <h2>{group.title}</h2>
            <p>{group.description}</p>
            <div className="group-detail__host">
              {group.host.image ? <img src={group.host.image} alt="" /> : <i>{group.host.name.slice(0, 1)}</i>}
              <span><small>Tonight's host</small><strong>{group.host.name}</strong></span>
            </div>
            <div className="group-detail__action">
              <span><strong>{group.memberCount}/{group.maxMembers}</strong><small>{group.full ? "Crew at capacity" : "People already in"}</small></span>
              <button disabled={membership.isPending || group.isHost || (group.full && !group.joined)} onClick={() => membership.mutate(group.joined)}>{group.isHost ? "You host this" : group.joined ? "Leave crew" : group.full ? "Crew full" : membership.isPending ? "Updating..." : "Join the crew"}</button>
            </div>
          </header>
          {membership.isError && <p className="entry-form__error" role="alert">{membership.error.message}</p>}

          <div className="group-section-heading"><div><span>People in</span><h3>Meet the crew</h3></div><small>{group.memberCount} checked in</small></div>
          <div className="group-members">{group.members?.map((member) => <article key={member.id}>{member.image ? <img src={member.image} alt="" /> : <i>{member.name.slice(0, 1)}</i>}<span>{member.name}<small>{member.role}</small></span></article>)}</div>

          {group.joined ? <div className="group-chat">
            <div className="group-section-heading"><div><span>Private to members</span><h3>Crew chat</h3></div><small>Expires tonight</small></div>
            {messages.isLoading && <div className="chat-skeleton" aria-label="Loading group messages"><i/><i/><i/></div>}
            {messages.isError && <button className="inbox-state" onClick={() => messages.refetch()}>Crew messages could not load. Retry.</button>}
            <div aria-live="polite">{messages.data?.length === 0 && <p className="group-chat__empty">You are in. Say hello and make the first plan.</p>}{messages.data?.map((message) => <article className={message.mine ? "mine" : ""} key={message.id}><b>{message.mine ? "You" : message.sender}</b><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></article>)}</div>
            <form onSubmit={sendMessage}><input name="message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder="Message the crew..." aria-label="Message the crew"/><button disabled={send.isPending || !draft.trim()}>{send.isPending ? "Sending..." : "Send"}</button></form>
            {send.isError && <p className="entry-form__error" role="alert">{send.error.message} Your message is still here.</p>}
          </div> : <div className="group-join-note"><CrewIcon name="lock" /><strong>The crew chat is private.</strong><span>Join this group to see the conversation and coordinate where to meet.</span></div>}

          <button type="button" className="group-report" disabled={report.isPending || report.isSuccess} onClick={() => report.mutate()}>{report.isSuccess ? "Report received" : "Report this group"}</button>
          {report.isError && <p className="entry-form__error" role="alert">{report.error.message}</p>}
        </>}
      </section>
    );
  }

  const allGroups = groups.data || [];
  const joinedGroups = allGroups.filter((group) => group.joined);
  const availableGroups = allGroups.filter((group) => !group.joined);

  return (
    <section className="groups-shell">
      <div className="groups-intro">
        <div><h2>Find your people.</h2><p>Crews are forming around the venue right now.</p></div>
        <button onClick={() => setCreating((value) => !value)} aria-expanded={creating}>{creating ? "Close" : "Start a crew"}</button>
      </div>

      {creating && <form className="group-creator" onSubmit={createGroup} onInput={updatePreview}>
        <div className="group-creator__fields">
          <label><span>Group name</span><input name="title" minLength={3} maxLength={50} required placeholder="Late-night dance circle"/></label>
          <label><span>What is the plan?</span><textarea name="description" minLength={8} maxLength={240} required placeholder="Give people an easy reason to join."/></label>
          <div className="group-creator__grid">
            <label><span>Vibe</span><select name="category"><option value="dancing">Dancing</option><option value="drinks">Drinks</option><option value="new-friends">New friends</option><option value="networking">Networking</option><option value="hangout">Hangout</option></select></label>
            <label><span>Meet at</span><select name="meetingArea"><option>Main Bar</option><option>Dance Floor</option><option>Entrance</option><option>Patio</option><option>VIP Lounge</option></select></label>
            <label><span>Capacity</span><input name="maxMembers" type="number" min="2" max="30" defaultValue="8"/></label>
            <label><span>Entry</span><select name="mode"><option value="open">Open to join</option><option value="private">Private / invite only</option></select></label>
          </div>
        </div>
        <aside className="group-creator__preview">
          <span>Live preview</span><i>{creatorPreview.title.slice(0, 2)}</i><small>{label(creatorPreview.category)}</small><strong>{creatorPreview.title}</strong><p><CrewIcon name="pin" /> {creatorPreview.meetingArea}</p><p><CrewIcon name="people" /> Up to {creatorPreview.maxMembers} people</p>
        </aside>
        {create.isError && <p className="entry-form__error" role="alert">{create.error.message}</p>}
        <button disabled={create.isPending}>{create.isPending ? "Creating..." : "Create this crew"}</button>
      </form>}

      <div className="group-filters" aria-label="Filter groups">{filters.map(([value, text]) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)} aria-pressed={filter === value}>{text}</button>)}</div>
      {groups.isLoading && <div className="group-list-skeleton" aria-label="Loading groups"><i/><i/></div>}
      {groups.isError && <button className="inbox-state" onClick={() => groups.refetch()}>Groups could not load. Retry.</button>}
      {groups.isSuccess && allGroups.length === 0 && <div className="inbox-empty"><strong>START THE FIRST CREW.</strong><p>No groups match this filter yet.</p><button type="button" onClick={() => setCreating(true)}>Create a crew</button></div>}

      {joinedGroups.length > 0 && <section className="group-collection"><div className="group-collection__title"><h3>Your crews</h3><span>{joinedGroups.length}</span></div><div className="group-list">{joinedGroups.map((group) => <GroupCard key={group._id} group={group} />)}</div></section>}
      {availableGroups.length > 0 && <section className="group-collection"><div className="group-collection__title"><h3>{filter ? `${label(filter)} crews` : "Open around you"}</h3><span>{availableGroups.length}</span></div><div className="group-list">{availableGroups.map((group) => <GroupCard key={group._id} group={group} />)}</div></section>}
    </section>
  );
}
