"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearchParams } from "next/navigation";

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [queryPrefilled, setQueryPrefilled] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const canSubmit = email.trim().length > 0 && hasMinLength && hasUppercase && hasNumber;

  useEffect(() => {
    if (queryPrefilled) return;
    const prefillEmail = searchParams.get("email");
    if (prefillEmail) {
      setEmail(prefillEmail);
      setQueryPrefilled(true);
    }
  }, [searchParams, queryPrefilled]);

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

  // Success State
  if (message) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 mb-4">
            <Check className="h-6 w-6 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Check your email
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
            We sent a confirmation link to <strong className="text-foreground">{email}</strong>
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="skeuo-outline"
            className="w-full"
            onClick={() => {
              setMessage(null);
              setEmail("");
              setPassword("");
            }}
          >
            Use a different email
          </Button>
          <Link href="/login" className="block">
            <Button variant="ghost" className="w-full">
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Start managing your productions today
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
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
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li className={hasMinLength ? "text-emerald-600" : ""}>At least 8 characters</li>
              <li className={hasUppercase ? "text-emerald-600" : ""}>At least 1 uppercase letter</li>
              <li className={hasNumber ? "text-emerald-600" : ""}>At least 1 number</li>
            </ul>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button
          variant="skeuo"
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full"
        >
          {loading ? "Creating account..." : "Create account"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
