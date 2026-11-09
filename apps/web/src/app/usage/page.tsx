import type { Metadata } from "next";

import { UsageView } from "@/components/pages/usage-view";

export const metadata: Metadata = {
  title: "Usage & Costs",
  description: "Recorded model usage and estimated cost.",
};

export default function UsageViewPage() {
  return <UsageView />;
}
