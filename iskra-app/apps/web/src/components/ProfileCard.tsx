type ProfileCardProps = {
  id: string;
  name: string;
  age: number | null;
  zone: string;
  status: string;
  bio: string;
  image: string | null;
  onView: () => void;
  onWave: () => void;
  waving?: boolean;
};

export function ProfileCard(props: ProfileCardProps) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-pulse">
      {props.image ? <img className="h-64 w-full object-cover" src={props.image} alt={props.name} /> : <div className="grid h-64 place-items-center bg-[radial-gradient(circle,_rgba(249,115,22,.32),_transparent_52%)] font-display text-7xl text-white/80">{props.name.slice(0, 1)}</div>}
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl text-white">
              {props.name}{props.age ? `, ${props.age}` : ""}
            </h3>
            <p className="text-sm text-white/50">
              Checked in · {props.zone}
            </p>
          </div>
          <span className="rounded-full border border-ember-400/40 bg-ember-500/20 px-3 py-1 text-xs text-ember-50">
            {props.status}
          </span>
        </div>
        <p className="text-sm leading-6 text-white/70">{props.bio}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={props.onView} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-night-950">
            View profile
          </button>
          <button type="button" onClick={props.onWave} disabled={props.waving} className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {props.waving ? "Sending..." : "Wave"}
          </button>
        </div>
      </div>
    </article>
  );
}
