const HEARTBEAT_MS = 25_000;

// Server-Sent Events: one long-lived response per dashboard tab.
export function liveEvents(events) {
  return (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 5000\n\n');

    const unsubscribe = events.subscribe(({ type, data }) => {
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    });
    // Comment lines keep proxies from closing an idle connection.
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    const stopOnShutdown = events.onClose(() => res.end());

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      stopOnShutdown();
    });
  };
}
