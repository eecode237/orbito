import type { Metadata } from "next";

import { ImageView } from "@/components/pages/image-view";

export const metadata: Metadata = {
  title: "Image Studio",
  description: "Image providers actually configured.",
};

export default function ImageViewPage() {
  return <ImageView />;
}
