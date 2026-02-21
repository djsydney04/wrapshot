"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export function useSignOut() {
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const supabase = React.useMemo(() => createClient(), []);

  const signOut = React.useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      const response = await fetch("/auth/signout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Server sign out failed");
      }
    } catch {
      await supabase.auth.signOut();
    } finally {
      window.location.assign("/login");
    }
  }, [isSigningOut, supabase]);

  return { signOut, isSigningOut };
}
