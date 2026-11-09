import type { Metadata } from "next";

import { DocumentsView } from "@/components/pages/documents-view";

export const metadata: Metadata = {
  title: "Document Studio",
  description: "Local model drafts with review.",
};

export default function DocumentsViewPage() {
  return <DocumentsView />;
}
