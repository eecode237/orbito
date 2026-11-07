"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TabItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
};

export function Tabs({
  items,
  value,
  onChange,
  className,
  size = "md",
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "no-scrollbar flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface-inset p-1",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={cn(
              "focus-ring flex shrink-0 items-center gap-1.5 rounded-md font-medium transition-colors",
              size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-[12px]",
              active
                ? "bg-surface text-foreground shadow-[var(--shadow-sm)]"
                : "text-foreground-muted hover:text-foreground-secondary",
              item.disabled && "cursor-not-allowed opacity-40",
            )}
          >
            {item.icon}
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  className,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border border-border bg-surface-inset p-0.5", className)}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "focus-ring rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === option.id
              ? "bg-surface text-foreground shadow-[var(--shadow-sm)]"
              : "text-foreground-muted hover:text-foreground-secondary",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function useTabs(initial: string) {
  const [value, setValue] = useState(initial);
  return { value, onChange: setValue };
}
