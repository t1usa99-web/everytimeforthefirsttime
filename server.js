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

// Future pieces will get their own routes
// app.get('/pieces/:slug', ...)

app.listen(PORT, () => {
  console.log(`everytimeforthefirsttime.com is alive on port ${PORT}`);
});
