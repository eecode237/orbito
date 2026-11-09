import type { Metadata } from "next";

import { DesignSystemView } from "@/components/pages/design-system-view";

export const metadata: Metadata = {
  title: "Design System",
  description: "Live design tokens and components.",
};

export default function DesignSystemViewPage() {
  return <DesignSystemView />;
}
