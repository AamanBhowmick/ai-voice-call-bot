/**
 * WebSocket Server
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles incoming WebSocket connections from ACS (audio stream).
 *
 * AI_PROVIDER env var controls which pipeline handles audio:
 *   "azure_openai_realtime"  → bridges to Azure OpenAI Realtime (default)
 *                              — single WS handles STT + LLM + TTS, lowest latency
 *   "custom"                 → runs the separate stt.ts → llm.ts → tts.ts chain
 *                              — use this when you want your own Gemini/Claude/etc keys
 */

import WebSocket, { WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import logger from "../logger.ts";
import { RealtimeBridge } from "./realtimeBridge.ts";
import { transcribeAudio } from "./stt.ts";
import { askLLM } from "./llm.ts";
import { synthesiseSpeech } from "./tts.ts";

const AI_PROVIDER = process.env.AI_PROVIDER ?? "azure_openai_realtime";

// ── Active session registry ───────────────────────────────────────────────────
// Stores callConnectionId → RealtimeBridge (or custom session state)
// Used to validate that incoming WebSocket connections belong to a real answered call.
const activeSessions = new Map<string, { registered: boolean }>();

export function registerSession(callConnectionId: string) {
  activeSessions.set(callConnectionId, { registered: true });
  logger.info({ callConnectionId, provider: AI_PROVIDER }, "Session registered — awaiting WebSocket");
}

export function unregisterSession(callConnectionId: string) {
  activeSessions.delete(callConnectionId);
}

// ── WebSocket server factory ──────────────────────────────────────────────────
export function createWsServer() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    logger.info({ url: req.url, provider: AI_PROVIDER }, "New WebSocket connection");

    // State for this connection
    let callConnectionId: string | null = null;
    let bridge: RealtimeBridge | null = null;

    // Custom pipeline state (used when AI_PROVIDER === "custom")
    const audioChunks: Buffer[] = [];
    const conversationHistory: { role: string; content: string }[] = [];

    ws.on("message", async (data: Buffer | string) => {
      try {
        // ACS sends JSON frames (control messages + base64 audio in some modes)
        // and binary frames (raw PCM audio in direct binary mode).
        const isString = typeof data === "string";
        const json = isString ? tryParseJSON(data) : tryParseJSON(data.toString());

        if (json) {
          // ── JSON frame ────────────────────────────────────────────────────
          // First JSON frame from ACS contains the callConnectionId —
          // use it to authenticate this WebSocket against our session registry.
          if (json.callConnectionId && !callConnectionId) {
            const id = json.callConnectionId as string;
            if (!activeSessions.has(id)) {
              logger.warn({ id }, "Unknown callConnectionId — closing socket");
              ws.close(1008, "Unauthorised");
              return;
            }
            callConnectionId = id;
            logger.info({ callConnectionId }, "WebSocket authenticated ✅");

            // Start AI provider
            if (AI_PROVIDER === "azure_openai_realtime") {
              bridge = new RealtimeBridge(ws, callConnectionId);
              await bridge.start();
            }
          }

          // Handle incoming audio data frames (JSON mode)
          if (json.kind === "AudioData" && json.audioData?.data) {
            const base64Audio = json.audioData.data as string;
            if (AI_PROVIDER === "azure_openai_realtime" && bridge) {
              // Forward directly to OpenAI Realtime — it handles everything.
              bridge.sendCallerAudio(base64Audio);
            } else if (AI_PROVIDER === "custom") {
              // Decode base64 → Buffer and accumulate for custom pipeline
              audioChunks.push(Buffer.from(base64Audio, "base64"));
              await maybeRunCustomPipeline(ws, audioChunks, conversationHistory);
            }
          }

          if (json.kind === "StopStream") {
            logger.info({ callConnectionId }, "Stream stopped by ACS");
          }

        } else if (Buffer.isBuffer(data)) {
          // ── Binary PCM frame (only in binary streaming mode) ──────────────
          if (!callConnectionId) return;

          if (AI_PROVIDER === "azure_openai_realtime" && bridge) {
            // Convert raw binary to base64 for OpenAI Realtime
            bridge.sendCallerAudio(data.toString("base64"));
          } else if (AI_PROVIDER === "custom") {
            audioChunks.push(data);
            await maybeRunCustomPipeline(ws, audioChunks, conversationHistory);
          }
        }
      } catch (err) {
        logger.error({ err, callConnectionId }, "Error processing WebSocket message");
      }
    });

    ws.on("close", () => {
      logger.info({ callConnectionId }, "WebSocket closed — call ended");
      bridge?.close();
      if (callConnectionId) unregisterSession(callConnectionId);
    });

    ws.on("error", (err) => {
      logger.error({ err, callConnectionId }, "WebSocket error");
    });
  });

  return wss;
}

// ── Custom pipeline: accumulate PCM → STT → LLM → TTS → send back ────────────
// Used when AI_PROVIDER=custom. Triggers after ~2s of audio (100 × 20ms chunks).
async function maybeRunCustomPipeline(
  ws: WebSocket,
  audioChunks: Buffer[],
  history: { role: string; content: string }[]
) {
  if (audioChunks.length < 100) return; // Wait for ~2s of audio

  const audioBuffer = Buffer.concat(audioChunks);
  audioChunks.length = 0;

  const transcript = await transcribeAudio(audioBuffer);
  if (!transcript.trim()) return;
  logger.info({ transcript }, "👤 Caller said (custom STT)");

  history.push({ role: "user", content: transcript });
  const responseText = await askLLM(history);
  history.push({ role: "assistant", content: responseText });
  logger.info({ responseText }, "🤖 AI responded (custom LLM)");

  const speechBuffer = await synthesiseSpeech(responseText);

  // Send TTS audio back to ACS in chunks
  const CHUNK = 3200; // 100ms of PCM 16kHz 16-bit mono
  for (let i = 0; i < speechBuffer.length; i += CHUNK) {
    if (ws.readyState === WebSocket.OPEN) {
      const chunk = speechBuffer.subarray(i, i + CHUNK);
      // ACS expects JSON-wrapped base64 audio in AudioData format
      ws.send(JSON.stringify({
        Kind: "AudioData",
        AudioData: { Data: chunk.toString("base64") },
        StopAudio: null,
      }));
    }
  }
}

function tryParseJSON(str: string): Record<string, unknown> | null {
  try { return JSON.parse(str); } catch { return null; }
}
