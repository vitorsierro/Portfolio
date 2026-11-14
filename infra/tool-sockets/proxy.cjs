const http = require('node:http');

function createServer({ api = 'http://api:3001', heartbeatTimeout = 3000, handshakeTimeout = 4000, targets = {
  hermes: { hostname: 'hermes', port: 9120, origin: 'https://chat.vitorsierro.com' },
  draw: { hostname: 'excalidraw-room', port: 8080, origin: 'https://draw.vitorsierro.com' },
} } = {}) {
  const server = http.createServer((req, res) => {
    res.writeHead(req.url === '/health' ? 200 : 404).end();
  });
  const active = new Set();
  server.stopTools = () => { for (const stop of active) stop(); };
  server.on('close', () => { for (const stop of active) stop(); });
  server.on('upgrade', (req, socket, head) => {
    const targetName = req.headers['x-tool-name'];
    const target = Object.hasOwn(targets, targetName) ? targets[targetName] : null;
    const origin = req.headers['x-tool-origin'];
    if (!target || (origin && origin !== target.origin) ||
        (targetName === 'draw' && !req.url.startsWith('/socket.io/'))) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    if (active.size >= 256) { socket.destroy(); return; }
    let verify, watch, upstream, upstreamSocket, timer;
    let stopped = false;
    let upgraded = false;
    let ready = false;
    let buffer = '';
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      active.delete(stop);
      verify?.destroy(); watch?.destroy(); upstream?.destroy(); upstreamSocket?.destroy(); socket.destroy();
    };
    active.add(stop);
    socket.on('error', stop);
    socket.on('close', stop);
    const reject = (status) => {
      if (!socket.destroyed) socket.end(`HTTP/1.1 ${status} ${http.STATUS_CODES[status]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`, stop);
      else stop();
    };
    timer = setTimeout(stop, handshakeTimeout);
    const openUpstream = () => {
      if (ready || stopped) return;
      ready = true;
      const headers = { ...req.headers };
      delete headers['x-tool-name']; delete headers['x-tool-origin'];
      if (targetName === 'hermes') {
        headers.host = '127.0.0.1:9119'; headers.origin = 'http://127.0.0.1:9119';
      }
      upstream = http.request({ hostname: target.hostname, port: target.port, path: req.url, method: 'GET', headers });
      upstream.on('error', stop);
      upstream.on('response', (response) => { response.on('error', stop); response.resume(); reject(502); });
      upstream.on('upgrade', (response, peer, peerHead) => {
        upstreamSocket = peer;
        if (stopped) { peer.destroy(); return; }
        upgraded = true;
        const lines = [`HTTP/1.1 ${response.statusCode} ${response.statusMessage}`];
        for (let i = 0; i < response.rawHeaders.length; i += 2) lines.push(`${response.rawHeaders[i]}: ${response.rawHeaders[i + 1]}`);
        socket.write(lines.join('\r\n') + '\r\n\r\n');
        if (peerHead.length) socket.write(peerHead);
        if (head.length) peer.write(head);
        peer.on('error', stop); peer.on('close', stop);
        socket.pipe(peer); peer.pipe(socket);
      });
      upstream.end();
    };
    verify = http.get(new URL('/auth/verify', api), { headers: { Cookie: req.headers.cookie || '' } }, (response) => {
      const ticket = response.headers['x-tool-session-watch'];
      response.on('error', stop);
      response.resume();
      if (response.statusCode !== 204 || typeof ticket !== 'string' || ticket.length > 256) { reject(401); return; }
      if (stopped) return;
      watch = http.get(new URL('/auth/socket-events', api), { headers: { Authorization: `Bearer ${ticket}` } }, (events) => {
        if (events.statusCode !== 200) { events.resume(); reject(401); return; }
        events.setEncoding('utf8');
        events.on('error', stop); events.on('end', stop); events.on('close', stop);
        events.on('data', (chunk) => {
          if (stopped) return;
          buffer += chunk.replace(/\r\n/g, '\n');
          if (buffer.length > 8192) { stop(); return; }
          let end;
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const event = buffer.slice(0, end); buffer = buffer.slice(end + 2);
            if (/^event: ?(ready|heartbeat)$/m.test(event)) {
              clearTimeout(timer);
              timer = setTimeout(stop, heartbeatTimeout);
              if (!upgraded) openUpstream();
            } else if (/^event: ?(revoked|error)$/m.test(event)) { stop(); return; }
          }
        });
      });
      watch.on('error', stop);
    });
    verify.on('error', () => reject(503));
  });
  return server;
}

module.exports = { createServer };
