import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
        <div className="flex items-center">
          <span className="font-semibold text-lg">wrapshoot</span>
        </div>

        {/* Tagline */}
        <div>
          <p className="text-2xl font-light leading-relaxed">
            Production management for modern filmmakers.
          </p>
        </div>

        {/* Footer spacer */}
        <div />
      </div>

      {/* Right Panel - Form */}
      <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24 bg-background">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="flex items-center mb-8 lg:hidden">
            <span className="font-semibold text-lg">wrapshoot</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
