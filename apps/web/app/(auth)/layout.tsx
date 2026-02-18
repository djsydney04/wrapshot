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
      <div className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-12 relative overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar to-sidebar-hover" />

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-sidebar-hover/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-sidebar-hover/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        {/* Content */}
        <div className="relative z-10">
          <span className="font-semibold text-lg tracking-tight">wrapshoot</span>
        </div>

        {/* Main copy */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-medium tracking-tight leading-tight">
              Schedule shoots.
              <br />
              Manage crew.
              <br />
              Wrap on time.
            </h1>
          </div>

          {/* Subtle divider */}
          <div className="w-12 h-px bg-sidebar-border" />

          <p className="text-sidebar-foreground-muted text-sm max-w-xs">
            The production management platform built for modern filmmakers.
          </p>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-sidebar-foreground-muted text-xs">
            © {new Date().getFullYear()} wrapshoot
          </p>
        </div>
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
