import Link from "next/link";
import { CalendarClock, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function AutomationOverview() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Automations"
        description="Scheduled and event-driven workflows"
        icon={<Zap className="h-3.5 w-3.5" />}
        actions={<Badge tone="neutral">Not connected</Badge>}
      />
      <CardContent className="flex flex-1 flex-col">
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-md border border-border-subtle bg-surface-inset px-2 py-1.5">
            <p className="type-eyebrow text-[8px] text-foreground-muted">Schedules</p>
            <p className="mt-0.5 font-mono text-[14px] text-foreground-muted">—</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-inset px-2 py-1.5">
            <p className="type-eyebrow text-[8px] text-foreground-muted">Next run</p>
            <p className="mt-0.5 font-mono text-[14px] text-foreground-muted">—</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-surface-inset px-2 py-1.5">
            <p className="type-eyebrow text-[8px] text-foreground-muted">Runs today</p>
            <p className="mt-0.5 font-mono text-[14px] text-foreground-muted">—</p>
          </div>
        </div>

        <div className="mt-2 flex-1">
          <EmptyState
            compact
            icon={CalendarClock}
            title="No scheduler endpoint is enabled"
            description="Nothing is scheduled, so there is no next execution to show. The workflow tables exist, but the scheduler worker is not connected in this build."
            action={
              <Link href="/automations" className="text-[11px] font-medium text-primary-hover">
                Open Automations
              </Link>
            }
          />
        </div>
      </CardContent>
      <div className="border-t border-border-subtle px-4 py-2 font-mono text-[9px] text-foreground-muted">
        Values appear here only after a real scheduler is connected.
      </div>
    </Card>
  );
}
