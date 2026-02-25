/**
 * Speech-to-Text Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Receives raw PCM audio (16kHz, 16-bit, mono) from ACS via WebSocket
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
 */

import logger from "../logger.ts";

export async function transcribeAudio(pcmBuffer: Buffer): Promise<string> {
  logger.debug({ bytes: pcmBuffer.length }, "STT: transcribing audio");

  // ── TODO: Replace this stub with real STT ──────────────────────────────────
  // Example using Azure Cognitive Speech (streaming):
  //
  // import * as sdk from "microsoft-cognitiveservices-speech-sdk";
  // const speechConfig = sdk.SpeechConfig.fromSubscription(
  //   process.env.AZURE_STT_KEY!,
  //   process.env.AZURE_STT_REGION!
  // );
  // const audioConfig = sdk.AudioConfig.fromWavFileInput(pcmBuffer); // or pushStream
  // const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  // return new Promise((resolve) => {
  //   recognizer.recognizeOnceAsync(result => resolve(result.text));
  // });
  // ────────────────────────────────────────────────────────────────────────────

  // Stub: simulate a short processing delay
  await new Promise((r) => setTimeout(r, 200));
  return "Hello, I need some help today."; // placeholder
}
