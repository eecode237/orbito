"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, Plus } from "lucide-react";

import { BrandLockup } from "@/components/brand/orbito-mark";
import { navGroups, settingsItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[76px] shrink-0 items-center justify-between px-5">
        <Link href="/" onClick={onNavigate} className="focus-ring rounded-xl">
          <BrandLockup />
        </Link>
      </div>

      <div className="px-3">
        <Link
          href="/chat"
          onClick={onNavigate}
          className="focus-ring flex items-center justify-between gap-2 rounded-xl border border-violet/30 bg-violet/12 px-3 py-2.5 text-sm font-medium text-white/90 transition hover:border-violet/55 hover:bg-violet/20"
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-violet-soft" />
            New task
          </span>
          <kbd className="rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-white/40">
            ⌘N
          </kbd>
        </Link>
      </div>

      <nav className="no-scrollbar mt-5 flex-1 overflow-y-auto px-3 pb-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/25">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "focus-ring group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition",
                      active
                        ? "bg-gradient-to-r from-violet/22 to-violet/5 text-white shadow-[inset_0_0_0_1px_rgba(167,139,250,0.22)]"
                        : "text-white/55 hover:bg-white/[0.045] hover:text-white/90",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[17px] w-[17px]",
                        active ? "text-violet-soft" : "text-white/35 group-hover:text-white/70",
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                          item.badge === "Beta"
                            ? "bg-mint/15 text-mint"
                            : "bg-white/5 text-white/35",
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div className="border-t border-white/5 pt-3">
          <Link
            href={settingsItem.href}
            onClick={onNavigate}
            className={cn(
              "focus-ring group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition",
              pathname.startsWith("/settings")
                ? "bg-gradient-to-r from-violet/22 to-violet/5 text-white shadow-[inset_0_0_0_1px_rgba(167,139,250,0.22)]"
                : "text-white/55 hover:bg-white/[0.045] hover:text-white/90",
            )}
          >
            <settingsItem.icon
              className={cn(
                "h-[17px] w-[17px]",
                pathname.startsWith("/settings")
                  ? "text-violet-soft"
                  : "text-white/35 group-hover:text-white/70",
              )}
            />
            {settingsItem.label}
          </Link>
        </div>
      </nav>

      <div className="shrink-0 border-t border-white/5 p-3">
        <button
          type="button"
          className="focus-ring flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.045]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet to-[#4338ca] text-xs font-semibold text-white shadow-[0_0_20px_-4px_rgba(124,92,255,0.8)]">
            E
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-white/90">Explorer</span>
            <span className="block text-[10.5px] text-mint/80">Pro plan · Demo workspace</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-white/30" />
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-white/[0.06] bg-[#080513]/90 backdrop-blur-2xl lg:block">
      <SidebarContent />
    </aside>
  );
}
