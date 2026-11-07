import Link from "next/link";
import {
  Activity,
  Bot,
  Boxes,
  FolderUp,
  Gauge,
  MessageSquarePlus,
  Radar,
  Zap,
} from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

const actions = [
  { href: "/chat", label: "New conversation", icon: MessageSquarePlus, tone: "text-primary-hover" },
  { href: "/agents", label: "Create agent", icon: Bot, tone: "text-info" },
  { href: "/models", label: "Open Model Hub", icon: Boxes, tone: "text-success" },
  { href: "/scraping", label: "Start scraping", icon: Radar, tone: "text-warning" },
  { href: "/documents", label: "Upload document", icon: FolderUp, tone: "text-info" },
  { href: "/automations", label: "Create automation", icon: Zap, tone: "text-primary-hover" },
  { href: "/system", label: "System Health", icon: Gauge, tone: "text-success" },
  { href: "/agents/monitor", label: "Task Manager", icon: Activity, tone: "text-warning" },
];

export function QuickAccess() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Quick access"
        description="Jump straight into a workflow"
        icon={<Zap className="h-3.5 w-3.5" />}
      />
      <CardContent className="grid flex-1 grid-cols-2 gap-1.5 p-2.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="focus-ring group flex items-center gap-2 rounded-md border border-border-subtle bg-surface-inset px-2 py-2 transition-colors hover:border-primary/35 hover:bg-primary/[0.05]"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded border border-border bg-surface">
                <Icon className={`h-3 w-3 ${action.tone}`} />
              </span>
              <span className="min-w-0 truncate text-[10px] text-foreground-secondary transition-colors group-hover:text-foreground">
                {action.label}
              </span>
            </Link>
          );
        })}
      </CardContent>
      <div className="border-t border-border-subtle px-4 py-2 font-mono text-[9px] text-foreground-muted">
        Keyboard palette · ⌘K
      </div>
    </Card>
  );
}
