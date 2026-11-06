import type { Metadata } from "next";
import { Mic } from "lucide-react";

import { ModulePage } from "@/components/module-page";

export const metadata: Metadata = { title: "Voice Studio" };

export default function VoicePage() {
  return (
    <ModulePage
      eyebrow="Talk to your OS"
      title="Voice"
      accentWord="studio"
      description="Real-time conversations with interruption, multilingual voices, and spoken commands that launch agents and tools."
      phase="Phase 6"
      icon={Mic}
      features={[
        {
          title: "Speech to text",
          body: "Streaming STT over LiveKit, provider-independent.",
        },
        {
          title: "Text to speech",
          body: "Choose voices per workspace or per agent.",
        },
        {
          title: "Interruption",
          body: "Barge-in and turn detection tuned for conversation.",
        },
        {
          title: "Voice commands",
          body: "Route spoken intents into the same orchestrator.",
        },
      ]}
      note="Voice runs on a separate LiveKit worker and never bypasses the model gateway. LiveKit environment variables are already reserved in .env.example."
    />
  );
}
