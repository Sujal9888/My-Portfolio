// Minimal Express server storing contacts in a local JSON file (contacts.json)
const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Root folder (serve static files from the portfolio directory)
const ROOT = path.resolve(__dirname);
const CONTACTS_FILE = path.join(ROOT, 'contacts.json');

app.use(cors());
app.use(express.json());
app.use(express.static(ROOT));

async function readContacts() {
  try {
    const raw = await fs.readFile(CONTACTS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

async function writeContacts(arr) {
  await fs.writeFile(CONTACTS_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

// POST /api/contact — accept JSON { name, email, message }
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing name, email, or message' });
    }

    const timestamp = new Date().toISOString();
    const contact = { id: Date.now(), name: String(name), email: String(email), message: String(message), timestamp };

    const arr = await readContacts();
    // dedupe: skip if an exact match (email + message + timestamp) already exists
    const exists = arr.find(c => c.email === contact.email && c.message === contact.message && c.timestamp === contact.timestamp);
    if (!exists) {
      arr.push(contact);
      await writeContacts(arr);
      return res.status(201).json({ success: true, contact });
    } else {
      console.log('Duplicate contact skipped');
      return res.status(200).json({ success: true, contact: exists, skipped: true });
    }
  } catch (err) {
    console.error('Error inserting contact', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/migrate — accept an array of contact objects to bulk import
// Body: [{ name, email, message, timestamp?, id? }, ...]
app.post('/api/migrate', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    if (!items.length) return res.status(400).json({ error: 'Expecting an array of contact objects' });

    const existing = await readContacts();
    let added = 0;
    for (const it of items) {
      const name = it.name && String(it.name).trim();
      const email = it.email && String(it.email).trim();
      const message = it.message && String(it.message).trim();
      const timestamp = it.timestamp || new Date().toISOString();
      if (!name || !email || !message) continue;
      // dedupe by email+message+timestamp
      const found = existing.find(c => c.email === email && c.message === message && c.timestamp === timestamp);
      if (found) continue;
      const contact = { id: Date.now() + Math.floor(Math.random() * 1000), name, email, message, timestamp };
      existing.push(contact);
      added++;
    }
  if (added) await writeContacts(existing);
  return res.json({ imported: added, importedContacts: existing.slice(-added) });
  } catch (err) {
    console.error('Migration error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/contacts — list recent messages (dev-only)
app.get('/api/contacts', async (req, res) => {
  try {
    const rows = await readContacts();
    res.json(rows.reverse());
  } catch (err) {
    console.error('Error reading contacts', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check
app.get('/api/_health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Serving static files from ${ROOT}`);
});
