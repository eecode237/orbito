import type { Metadata } from "next";

import { WorkflowManager } from "@/components/automations/workflow-manager";

export const metadata: Metadata = {
  title: "Automations",
  description: "Create and manage ORBITO workflows with triggers, actions and honest execution records.",
};

export default function AutomationsPage() {
  return <WorkflowManager />;
}
