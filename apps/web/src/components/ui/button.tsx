import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_10px_30px_-14px_var(--primary)] hover:bg-primary-hover active:translate-y-px",
  secondary:
    "border border-border bg-surface-elevated text-foreground hover:border-border-strong hover:bg-surface-hover active:translate-y-px",
  outline:
    "border border-border bg-transparent text-foreground-secondary hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
  ghost:
    "border border-transparent bg-transparent text-foreground-secondary hover:bg-foreground/5 hover:text-foreground",
  danger:
    "border border-error/30 bg-error/10 text-error hover:border-error/50 hover:bg-error/15",
  success:
    "border border-success/30 bg-success/10 text-success hover:border-success/50 hover:bg-success/15",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[12px]",
  md: "h-9 gap-2 px-3.5 text-[12.5px]",
  lg: "h-11 gap-2 px-5 text-[13.5px]",
  icon: "h-9 w-9 justify-center",
  "icon-sm": "h-7 w-7 justify-center",
};

export function buttonVariants({
  variant = "secondary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "focus-ring inline-flex shrink-0 select-none items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-45",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className,
  size = "icon",
  variant = "ghost",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}
