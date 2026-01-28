import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({
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

  // Check if onboarding is already completed
  const { data: profile } = await supabase
    .from("UserProfile")
    .select("onboardingCompletedAt")
    .eq("userId", user.id)
    .single();

  // If onboarding is already completed, redirect to dashboard
  if (profile?.onboardingCompletedAt) {
    redirect("/");
  }

  // Full-page layout without app shell
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
