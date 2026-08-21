import { create } from "zustand";

type Intent =
  | "Dating"
  | "New friends"
  | "Drinks"
  | "Dancing"
  | "Group hangout"
  | "Networking";

type AppState = {
  selectedIntents: Intent[];
  setSelectedIntents: (intents: Intent[]) => void;
};

export const useAppStore = create<AppState>((set) => ({
  selectedIntents: ["Dating", "Dancing"],
  setSelectedIntents: (selectedIntents) => set({ selectedIntents })
}));

