import { Router, type Request, type Response } from "express";
import logger from "../logger.ts";
import acsClient from "../services/acsClient.ts";
import { registerSession } from "../services/wsServer.ts";

const router = Router();

const CALLBACK_URI  = process.env.CALLBACK_URI!;
const WEBSOCKET_URL = process.env.WEBSOCKET_URL!;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

router.post("/", async (req: Request, res: Response) => {
  // ── Security: validate Event Grid secret header ───────────────────────────
  if (WEBHOOK_SECRET) {
    const incoming = req.headers["aeg-sas-key"];
    if (incoming !== WEBHOOK_SECRET) {
      logger.warn("Rejected webhook — invalid aeg-sas-key");
      return res.sendStatus(401);
    }
  }

  const events = req.body;
  if (!Array.isArray(events) || events.length === 0) return res.sendStatus(400);

  for (const event of events) {
    // ── Event Grid subscription validation handshake ─────────────────────────
    // Azure sends this one-time when you create the Event Grid subscription.
    // You must echo back validationCode within 30 seconds or the subscription fails.
    if (event.eventType === "Microsoft.EventGrid.SubscriptionValidationEvent") {
      logger.info("Event Grid handshake received — responding with validation code");
      return res.json({ validationResponse: event.data.validationCode });
    }

    // ── Incoming call ─────────────────────────────────────────────────────────
    if (event.eventType === "Microsoft.Communication.IncomingCall") {
      const { incomingCallContext } = event.data;
      const callerId = event.data?.from?.phoneNumber?.value ?? event.data?.from?.rawId ?? "unknown";

      logger.info({ callerId }, "📞 Incoming call — answering...");

      try {
        const result = await acsClient.answerCall(
          incomingCallContext,
          CALLBACK_URI,
          {
            mediaStreamingOptions: {
              transportUrl: WEBSOCKET_URL,
              transportType: "websocket",
              contentType: "audio",
              // "mixed" gives a single combined audio stream of all participants.
              // Use "unmixed" if you need a separate stream per participant (e.g. multi-party calls).
              audioChannelType: "mixed",
              // CRITICAL: enableBidirectional = true lets you SEND audio BACK to the caller.
              // Without this, ACS streams audio TO you but won't play anything you send back.
              enableBidirectional: true,
              // PCM 24kHz mono — matches Azure OpenAI Realtime's native output format.
              // Using 24kHz avoids resampling artifacts and reduces latency.
              // If using the custom pipeline with a 16kHz TTS, change this to "Pcm16KMono".
              audioFormat: "Pcm24KMono",
            },
          }
        );

        const callConnectionId = result.callConnectionProperties?.callConnectionId;
        if (callConnectionId) {
          // Register the session so the WebSocket handler recognises this call
          registerSession(callConnectionId);
        }

        logger.info({ callerId, callConnectionId }, "✅ Call answered, media stream attached");
      } catch (err) {
        logger.error({ err, callerId }, "❌ Failed to answer call");
      }
    }
  }

  res.sendStatus(200);
});

export default router;
