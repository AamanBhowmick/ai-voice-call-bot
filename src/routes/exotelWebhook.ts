/**
 * Exotel Webhook Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles HTTP callbacks from Exotel's Passthru Applet:
 *   POST /incoming  — called when a call arrives on your ExoPhone
 *   POST /status    — called when a call ends (optional status callback)
 *
 * The Passthru Applet fires BEFORE the Voicebot Applet in your Exotel flow.
 * Your server returns 200 to let the flow continue → Voicebot opens WebSocket.
 */

import { Router, type Request, type Response } from "express";
import logger from "../logger.ts";

const router = Router();

// ── Passthru Applet → Incoming call notification ────────────────────────────
// Exotel sends: CallSid, From, To, CallType, Direction, CurrentTime, etc.
router.post("/incoming", (req: Request, res: Response) => {
  const { CallSid, From, To, CallType, Direction } = req.body ?? req.query ?? {};

  logger.info(
    { callSid: CallSid, from: From, to: To, callType: CallType, direction: Direction },
    "📞 Exotel incoming call"
  );

  // Return 200 to let the Exotel flow continue to the next applet (Voicebot)
  res.sendStatus(200);
});

// ── Status callback → Call ended / completed ────────────────────────────────
// Configure this URL in Exotel's StatusCallback settings for the flow.
router.post("/status", (req: Request, res: Response) => {
  const { CallSid, Status, Duration, Direction } = req.body ?? {};

  logger.info(
    { callSid: CallSid, status: Status, duration: Duration, direction: Direction },
    "📵 Exotel call status update"
  );

  res.sendStatus(200);
});

export default router;
