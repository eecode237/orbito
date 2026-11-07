import { AgentGlyph } from "@/components/agent-glyph";
import { cn } from "@/lib/utils";

const accents: Record<string, string> = {
  core: "border-primary/30 bg-primary/12 text-primary-hover",
  career: "border-info/30 bg-info/12 text-info",
  research: "border-success/30 bg-success/12 text-success",
  study: "border-warning/30 bg-warning/12 text-warning",
  coding: "border-primary/30 bg-primary/12 text-primary-hover",
  automation: "border-warning/30 bg-warning/12 text-warning",
  documents: "border-info/30 bg-info/12 text-info",
};

export function AgentAvatar({
  slug,
  size = "md",
  className,
}: {
  slug: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const style = accents[slug] ?? accents.core;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg border",
        style,
        size === "sm" ? "h-6 w-6" : size === "lg" ? "h-11 w-11" : "h-8 w-8",
        className,
      )}
      aria-hidden
    >
      <AgentGlyph
        slug={slug}
        className={size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4"}
      />
    </span>
  );
}

export function ModelBadge({
  provider,
  model,
  local,
  className,
}: {
  provider?: string | null;
  model?: string | null;
  local?: boolean;
  className?: string;
}) {
  if (!model && !provider) return null;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface-inset px-1.5 py-0.5 font-mono text-[9.5px] text-foreground-muted",
        className,
      )}
      title={[provider, model].filter(Boolean).join(" · ")}
    >
      <span
        className={cn(
          "h-1 w-1 shrink-0 rounded-full",
          local ? "bg-success" : "bg-info",
        )}
      />
      <span className="truncate">{model ?? provider}</span>
    </span>
  );
}
