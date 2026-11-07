import type { Metadata } from "next";

import { MarketsView } from "@/components/crypto/crypto-market";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Real crypto and company stock market snapshots and price history, proxied by ORBITO with cached/stale fallback on rate limits and no synthetic prices.",
};

export default function CryptoPage() {
  return (
    <div className="pt-2">
      <MarketsView />
    </div>
  );
}
