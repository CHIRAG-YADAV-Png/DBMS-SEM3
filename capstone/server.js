require('dotenv').config();
const express = require('express');
const { Pool, types } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

// PostgreSQL returns NUMERIC and DATE as text by default; convert them for the frontend
types.setTypeParser(1700, v => parseFloat(v));  // NUMERIC -> number
types.setTypeParser(1082, v => v);              // DATE -> 'YYYY-MM-DD'

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1) Database connection (one DATABASE_URL variable)
const url = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/keytag';
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const pool = new Pool({
  connectionString: url.split('?')[0],              // ssl is set below instead
  ssl: local ? false : { rejectUnauthorized: false }, // cloud databases need SSL
  max: 3                                            // every Vercel function instance has its own pool
});
const q = (text, params) => pool.query(text, params).then(r => r.rows);

// 2) Signed login tokens (work on Vercel, where memory is not shared between requests)
const SECRET = process.env.TOKEN_SECRET;
if (!SECRET) throw new Error('Set TOKEN_SECRET in .env (locally) or in Vercel Environment Variables.');
const sign = name => {
  const p = Buffer.from(JSON.stringify({ n: name, e: Date.now() + 8 * 3600e3 })).toString('base64url');
  return p + '.' + crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
};
const verify = t => {
  const [p, s] = (t || '').split('.');
  if (!p || !s) return false;
  const good = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return false;
  return JSON.parse(Buffer.from(p, 'base64url')).e > Date.now();
};

const wrap = fn => (req, res) => fn(req, res).catch(err => {
  console.error(err.message);
  let msg = err.message;
  if (err.code === '23505') msg = 'That plate number or licence number already exists.';
  if (err.code === '23514') msg = 'Please check the values (dates must be in order, amounts above zero).';
  res.status(400).json({ error: msg });
});

app.use('/api', (req, res, next) => {
  if (req.path === '/login') return next();
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  verify(t) ? next() : res.status(401).json({ error: 'Please sign in again.' });
});

app.post('/api/login', wrap(async (req, res) => {
  const [u] = await q('SELECT * FROM staff WHERE username = $1', [req.body.username || '']);
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password_hash)))
    return res.status(401).json({ error: 'Wrong username or password.' });
  res.json({ token: sign(u.username), name: u.username });
}));

// 3) Read everything the screens need (aliases match the names used in script.js)
app.get('/api/data', wrap(async (req, res) => {
  const vehicles = await q('SELECT vehicle_id AS id, plate_no AS plate, name, type, seats, rate_per_day AS rate, status FROM vehicle ORDER BY vehicle_id');
  const customers = await q('SELECT customer_id AS id, name, phone, license_no AS license FROM customer ORDER BY customer_id');
  const rentals = await q(
    'SELECT r.rental_id AS id, r.vehicle_id AS vid, r.customer_id AS cid, r.start_date AS "from", r.end_date AS "to", ' +
    'r.total_amount AS total, r.late_fee AS fee, r.status, ' +
    'COALESCE(SUM(p.amount),0) >= r.total_amount + r.late_fee AS paid, MAX(p.method) AS method ' +
    'FROM rental r LEFT JOIN payment p ON p.rental_id = r.rental_id GROUP BY r.rental_id ORDER BY r.rental_id');
  res.json({ vehicles, customers, rentals });
}));

// 4) Write operations
app.post('/api/vehicles', wrap(async (req, res) => {
  const { plate, name, type, rate } = req.body;
  await q('INSERT INTO vehicle (plate_no, name, type, rate_per_day) VALUES ($1,$2,$3,$4)',
    [String(plate).toUpperCase(), name, type, rate]);
  res.status(201).json({ ok: true });
}));

app.patch('/api/vehicles/:id/status', wrap(async (req, res) => {
  if (!['Available', 'Maintenance'].includes(req.body.status)) throw new Error('Invalid status.');
  const r = await pool.query("UPDATE vehicle SET status = $1 WHERE vehicle_id = $2 AND status <> 'Rented'",
    [req.body.status, req.params.id]);
  if (!r.rowCount) throw new Error('A rented vehicle cannot be changed.');
  res.json({ ok: true });
}));

app.post('/api/customers', wrap(async (req, res) => {
  const { name, phone, license } = req.body;
  await q('INSERT INTO customer (name, phone, license_no) VALUES ($1,$2,$3)', [name, phone, license]);
  res.status(201).json({ ok: true });
}));

app.post('/api/rentals', wrap(async (req, res) => {
  const { vehicle_id, customer_id, start, end } = req.body;
  // the trigger checks availability, calculates the total and marks the vehicle as Rented
  await q('INSERT INTO rental (vehicle_id, customer_id, start_date, end_date) VALUES ($1,$2,$3,$4)',
    [vehicle_id, customer_id, start, end]);
  res.status(201).json({ ok: true });
}));

app.post('/api/rentals/:id/return', wrap(async (req, res) => {
  await pool.query('CALL return_vehicle($1::int)', [req.params.id]);
  res.json({ ok: true });
}));

app.post('/api/rentals/:id/payment', wrap(async (req, res) => {
  const [r] = await q(
    'SELECT r.total_amount + r.late_fee - COALESCE((SELECT SUM(amount) FROM payment WHERE rental_id = r.rental_id),0) AS due ' +
    'FROM rental r WHERE r.rental_id = $1', [req.params.id]);
  if (!r || r.due <= 0) throw new Error('Nothing is due on this rental.');
  await q('INSERT INTO payment (rental_id, amount, method) VALUES ($1,$2,$3)', [req.params.id, r.due, req.body.method]);
  res.json({ ok: true });
}));

// 5) Create the default admin the first time the server starts
(async () => {
  const [c] = await q('SELECT COUNT(*)::int AS n FROM staff');
  if (!c.n) {
    await q('INSERT INTO staff (username, password_hash) VALUES ($1,$2)', ['admin', await bcrypt.hash('admin123', 10)]);
    console.log('Created default staff login: admin / admin123');
  }
})().catch(e => console.error('Could not reach the database:', e.message));

module.exports = app; // Vercel uses this export
if (require.main === module) // local run: npm start
  app.listen(process.env.PORT || 3000, () =>
    console.log('KeyTag running at http://localhost:' + (process.env.PORT || 3000)));
