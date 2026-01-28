import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If already logged in, redirect to dashboard
  if (user) {
    redirect("/");
  }

  // Full-screen layout without centering
  return <>{children}</>;
}
