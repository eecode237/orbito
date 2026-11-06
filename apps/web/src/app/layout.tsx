import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";

import { AppShell } from "@/components/layout/app-shell";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ORBITO — Your personal AI operating system",
    template: "%s · ORBITO",
  },
  description:
    "ORBITO is a multi-agent AI workspace. One agent. Infinite possibilities. Apply for jobs, research the web, study, build and automate.",
  applicationName: "ORBITO",
  openGraph: {
    title: "ORBITO — One Agent. Infinite Possibilities.",
    description:
      "Your personal AI operating system. Career, research, study, build and automation in one workspace.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#06040f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${space.variable}`}>
      <body className="min-h-screen bg-ink text-[#f4f1ff] antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
