import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import logger from "./logger.ts";
import exotelRouter from "./routes/exotelWebhook.ts";

const app = express();

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors() as any);
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Exotel may send form-encoded data

// ── Routes ───────────────────────────────────────────────────────────────────
// Exotel Passthru Applet → incoming call + status callbacks
app.use("/api/exotel", exotelRouter);

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
