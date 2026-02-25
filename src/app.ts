import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import logger from "./logger.ts";
import webhookRouter from "./routes/webhook.ts";
import callbackRouter from "./routes/callback.ts";

const app = express();

// ── Middleware ───────────────────────────────────────────────────────────────
// app.use(cors({ origin: "*" }));
app.use(express.json());

// HTTP request logging via morgan → piped into pino
app.use(
  morgan("tiny", {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// ── Routes ───────────────────────────────────────────────────────────────────
// Event Grid → IncomingCall notification
app.use("/api/incoming-call", webhookRouter);

// ACS call-state events (CallConnected, CallDisconnected, etc.)
app.use("/api/callback", callbackRouter);

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
