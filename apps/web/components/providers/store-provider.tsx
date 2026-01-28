"use client";

import * as React from "react";
import { useLayoutStore } from "@/lib/stores/layout-store";

interface StoreProviderProps {
  children: React.ReactNode;
}

export function StoreProvider({ children }: StoreProviderProps) {
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Wait for client-side hydration
  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Rehydrate the zustand store on mount
  React.useEffect(() => {
    // This ensures the store is properly rehydrated
    useLayoutStore.persist.rehydrate();
  }, []);

  if (!isHydrated) {
    // Return children but in a way that won't cause hydration mismatch
    // The stores will use their default values until hydrated
    return <>{children}</>;
  }

  return <>{children}</>;
}
