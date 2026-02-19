"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function PostHogAuthWrapper({ children }: { children: React.ReactNode }) {
  const posthogClient = usePostHog();

  useEffect(() => {
    const supabase = createClient();

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        posthogClient?.identify(user.id, {
          email: user.email,
          name: user.user_metadata?.name || user.user_metadata?.full_name,
          created_at: user.created_at,
        });
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        posthogClient?.identify(session.user.id, {
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.user_metadata?.full_name,
          created_at: session.user.created_at,
        });
      } else if (event === "SIGNED_OUT") {
        posthogClient?.reset();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [posthogClient]);

  return <>{children}</>;
}

interface PostHogProviderProps {
  children: React.ReactNode;
  posthogKey?: string;
  posthogHost?: string;
}

export function PostHogProvider({
  children,
  posthogKey,
  posthogHost,
}: PostHogProviderProps) {
  useEffect(() => {
    console.log("[PostHog] Initializing...", {
      key: posthogKey ? "present" : "missing",
      host: posthogHost,
    });

    if (typeof window !== "undefined" && posthogKey) {
      posthog.init(posthogKey, {
        api_host: posthogHost || "https://us.i.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
        disable_surveys: true, // Disable auto-popup, we use our own UI
        loaded: (ph) => {
          console.log("[PostHog] Loaded successfully!");
          if (process.env.NODE_ENV === "development") {
            ph.debug();
          }
        },
      });
    } else {
      console.warn("[PostHog] Not initialized - missing key or not in browser");
    }
  }, [posthogHost, posthogKey]);

  return (
    <PHProvider client={posthog}>
      <PostHogAuthWrapper>{children}</PostHogAuthWrapper>
    </PHProvider>
  );
}
