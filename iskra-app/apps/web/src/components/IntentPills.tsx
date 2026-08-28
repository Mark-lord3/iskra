import { useAppStore } from "../lib/store";

const options = ["Dating", "New friends", "Drinks", "Dancing", "Group hangout", "Networking"] as const;

export function IntentPills() {
  const selectedIntents = useAppStore((state) => state.selectedIntents);
  const setSelectedIntents = useAppStore((state) => state.setSelectedIntents);

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((intent) => {
        const selected = selectedIntents.includes(intent);

        return (
          <button
            key={intent}
            onClick={() => {
              const next = selected
                ? selectedIntents.filter((value) => value !== intent)
                : [...selectedIntents, intent];
              setSelectedIntents(next);
            }}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              selected
                ? "border-pink bg-softpink text-ink"
                : "border-hairline bg-softpink/60 text-muted"
            }`}
          >
            {intent}
          </button>
        );
      })}
    </div>
  );
}

