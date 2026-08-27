import { NavLink } from "react-router-dom";

const items = [
  { label: "Discover", to: "/discover" },
  { label: "Royal", to: "/royal" },
  { label: "Radar", to: "/radar" },
  { label: "Groups", to: "/groups" },
  { label: "Profile", to: "/profile" }
];

export function BottomNav() {
  return (
    <nav aria-label="Venue app" className="fixed bottom-3 left-3 right-3 z-30 mx-auto grid max-w-md grid-cols-5 gap-1 rounded-3xl border border-white/10 bg-night-950/95 p-2 shadow-pulse backdrop-blur">
      {items.map((item) => (
        <NavLink key={item.label} to={item.to} className={({ isActive }) => `rounded-2xl px-2 py-3 text-center text-xs font-medium transition ${isActive ? "bg-ember-500 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
