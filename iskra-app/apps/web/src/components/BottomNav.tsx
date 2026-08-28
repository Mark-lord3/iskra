import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const items = [
  { label: "Discover", to: "/discover" },
  { label: "Royal", to: "/royal" },
  { label: "Messages", to: "/messages" },
  { label: "Groups", to: "/groups" },
  { label: "Profile", to: "/profile" }
];

export function BottomNav({ eventId, enabled }: { eventId?: string; enabled?: boolean }) {
  const conversations = useQuery({ queryKey: ["conversations", eventId], queryFn: () => api<Array<{ unread: number }>>(`/social/conversations/event/${eventId}`), enabled: Boolean(eventId && enabled), refetchInterval: 15_000 });
  const unread = (conversations.data || []).reduce((total, thread) => total + thread.unread, 0);
  return (
    <nav aria-label="Venue app" className="venue-nav fixed left-3 right-3 z-30 mx-auto grid max-w-md grid-cols-5 gap-1 rounded-3xl border border-hairline bg-surface p-2 shadow-pulse"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
      {items.map((item) => (
        <NavLink key={item.label} to={item.to} className={({ isActive }) => `venue-nav__link flex min-h-[44px] items-center justify-center rounded-2xl px-2 text-center text-xs font-medium transition ${isActive ? "is-active bg-pink-fill text-white" : "text-muted hover:bg-softpink hover:text-ink"}`}>
          <span>{item.label}</span>{item.label === "Messages" && unread > 0 && <b className="nav-unread">{unread > 9 ? "9+" : unread}</b>}
        </NavLink>
      ))}
    </nav>
  );
}
