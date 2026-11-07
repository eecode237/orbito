import type { Metadata } from "next";

import { CryptoMarketView } from "@/components/crypto/crypto-market";

export const metadata: Metadata = {
  title: "Crypto Intelligence",
  description:
    "Observed crypto market snapshots and price history from the CoinGecko public API, proxied by ORBITO with honest failure states.",
};

export default function CryptoPage() {
  return (
    <div className="pt-2">
      <CryptoMarketView />
    </div>
  );
}
