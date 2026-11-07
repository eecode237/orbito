import type { Metadata } from "next";
import { Boxes, Cpu, Download, HardDrive } from "lucide-react";

import { ModelHub } from "@/components/models/model-hub";

export const metadata: Metadata = {
  title: "Model Hub",
  description: "Manage local Ollama models: discover hardware, view installed/running models, and download with real-time progress.",
};

export default function ModelsPage() {
  return (
    <div className="pt-6 sm:pt-8">
      <div className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(150deg,rgba(23,16,44,0.88),rgba(8,5,18,0.92))] p-6">
        <div className="halo -right-10 -top-16 h-56 w-56 bg-violet/20" />
        <div className="relative">
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.24em] text-violet-soft/70">Local inference</span>
          <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-white sm:text-[34px]">
            Model <span className="text-gradient">Hub</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/40">
            Real-time view of your Ollama runtime, installed and loaded models, hardware, and downloads. Progress and model data come directly from local APIs — nothing simulated.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-white/30">
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1"><Boxes className="h-3 w-3 text-violet-soft" /> Installed & loaded</span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1"><Download className="h-3 w-3 text-mint" /> Live pull progress</span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1"><Cpu className="h-3 w-3 text-sky" /> Hardware aware</span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1"><HardDrive className="h-3 w-3 text-amber" /> Real storage charts</span>
          </div>
        </div>
      </div>
      <div className="mt-5">
        <ModelHub />
      </div>
    </div>
  );
}
