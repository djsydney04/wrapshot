import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette } from "@/components/command-palette";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: {
    default: "wrapshoot - Film Production Scheduling",
    template: "%s | wrapshoot",
  },
  description: "Production management for modern filmmakers. Manage scenes, schedules, call sheets, and budgets all in one place.",
  keywords: ["film production", "scheduling", "call sheets", "production management", "filmmaking", "movie production"],
  authors: [{ name: "wrapshoot" }],
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "wrapshoot - Film Production Scheduling",
    description: "Production management for modern filmmakers. Manage scenes, schedules, call sheets, and budgets all in one place.",
    url: "https://wrapshoot.com",
    siteName: "wrapshoot",
    images: [
      {
        url: "https://hhmdkkkpaukfcwfmdxyl.supabase.co/storage/v1/object/public/logo/logo.svg",
        width: 512,
        height: 512,
        alt: "wrapshoot logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "wrapshoot - Film Production Scheduling",
    description: "Production management for modern filmmakers",
    images: ["https://hhmdkkkpaukfcwfmdxyl.supabase.co/storage/v1/object/public/logo/logo.svg"],
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <PostHogProvider>
          {children}
          <CommandPalette />
          <Toaster position="bottom-right" richColors />
        </PostHogProvider>
      </body>
    </html>
  );
}
