const items = ["Discover", "Radar", "Groups", "Chat", "Profile"];

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 mt-8 grid grid-cols-5 gap-2 rounded-3xl border border-white/10 bg-white/5 p-2 backdrop-blur">
      {items.map((item) => (
        <button
          key={item}
          className="rounded-2xl px-2 py-3 text-center text-xs font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
        >
          {item}
        </button>
      ))}
    </nav>
  );
}

