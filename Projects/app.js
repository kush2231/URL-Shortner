const express = require('express');
const { nanoid } = require('nanoid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(express.json());

app.get('/', (req,res)=>{
  console.log('this is running server code');
  return res.status(200).send("This is the staging server.");
})

// POST /shorten — create a short URL
app.post('/shorten', (req, res) => {
  const { url, customCode } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    new URL(url); // validate URL format
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Handle custom code — check for duplicate upfront
  if (customCode) {
    const existing = db.prepare('SELECT code FROM urls WHERE code = ?').get(customCode);
    if (existing) {
      return res.status(409).json({ error: 'Custom code already in use' });
    }
  }

  // Auto-generated code: retry on collision (UNIQUE constraint violation)
  const MAX_RETRIES = 5;
  let code = customCode;

  if (!code) {
    const insert = db.prepare('INSERT INTO urls (code, original_url) VALUES (?, ?)');
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      code = nanoid(7);
      try {
        insert.run(code, url);
        return res.status(201).json({ short_url: `${BASE_URL}/${code}`, code, original_url: url });
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' && attempt < MAX_RETRIES) continue;
        return res.status(500).json({ error: 'Failed to generate a unique code, please try again' });
      }
    }
  }

  try {
    db.prepare('INSERT INTO urls (code, original_url) VALUES (?, ?)').run(code, url);
  } catch {
    return res.status(500).json({ error: 'Failed to save URL' });
  }

  return res.status(201).json({
    short_url: `${BASE_URL}/${code}`,
    code,
    original_url: url,
  });
});

// GET /api/stats/:code — view stats for a short URL
app.get('/api/stats/:code', (req, res) => {
  const row = db.prepare('SELECT * FROM urls WHERE code = ?').get(req.params.code);

  if (!row) {
    return res.status(404).json({ error: 'Short URL not found' });
  }

  return res.json({
    code: row.code,
    original_url: row.original_url,
    short_url: `${BASE_URL}/${row.code}`,
    clicks: row.clicks,
    created_at: row.created_at,
  });
});

// GET /:code — redirect to original URL
app.get('/:code', (req, res) => {
  const row = db.prepare('SELECT * FROM urls WHERE code = ?').get(req.params.code);

  if (!row) {
    return res.status(404).json({ error: 'Short URL not found' });
  }

  db.prepare('UPDATE urls SET clicks = clicks + 1 WHERE code = ?').run(req.params.code);

  return res.redirect(301, row.original_url);
});

app.listen(PORT, () => {
  console.log(`URL shortener running at ${BASE_URL}`);
});
