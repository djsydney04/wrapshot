import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CommandPalette } from "@/components/command-palette";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SetSync - Film Production Scheduling",
  description: "AI-powered movie production scheduling platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <CommandPalette />
      </body>
    </html>
  );
}
