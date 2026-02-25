/**
 * Entry Point — starts the HTTP server (Express) and WebSocket server (ws)
 * on the same port, routing upgrades to the WS server for /audio connections.
 */

import http from "http";
import { createServer as createHttpServer } from "http";
import app from "./app.ts";
import { createWsServer } from "./services/wsServer.ts";
import logger from "./logger.ts";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

// ── Create HTTP server wrapping the Express app ───────────────────────────────
const httpServer = createHttpServer(app);

// ── Attach the WebSocket server ───────────────────────────────────────────────
// The WS server does NOT listen on its own port.
// Instead, we intercept HTTP upgrade requests on the same port and hand them
// to the WS server — this is how you run HTTP + WebSocket on a single port.
const wss = createWsServer();

httpServer.on("upgrade", (req, socket, head) => {
  // Only handle upgrades for the /audio path
  if (req.url === "/audio") {
    wss.handleUpgrade(req, socket as any, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    // Reject WebSocket upgrades for unknown paths
    socket.destroy();
  }
});

// ── Start listening ───────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  logger.info(`🚀 HTTP server listening on http://localhost:${PORT}`);
  logger.info(`🔌 WebSocket server listening on ws://localhost:${PORT}/audio`);
  logger.info(`❤  Health check: http://localhost:${PORT}/health`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Closes open connections cleanly when the process is stopped (Ctrl+C or Azure restart)
const shutdown = (signal: string) => {
  logger.info({ signal }, "Shutting down...");
  httpServer.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
