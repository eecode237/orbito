import type { Metadata } from "next";
import { LayoutGrid } from "lucide-react";

import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Workspaces" };

export default function WorkspacesPage() {
  return (
    <ModulePage
      eyebrow="Context, separated"
      title="Your"
      accentWord="workspaces"
      description="Separate job search from university, business research, and side projects — each with its own files, conversations, tasks and memory."
      phase="Phase 3"
      icon={LayoutGrid}
      features={[
        {
          title: "Scoped context",
          body: "Conversations and files stay inside the workspace that owns them.",
        },
        {
          title: "Scoped memory",
          body: "Workspace facts never leak into unrelated projects.",
        },
        {
          title: "Shared models",
          body: "Every workspace uses the same gateway and permission policy.",
        },
        {
          title: "One switcher",
          body: "Jump between contexts without losing task history.",
        },
      ]}
      note="The database already carries workspace_id on conversations, memories and files. The workspace switcher, scoping middleware and RLS policies land in Phase 3."
    />
  );
}
