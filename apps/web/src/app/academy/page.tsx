import type { Metadata } from "next";

import { AcademyView } from "@/components/pages/academy-view";

export const metadata: Metadata = {
  title: "Academy",
  description: "Flashcards you write and review.",
};

export default function AcademyViewPage() {
  return <AcademyView />;
}
