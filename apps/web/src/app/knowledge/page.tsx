import type { Metadata } from "next";
import { BookOpen } from "lucide-react";

import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Knowledge Base" };

export default function KnowledgePage() {
  return (
    <ModulePage
      eyebrow="Grounded answers"
      title="Knowledge"
      accentWord="base"
      description="Upload PDFs, notes and research. ORBITO chunks, embeds and cites them so Study and Research answers are grounded in your own material."
      phase="Phase 3–5"
      icon={BookOpen}
      features={[
        {
          title: "Document intake",
          body: "PDF and text extraction already ship in the documents tool.",
        },
        {
          title: "Embeddings",
          body: "pgvector is provisioned; chunking and embedding jobs arrive next.",
        },
        {
          title: "Citations",
          body: "Every retrieved passage keeps its source file and page.",
        },
        {
          title: "Export",
          body: "Take summaries and study material with you.",
        },
      ]}
      note="Foundation v0.1 stores file metadata and can extract PDF text. The vector pipeline, retrieval ranking and citation UI are the next milestone for the Study agent."
    />
  );
}
