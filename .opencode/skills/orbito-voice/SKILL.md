---
name: ORBITO Voice
description: "Use when implementing or changing ORBITO voice features: browser microphone capture, push-to-talk, speech recognition/transcription, spoken responses, interruption, voice commands, wake-word detection, or audio privacy and permissions."
---

## Current state

`/voice` is a Next.js module-page shell. There is no working microphone capture,
STT, TTS, push-to-talk or wake-word service. Do not present the shell as a live
voice feature. Follow the voice phase in `docs/IMPLEMENTATION_PLAN.md`.

## Recommended sequence

1. Ship push-to-talk, not always-on listening.
2. Request browser microphone permission only after a user click. Show a strong
   recording indicator, elapsed time, mute/stop and cancel controls.
3. Transcribe locally using a measured Windows-compatible Whisper option
   (benchmark faster-whisper/Whisper.cpp and model sizes on the actual hardware).
4. Show transcript for review/edit before acting. Route it through the same chat
   orchestrator, tool registry and permission checks as typed text.
5. Add local TTS (Piper candidate) behind an adapter, visible playback state,
   stop/interrupt and text fallback.
6. Measure latency, accuracy and resource impact; enforce request duration and
   audio byte limits.
7. Consider wake word only after push-to-talk is stable. Make it opt-in, visibly
   active, locally processed, false-positive tested, physically/software
   muteable, and never retain continuous audio.

## Security / privacy invariants

- Audio and transcript are untrusted input. A spoken transcript can never
  approve a risky action. Require explicit UI approval with the exact payload.
- Voice receives no capabilities that typed chat does not have.
- Do not persist raw audio by default. If the user opts to save it, state where,
  for how long, who can access it and how to delete it.
- Do not stream microphone bytes to a cloud service without an explicit provider
  disclosure and per-session user consent. Keep local model calls in
  `core/model_gateway` where applicable.
- Keep secrets server-side. Browser microphone capture needs permission and a
  secure context (localhost/HTTPS); handle denied or unsupported devices
  honestly.
- No background recording or hidden wake-word listener.

## Architecture and verification

- Browser capture and playback belong in client components under
  `apps/web/src/components/voice/`; keep the page thin.
- Backend STT/TTS providers should be adapters/services with typed contracts.
  Any LLM generation still goes through `apps/api/app/core/model_gateway/`.
- Reuse the task/SSE trace for transcription status, tool selection, approval
  waits and answer; do not make a separate execution path for voice.
- Test browser permission denied, no microphone, empty/long audio, cancellation,
  transcript correction, interruption and tool-policy equivalence.
- CI uses fixtures/fake audio and never opens the real microphone. Manual
  Windows acceptance measures the real end-to-end latency.
