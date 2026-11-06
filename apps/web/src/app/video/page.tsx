import type { Metadata } from "next";
import { Video } from "lucide-react";

import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Video Studio" };

export default function VideoPage() {
  return (
    <ModulePage
      eyebrow="Understand and generate"
      title="Video"
      accentWord="studio"
      description="Upload a video, extract audio, transcribe it, sample frames, and ask questions about what happened — then generate clips from a prompt."
      phase="Phase 6"
      icon={Video}
      features={[
        {
          title: "Transcription",
          body: "Audio extraction with FFmpeg, then streaming STT.",
        },
        {
          title: "Frame analysis",
          body: "Scene sampling into Gemini or another vision model.",
        },
        {
          title: "Q&A",
          body: "Grounded answers with timestamps and citations.",
        },
        {
          title: "Generation",
          body: "Prompt-to-video through whichever provider is best.",
        },
      ]}
      note="Media stays in object storage; PostgreSQL only holds metadata. Uploads, FFmpeg processing and the vision pipeline land in Phase 6."
    />
  );
}
