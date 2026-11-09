import type { Metadata } from "next";

import { ApprovalsView } from "@/components/safety/approvals-view";

export const metadata: Metadata = {
  title: "Approvals",
  description: "Approve or reject sensitive ORBITO actions bound to their exact payload.",
};

export default function ApprovalsPage() {
  return <ApprovalsView />;
}

