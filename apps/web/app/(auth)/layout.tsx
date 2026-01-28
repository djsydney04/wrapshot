import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Clapperboard } from "lucide-react";

export default async function AuthLayout({
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

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-col justify-between bg-stone-900 text-white p-10">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <Clapperboard className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg">SetSync</span>
        </div>

        {/* Quote */}
        <div className="space-y-6">
          <blockquote className="text-2xl font-light leading-relaxed">
            &ldquo;SetSync transformed how we manage productions. From call sheets to
            scheduling, everything is finally in one place.&rdquo;
          </blockquote>
          <div>
            <p className="font-medium">Sarah Chen</p>
            <p className="text-white/60 text-sm">Line Producer, Summit Films</p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-white/40 text-sm">
          Production management for modern filmmakers
        </p>
      </div>

      {/* Right Panel - Form */}
      <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24 bg-background">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Clapperboard className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">SetSync</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
