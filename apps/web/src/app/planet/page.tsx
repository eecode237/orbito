import type { Metadata } from "next";
import { Globe2 } from "lucide-react";

import { PlanetView } from "@/components/planet/planet-view";

export const metadata: Metadata = {
  title: "Planet",
  description: "Earth-like 3D globe visualizing real-time news signals across the world.",
};

export default function PlanetPage() {
  return (
    <div className="pt-6 sm:pt-8">
      <div className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(150deg,rgba(8,18,36,0.9),rgba(6,5,18,0.95))] p-6">
        <div className="halo -left-10 -top-16 h-56 w-56 bg-sky/15" />
        <div className="halo -right-10 -bottom-16 h-56 w-56 bg-violet/15" />
        <div className="relative">
          <span className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.24em] text-sky/80">
            <Globe2 className="h-3.5 w-3.5" /> Global intelligence
          </span>
          <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-white sm:text-[34px]">
            <span className="text-gradient">Planet</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/40">
            An Earth-like 3D globe showing real, refreshing news signals from publisher feeds across the world. Marker locations are approximate source/coverage regions — never fabricated.
          </p>
        </div>
      </div>
      <div className="mt-5">
        <PlanetView />
      </div>
    </div>
  );
}
