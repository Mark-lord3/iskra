import { motion } from "framer-motion";
import { BottomNav } from "./components/BottomNav";
import { IntentPills } from "./components/IntentPills";
import { ProfileCard } from "./components/ProfileCard";
import { groups, participants } from "./lib/mock-data";

function App() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.22),_transparent_28%),linear-gradient(180deg,_#121214_0%,_#09090b_55%,_#050506_100%)] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-md">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-pulse backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-ember-200">Club Iskra</p>
              <h1 className="mt-3 font-display text-4xl leading-tight">Meet people who are here tonight.</h1>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/70">
              184 live
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
            See who is open to meeting, find people nearby, message privately, and turn the night
            into a real-world connection.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button className="rounded-2xl bg-ember-500 px-5 py-3 font-semibold text-white">
              Join Tonight - $5
            </button>
            <button className="rounded-2xl border border-white/10 px-5 py-3 font-semibold text-white/80">
              Preview vibe
            </button>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-white/60">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">Private by design</div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">Venue-only access</div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">Photos expire tonight</div>
          </div>
        </motion.section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/50">Tonight you are open to</p>
              <h2 className="mt-1 text-lg font-semibold">Connection modes</h2>
            </div>
            <span className="text-xs text-ember-200">Live edit</span>
          </div>
          <div className="mt-4">
            <IntentPills />
          </div>
        </section>

        <section className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/50">Discover</p>
              <h2 className="text-xl font-semibold">People around you</h2>
            </div>
            <button className="text-sm text-ember-200">Radar view</button>
          </div>
          {participants.map((participant) => (
            <ProfileCard key={participant.id} {...participant} />
          ))}
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/50">Radar</p>
              <h2 className="text-xl font-semibold">Approximate venue proximity</h2>
            </div>
            <span className="text-xs text-white/45">No exact coordinates</span>
          </div>
          <div className="relative mt-6 flex aspect-square items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(circle,_rgba(249,115,22,0.2),_rgba(255,255,255,0.03)_38%,_rgba(255,255,255,0.02)_60%,_transparent_68%)]">
            <div className="absolute inset-10 rounded-full border border-white/10" />
            <div className="absolute inset-20 rounded-full border border-white/10" />
            <div className="absolute inset-28 rounded-full border border-white/10" />
            <div className="absolute flex h-20 w-20 items-center justify-center rounded-full bg-white text-sm font-semibold text-night-950">
              You
            </div>
            <img
              className="absolute left-10 top-16 h-14 w-14 rounded-full border-2 border-ember-400 object-cover"
              src={participants[0].image}
              alt={participants[0].name}
            />
            <img
              className="absolute right-12 top-24 h-14 w-14 rounded-full border-2 border-white object-cover"
              src={participants[1].image}
              alt={participants[1].name}
            />
            <img
              className="absolute bottom-16 right-20 h-14 w-14 rounded-full border-2 border-white/70 object-cover"
              src={participants[2].image}
              alt={participants[2].name}
            />
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/50">Group hangouts</p>
              <h2 className="text-xl font-semibold">Find a live crew</h2>
            </div>
            <button className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/70">
              Create group
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {groups.map((group) => (
              <article key={group.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{group.title}</h3>
                    <p className="text-sm text-white/50">
                      {group.members} people · {group.area}
                    </p>
                  </div>
                  <button className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-night-950">
                    Join
                  </button>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/65">{group.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.3em] text-ember-200">Privacy promise</p>
          <h2 className="mt-2 text-xl font-semibold">Your photos belong to tonight.</h2>
          <p className="mt-3 text-sm leading-6 text-white/65">
            Event profile photos, chat images, and group media are stored on the app server inside
            event-specific folders and automatically deleted after the event cleanup window.
          </p>
        </section>

        <BottomNav />
      </div>
    </main>
  );
}

export default App;

