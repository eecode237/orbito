"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Command,
  CornerDownLeft,
  Moon,
  Search,
  Sun,
} from "lucide-react";

import { Kbd } from "@/components/ui/badge";
import { navGroups } from "@/lib/nav";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  href?: string;
  icon?: React.ReactNode;
  run?: () => void;
};

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const navigation: Command[] = navGroups.flatMap((group) =>
      group.items.map((item) => ({
        id: `nav-${item.href}`,
        label: item.label,
        hint: item.href,
        group: group.label,
        href: item.href,
        icon: <item.icon className="h-3.5 w-3.5" />,
      })),
    );
    const actions: Command[] = [
      {
        id: "action-new-task",
        label: "Start a new task",
        hint: "Open chat with a fresh conversation",
        group: "Actions",
        href: "/chat",
        icon: <ArrowRight className="h-3.5 w-3.5" />,
      },
      {
        id: "action-theme",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        hint: "Appearance",
        group: "Actions",
        icon: theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />,
        run: toggle,
      },
      {
        id: "action-models",
        label: "Model Hub",
        hint: "Local and cloud providers",
        group: "Actions",
        href: "/models",
        icon: <Command className="h-3.5 w-3.5" />,
      },
      {
        id: "action-design",
        label: "Design system",
        hint: "Tokens, components and patterns",
        group: "Actions",
        href: "/design-system",
        icon: <Command className="h-3.5 w-3.5" />,
      },
    ];
    return [...actions, ...navigation];
  }, [theme, toggle]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands.slice(0, 12);
    return commands
      .filter(
        (command) =>
          command.label.toLowerCase().includes(needle) ||
          command.hint?.toLowerCase().includes(needle) ||
          command.group.toLowerCase().includes(needle),
      )
      .slice(0, 14);
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setQuery("");
      setActive(0);
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered.length, active]);

  if (!open) return null;

  function choose(command: Command | undefined) {
    if (!command) return;
    onClose();
    if (command.run) command.run();
    if (command.href) router.push(command.href);
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)] animate-rise"
      >
        <div className="flex items-center gap-2.5 border-b border-border-subtle px-3.5 py-3">
          <Search className="h-4 w-4 shrink-0 text-foreground-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => (index + 1) % Math.max(1, filtered.length));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => (index - 1 + filtered.length) % Math.max(1, filtered.length));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                choose(filtered[active]);
              }
              if (event.key === "Escape") onClose();
            }}
            placeholder="Search pages, actions and settings…"
            className="h-8 flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-foreground-muted"
          />
          <Kbd>esc</Kbd>
        </div>

        <div className="max-h-[52dvh] overflow-y-auto p-1.5">
          {filtered.length ? (
            filtered.map((command, index) => (
              <button
                key={command.id}
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(command)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  index === active ? "bg-primary/10 text-foreground" : "text-foreground-secondary hover:bg-foreground/5",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-md border",
                    index === active
                      ? "border-primary/30 bg-primary/10 text-primary-hover"
                      : "border-border bg-surface-inset text-foreground-muted",
                  )}
                >
                  {command.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{command.label}</span>
                  {command.hint ? (
                    <span className="block truncate font-mono text-[9.5px] text-foreground-muted">
                      {command.hint}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[9px] uppercase tracking-wide text-foreground-muted">
                  {command.group}
                </span>
                {index === active ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-foreground-muted" /> : null}
              </button>
            ))
          ) : (
            <div className="px-4 py-10 text-center">
              <p className="text-[12px] text-foreground-secondary">No matches</p>
              <p className="mt-1 text-[10.5px] text-foreground-muted">
                Try a page name, model, agent or setting.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle px-3.5 py-2 text-[9.5px] text-foreground-muted">
          <span className="flex items-center gap-2">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            navigate
          </span>
          <span className="flex items-center gap-2">
            <Kbd>↵</Kbd>
            open
          </span>
        </div>
      </div>
    </div>
  );
}
