// Mock webhook receiver for testing Pak Commerce webhook deliveries.
// - POST /ok    : always returns 200, verifies HMAC signature
// - POST /fail  : always returns 500 (tests retry/backoff)
// - GET  /log   : dumps received requests + verification results
const http = require('http');
const crypto = require('crypto');

const SECRET = process.argv[2] || ''; // webhook secret to verify HMAC
const PORT = 4005;

const log = [];

function verifySig(raw, sigHeader) {
  if (!SECRET) return { checked: false };
  if (!sigHeader) return { checked: true, ok: false, reason: 'missing header' };
  const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  return { checked: true, ok: sigHeader === expected, expected, received: sigHeader };
}

const server = http.createServer((req, res) => {
  let chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    if (req.method === 'GET' && req.url.startsWith('/log')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(log, null, 2));
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(404).end();
      return;
    }
    const v = verifySig(raw, req.headers['x-pak-commerce-signature']);
    const entry = {
      at: new Date().toISOString(),
      url: req.url,
      topic: req.headers['x-pak-commerce-topic'] || null,
      deliveryId: req.headers['x-pak-commerce-delivery-id'] || null,
      sigVerify: v,
      body: raw.slice(0, 800),
    };
    log.push(entry);
    console.log(`[recv] ${req.url} topic=${entry.topic} sigOk=${v.ok === true ? 'YES' : v.checked ? 'NO' : 'n/a'}`);
    if (req.url.startsWith('/fail')) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'simulated receiver failure' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }
  });
});

server.listen(PORT, () => console.log(`Mock receiver on :${PORT} (secret ${SECRET ? 'configured' : 'NOT set — verification skipped'})`));
