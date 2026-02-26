/**
 * Azure OpenAI Realtime Bridge
 * ─────────────────────────────────────────────────────────────────────────────
 * Bridges two WebSocket connections:
 *   1. Caller WebSocket — incoming PCM audio from Exotel, outgoing audio to caller
 *   2. Azure OpenAI Realtime WebSocket — full duplex STT + LLM + TTS in one
 *
 * Data flow:
 *   Caller ──(8kHz PCM)──► Exotel ──(base64)──► This server ──(24kHz)──► OpenAI Realtime
 *   Caller ◄──(8kHz PCM)── Exotel ◄──(base64)── This server ◄──(24kHz)── OpenAI Realtime
 *
 * OpenAI Realtime handles everything: VAD, transcription, LLM response, TTS.
 * Resampling (8↔24kHz) is handled transparently by this bridge.
 */

import WebSocket from "ws";
import logger from "../logger.ts";
import { downsample24to8, upsample8to24 } from "./resample.ts";
import { sendAudioToExotel } from "./wsServer.ts";

// ── Config ───────────────────────────────────────────────────────────────────
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT!;
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY!;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o-realtime-preview";
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-01-preview";

// ── System prompt — customise to define your bot's personality ───────────────
const SYSTEM_PROMPT = process.env.BOT_SYSTEM_PROMPT ??
  `You are a helpful AI voice assistant. Keep your responses concise and conversational —
   1 to 3 sentences max. You are speaking to someone on the phone, so avoid lists and markdown.`;

// ── Types ─────────────────────────────────────────────────────────────────────
type OpenAIMessage = Record<string, unknown>;

// ── RealtimeBridge ────────────────────────────────────────────────────────────
export class RealtimeBridge {
  private callerWs: WebSocket;          // socket to/from Exotel (the caller's audio)
  private openaiWs: WebSocket | null = null; // socket to Azure OpenAI Realtime
  private streamSid: string;

  constructor(callerWs: WebSocket, streamSid: string) {
    this.callerWs = callerWs;
    this.streamSid = streamSid;
  }

  // ── 1. Start: connect to OpenAI Realtime and configure the session ─────────
  async start() {
    const endpoint = AZURE_OPENAI_ENDPOINT.replace(/^https?:\/\//, "");
    const url = `wss://${endpoint}/openai/realtime?api-version=${AZURE_OPENAI_API_VERSION}&deployment=${AZURE_OPENAI_DEPLOYMENT}`;

    logger.info({ streamSid: this.streamSid, url }, "Connecting to Azure OpenAI Realtime...");

    this.openaiWs = new WebSocket(url, {
      headers: {
        "api-key": AZURE_OPENAI_KEY,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    this.openaiWs.on("open", () => {
      logger.info({ streamSid: this.streamSid }, "✅ Connected to Azure OpenAI Realtime");
      this.configureSession();
    });

    this.openaiWs.on("message", (raw) => {
      this.handleOpenAIMessage(JSON.parse(raw.toString()) as OpenAIMessage);
    });

    this.openaiWs.on("error", (err) => {
      logger.error({ err, streamSid: this.streamSid }, "OpenAI Realtime WS error");
    });

    this.openaiWs.on("close", () => {
      logger.info({ streamSid: this.streamSid }, "OpenAI Realtime WS closed");
    });
  }

  // ── 2. Session config: VAD, voice, system prompt, audio format ────────────
  private configureSession() {
    const sessionUpdate = {
      type: "session.update",
      session: {
        voice: process.env.OPENAI_VOICE ?? "alloy",
        instructions: SYSTEM_PROMPT,
        // Audio format: PCM 24kHz mono (we resample from/to Exotel's 8kHz)
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        // Built-in server-side Voice Activity Detection
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          silence_duration_ms: 300,
          prefix_padding_ms: 200,
        },
        input_audio_transcription: { model: "whisper-1" },
      },
    };

    this.sendToOpenAI(sessionUpdate);
    logger.info({ streamSid: this.streamSid }, "Session configured with VAD");
  }

  // ── 3. Receive audio from Exotel → upsample → forward to OpenAI ──────────
  sendCallerAudio(base64Audio: string) {
    // Exotel sends 8kHz PCM → upsample to 24kHz for OpenAI Realtime
    const input8k = Buffer.from(base64Audio, "base64");
    const output24k = upsample8to24(input8k);

    this.sendToOpenAI({
      type: "input_audio_buffer.append",
      audio: output24k.toString("base64"),
    });
  }

  // ── 4. Handle messages from OpenAI Realtime → act or forward to caller ────
  private async handleOpenAIMessage(msg: OpenAIMessage) {
    switch (msg.type) {
      // ── Session ready ──────────────────────────────────────────────────────
      case "session.created":
        logger.info({ streamSid: this.streamSid }, "OpenAI session created");
        this.triggerInitialGreeting();
        break;

      // ── Caller started speaking (barge-in) ─────────────────────────────────
      case "input_audio_buffer.speech_started":
        logger.info({ streamSid: this.streamSid }, "🎙 Caller speaking — barge-in detected");
        // Send a clear/mark event to Exotel to stop current playback
        this.sendClearToExotel();
        break;

      // ── Transcription of what the caller said ──────────────────────────────
      case "conversation.item.input_audio_transcription.completed":
        logger.info({ streamSid: this.streamSid, transcript: msg.transcript }, "👤 Caller said");
        break;

      // ── AI audio response chunk → downsample → forward to Exotel ──────────
      case "response.audio.delta": {
        const base64_24k = msg.delta as string;
        const pcm24k = Buffer.from(base64_24k, "base64");
        const pcm8k = downsample24to8(pcm24k);

        sendAudioToExotel(this.callerWs, this.streamSid, pcm8k.toString("base64"));
        break;
      }

      // ── Full AI text transcript (for logging) ─────────────────────────────
      case "response.audio_transcript.done":
        logger.info({ streamSid: this.streamSid, transcript: msg.transcript }, "🤖 AI said");
        break;

      // ── Errors ────────────────────────────────────────────────────────────
      case "error":
        logger.error({ streamSid: this.streamSid, error: msg.error }, "OpenAI Realtime error");
        break;
    }
  }

  // ── 5. Optional: trigger an initial greeting when the call connects ────────
  private triggerInitialGreeting() {
    this.sendToOpenAI({ type: "response.create" });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private sendToOpenAI(msg: OpenAIMessage) {
    if (this.openaiWs?.readyState === WebSocket.OPEN) {
      this.openaiWs.send(JSON.stringify(msg));
    }
  }

  private sendClearToExotel() {
    if (this.callerWs.readyState === WebSocket.OPEN) {
      this.callerWs.send(JSON.stringify({
        event: "clear",
        streamSid: this.streamSid,
      }));
    }
  }

  close() {
    this.openaiWs?.close();
    logger.info({ streamSid: this.streamSid }, "RealtimeBridge closed");
  }
}
