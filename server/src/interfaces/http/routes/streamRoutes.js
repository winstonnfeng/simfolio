import { presentQuote } from '../presenters/portfolioPresenter.js';

const HEARTBEAT_MS = 25000;

/**
 * Server-sent events endpoint for live quotes.
 *
 * SSE rather than a browser-facing WebSocket: the data flows one way, it rides
 * on plain HTTP (so no proxy or auth changes), and EventSource reconnects on its
 * own. The token arrives as a query parameter because EventSource cannot set
 * headers — it is verified exactly like a bearer token.
 */
export function streamRoutes({ broadcaster, tokens }) {
  return (req, res) => {
    try {
      tokens.verify(req.query.token ?? '');
    } catch (error) {
      res.status(401).json({ error: { code: 'AUTH_ERROR', message: 'Invalid stream token' } });
      return;
    }

    const symbols = String(req.query.symbols ?? '')
      .split(',')
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 60);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n\n');

    const send = (quote) => res.write(`event: quote\ndata: ${JSON.stringify(presentQuote(quote))}\n\n`);
    const unsubscribe = broadcaster.subscribe(symbols, send);

    // Comment frames keep proxies from closing an idle connection.
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    heartbeat.unref?.();

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  };
}
