import type { Metadata } from "next";

import { AuditView } from "@/components/safety/audit-view";

export const metadata: Metadata = {
  title: "Audit Logs",
  description: "Recorded safety decisions, approvals and workflow runs.",
};

export default function AuditPage() {
  return <AuditView />;
}

