"use client";

import Link from "next/link";
import {
  Clapperboard,
  Film,
  Calendar,
  Users,
  FileText,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Film,
    title: "Replace Final Draft Breakdowns",
    description: "AI-powered script analysis and scene breakdowns in seconds",
  },
  {
    icon: Calendar,
    title: "Replace Excel Schedules",
    description: "Smart scheduling with automatic conflict detection",
  },
  {
    icon: Users,
    title: "Replace Email Chains",
    description: "Centralized team communication and availability tracking",
  },
  {
    icon: FileText,
    title: "Replace PDF Call Sheets",
    description: "One-click generation with instant notifications",
  },
];

const benefits = [
  "Cut pre-production time in half",
  "Eliminate scheduling conflicts",
  "Keep everyone in sync, always",
];

const testimonials = [
  {
    quote: "Finally, one tool instead of five. Our pre-production is 3x faster.",
    author: "Sarah Chen",
    role: "Producer",
  },
  {
    quote: "No more juggling spreadsheets and email. This is the future.",
    author: "Marcus Webb",
    role: "1st AD",
  },
];

export default function WelcomePage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-muted/30 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-blue-500 blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Clapperboard className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">SetSync</span>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-tight">
              The all-in-one
              <br />
              production platform
            </h1>
            <p className="mt-3 text-base text-muted-foreground max-w-md leading-relaxed">
              Replace your spreadsheets, email chains, and production binders with one powerful workspace. From script to screen.
            </p>
          </div>

          {/* Benefits list */}
          <div className="space-y-2">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <span className="text-sm text-foreground">{benefit}</span>
              </div>
            ))}
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-background/50 border border-border/50"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold leading-tight">{feature.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Social proof */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
            <span>Trusted by 500+ production teams</span>
          </div>

          <div className="flex gap-3">
            {testimonials.map((testimonial, i) => (
              <div
                key={i}
                className="flex-1 p-3 rounded-lg bg-background/50 border border-border/50"
              >
                <p className="text-xs italic text-muted-foreground leading-relaxed">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div className="mt-2">
                  <p className="text-xs font-medium">{testimonial.author}</p>
                  <p className="text-[10px] text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Auth Options */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex flex-col items-center lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary mb-3">
              <Clapperboard className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-semibold">SetSync</h1>
            <p className="text-xs text-muted-foreground mt-1">
              The all-in-one production platform
            </p>
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block text-center">
            <h2 className="text-xl font-semibold">Get started</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to your account or create a new one
            </p>
          </div>

          {/* Auth buttons */}
          <div className="space-y-3">
            <Button asChild className="w-full h-11" size="lg">
              <Link href="/signup">
                Create an account
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full h-11" size="lg">
              <Link href="/login">
                Sign in
              </Link>
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or continue with
              </span>
            </div>
          </div>

          {/* Social auth buttons (placeholder for future) */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" disabled className="h-11">
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>
            <Button variant="outline" disabled className="h-11">
              <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </Button>
          </div>

          {/* Terms */}
          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
