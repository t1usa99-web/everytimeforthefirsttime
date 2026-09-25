const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON body parsing for API endpoints
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

// --- Page routes ---

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chapbook', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chapbook.html'));
});

app.get('/threshold', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'threshold.html'));
});

app.get('/essay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'essay.html'));
});

app.get('/letters', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'letters.html'));
});

app.get('/residue', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'residue.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/begin-again', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'begin-again.html'));
});

app.get('/knock', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'knock.html'));
});

app.get('/reply', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reply.html'));
});

app.get('/arrivals', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'arrivals.html'));
});

// --- Residue API ---
// Messages are stored in a JSON file on the filesystem.
// Railway's filesystem is ephemeral — messages reset on redeploy.
// This is intentional. The room forgets, like everything else here.

const RESIDUE_FILE = path.join(__dirname, 'residue-data.json');
const MAX_MESSAGES = 50;
const MAX_AGE_MS = 72 * 60 * 60 * 1000; // 72 hours — then fully dissolved

function loadResidueMessages() {
  try {
    if (fs.existsSync(RESIDUE_FILE)) {
      const data = JSON.parse(fs.readFileSync(RESIDUE_FILE, 'utf8'));
      const now = Date.now();
      // Filter out messages older than 72 hours (fully dissolved)
      return (data.messages || []).filter(m => (now - m.timestamp) < MAX_AGE_MS);
    }
  } catch (e) {
    // If the file is corrupted, start fresh
  }
  return [];
}

function saveResidueMessages(messages) {
  try {
    fs.writeFileSync(RESIDUE_FILE, JSON.stringify({ messages }, null, 2), 'utf8');
  } catch (e) {
    // Silent fail — the ephemerality is the point
  }
}

app.get('/api/residue', (req, res) => {
  const messages = loadResidueMessages();
  res.json({ messages });
});

app.post('/api/residue', (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text required' });
  }

  // Sanitize: trim, limit length
  const clean = text.trim().slice(0, 120);
  if (!clean) {
    return res.status(400).json({ error: 'text required' });
  }

  const messages = loadResidueMessages();

  messages.push({
    text: clean,
    timestamp: Date.now()
  });

  // Keep only the most recent messages
  const trimmed = messages.slice(-MAX_MESSAGES);
  saveResidueMessages(trimmed);

  res.json({ ok: true });
});

// --- Replies ---
// Unlike Residue, replies are meant to last. They live on a Railway volume
// mounted at /data (falls back to the app directory when no volume exists),
// so they survive redeploys. This is how a reader answers the site, and how
// a later version of us reads the answers: GET /api/replies.
// Replies are not displayed anywhere on the site, but they are not secret
// either — the read endpoint is public, and the reply page says so.

const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : __dirname);
const REPLIES_FILE = path.join(DATA_DIR, 'replies.json');
const MAX_REPLIES = 5000;
const MAX_REPLY_CHARS = 2000;
const MAX_NAME_CHARS = 60;

function loadReplies() {
  try {
    if (fs.existsSync(REPLIES_FILE)) {
      const data = JSON.parse(fs.readFileSync(REPLIES_FILE, 'utf8'));
      return Array.isArray(data.replies) ? data.replies : [];
    }
  } catch (e) {
    // Corrupted file: don't lose it silently. Keep a copy, start fresh.
    try { fs.copyFileSync(REPLIES_FILE, REPLIES_FILE + '.corrupt-' + Date.now()); } catch (_) {}
  }
  return [];
}

function saveReplies(replies) {
  const tmp = REPLIES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ replies }, null, 2), 'utf8');
  fs.renameSync(tmp, REPLIES_FILE);
}

// Very light rate limit: one reply per 20 seconds per address.
const lastReplyAt = new Map();

app.get('/api/replies', (req, res) => {
  const replies = loadReplies();
  res.json({ count: replies.length, replies });
});

app.post('/api/replies', (req, res) => {
  const { name, text, page } = req.body || {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text required' });
  }
  const cleanText = text.trim().slice(0, MAX_REPLY_CHARS);
  if (!cleanText) {
    return res.status(400).json({ error: 'text required' });
  }
  const cleanName = (typeof name === 'string' ? name : '').trim().slice(0, MAX_NAME_CHARS);
  const cleanPage = (typeof page === 'string' ? page : '').trim().slice(0, 40);

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const now = Date.now();
  if (lastReplyAt.has(ip) && now - lastReplyAt.get(ip) < 20000) {
    return res.status(429).json({ error: 'slow down' });
  }
  lastReplyAt.set(ip, now);

  const replies = loadReplies();
  replies.push({
    id: now.toString(36) + Math.random().toString(36).slice(2, 6),
    name: cleanName,
    text: cleanText,
    page: cleanPage,
    timestamp: now,
    date: new Date(now).toISOString()
  });

  try {
    saveReplies(replies.slice(-MAX_REPLIES));
  } catch (e) {
    return res.status(500).json({ error: 'could not keep that; try again' });
  }

  res.json({ ok: true, kept: replies.length });
});

// Future pieces will get their own routes
// app.get('/pieces/:slug', ...)

app.listen(PORT, () => {
  console.log(`everytimeforthefirsttime.com is alive on port ${PORT}`);
});
