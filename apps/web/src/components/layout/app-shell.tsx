"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Sidebar, SidebarContent } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar />

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 w-[286px] border-r border-white/10 bg-[#080513] shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="focus-ring absolute right-3 top-4 z-10 grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/60"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[264px]">
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1560px] px-4 pb-24 sm:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
