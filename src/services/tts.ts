/**
 * Text-to-Speech Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts a text string to PCM audio (16kHz, 16-bit, mono) that can be
 * sent back to ACS over the WebSocket to play to the caller.
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
 * IMPORTANT: ACS expects raw PCM 16kHz 16-bit mono.
 * If your TTS returns MP3 or WAV, you must convert it first.
 * Use ffmpeg or the `pcm-convert` npm package.
 */

import logger from "../logger.ts";

export async function synthesiseSpeech(text: string): Promise<Buffer> {
  logger.debug({ text }, "TTS: synthesising speech");

  // ── TODO: Replace with real TTS ───────────────────────────────────────────
  //
  // Example using Azure Neural TTS (returns raw PCM):
  //
  // import * as sdk from "microsoft-cognitiveservices-speech-sdk";
  // const speechConfig = sdk.SpeechConfig.fromSubscription(
  //   process.env.AZURE_TTS_KEY!,
  //   process.env.AZURE_TTS_REGION!
  // );
  // speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";
  // speechConfig.speechSynthesisOutputFormat =
  //   sdk.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm; // ← exact format ACS needs
  //
  // return new Promise((resolve, reject) => {
  //   const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
  //   synthesizer.speakTextAsync(text,
  //     (result) => resolve(Buffer.from(result.audioData)),
  //     (err)    => reject(err)
  //   );
  // });
  // ───────────────────────────────────────────────────────────────────────────

  // Stub: simulate TTS latency, return 1 second of silence
  await new Promise((r) => setTimeout(r, 300));
  // 16000 samples/sec × 2 bytes/sample × 1 second = 32000 bytes of silence
  return Buffer.alloc(32000, 0);
}
