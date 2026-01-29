"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectRole } from "@/lib/permissions";
import { useProjectStore } from "@/lib/stores/project-store";

// Types
export interface Subscription {
  plan: "FREE" | "PRO" | "STUDIO";
  status: "TRIALING" | "ACTIVE" | "CANCELED" | "PAST_DUE" | "UNPAID";
  trialEndsAt: string | null;
  stripeCurrentPeriodEnd: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
}

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  projectRoles: Record<string, ProjectRole>;
  subscription: Subscription | null;
  refreshAuth: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [projectRoles, setProjectRoles] = React.useState<Record<string, ProjectRole>>({});
  const [subscription, setSubscription] = React.useState<Subscription | null>(null);

  const supabase = createClient();

  const fetchUserData = React.useCallback(async (userId: string) => {
    const setProjects = useProjectStore.getState().setProjects;

    // Fetch project memberships with full project data
    const { data: projectData } = await supabase
      .from("ProjectMember")
      .select(`
        projectId,
        role,
        project:Project (
          id,
          organizationId,
          name,
          description,
          status,
          startDate,
          endDate,
          createdAt,
          updatedAt
        )
      `)
      .eq("userId", userId);

    const roles: Record<string, ProjectRole> = {};
    projectData?.forEach((p) => {
      roles[p.projectId] = p.role as ProjectRole;
    });
    setProjectRoles(roles);

    // Transform database projects to match Project type (convert nulls to empty strings)
    // The project field from Supabase join can be an object or null
    type ProjectRow = {
      id: string;
      organizationId: string;
      name: string;
      description: string | null;
      status: string;
      startDate: string | null;
      endDate: string | null;
      createdAt: string;
      updatedAt: string;
    };
    const projects = (projectData || [])
      .filter((p): p is typeof p & { project: ProjectRow } => p.project !== null && typeof p.project === "object" && !Array.isArray(p.project))
      .map((p) => ({
        id: p.project.id,
        name: p.project.name,
        description: p.project.description || "",
        status: p.project.status as "DEVELOPMENT" | "PRE_PRODUCTION" | "PRODUCTION" | "POST_PRODUCTION" | "COMPLETED" | "ON_HOLD",
        startDate: p.project.startDate || "",
        endDate: p.project.endDate || "",
        scenesCount: 0,
        shootingDaysCount: 0,
        castCount: 0,
        locationsCount: 0,
      }));
    setProjects(projects);

    // Fetch subscription for user
    const { data: subData } = await supabase
      .from("Subscription")
      .select("plan, status, trialEndsAt, stripeCurrentPeriodEnd, stripeSubscriptionId, cancelAtPeriodEnd")
      .eq("userId", userId)
      .maybeSingle();

    if (subData) {
      setSubscription(subData as Subscription);
    } else {
      // Default to free plan if no subscription
      setSubscription({
        plan: "FREE",
        status: "ACTIVE",
        trialEndsAt: null,
        stripeCurrentPeriodEnd: null,
        stripeSubscriptionId: null,
        cancelAtPeriodEnd: false,
      });
    }
  }, [supabase]);

  const refreshAuth = React.useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (authUser) {
      setUser({
        id: authUser.id,
        email: authUser.email ?? "",
      });
      await fetchUserData(authUser.id);
    } else {
      setUser(null);
      setProjectRoles({});
      setSubscription(null);
      useProjectStore.getState().setProjects([]);
    }

    setLoading(false);
  }, [supabase, fetchUserData]);

  // Initial auth check
  React.useEffect(() => {
    refreshAuth();

    // Listen for auth changes
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? "",
        });
        fetchUserData(session.user.id);
      } else {
        setUser(null);
        setProjectRoles({});
        setSubscription(null);
        useProjectStore.getState().setProjects([]);
      }
      setLoading(false);
    });

    return () => {
      authSubscription.unsubscribe();
    };
  }, [refreshAuth, supabase, fetchUserData]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        projectRoles,
        subscription,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
