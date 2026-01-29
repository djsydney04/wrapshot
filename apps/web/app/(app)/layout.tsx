import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { StoreProvider } from "@/components/providers/store-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { TourProvider } from "@/components/tour/tour-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get current path to avoid redirect loops
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || headersList.get("x-invoke-path") || "";
  const isOnboardingPage = pathname.startsWith("/onboarding");

  // Safety net: Check if user has completed onboarding (skip if already on onboarding page)
  if (!isOnboardingPage) {
    const { data: profile } = await supabase
      .from("UserProfile")
      .select("onboardingCompletedAt")
      .eq("userId", user.id)
      .maybeSingle();

    if (!profile?.onboardingCompletedAt) {
      redirect("/onboarding");
    }
  }

  // For onboarding page, render without the AppShell
  if (isOnboardingPage) {
    return (
      <StoreProvider>
        <AuthProvider>{children}</AuthProvider>
      </StoreProvider>
    );
  }

  return (
    <StoreProvider>
      <AuthProvider>
        <TourProvider>
          <AppShell user={{ email: user.email }}>{children}</AppShell>
        </TourProvider>
      </AuthProvider>
    </StoreProvider>
  );
}
