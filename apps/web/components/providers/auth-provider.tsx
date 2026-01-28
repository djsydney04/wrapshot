"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrgRole, ProjectRole } from "@/lib/permissions";

// Types
interface Organization {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
}

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
  organizations: Organization[];
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization | null) => void;
  projectRoles: Record<string, ProjectRole>;
  subscription: Subscription | null;
  refreshAuth: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = React.useState<Organization | null>(null);
  const [projectRoles, setProjectRoles] = React.useState<Record<string, ProjectRole>>({});
  const [subscription, setSubscription] = React.useState<Subscription | null>(null);

  const supabase = createClient();

  const fetchUserData = React.useCallback(async (userId: string) => {
    // Fetch organization memberships
    const { data: orgData } = await supabase
      .from("OrganizationMember")
      .select(
        `
        role,
        organization:Organization (
          id,
          name,
          slug
        )
      `
      )
      .eq("userId", userId);

    const orgs: Organization[] =
      orgData?.map((m) => {
        const org = m.organization as unknown as { id: string; name: string; slug: string } | null;
        return {
          id: org?.id ?? "",
          name: org?.name ?? "",
          slug: org?.slug ?? "",
          role: m.role as OrgRole,
        };
      }).filter((o) => o.id) ?? [];

    setOrganizations(orgs);

    // Set current org to first one if not set
    if (orgs.length > 0 && !currentOrg) {
      setCurrentOrg(orgs[0]);
    }

    // Fetch project memberships
    const { data: projectData } = await supabase
      .from("ProjectMember")
      .select("projectId, role")
      .eq("userId", userId);

    const roles: Record<string, ProjectRole> = {};
    projectData?.forEach((p) => {
      roles[p.projectId] = p.role as ProjectRole;
    });
    setProjectRoles(roles);

    // Fetch subscription for current org
    if (orgs.length > 0) {
      const orgId = currentOrg?.id ?? orgs[0].id;
      const { data: subData } = await supabase
        .from("Subscription")
        .select("plan, status, trialEndsAt, stripeCurrentPeriodEnd, stripeSubscriptionId, cancelAtPeriodEnd")
        .eq("organizationId", orgId)
        .single();

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
    }
  }, [currentOrg, supabase]);

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
      setOrganizations([]);
      setCurrentOrg(null);
      setProjectRoles({});
      setSubscription(null);
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
        setOrganizations([]);
        setCurrentOrg(null);
        setProjectRoles({});
        setSubscription(null);
      }
      setLoading(false);
    });

    return () => {
      authSubscription.unsubscribe();
    };
  }, [refreshAuth, supabase, fetchUserData]);

  // Update subscription when current org changes
  React.useEffect(() => {
    if (currentOrg && user) {
      supabase
        .from("Subscription")
        .select("plan, status, trialEndsAt, stripeCurrentPeriodEnd, stripeSubscriptionId, cancelAtPeriodEnd")
        .eq("organizationId", currentOrg.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setSubscription(data as Subscription);
          } else {
            setSubscription({
              plan: "FREE",
              status: "ACTIVE",
              trialEndsAt: null,
              stripeCurrentPeriodEnd: null,
              stripeSubscriptionId: null,
              cancelAtPeriodEnd: false,
            });
          }
        });
    }
  }, [currentOrg, user, supabase]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        organizations,
        currentOrg,
        setCurrentOrg,
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
