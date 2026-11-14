const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createHash } = require('node:crypto');
const { createServer } = require('./proxy.cjs');

const closed = (socket) => new Promise((resolve) => socket.once('close', resolve));

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

async function fixture(t, { heartbeat = true } = {}) {
  const streams = new Map();
  const peers = new Set();
  const api = http.createServer((req, res) => {
    if (req.url === '/auth/verify') {
      const session = /^sid=([ab])$/.exec(req.headers.cookie || '')?.[1];
      res.writeHead(session ? 204 : 401, session ? { 'X-Tool-Session-Watch': session } : {}).end();
    } else {
      const id = req.headers.authorization?.slice(7);
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('event: ready\ndata: active\n\n');
      if (!streams.has(id)) streams.set(id, new Set());
      streams.get(id).add(res);
      const timer = heartbeat ? setInterval(() => res.write('event: heartbeat\ndata: active\n\n'), 50) : null;
      res.on('close', () => { clearInterval(timer); streams.get(id).delete(res); });
    }
  });
  const upstream = http.createServer();
  upstream.on('upgrade', (req, socket) => {
    peers.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => peers.delete(socket));
    const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.on('data', (bytes) => socket.write(bytes));
  });
  const apiPort = await listen(api);
  const upstreamPort = await listen(upstream);
  const gateway = createServer({ api: `http://127.0.0.1:${apiPort}`, heartbeatTimeout: 250, targets: {
    hermes: { hostname: '127.0.0.1', port: upstreamPort, origin: 'https://chat.example.test' },
    draw: { hostname: '127.0.0.1', port: upstreamPort, origin: 'https://draw.example.test' },
  } });
  const port = await listen(gateway);
  t.after(() => {
    gateway.stopTools(); gateway.close(); gateway.closeAllConnections();
    for (const peer of peers) peer.destroy();
    for (const set of streams.values()) for (const stream of set) stream.destroy();
    api.close(); api.closeAllConnections(); upstream.close(); upstream.closeAllConnections();
  });
  const connect = (cookie = 'sid=a', name = 'hermes', origin = 'https://chat.example.test') => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: name === 'draw' ? '/socket.io/?EIO=4&transport=websocket' : '/api/events?channel=test', headers: {
      Cookie: cookie, 'X-Tool-Name': name, 'X-Tool-Origin': origin,
      Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': 'AAAAAAAAAAAAAAAAAAAAAA==', 'Sec-WebSocket-Version': '13',
    } });
    req.on('upgrade', (_, socket) => { socket.on('error', () => {}); resolve({ status: 101, socket }); });
    req.on('response', (res) => { res.resume(); resolve({ status: res.statusCode }); });
    req.on('error', reject); req.end();
  });
  const revoke = (id) => { for (const stream of streams.get(id) || []) stream.end('event: revoked\ndata: revoked\n\n'); };
  return { connect, revoke, api, streams, peers };
}

test('logout fecha canais ativos de Hermes e colaboração, preservando outra sessão', async (t) => {
  const f = await fixture(t);
  const a = await f.connect();
  const draw = await f.connect('sid=a', 'draw', 'https://draw.example.test');
  const b = await f.connect('sid=b');
  assert.equal(a.status, 101); assert.equal(draw.status, 101); assert.equal(b.status, 101);
  let received = 0;
  a.socket.on('data', () => received++);
  const active = setInterval(() => a.socket.write('traffic'), 10);
  t.after(() => clearInterval(active));
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.ok(received > 0, 'o canal tem tráfego, não está apenas ocioso');
  const closedA = closed(a.socket); const closedDraw = closed(draw.socket);
  f.revoke('a');
  await Promise.all([closedA, closedDraw]);
  clearInterval(active);
  assert.equal(b.socket.destroyed, false);
  b.socket.destroy();
});

test('nega cookie ausente, origem estranha e destino arbitrário', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.connect('')).status, 401);
  assert.equal((await f.connect('sid=a', 'hermes', 'https://evil.test')).status, 403);
  assert.equal((await f.connect('sid=a', 'http://evil.test')).status, 403);
  assert.equal(f.peers.size, 0);
});

test('fecha os canais se perder o stream ou o heartbeat da API', async (t) => {
  const f = await fixture(t, { heartbeat: false });
  const a = await f.connect();
  assert.equal(a.status, 101);
  await closed(a.socket);
  const b = await f.connect('sid=b');
  const closedB = closed(b.socket);
  for (const stream of f.streams.get('b')) stream.destroy();
  await closedB;
});
