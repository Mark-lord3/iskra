type ProfileCardProps = {
  name: string;
  age: number;
  distance: string;
  zone: string;
  status: string;
  bio: string;
  image: string;
};

export function ProfileCard(props: ProfileCardProps) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-pulse">
      <img className="h-64 w-full object-cover" src={props.image} alt={props.name} />
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-2xl text-white">
              {props.name}, {props.age}
            </h3>
            <p className="text-sm text-white/50">
              {props.distance} · {props.zone}
            </p>
          </div>
          <span className="rounded-full border border-ember-400/40 bg-ember-500/20 px-3 py-1 text-xs text-ember-50">
            {props.status}
          </span>
        </div>
        <p className="text-sm leading-6 text-white/70">{props.bio}</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-night-950">
            View profile
          </button>
          <button className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm font-semibold text-white">
            Wave
          </button>
        </div>
      </div>
    </article>
  );
}

