"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, Menu, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        router.push("/chat");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/chat?q=${encodeURIComponent(value)}` : "/chat");
  }

  return (
    <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-white/[0.06] bg-[#06040f]/72 px-4 backdrop-blur-2xl sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-white/70 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <form onSubmit={submit} className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search anything…"
          className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.035] pl-10 pr-16 text-[13px] text-white/85 outline-none transition placeholder:text-white/28 focus:border-violet/40 focus:bg-white/[0.05]"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-white/35">
          ⌘ K
        </kbd>
      </form>

      <div className="flex-1 sm:hidden" />

      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-mint/20 bg-mint/[0.06] px-3 py-1.5 text-[11px] font-medium text-mint/90 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_8px_#3ddc97]" />
          ORBITO online
        </span>

        <button
          type="button"
          className="focus-ring relative grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-white/60 transition hover:border-white/20 hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-[17px] w-[17px]" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-soft shadow-[0_0_8px_#a78bfa]" />
        </button>

        <Link
          href="/chat"
          className={cn(
            "focus-ring flex h-9 items-center gap-1.5 rounded-xl bg-violet px-3.5 text-[12.5px] font-semibold text-white",
            "shadow-[0_8px_28px_-10px_rgba(124,92,255,1)] transition hover:bg-[#8b6dff]",
          )}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New task</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>
    </header>
  );
}
