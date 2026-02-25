/**
 * Outbound Call Route — POST /api/outbound-call
 * ─────────────────────────────────────────────────────────────────────────────
 * Called by the demo page when a user enters their phone number and clicks
 * "Try Demo". Initiates an outbound call to their number via ACS.
 *
 * The call flow once they pick up is identical to inbound:
 * ACS → WebSocket → AI pipeline (Azure OpenAI Realtime or custom)
 */

import { Router, type Request, type Response } from "express";
import logger from "../logger.ts";
import acsClient from "../services/acsClient.ts";

const router = Router();

const ACS_PHONE_NUMBER = process.env.ACS_PHONE_NUMBER!;
const CALLBACK_URI     = process.env.CALLBACK_URI!;
const WEBSOCKET_URL    = process.env.WEBSOCKET_URL!;


router.post("/", async (req: Request, res: Response) => {
  const { phoneNumber } = req.body as { phoneNumber?: string };

  // ── Validate input ─────────────────────────────────────────────────────────
  if (!phoneNumber || !/^\+?[\d\s\-]{7,15}$/.test(phoneNumber.trim())) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  // Normalise — ensure E.164 format (+ followed by digits only)
  const target = phoneNumber.replace(/[\s\-]/g, "").startsWith("+")
    ? phoneNumber.replace(/[\s\-]/g, "")
    : `+${phoneNumber.replace(/[\s\-]/g, "")}`;

  logger.info({ target }, "Initiating outbound demo call");

  try {
    // ACS outbound call — calls the user's number from your ACS phone number
    // PhoneNumberIdentifier expects `phoneNumber` to be a plain string (E.164)
    const callInvite = {
      targetParticipant: { phoneNumber: target } as const,
      sourceCallIdNumber: { phoneNumber: ACS_PHONE_NUMBER } as const,
    };

    const result = await acsClient.createCall(
      callInvite,
      CALLBACK_URI,
      {
        mediaStreamingOptions: {
          transportUrl: WEBSOCKET_URL,
          transportType: "websocket",
          contentType: "audio",
          audioChannelType: "mixed",
          enableBidirectional: true,
          audioFormat: "Pcm24KMono",
        },
      }
    );

    const callConnectionId = result.callConnectionProperties?.callConnectionId;
    logger.info({ target, callConnectionId }, "✅ Outbound call initiated");

    // NOTE: We don't register the session here because ACS will fire
    // a CallConnected callback event once the user picks up.
    // Register the session in the callback route at that point instead.

    res.json({
      success: true,
      message: `Calling ${target} now!`,
      callConnectionId,
    });
  } catch (err: any) {
    logger.error({ err, target }, "❌ Failed to initiate outbound call");
    res.status(500).json({
      error: err?.message ?? "Failed to place call. Please try again.",
    });
  }
});

export default router;
