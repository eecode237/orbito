"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  Sparkles,
} from "lucide-react";

import { BrandLockup, BrandMark, OrbitMark } from "@/components/brand/orbito-mark";
import { Kbd } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/overlay";
import { navGroups, settingsItem, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenSearch: () => void;
};

function isActive(pathname: string, item: NavItem) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-ring group relative flex items-center rounded-lg transition-colors duration-150",
        collapsed ? "mx-auto h-9 w-9 justify-center" : "h-8 gap-2.5 px-2.5",
        active
          ? "bg-primary/10 text-foreground"
          : "text-foreground-secondary hover:bg-foreground/[0.045] hover:text-foreground",
      )}
    >
      {active ? (
        <span
          aria-hidden
          className={cn(
            "absolute rounded-full bg-primary",
            collapsed ? "-left-1.5 h-4 w-0.5" : "-left-2 h-4 w-0.5",
          )}
        />
      ) : null}
      <Icon
        className={cn(
          "shrink-0 transition-colors",
          collapsed ? "h-[18px] w-[18px]" : "h-[16px] w-[16px]",
          active ? "text-primary-hover" : "text-foreground-muted group-hover:text-foreground-secondary",
        )}
      />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{item.label}</span>
          {item.badge ? (
            <span
              className={cn(
                "rounded px-1 py-px text-[8px] font-semibold uppercase tracking-wide",
                item.badge === "Live"
                  ? "bg-success/15 text-success"
                  : item.badge === "Beta"
                    ? "bg-primary/15 text-primary-hover"
                    : "bg-foreground/5 text-foreground-muted",
              )}
            >
              {item.badge}
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip label={item.label} side="right">
        {link}
      </Tooltip>
    );
  }
  return link;
}

