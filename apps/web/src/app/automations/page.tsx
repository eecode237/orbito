import type { Metadata } from "next";
import { Zap } from "lucide-react";

import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Automations" };

export default function AutomationsPage() {
  return (
    <ModulePage
      eyebrow="Runs without you"
      title="Workflows that"
      accentWord="keep going"
      description="Schedule a job search, monitor a pricing page, or chain research into a weekly report — with retries, dry-runs and approval gates."
      phase="Phase 7"
      icon={Zap}
      features={[
        {
          title: "Triggers",
          body: "Cron schedules, webhooks and page-change detection.",
        },
        {
          title: "Steps",
          body: "Agent, tool and transform nodes with explicit data contracts.",
        },
        {
          title: "Guardrails",
          body: "Timeouts, retry budgets and human approval for side effects.",
        },
        {
          title: "Observability",
          body: "Every run logs its inputs, outputs, cost and failure point.",
        },
      ]}
      note="The workflow and workflow_run tables exist today. The builder, scheduler worker and dry-run engine arrive after the agent layer is stable."
    />
  );
}
