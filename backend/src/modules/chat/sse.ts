import type { Response } from 'express';

/** SSE over the POST response itself (native EventSource only supports GET without headers). */
export function openSse(res: Response) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Keeps the connection alive behind proxies during slow tool calls.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);
  res.on('close', () => clearInterval(heartbeat));

  return {
    send(event: string, data: unknown) {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    },
  };
}
