/**
 * WebSocket Server — Exotel Voicebot Applet
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles incoming WebSocket connections from Exotel's Voicebot Applet.
 *
 * Exotel WebSocket protocol:
 *   1. "connected"  — session started, contains streamSid + call metadata
 *   2. "media"      — audio frame, base64-encoded PCM 8kHz 16-bit mono
 *   3. "stop"       — stream ending (caller hung up or flow ended)
 *
 * AI_PROVIDER env var controls which pipeline handles audio:
 *   "azure_openai_realtime"  → bridges to Azure OpenAI Realtime (default)
 *   "custom"                 → runs the separate stt.ts → llm.ts → tts.ts chain
 */

import type { IncomingMessage } from "http";
import WebSocket, { WebSocketServer } from "ws";
import logger from "../logger.ts";
import { askLLM } from "./llm.ts";
import { RealtimeBridge } from "./realtimeBridge.ts";
import { transcribeAudio } from "./stt.ts";
import { synthesiseSpeech } from "./tts.ts";

const AI_PROVIDER = process.env.AI_PROVIDER ?? "azure_openai_realtime";

// ── WebSocket server factory ──────────────────────────────────────────────────
export function createWsServer() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    logger.info({ url: req.url, provider: AI_PROVIDER }, "New WebSocket connection from Exotel");

    // Session state
    let streamSid: string | null = null;
    let bridge: RealtimeBridge | null = null;

    // Custom pipeline state
    const audioChunks: Buffer[] = [];
    const conversationHistory: { role: string; content: string }[] = [];

    ws.on("message", async (raw: Buffer | string) => {
      try {
        const msg = parseMessage(raw);
        if (!msg) return;

        switch (msg.event) {
          // ── Connected: Exotel opens the stream ──────────────────────────────
          case "connected":
            streamSid = msg.streamSid ?? msg.stream_sid ?? null;
            logger.info(
              { streamSid, callSid: msg.start?.callSid ?? msg.callSid },
              "🔗 Exotel stream connected"
            );

            // Start AI provider
            if (AI_PROVIDER === "azure_openai_realtime") {
              bridge = new RealtimeBridge(ws, streamSid ?? "unknown");
              await bridge.start();
            }
            break;

          // ── Start: stream metadata (some Exotel versions send this) ─────────
          case "start":
            streamSid = msg.streamSid ?? msg.stream_sid ?? streamSid;
            logger.info({ streamSid, metadata: msg.start }, "▶ Stream started");

            if (!bridge && AI_PROVIDER === "azure_openai_realtime") {
              bridge = new RealtimeBridge(ws, streamSid ?? "unknown");
              await bridge.start();
            }
            break;

          // ── Media: audio frame from the caller ──────────────────────────────
          case "media": {
            if (!msg.media?.payload) break;

            const base64Audio = msg.media.payload as string;

            if (AI_PROVIDER === "azure_openai_realtime" && bridge) {
              // Forward to OpenAI Realtime (bridge handles resampling)
              bridge.sendCallerAudio(base64Audio);
            } else if (AI_PROVIDER === "custom") {
              // Decode and accumulate for custom pipeline
              audioChunks.push(Buffer.from(base64Audio, "base64"));
              await maybeRunCustomPipeline(ws, streamSid, audioChunks, conversationHistory);
            }
            break;
          }

          // ── Stop: stream ending ─────────────────────────────────────────────
          case "stop":
            logger.info({ streamSid }, "⏹ Exotel stream stopped");
            break;

          default:
            logger.debug({ event: msg.event, streamSid }, "Unhandled Exotel WS event");
        }
      } catch (err) {
        logger.error({ err, streamSid }, "Error processing Exotel WebSocket message");
      }
    });

    ws.on("close", () => {
      logger.info({ streamSid }, "WebSocket closed — call ended");
      bridge?.close();
    });

    ws.on("error", (err) => {
      logger.error({ err, streamSid }, "WebSocket error");
    });
  });

  return wss;
}

// ── Send audio back to the caller via Exotel ──────────────────────────────────
// Exotel expects media frames in this format for bidirectional streaming.
export function sendAudioToExotel(
  ws: WebSocket,
  streamSid: string,
  base64Audio: string
) {
  if (ws.readyState !== WebSocket.OPEN) return;

  ws.send(
    JSON.stringify({
      event: "media",
      streamSid,
      media: {
        payload: base64Audio,
      },
    })
  );
}

// ── Custom pipeline: accumulate PCM → STT → LLM → TTS → send back ────────────
// Triggers after ~2s of audio. Exotel sends 8kHz 16-bit mono = ~50 chunks @ 20ms.
async function maybeRunCustomPipeline(
  ws: WebSocket,
  streamSid: string | null,
  audioChunks: Buffer[],
  history: { role: string; content: string }[]
) {
  // 8kHz × 2 bytes × 0.02s = 320 bytes per 20ms frame → 100 frames ≈ 2s
  if (audioChunks.length < 100) return;

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

  // Send TTS audio back to caller in chunks
  // 8kHz × 2 bytes × 0.1s = 1600 bytes per 100ms chunk
  const CHUNK = 1600;
  for (let i = 0; i < speechBuffer.length; i += CHUNK) {
    if (ws.readyState === WebSocket.OPEN) {
      const chunk = speechBuffer.subarray(i, i + CHUNK);
      sendAudioToExotel(ws, streamSid ?? "", chunk.toString("base64"));
    }
  }
}

// ── Parse incoming message ────────────────────────────────────────────────────
function parseMessage(raw: Buffer | string): Record<string, any> | null {
  try {
    const str = typeof raw === "string" ? raw : raw.toString();
    return JSON.parse(str);
  } catch {
    return null;
  }
}
