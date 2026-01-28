import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface LayoutState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  commandPaletteOpen: boolean;
  activeProjectId: string | null;
  _hasHydrated: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setActiveProject: (id: string | null) => void;
  setHasHydrated: (state: boolean) => void;
}

// Custom storage that handles SSR
const storage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") return null;
    const item = localStorage.getItem(name);
    return item;
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

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarWidth: 240,
      commandPaletteOpen: false,
      activeProjectId: null,
      _hasHydrated: false,

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      setActiveProject: (id) => set({ activeProjectId: id }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "setsync-layout",
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
