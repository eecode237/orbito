import {
  Briefcase,
  Code2,
  FileText,
  Globe2,
  GraduationCap,
  Sparkles,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Renders an agent's icon without constructing a component during render.
 * A switch is deliberately explicit: the icon set is part of the design system,
 * and the React compiler forbids dynamic component creation.
 */
export function AgentGlyph({ slug, className }: { slug: string; className?: string }) {
  const classes = cn(className);
  switch (slug) {
    case "career":
      return <Briefcase className={classes} />;
    case "research":
      return <Globe2 className={classes} />;
    case "study":
      return <GraduationCap className={classes} />;
    case "coding":
      return <Code2 className={classes} />;
    case "automation":
      return <Zap className={classes} />;
    case "documents":
      return <FileText className={classes} />;
    default:
      return <Sparkles className={classes} />;
  }
}
