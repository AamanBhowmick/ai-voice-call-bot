/**
 * Speech-to-Text Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Receives raw PCM audio (8kHz, 16-bit, mono) from Exotel via WebSocket
 * and returns a text transcript.
 *
 * Currently: stub implementation that returns placeholder text.
 * Replace the body of `transcribeAudio` with your preferred STT provider.
 *
 * Options to plug in:
 *   • Azure Cognitive Speech SDK  → npm install microsoft-cognitiveservices-speech-sdk
 *   • Google Cloud STT            → npm install @google-cloud/speech
 *   • Deepgram                    → npm install @deepgram/sdk
 *   • Whisper (local)             → run faster-whisper as a sidecar service
 *
 * NOTE: Exotel streams 8kHz PCM. Most STT providers accept 8kHz natively —
 * just set the sample rate / encoding parameter accordingly.
 */

import logger from "../logger.ts";

export async function transcribeAudio(pcmBuffer: Buffer): Promise<string> {
  logger.debug({ bytes: pcmBuffer.length }, "STT: transcribing audio");

  // ── TODO: Replace this stub with real STT ──────────────────────────────────
  // Example using Deepgram (accepts 8kHz PCM natively):
  //
  // import { createClient } from "@deepgram/sdk";
  // const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);
  // const { result } = await deepgram.listen.prerecorded.transcribeFile(
  //   pcmBuffer,
  //   {
  //     model: "nova-2",
  //     encoding: "linear16",
  //     sample_rate: 8000,    // ← Exotel's sample rate
  //     channels: 1,
  //     language: "en",
  //   }
  // );
  // return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  // ────────────────────────────────────────────────────────────────────────────

  // Stub: simulate a short processing delay
  await new Promise((r) => setTimeout(r, 200));
  return "Hello, I need some help today."; // placeholder
}
