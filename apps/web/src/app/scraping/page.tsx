import type { Metadata } from "next";

import { ScrapingStudio } from "@/components/scraping/scraping-studio";

export const metadata: Metadata = { title: "Scraping Studio" };

export default function ScrapingPage() {
  return (
    <div className="pt-6 sm:pt-8">
      <div className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(150deg,rgba(16,32,28,0.7),rgba(8,5,18,0.92))] p-6">
        <div className="halo -right-10 -top-20 h-56 w-56 bg-mint/15" />
        <div className="relative">
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.24em] text-mint/70">
            ORBITO Research · Beta
          </span>
          <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-white sm:text-[34px]">
            Scraping <span className="text-gradient">Studio</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/40">
            Turn public pages into structured data. Choose selectors, crawl same-origin links,
            watch progress, and export CSV or JSON.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ScrapingStudio />
      </div>
    </div>
  );
}
