"use client";

import { useState } from "react";
import Link from "next/link";
import { Clapperboard, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setMessage("Check your email to confirm your account!");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary mb-4">
          <Clapperboard className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start managing your film productions
        </p>
      </div>

      {/* Success Message */}
      {message ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 mx-auto mb-3">
            <Check className="h-5 w-5 text-green-600" />
          </div>
          <h3 className="font-medium text-green-900">Check your email</h3>
          <p className="mt-1 text-sm text-green-700">
            We&apos;ve sent you a confirmation link at <strong>{email}</strong>
          </p>
          <Link href="/login">
            <Button variant="outline" className="mt-4">
              Back to sign in
            </Button>
          </Link>
        </div>
      ) : (
        /* Form */
        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
