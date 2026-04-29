import { createServer } from "node:http";

export interface HealthState {
  startedAt: number;
  runtimes: Map<string, unknown>;
  lastPollAt: number;
}

export function startHealthServer(state: HealthState, port = Number(process.env.PORT) || 3000) {
  const server = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/healthz" || req.url === "/") {
      const uptimeMs = Date.now() - state.startedAt;
      const lastPollAgoMs = Date.now() - state.lastPollAt;
      // Consider unhealthy if we haven't polled in 60s
      const healthy = lastPollAgoMs < 60_000;
      res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: healthy,
          uptimeMs,
          lastPollAgoMs,
          runningBots: state.runtimes.size,
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, () => {
    console.log(`Health server listening on :${port}`);
  });
  return server;
}
