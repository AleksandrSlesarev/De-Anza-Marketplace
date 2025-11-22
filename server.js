// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { Low, JSONFile } = require('lowdb');
const { nanoid } = require('nanoid');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// serve uploaded files
app.use('/uploads', express.static(UPLOAD_DIR));

// serve frontend if placed in /public
app.use('/', express.static(path.join(__dirname, 'public')));

// Setup lowdb
const dbFile = path.join(__dirname, 'db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

// Initialize DB if empty
async function initDB() {
  await db.read();
  db.data = db.data || { users: [], listings: [] };
  await db.write();
}
initDB();

// Configure multer for uploads (images & videos)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${nanoid(6)}${ext}`);
  }
});
const upload = multer({ storage });

// ---------- Auth endpoints (demo, no password hashing) ----------

// Register
// body: { name, studentId, password }
app.post('/api/register', async (req, res) => {
  await db.read();
  const { name, studentId, password } = req.body;
  if (!name || !studentId || !password) return res.status(400).json({ ok:false, msg: 'Missing fields' });

  const exists = db.data.users.find(u => u.studentId === studentId);
  if (exists) return res.status(409).json({ ok:false, msg: 'Student ID already used' });

  const user = { id: nanoid(), name, studentId, password };
  db.data.users.push(user);
  await db.write();

  // Return basic user (no password)
  const { password: pw, ...publicUser } = user;
  res.json({ ok: true, user: publicUser });
});

// Login
// body: { studentId, password }
app.post('/api/login', async (req, res) => {
  await db.read();
  const { studentId, password } = req.body;
  const user = db.data.users.find(u => u.studentId === studentId && u.password === password);
  if (!user) return res.status(401).json({ ok:false, msg: 'Invalid credentials' });
  const { password: pw, ...publicUser } = user;
  res.json({ ok: true, user: publicUser });
});

// Get current user by id (demo)
// GET /api/users/:studentId
app.get('/api/users/:studentId', async (req, res) => {
  await db.read();
  const u = db.data.users.find(x => x.studentId === req.params.studentId);
  if (!u) return res.status(404).json({ ok:false, msg: 'Not found' });
  const { password, ...pub } = u;
  res.json({ ok:true, user: pub });
});

// ---------- Listings endpoints ----------

// GET /api/listings?cat=&search=&price=
app.get('/api/listings', async (req, res) => {
  await db.read();
  let items = db.data.listings || [];
  const { cat, search, price } = req.query;

  if (cat) items = items.filter(i => i.category === cat);
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(i => (i.title + ' ' + i.desc).toLowerCase().includes(q));
  }
  if (price) {
    if (price === '0-50') items = items.filter(i => i.price <= 50);
    if (price === '50-200') items = items.filter(i => i.price > 50 && i.price <= 200);
    if (price === '200+') items = items.filter(i => i.price > 200);
  }

  res.json({ ok:true, listings: items });
});

// GET single listing
app.get('/api/listings/:id', async (req, res) => {
  await db.read();
  const item = db.data.listings.find(l => String(l.id) === String(req.params.id));
  if (!item) return res.status(404).json({ ok:false, msg: 'Not found' });
  res.json({ ok:true, listing: item });
});

// POST create listing with file uploads
// fields: title, desc, price, category, studentId (seller)
// use multipart/form-data with key 'media' for files (multiple)
app.post('/api/listings', upload.array('media', 6), async (req, res) => {
  await db.read();
  const { title, desc, price = 0, category = 'misc', studentId } = req.body;
  if (!title || !studentId) return res.status(400).json({ ok:false, msg:'Missing title or studentId' });

  const mediaFiles = (req.files || []).map(f => `/uploads/${f.filename}`);
  const item = {
    id: Date.now(),
    title,
    desc,
    price: Number(price) || 0,
    category,
    studentId,
    media: mediaFiles,
    createdAt: new Date().toISOString()
  };
  db.data.listings.unshift(item);
  await db.write();
  res.json({ ok:true, listing: item });
});

// PUT update listing (basic)
app.put('/api/listings/:id', upload.array('media', 6), async (req, res) => {
  await db.read();
  const id = Number(req.params.id);
  const idx = db.data.listings.findIndex(l => Number(l.id) === id);
  if (idx === -1) return res.status(404).json({ ok:false, msg:'Not found' });

  const { title, desc, price, category } = req.body;
  if (title) db.data.listings[idx].title = title;
  if (desc) db.data.listings[idx].desc = desc;
  if (price) db.data.listings[idx].price = Number(price);
  if (category) db.data.listings[idx].category = category;
  if (req.files && req.files.length) {
    db.data.listings[idx].media = (req.files || []).map(f => `/uploads/${f.filename}`);
  }
  await db.write();
  res.json({ ok:true, listing: db.data.listings[idx] });
});

// DELETE listing
app.delete('/api/listings/:id', async (req, res) => {
  await db.read();
  const id = Number(req.params.id);
  db.data.listings = db.data.listings.filter(l => Number(l.id) !== id);
  await db.write();
  res.json({ ok:true });
});

// Health
app.get('/api/ping', (req, res) => res.json({ ok:true, time: new Date().toISOString() }));

// Start server
app.listen(PORT, () => {
  console.log(`Sociaty backend running: http://localhost:${PORT}`);
});
