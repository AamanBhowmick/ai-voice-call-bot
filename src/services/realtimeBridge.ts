/**
 * Azure OpenAI Realtime Bridge
 * ─────────────────────────────────────────────────────────────────────────────
 * Bridges two WebSocket connections:
 *   1. ACS WebSocket  — incoming PCM audio from the caller, outgoing audio to the caller
 *   2. Azure OpenAI Realtime WebSocket — full duplex STT + LLM + TTS in one
 *
 * Data flow:
 *   Caller ──(PCM audio)──► ACS ──(base64 audio)──► This server ──► OpenAI Realtime
 *   Caller ◄──(PCM audio)── ACS ◄──────(base64)──── This server ◄── OpenAI Realtime
 *
 * OpenAI Realtime handles everything: VAD, transcription, LLM response, TTS.
 * When the caller starts speaking mid-response (barge-in), we send StopAudio to ACS.
 */

import WebSocket from "ws";
import logger from "../logger.ts";

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
  private acsWs: WebSocket;           // socket to/from ACS (the caller's audio)
  private openaiWs: WebSocket | null = null; // socket to Azure OpenAI Realtime
  private callConnectionId: string;

  constructor(acsWs: WebSocket, callConnectionId: string) {
    this.acsWs = acsWs;
    this.callConnectionId = callConnectionId;
  }

  // ── 1. Start: connect to OpenAI Realtime and configure the session ─────────
  async start() {
    // Build the WebSocket URL for Azure OpenAI Realtime
    // Format: wss://{endpoint}/openai/realtime?api-version=...&deployment=...
    const endpoint = AZURE_OPENAI_ENDPOINT.replace(/^https?:\/\//, "");
    const url = `wss://${endpoint}/openai/realtime?api-version=${AZURE_OPENAI_API_VERSION}&deployment=${AZURE_OPENAI_DEPLOYMENT}`;

    logger.info({ callConnectionId: this.callConnectionId, url }, "Connecting to Azure OpenAI Realtime...");

    this.openaiWs = new WebSocket(url, {
      headers: {
        "api-key": AZURE_OPENAI_KEY,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    this.openaiWs.on("open", () => {
      logger.info({ callConnectionId: this.callConnectionId }, "✅ Connected to Azure OpenAI Realtime");
      this.configureSession();
    });

    this.openaiWs.on("message", (raw) => {
      this.handleOpenAIMessage(JSON.parse(raw.toString()) as OpenAIMessage);
    });

    this.openaiWs.on("error", (err) => {
      logger.error({ err, callConnectionId: this.callConnectionId }, "OpenAI Realtime WS error");
    });

    this.openaiWs.on("close", () => {
      logger.info({ callConnectionId: this.callConnectionId }, "OpenAI Realtime WS closed");
    });
  }

  // ── 2. Session config: VAD, voice, system prompt, audio format ────────────
  private configureSession() {
    const sessionUpdate = {
      type: "session.update",
      session: {
        // Voice for TTS responses — options: alloy, echo, shimmer, fable, onyx, nova
        voice: process.env.OPENAI_VOICE ?? "alloy",
        instructions: SYSTEM_PROMPT,
        // Audio format ACS sends us: PCM 24kHz mono (set in answerCall)
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        // Built-in server-side Voice Activity Detection
        // → detects when caller stops speaking and triggers AI response automatically
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,           // sensitivity 0-1 (lower = more sensitive)
          silence_duration_ms: 300, // wait 300ms of silence before responding
          prefix_padding_ms: 200,   // include 200ms before speech onset
        },
        // Enable Whisper transcription so we can log what the caller said
        input_audio_transcription: { model: "whisper-1" },
      },
    };

    this.sendToOpenAI(sessionUpdate);
    logger.info({ callConnectionId: this.callConnectionId }, "Session configured with VAD");
  }

  // ── 3. Receive audio from ACS → forward to OpenAI Realtime ───────────────
  // Call this from wsServer.ts whenever an audio frame arrives from ACS.
  sendCallerAudio(base64Audio: string) {
    this.sendToOpenAI({
      type: "input_audio_buffer.append",
      audio: base64Audio,
    });
  }

  // ── 4. Handle messages from OpenAI Realtime → act or forward to ACS ───────
  private async handleOpenAIMessage(msg: OpenAIMessage) {
    switch (msg.type) {
      // ── Session ready ──────────────────────────────────────────────────────
      case "session.created":
        logger.info({ callConnectionId: this.callConnectionId }, "OpenAI session created");
        // Send an initial greeting to kick off the conversation
        this.triggerInitialGreeting();
        break;

      // ── Caller started speaking (barge-in) ─────────────────────────────────
      // OpenAI VAD detected the caller speaking while the bot is talking.
      // Send StopAudio to ACS to cut off the bot's current audio immediately.
      case "input_audio_buffer.speech_started":
        logger.info({ callConnectionId: this.callConnectionId }, "🎙 Caller speaking — barge-in detected");
        this.sendToACS({ Kind: "StopAudio", AudioData: null, StopAudio: {} });
        break;

      // ── Transcription of what the caller said (for logging) ──────────────
      case "conversation.item.input_audio_transcription.completed":
        logger.info({ callConnectionId: this.callConnectionId, transcript: msg.transcript }, "👤 Caller said");
        break;

      // ── AI audio response chunk — forward to ACS ──────────────────────────
      // OpenAI streams the TTS audio as base64 PCM deltas.
      // We wrap it in the ACS AudioData format and send it back over the
      // ACS WebSocket — this is what the caller hears.
      case "response.audio.delta":
        this.sendToACS({
          Kind: "AudioData",
          AudioData: { Data: msg.delta },
          StopAudio: null,
        });
        break;

      // ── Full AI text transcript (for logging) ─────────────────────────────
      case "response.audio_transcript.done":
        logger.info({ callConnectionId: this.callConnectionId, transcript: msg.transcript }, "🤖 AI said");
        break;

      // ── Errors ────────────────────────────────────────────────────────────
      case "error":
        logger.error({ callConnectionId: this.callConnectionId, error: msg.error }, "OpenAI Realtime error");
        break;
    }
  }

  // ── 5. Optional: trigger an initial greeting when the call connects ────────
  private triggerInitialGreeting() {
    // Tell OpenAI to generate an opening message from the assistant
    this.sendToOpenAI({ type: "response.create" });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private sendToOpenAI(msg: OpenAIMessage) {
    if (this.openaiWs?.readyState === WebSocket.OPEN) {
      this.openaiWs.send(JSON.stringify(msg));
    }
  }

  private sendToACS(msg: object) {
    if (this.acsWs.readyState === WebSocket.OPEN) {
      this.acsWs.send(JSON.stringify(msg));
    }
  }

  // Called when the ACS connection closes (caller hung up)
  close() {
    this.openaiWs?.close();
    logger.info({ callConnectionId: this.callConnectionId }, "RealtimeBridge closed");
  }
}
