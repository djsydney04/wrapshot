import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StoreProvider } from "@/components/providers/store-provider";
import { AuthProvider } from "@/components/providers/auth-provider";

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

  return (
    <StoreProvider>
      <AuthProvider>
        <AppShell user={{ email: user.email }}>
          {children}
        </AppShell>
      </AuthProvider>
    </StoreProvider>
  );
}
