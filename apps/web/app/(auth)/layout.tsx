import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
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
      <div className="hidden bg-[#1f2937] p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="flex items-center">
          <Image
            src="/logo.svg"
            alt="Wrapshoot logo"
            width={38}
            height={38}
            className="h-9 w-9 rounded-md"
            priority
          />
        </div>

        <div className="mt-16 max-w-lg space-y-5">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
              Production planning with shared context.
            </h2>
            <p className="text-sm leading-relaxed text-blue-100/80">
              Keep prep and shoot-day decisions connected in one place.
            </p>
          </div>

          <div className="space-y-1 text-sm text-blue-100/90">
            <p>Script breakdown, planning, and call sheets stay connected.</p>
            <p>Your team works from the same source of truth.</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24 bg-background">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.svg"
                alt="Wrapshoot logo"
                width={32}
                height={32}
                className="h-8 w-8 rounded-md"
                priority
              />
              <span className="text-lg font-semibold tracking-tight">wrapshoot</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Production planning from script analysis to call sheets.
            </p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
