import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppShell } from "@/components/layout/app-shell";

import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ORBITO — Personal AI operating system",
    template: "%s · ORBITO",
  },
  description:
    "ORBITO is a local-first AI operating system. One intelligence, infinite possibilities. Delegate work to agents, route models, scrape the web and observe every execution.",
  applicationName: "ORBITO",
  keywords: [
    "AI operating system",
    "agents",
    "local models",
    "Ollama",
    "orchestration",
    "observability",
  ],
  openGraph: {
    title: "ORBITO — One intelligence. Infinite possibilities.",
    description:
      "A local-first AI operating system with agents, model routing, execution observability and live machine telemetry.",
    type: "website",
    siteName: "ORBITO",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080713" },
    { media: "(prefers-color-scheme: light)", color: "#f6f5fa" },
  ],
  width: "device-width",
  initialScale: 1,
};

const themeScript = `(function(){try{var t=localStorage.getItem("orbito-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}else{document.documentElement.dataset.theme="dark";}}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
