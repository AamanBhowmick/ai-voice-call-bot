import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import logger from "./logger.ts";
import webhookRouter from "./routes/webhook.ts";
import callbackRouter from "./routes/callback.ts";
import outboundCallRouter from "./routes/outboundCall.ts";

const app = express();

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors() as any); // cast needed due to @types/cors overload mismatch with Express 4
app.use(express.json());

// HTTP request logging via morgan → piped into pino
app.use(
  morgan("tiny", {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// ── Static files ─────────────────────────────────────────────────────────────
// Bun exposes import.meta.dir as the directory of the current file.
// __dirname equivalent: src/ → go one level up to project root
const ROOT = import.meta.dir.replace(/[\\/]src$/, "");
app.get("/", (_req: Request, res: Response) => {
  res.sendFile(`${ROOT}/demo.html`);
});
// Also serve index.html (architecture diagram) at /diagram
app.get("/diagram", (_req: Request, res: Response) => {
  res.sendFile(`${ROOT}/index.html`);
});

// ── Routes ───────────────────────────────────────────────────────────────────
// Demo page → user enters their number → initiates outbound call to them
app.use("/api/outbound-call", outboundCallRouter);

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

