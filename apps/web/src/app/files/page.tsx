import type { Metadata } from "next";

import { FilesView } from "@/components/pages/files-view";

export const metadata: Metadata = {
  title: "Files",
  description: "Uploaded workspace files.",
};

export default function FilesViewPage() {
  return <FilesView />;
}