export function SidebarContent({
  collapsed = false,
  onNavigate,
  onToggleCollapsed,
  onOpenSearch,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapsed?: () => void;
  onOpenSearch?: () => void;
}) {
  const pathname = usePathname();
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});

  const groups = useMemo(
    () =>
      navGroups.map((group) => ({
        ...group,
        open: !closedGroups[group.label],
      })),
    [closedGroups],
  );

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-[68px] shrink-0 items-center border-b border-border-subtle",
          collapsed ? "justify-center px-2" : "justify-between px-3.5",
        )}
      >
        <Link href="/" onClick={onNavigate} className="focus-ring rounded-lg" aria-label="ORBITO home">
          {collapsed ? <BrandMark size="sm" /> : <BrandLockup />}
        </Link>
        {!collapsed && onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Collapse sidebar"
            className="focus-ring grid h-7 w-7 place-items-center rounded-md text-foreground-muted transition hover:bg-foreground/5 hover:text-foreground"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {collapsed && onToggleCollapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Expand sidebar"
          className="focus-ring mx-auto mt-2 grid h-7 w-7 place-items-center rounded-md text-foreground-muted transition hover:bg-foreground/5 hover:text-foreground"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      ) : null}

      <div className={cn("shrink-0", collapsed ? "px-2 pt-2" : "px-3 pt-3")}>
        {collapsed ? (
          <Tooltip label="New task (⌘N)" side="right">
            <Link
              href="/chat"
              onClick={onNavigate}
              aria-label="New task"
              className="focus-ring mx-auto grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-primary/12 text-primary-hover transition hover:bg-primary/20"
            >
              <Plus className="h-4 w-4" />
            </Link>
          </Tooltip>
        ) : (
          <Link
            href="/chat"
            onClick={onNavigate}
            className="focus-ring flex h-9 items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-2.5 text-[12.5px] font-medium text-foreground transition hover:border-primary/50 hover:bg-primary/15"
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary-hover" />
              New task
            </span>
            <Kbd>⌘N</Kbd>
          </Link>
        )}
      </div>

      <nav
        aria-label="Primary"
        className={cn("no-scrollbar mt-2 flex-1 overflow-y-auto pb-3", collapsed ? "px-2" : "px-3")}
      >
        {groups.map((group, index) => {
          const visible = collapsed || group.open;
          return (
            <div key={group.label} className={cn(collapsed ? "mb-1.5" : "mb-2.5")}>
              {collapsed ? (
                index > 0 ? <div className="mx-auto mb-1.5 h-px w-5 bg-border-subtle" /> : null
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setClosedGroups((previous) => ({
                      ...previous,
                      [group.label]: !previous[group.label],
                    }))
                  }
                  aria-expanded={group.open}
                  className="focus-ring flex w-full items-center justify-between rounded px-1.5 py-1 text-left"
                >
                  <span className="type-eyebrow text-[9px] text-foreground-muted">{group.label}</span>
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 text-foreground-muted/70 transition-transform duration-150",
                      group.open && "rotate-90",
                    )}
                  />
                </button>
              )}
              {visible ? (
                <div className={cn("space-y-0.5", !collapsed && "mt-1")}>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      active={isActive(pathname, item)}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className={cn("shrink-0 border-t border-border-subtle p-2", collapsed && "px-2")}>
        <div className={cn("flex", collapsed ? "flex-col items-center gap-1" : "flex-col gap-0.5")}>
          <NavLink
            item={settingsItem}
            active={pathname.startsWith("/settings")}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
          {collapsed ? (
            <Tooltip label="Command menu (⌘K)" side="right">
              <button
                type="button"
                onClick={onOpenSearch}
                aria-label="Open command menu"
                className="focus-ring mx-auto grid h-9 w-9 place-items-center rounded-lg text-foreground-muted transition hover:bg-foreground/5 hover:text-foreground"
              >
                <CircleHelp className="h-[17px] w-[17px]" />
              </button>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={onOpenSearch}
              className="focus-ring flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-left text-[12.5px] font-medium text-foreground-secondary transition hover:bg-foreground/[0.045] hover:text-foreground"
            >
              <CircleHelp className="h-4 w-4 text-foreground-muted" />
              <span className="flex-1">Help & commands</span>
              <Kbd>⌘K</Kbd>
            </button>
          )}
        </div>

        <div className={cn("mt-2 border-t border-border-subtle pt-2", collapsed && "flex justify-center")}>
          {collapsed ? (
            <Tooltip label="Local profile" side="right">
              <button
                type="button"
                aria-label="Local profile"
                className="focus-ring grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-[#4338ca] text-[10px] font-semibold text-white"
              >
                OR
              </button>
            </Tooltip>
          ) : (
            <Link
              href="/settings?tab=profile"
              onClick={onNavigate}
              className="focus-ring flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition hover:bg-foreground/[0.045]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-[#4338ca] text-[10px] font-semibold text-white shadow-[0_0_18px_-6px_var(--primary)]">
                OR
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-foreground">Local profile</span>
                <span className="flex items-center gap-1 text-[9.5px] text-foreground-muted">
                  <span className="h-1 w-1 rounded-full bg-success" />
                  Local-first workspace
                </span>
              </span>
              <Settings2 className="h-3.5 w-3.5 text-foreground-muted" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ collapsed, onToggleCollapsed, onOpenSearch }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden border-r border-border-subtle bg-background-secondary/80 backdrop-blur-xl transition-[width] duration-200 lg:block",
        collapsed ? "w-[68px]" : "w-[252px]",
      )}
    >
      <SidebarContent
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        onOpenSearch={onOpenSearch}
      />
    </aside>
  );
}

export function MobileBrand() {
  return (
    <div className="flex items-center gap-2">
      <OrbitMark className="h-6 w-6" />
      <span className="font-display text-[13px] font-semibold tracking-[0.2em] text-foreground">ORBITO</span>
      <Sparkles className="h-3 w-3 text-primary-hover" />
    </div>
  );
}
