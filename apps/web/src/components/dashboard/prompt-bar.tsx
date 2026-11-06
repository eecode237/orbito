"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUp, Paperclip, Sparkles } from "lucide-react";

const suggestions = [
  "Find remote AI jobs in Canada",
  "Summarize this article",
  "Build me a study plan",
  "Scrape a competitor's pricing",
];

export function PromptBar() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function launch(prompt: string) {
    const text = prompt.trim();
    if (!text) return;
    router.push(`/chat?q=${encodeURIComponent(text)}`);
  }

  return (
    <div className="w-full">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          launch(value);
        }}
        className="group relative flex items-center gap-2 rounded-2xl border border-violet/25 bg-[linear-gradient(120deg,rgba(27,20,52,0.92),rgba(12,8,25,0.95))] p-2 shadow-[0_24px_70px_-30px_rgba(124,92,255,0.75)] transition focus-within:border-violet/55 sm:gap-3"
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(500px_100px_at_20%_0%,rgba(124,92,255,0.16),transparent_70%)]" />
        <span className="relative ml-2 hidden h-9 w-9 shrink-0 place-items-center rounded-xl border border-violet/25 bg-violet/10 sm:grid">
          <Sparkles className="h-4 w-4 text-violet-soft" />
        </span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Try something like… “Find remote AI jobs in Canada”"
          aria-label="Ask ORBITO"
          className="relative h-11 min-w-0 flex-1 bg-transparent text-[14px] text-white/90 outline-none placeholder:text-white/30"
        />
        <button
          type="button"
          title="File uploads arrive with the documents workspace"
          className="relative hidden h-9 w-9 place-items-center rounded-xl text-white/30 transition hover:bg-white/5 hover:text-white/60 sm:grid"
          aria-label="Attach a file"
        >
          <Paperclip className="h-[17px] w-[17px]" />
        </button>
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="Send prompt"
          className="focus-ring relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet text-white shadow-[0_8px_26px_-8px_rgba(124,92,255,1)] transition hover:bg-[#8b6dff] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => launch(suggestion)}
            className="focus-ring rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[11.5px] text-white/45 transition hover:border-violet/35 hover:bg-violet/10 hover:text-white/85"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
