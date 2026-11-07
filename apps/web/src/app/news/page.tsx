import type { Metadata } from "next";

import { NewsFeedView } from "@/components/news/news-feed";

export const metadata: Metadata = {
  title: "News Intelligence",
  description:
    "Headlines from publisher RSS and Atom feeds, normalised by ORBITO with source health reported honestly.",
};

export default function NewsPage() {
  return (
    <div className="pt-2">
      <NewsFeedView />
    </div>
  );
}
