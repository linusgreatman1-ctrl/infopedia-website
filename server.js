// Infopedia Technology — static site + backend server.
// Handles: public review submission/listing, the contact form, and an
// admin API (login, respond to/hide reviews, view contact messages).
//
// Deployment note: this is a real server (not a static site), so it needs
// a Node host (Render, Railway, a VPS, etc.) — it will NOT work on a
// static-only host like Netlify. Run `npm install` once before starting
// (pulls in nodemailer for the optional email notifications below).
//
// Required env var before deploying: ADMIN_PASSWORD (a fallback insecure
// default is used otherwise, logged as a warning on boot).
//
// Optional env vars, for emailing a notification on every new review /
// contact submission — if any are missing, email is silently skipped and
// everything else still works (submissions are always saved either way):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, NOTIFY_EMAIL

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const port = process.env.PORT || 5050;
const dataDir = path.join(root, 'data');
const reviewsFile = path.join(dataDir, 'reviews.json');
const contactsFile = path.join(dataDir, 'contacts.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'infopedia-admin-change-me';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(reviewsFile)) fs.writeFileSync(reviewsFile, '[]');
if (!fs.existsSync(contactsFile)) fs.writeFileSync(contactsFile, '[]');

// ── Optional email notifications ──
// nodemailer is a listed dependency (package.json), but this require is
// guarded anyway so a deploy that skipped `npm install` degrades to
// "no email" instead of crashing the whole server on boot.
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // not installed — email notifications simply won't fire
}

function emailConfigured() {
  return !!(nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.NOTIFY_EMAIL);
}

let mailTransport = null;
function getMailTransport() {
  if (!emailConfigured()) return null;
  if (!mailTransport) {
    mailTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return mailTransport;
}

async function notifyByEmail(subject, text) {
  const transport = getMailTransport();
  if (!transport) return; // not configured — quietly skip, submission is already saved
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.NOTIFY_EMAIL,
      subject,
      text,
    });
  } catch (err) {
    console.error('[email] notification failed (submission was still saved):', err.message);
  }
}

// ── In-memory admin sessions: token -> expiry timestamp ──
const adminTokens = new Map();

// ── In-memory rate limiting for public POST endpoints: ip -> timestamps[] ──
const rateBuckets = new Map();
function isRateLimited(ip, route, max = 5, windowMs = 10 * 60 * 1000) {
  const key = ip + ':' + route;
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    rateBuckets.set(key, hits);
    return true;
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  return false;
}
// Sweep old buckets every hour so this map can't grow unbounded on a
// long-running process.
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of rateBuckets) {
    const fresh = hits.filter((t) => now - t < 60 * 60 * 1000);
    if (fresh.length) rateBuckets.set(key, fresh);
    else rateBuckets.delete(key);
  }
}, 60 * 60 * 1000).unref();

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

const staticTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
};

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}
function writeJsonFile(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
const readReviews = () => readJsonFile(reviewsFile);
const writeReviews = (data) => writeJsonFile(reviewsFile, data);
const readContacts = () => readJsonFile(contactsFile);
const writeContacts = (data) => writeJsonFile(contactsFile, data);

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function readBody(req, maxBytes = 20000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function getAdminToken(req) {
  const auth = req.headers['authorization'] || '';
  const match = auth.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

function requireAdmin(req) {
  const token = getAdminToken(req);
  if (!token) return false;
  const expiry = adminTokens.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleApi(req, res, pathname) {
  const ip = clientIp(req);

  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, { status: 'ok', time: new Date().toISOString() });
  }

  // ── Reviews: public ──
  if (pathname === '/api/reviews' && req.method === 'GET') {
    const reviews = readReviews()
      .filter((r) => !r.hidden)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJson(res, 200, { reviews });
  }

  if (pathname === '/api/reviews' && req.method === 'POST') {
    if (isRateLimited(ip, 'reviews')) return sendJson(res, 429, { error: 'Too many submissions. Please try again later.' });

    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJson(res, 400, { error: 'Invalid request body' });
    }
    const name = String(body.name || '').trim().slice(0, 80);
    const company = String(body.company || '').trim().slice(0, 80);
    const comment = String(body.comment || '').trim().slice(0, 1000);
    const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating))));

    if (!name || !comment || !rating) {
      return sendJson(res, 400, { error: 'Name, rating and comment are required.' });
    }

    const review = {
      id: crypto.randomUUID(),
      name,
      company,
      rating,
      comment,
      createdAt: new Date().toISOString(),
      hidden: false,
      response: null,
      respondedAt: null,
    };
    const reviews = readReviews();
    reviews.push(review);
    writeReviews(reviews);

    notifyByEmail(
      `New ${rating}★ review from ${name}`,
      `${name}${company ? ' (' + company + ')' : ''} left a ${rating}-star review:\n\n"${comment}"\n\nRespond from the admin panel: /admin.html`
    );

    return sendJson(res, 201, { review });
  }

  // ── Contact form: public ──
  if (pathname === '/api/contact' && req.method === 'POST') {
    if (isRateLimited(ip, 'contact')) return sendJson(res, 429, { error: 'Too many submissions. Please try again later.' });

    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJson(res, 400, { error: 'Invalid request body' });
    }
    const name = String(body.name || '').trim().slice(0, 100);
    const email = String(body.email || '').trim().slice(0, 200);
    const service = String(body.service || '').trim().slice(0, 100);
    const message = String(body.message || '').trim().slice(0, 2000);

    if (!name || !email || !message) {
      return sendJson(res, 400, { error: 'Name, email and project details are required.' });
    }
    if (!EMAIL_RE.test(email)) {
      return sendJson(res, 400, { error: 'Please enter a valid email address.' });
    }

    const contact = {
      id: crypto.randomUUID(),
      name,
      email,
      service,
      message,
      createdAt: new Date().toISOString(),
      read: false,
    };
    const contacts = readContacts();
    contacts.push(contact);
    writeContacts(contacts);

    notifyByEmail(
      `New enquiry — ${service || 'General'}`,
      `From: ${name} <${email}>\nService: ${service || '—'}\n\n${message}`
    );

    return sendJson(res, 201, { ok: true });
  }

  // ── Admin: login ──
  if (pathname === '/api/admin/login' && req.method === 'POST') {
    if (isRateLimited(ip, 'admin-login', 10, 15 * 60 * 1000)) return sendJson(res, 429, { error: 'Too many attempts. Please try again later.' });

    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJson(res, 400, { error: 'Invalid request body' });
    }
    if (body.password !== ADMIN_PASSWORD) {
      return sendJson(res, 401, { error: 'Incorrect password' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    adminTokens.set(token, Date.now() + TOKEN_TTL_MS);
    return sendJson(res, 200, { token });
  }

  // ── Admin: reviews ──
  if (pathname === '/api/admin/reviews' && req.method === 'GET') {
    if (!requireAdmin(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const reviews = readReviews().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJson(res, 200, { reviews });
  }

  const respondMatch = pathname.match(/^\/api\/admin\/reviews\/([^/]+)\/respond$/);
  if (respondMatch && req.method === 'POST') {
    if (!requireAdmin(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJson(res, 400, { error: 'Invalid request body' });
    }
    const response = String(body.response || '').trim().slice(0, 1000);
    if (!response) return sendJson(res, 400, { error: 'Response text is required.' });

    const reviews = readReviews();
    const review = reviews.find((r) => r.id === respondMatch[1]);
    if (!review) return sendJson(res, 404, { error: 'Review not found' });
    review.response = response;
    review.respondedAt = new Date().toISOString();
    writeReviews(reviews);
    return sendJson(res, 200, { review });
  }

  const hideMatch = pathname.match(/^\/api\/admin\/reviews\/([^/]+)\/hide$/);
  if (hideMatch && req.method === 'POST') {
    if (!requireAdmin(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      body = {};
    }
    const reviews = readReviews();
    const review = reviews.find((r) => r.id === hideMatch[1]);
    if (!review) return sendJson(res, 404, { error: 'Review not found' });
    review.hidden = body.hidden !== undefined ? !!body.hidden : !review.hidden;
    writeReviews(reviews);
    return sendJson(res, 200, { review });
  }

  // ── Admin: contact messages ──
  if (pathname === '/api/admin/contacts' && req.method === 'GET') {
    if (!requireAdmin(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const contacts = readContacts().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJson(res, 200, { contacts });
  }

  const readMatch = pathname.match(/^\/api\/admin\/contacts\/([^/]+)\/read$/);
  if (readMatch && req.method === 'POST') {
    if (!requireAdmin(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      body = {};
    }
    const contacts = readContacts();
    const contact = contacts.find((c) => c.id === readMatch[1]);
    if (!contact) return sendJson(res, 404, { error: 'Message not found' });
    contact.read = body.read !== undefined ? !!body.read : !contact.read;
    writeContacts(contacts);
    return sendJson(res, 200, { contact });
  }

  return sendJson(res, 404, { error: 'Not found' });
}

function serveStatic(req, res, pathname) {
  let urlPath = pathname;
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(root, urlPath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': staticTypes[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  });
}

http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  const pathname = decodeURIComponent(req.url.split('?')[0]);

  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).catch((err) => {
      console.error(err);
      sendJson(res, 500, { error: 'Server error' });
    });
    return;
  }

  serveStatic(req, res, pathname);
}).listen(port, () => {
  console.log(`Infopedia site + backend listening on http://localhost:${port}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('ADMIN_PASSWORD not set — using an insecure default. Set it before deploying.');
  }
  if (!emailConfigured()) {
    console.warn('Email notifications not configured (SMTP_* / NOTIFY_EMAIL env vars) — submissions are still saved, just not emailed.');
  }
});
