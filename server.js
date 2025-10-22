const express = require('express');
const cors = require('cors');
const { Low, JSONFile } = require('lowdb');
const { nanoid } = require('nanoid');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// ensure server directory exists for db file
const dbDir = __dirname;
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const file = path.join(dbDir, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

(async () => {
  await db.read();
  db.data = db.data || { sessions: {} };
  await db.write();
})();

// Create a new session id and empty history
app.post('/api/sessions', async (req, res) => {
  await db.read();
  const id = nanoid();
  db.data.sessions[id] = { history: [] };
  await db.write();
  res.json({ id });
});

// Get session history
app.get('/api/sessions/:id', async (req, res) => {
  await db.read();
  const s = db.data.sessions[req.params.id];
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(s);
});

// Replace/overwrite session history
app.put('/api/sessions/:id', async (req, res) => {
  if (!req.body || !Array.isArray(req.body.history)) {
    return res.status(400).json({ error: 'Missing or invalid body.history (must be array)' });
  }
  await db.read();
  db.data.sessions[req.params.id] = { history: req.body.history };
  await db.write();
  res.json({ ok: true });
});

// Append one item to history (validates input)
app.post('/api/sessions/:id/history', async (req, res) => {
  if (!req.body || typeof req.body.item === 'undefined') {
    return res.status(400).json({ error: 'Missing body.item' });
  }
  await db.read();
  const id = req.params.id;
  if (!db.data.sessions[id]) db.data.sessions[id] = { history: [] };
  db.data.sessions[id].history.push(req.body.item);
  await db.write();
  res.json({ ok: true });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server listening ${port}`));