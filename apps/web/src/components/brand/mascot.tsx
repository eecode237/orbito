import { cn } from "@/lib/utils";

type MascotProps = {
  className?: string;
  expression?: "happy" | "sleep" | "wink";
  ring?: boolean;
  glow?: boolean;
};

export function Mascot({
  className,
  expression = "happy",
  ring = true,
  glow = true,
}: MascotProps) {
  return (
    <div className={cn("relative grid place-items-center", className)} aria-hidden="true">
      {glow ? (
        <div className="halo inset-0 bg-violet/40 blur-[46px] animate-glow" />
      ) : null}

      {ring ? (
        <div className="absolute inset-[-14%] animate-ring" style={{ transform: "rotate(-18deg)" }}>
          <div className="h-full w-full rounded-[50%] border border-violet-soft/45 scale-y-[0.34] shadow-[0_0_24px_rgba(124,92,255,0.35)]" />
        </div>
      ) : null}

      <div className="relative h-[72%] w-[72%] rounded-full bg-[radial-gradient(circle_at_32%_26%,#c9bcff_0%,#8b6dff_26%,#4c2fd6_58%,#170d52_100%)] shadow-[inset_0_-14px_30px_rgba(6,4,15,0.75),inset_0_10px_22px_rgba(255,255,255,0.18),0_22px_60px_-18px_rgba(124,92,255,0.9)]">
        <div className="absolute left-[16%] top-[10%] h-[28%] w-[38%] rounded-full bg-white/25 blur-[7px]" />
        <div className="absolute inset-x-0 top-[42%] flex items-center justify-center gap-[14%]">
          {expression === "sleep" ? (
            <>
              <span className="h-[3px] w-[16%] rounded-full bg-cyan-300 shadow-[0_0_10px_#67e8f9]" />
              <span className="h-[3px] w-[16%] rounded-full bg-cyan-300 shadow-[0_0_10px_#67e8f9]" />
            </>
          ) : expression === "wink" ? (
            <>
              <span className="h-[3px] w-[16%] rounded-full bg-cyan-200 shadow-[0_0_10px_#67e8f9]" />
              <span className="h-[18%] w-[16%] rounded-t-full border-t-[3px] border-cyan-200 shadow-[0_-2px_10px_#67e8f9]" />
            </>
          ) : (
            <>
              <span className="h-[22%] w-[16%] rounded-t-full border-t-[3.5px] border-cyan-200 shadow-[0_-3px_12px_#67e8f9] animate-blink" />
              <span className="h-[22%] w-[16%] rounded-t-full border-t-[3.5px] border-cyan-200 shadow-[0_-3px_12px_#67e8f9] animate-blink" />
            </>
          )}
        </div>
        <div className="absolute bottom-[12%] left-1/2 h-[7%] w-[12%] -translate-x-1/2 rounded-full bg-[#2dd4bf]/30 blur-[2px]" />
      </div>

      <span className="absolute left-[2%] top-[18%] h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_12px_#3ddc97]" />
      <span className="absolute right-[6%] bottom-[16%] h-1 w-1 rounded-full bg-sky shadow-[0_0_10px_#38bdf8]" />
    </div>
  );
}
