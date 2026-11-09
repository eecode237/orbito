import type { Metadata } from "next";

import { JobsView } from "@/components/pages/jobs-view";

export const metadata: Metadata = {
  title: "Jobs",
  description: "Job application tracker.",
};

export default function JobsViewPage() {
  return <JobsView />;
}
