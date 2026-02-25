import { Router, type Request, type Response } from "express";
import logger from "../logger.ts";

const router = Router();

router.post("/", (req: Request, res: Response) => {
  const events = req.body;

  if (!Array.isArray(events)) return res.sendStatus(400);

  for (const event of events) {
    const type = event.type ?? event.eventType;
    const callId = event.data?.callConnectionId ?? "unknown";

    logger.info({ type, callId }, "ACS callback event received");

    switch (type) {
      // Fired when ACS has successfully answered the call
      // and the WebSocket media stream is ready to open.
      case "Microsoft.Communication.CallConnected":
        logger.info({ callId }, "✅ Call connected — WebSocket will open shortly");
        break;

      // Fired when the call ends (caller hangs up, or you hang up).
      // Clean up any resources associated with this callId here.
      case "Microsoft.Communication.CallDisconnected":
        logger.info({ callId }, "📵 Call disconnected");
        break;

      // Fired when the media stream is ready and ACS has connected
      // to your WebSocket server. Audio is now flowing.
      case "Microsoft.Communication.MediaStreamingStarted":
        logger.info({ callId }, "🎙 Media streaming started");
        break;

      // Fired when the media stream stops (call ended or stream detached).
      case "Microsoft.Communication.MediaStreamingStopped":
        logger.info({ callId }, "🔇 Media streaming stopped");
        break;

      default:
        logger.debug({ type, callId }, "Unhandled ACS event");
    }
  }

  res.sendStatus(200);
});

export default router;
