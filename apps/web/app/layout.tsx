import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { CommandPalette } from "@/components/command-palette";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { Toaster } from "sonner";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

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
        url: "https://hhmdkkkpaukfcwfmdxyl.supabase.co/storage/v1/object/public/logo/sharephoto.png",
        alt: "wrapshoot share preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "wrapshoot - Film Production Scheduling",
    description: "Production management for modern filmmakers",
    images: ["https://hhmdkkkpaukfcwfmdxyl.supabase.co/storage/v1/object/public/logo/sharephoto.png"],
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const posthogKey = process.env.NEXT_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_POSTHOG_HOST;

  return (
    <html lang="en">
      <body
        className={`${manrope.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable} font-sans antialiased`}
      >
        <PostHogProvider posthogKey={posthogKey} posthogHost={posthogHost}>
          {children}
          <CommandPalette />
          <Toaster
            position="bottom-right"
            closeButton
            theme="system"
            toastOptions={{
              classNames: {
                toast: "app-toast",
                title: "app-toast-title",
                description: "app-toast-description",
                actionButton: "app-toast-action",
                cancelButton: "app-toast-cancel",
                success: "app-toast-success",
                error: "app-toast-error",
                warning: "app-toast-warning",
                info: "app-toast-info",
                loading: "app-toast-loading",
              },
            }}
          />
        </PostHogProvider>
      </body>
    </html>
  );
}
