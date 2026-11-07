"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Command,
  FolderGit2,
  Menu,
  Moon,
  Search,
  Settings2,
  Sun,
  UserRound,
} from "lucide-react";

import { Kbd } from "@/components/ui/badge";
import { MenuItem, Popover, Tooltip } from "@/components/ui/overlay";
import { getHealth, getSystemAlerts, getWorkspaces } from "@/lib/api";
import { navLabelFor } from "@/lib/nav";
import { useTheme } from "@/lib/theme";
import type { SystemAlert, WorkspaceRoot } from "@/lib/types";
import { cn } from "@/lib/utils";

function titleCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 md:flex">
      <Link
        href="/"
        className="focus-ring rounded px-1 text-[11.5px] text-foreground-muted transition hover:text-foreground"
      >
        ORBITO
      </Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        const label = navLabelFor(href) ?? titleCase(segment);
        const last = index === segments.length - 1;
        return (
          <span key={href} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="h-3 w-3 shrink-0 text-foreground-muted/50" />
            {last ? (
              <span className="truncate px-1 text-[11.5px] font-medium text-foreground-secondary">
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="focus-ring truncate rounded px-1 text-[11.5px] text-foreground-muted transition hover:text-foreground"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function Notifications() {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getSystemAlerts()
      .then((data) => {
        if (alive) setAlerts(data.alerts);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Popover
      align="end"
      className="w-80 p-0"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label="Notifications"
          aria-expanded={open}
          className="focus-ring relative grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-foreground-secondary transition hover:border-border-strong hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {alerts.length ? (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warning shadow-[0_0_6px_var(--warning)]" />
          ) : null}
        </button>
      )}
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <p className="text-[11.5px] font-medium text-foreground">Notifications</p>
        <span className="font-mono text-[9px] text-foreground-muted">
          {loaded ? `${alerts.length} alerts` : "syncing…"}
        </span>
      </div>
      {alerts.length ? (
        <div className="max-h-72 overflow-y-auto p-1">
          {alerts.map((alert) => (
            <Link
              key={alert.id}
              href={alert.href ?? "/system"}
              className="block rounded-md px-2.5 py-2 transition hover:bg-foreground/5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] font-medium text-foreground">{alert.title}</span>
                <span className="font-mono text-[9px] text-foreground-muted">{alert.value}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[10px] text-foreground-muted">{alert.detail}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="px-3 py-6 text-center">
          <Check className="mx-auto h-4 w-4 text-success" />
          <p className="mt-2 text-[11px] text-foreground-secondary">
            {loaded ? "All monitored systems are within range." : "Checking system alerts…"}
          </p>
          <p className="mt-0.5 text-[9.5px] text-foreground-muted">
            Alerts appear here only when a real threshold is crossed.
          </p>
        </div>
      )}
      <div className="border-t border-border-subtle p-1">
        <Link
          href="/system"
          className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] text-foreground-secondary transition hover:bg-foreground/5 hover:text-foreground"
        >
          Open System Health
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </Popover>
  );
}

function WorkspaceSelector() {
  const [roots, setRoots] = useState<WorkspaceRoot[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getWorkspaces()
      .then((data) => {
        if (!alive) return;
        setRoots(data.roots);
        setCurrent(data.roots.find((root) => root.path === data.default)?.name ?? data.roots[0]?.name ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Popover
      align="start"
      className="w-72"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="focus-ring flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2 text-[11.5px] text-foreground-secondary transition hover:border-border-strong hover:text-foreground"
        >
          <FolderGit2 className="h-3.5 w-3.5 text-foreground-muted" />
          <span className="max-w-28 truncate">{current ?? "Local workspace"}</span>
          <ChevronDown className="h-3 w-3 text-foreground-muted" />
        </button>
      )}
    >
      <div className="border-b border-border-subtle px-2.5 py-2">
        <p className="type-eyebrow text-[9px] text-foreground-muted">Workspace</p>
        <p className="mt-0.5 text-[10.5px] text-foreground-muted">
          Files stay on this machine.
        </p>
      </div>
      <div className="p-1">
        {roots.length ? (
          roots.map((root) => (
            <button
              key={root.path}
              type="button"
              onClick={() => setCurrent(root.name)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11.5px] transition",
                current === root.name
                  ? "bg-primary/10 text-foreground"
                  : "text-foreground-secondary hover:bg-foreground/5",
              )}
            >
              <CircleDot
                className={cn("h-3 w-3", root.exists ? "text-success" : "text-warning")}
              />
              <span className="min-w-0 flex-1 truncate">{root.name}</span>
              {current === root.name ? <Check className="h-3 w-3 text-primary-hover" /> : null}
            </button>
          ))
        ) : (
          <p className="px-2 py-2 text-[10.5px] text-foreground-muted">No roots discovered yet.</p>
        )}
      </div>
      <div className="border-t border-border-subtle p-1">
        <Link
          href="/workspaces"
          className="flex items-center justify-between rounded-md px-2 py-1.5 text-[11px] text-foreground-secondary transition hover:bg-foreground/5 hover:text-foreground"
        >
          Manage workspaces
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </Popover>
  );
}

export function Topbar({
  onOpenMenu,
  onOpenSearch,
}: {
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    getHealth()
      .then(() => alive && setOnline(true))
      .catch(() => alive && setOnline(false));
    const timer = window.setInterval(() => {
      getHealth()
        .then(() => alive && setOnline(true))
        .catch(() => alive && setOnline(false));
    }, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-2 border-b border-border-subtle bg-background/75 px-3 backdrop-blur-xl sm:px-5">
      <button
        type="button"
        onClick={onOpenMenu}
        className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-surface text-foreground-secondary lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      <Breadcrumbs />
      <div className="flex-1" />

      <button
        type="button"
        onClick={onOpenSearch}
        className="focus-ring hidden h-8 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-[11.5px] text-foreground-muted transition hover:border-border-strong hover:text-foreground-secondary sm:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="pr-8">Search or run a command…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <Tooltip label="Command menu" side="bottom" className="sm:hidden">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open command menu"
          className="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-foreground-secondary"
        >
          <Command className="h-4 w-4" />
        </button>
      </Tooltip>

      <span
        className={cn(
          "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium md:flex",
          online === false
            ? "border-error/25 bg-error/[0.06] text-error"
            : "border-success/20 bg-success/[0.06] text-success",
        )}
        title={online === false ? "API unreachable" : "API connected"}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            online === false ? "bg-error" : online ? "bg-success shadow-[0_0_6px_var(--success)]" : "bg-foreground-muted",
          )}
        />
        {online === false ? "API offline" : online ? "API online" : "Connecting"}
      </span>

      <WorkspaceSelector />
      <Notifications />

      <Tooltip label={theme === "dark" ? "Light theme" : "Dark theme"} side="bottom">
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle theme"
          className="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-foreground-secondary transition hover:border-border-strong hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </Tooltip>

      <Popover
        align="end"
        trigger={({ open, toggle: toggleMenu }) => (
          <button
            type="button"
            onClick={toggleMenu}
            aria-expanded={open}
            aria-label="Profile menu"
            className="focus-ring grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-[#4338ca] text-[10px] font-semibold text-white"
          >
            OR
          </button>
        )}
      >
        <div className="border-b border-border-subtle px-2.5 py-2">
          <p className="text-[12px] font-medium text-foreground">Local profile</p>
          <p className="text-[10px] text-foreground-muted">Single-user workspace</p>
        </div>
        <div className="p-1">
          <MenuItem icon={<UserRound className="h-3.5 w-3.5" />} onClick={() => router.push("/settings?tab=profile")}>
            Profile & workspace
          </MenuItem>
          <MenuItem icon={<Settings2 className="h-3.5 w-3.5" />} onClick={() => router.push("/settings")}>
            Settings
          </MenuItem>
          <MenuItem
            icon={theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            onClick={toggle}
          >
            Switch theme
          </MenuItem>
          <MenuItem icon={<Command className="h-3.5 w-3.5" />} onClick={onOpenSearch}>
            Keyboard shortcuts
          </MenuItem>
        </div>
      </Popover>
    </header>
  );
}
