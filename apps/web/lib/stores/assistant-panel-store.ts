import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AssistantPanelState {
  panelOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
}

const storage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(name);
  },
};

export const useAssistantPanelStore = create<AssistantPanelState>()(
  persist(
    (set) => ({
      panelOpen: false,
      togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
      openPanel: () => set({ panelOpen: true }),
      closePanel: () => set({ panelOpen: false }),
    }),
    {
      name: "wrapshot-assistant-panel",
      storage: createJSONStorage(() => storage),
    }
  )
);
