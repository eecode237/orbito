import Link from "next/link";
import { Orbit } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center text-center">
      <div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-violet/25 bg-violet/10">
          <Orbit className="h-7 w-7 text-violet-soft" />
        </div>
        <p className="mt-5 font-display text-[10px] uppercase tracking-[0.28em] text-violet-soft/60">
          404 · off course
        </p>
        <h1 className="mt-2 font-display text-[30px] font-semibold text-white">
          This orbit doesn&apos;t exist.
        </h1>
        <p className="mt-2 text-[12px] text-white/35">
          The page you were looking for drifted out of range.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-9 items-center rounded-xl bg-violet px-4 text-[11.5px] font-semibold text-white transition hover:bg-[#8b6dff]"
        >
          Back to ORBITO
        </Link>
      </div>
    </div>
  );
}
