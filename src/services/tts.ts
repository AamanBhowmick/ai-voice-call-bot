/**
 * Text-to-Speech Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts a text string to PCM audio (8kHz, 16-bit, mono) that can be
 * sent back to Exotel over the WebSocket for the caller to hear.
 *
 * Currently: stub that returns silent audio (empty buffer).
 * Replace the body of `synthesiseSpeech` with your preferred TTS provider.
 *
 * Options to plug in:
 *   • Azure Neural TTS  → npm install microsoft-cognitiveservices-speech-sdk
 *   • Google Cloud TTS  → npm install @google-cloud/text-to-speech
 *   • ElevenLabs        → npm install elevenlabs
 *   • OpenAI TTS        → use openai SDK with audio.speech endpoint
 *
 * IMPORTANT: Exotel expects raw PCM 8kHz 16-bit mono.
 * If your TTS returns a different sample rate (e.g. 16kHz, 24kHz),
 * resample it down to 8kHz before returning. See resample.ts.
 */

import logger from "../logger.ts";

export async function synthesiseSpeech(text: string): Promise<Buffer> {
  logger.debug({ text }, "TTS: synthesising speech");

  // ── TODO: Replace with real TTS ───────────────────────────────────────────
  //
  // Example using ElevenLabs:
  //
  // import { ElevenLabsClient } from "elevenlabs";
  // const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY! });
  // const audioStream = await client.generate({
  //   voice: "Rachel",
  //   text,
  //   model_id: "eleven_turbo_v2",
  //   output_format: "pcm_8000",   // ← 8kHz PCM for Exotel
  // });
  // // Collect stream into a Buffer...
  // ───────────────────────────────────────────────────────────────────────────

  // Stub: simulate TTS latency, return 1 second of silence
  await new Promise((r) => setTimeout(r, 300));
  // 8000 samples/sec × 2 bytes/sample × 1 second = 16000 bytes of silence
  return Buffer.alloc(16000, 0);
}
