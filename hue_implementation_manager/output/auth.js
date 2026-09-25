// Real authentication, replacing the client portal's "Preview as" role switcher (which is
// purely cosmetic in the frontend and enforces nothing on its own). Everything here runs
// server-side, since the frontend can never be trusted to enforce access on its own.
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const pool = require('./db');

// Limits repeated login attempts from one IP -- 10 tries per 15 minutes is generous for a real
// user who mistypes a password, but slow enough to make brute-forcing a password impractical.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

function sessionMiddleware() {
  return session({
    store: new PgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  });
}

// 401 if nobody is signed in.
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not signed in' });
  next();
}

// 401/403 if the signed-in user isn't a manager.
function requireManager(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not signed in' });
  if (req.session.user.role !== 'manager') return res.status(403).json({ error: 'Manager access required' });
  next();
}

// A manager can access any client; a client-role user can only access their own.
function canAccessClient(req, clientId) {
  const user = req.session.user;
  if (!user) return false;
  if (user.role === 'manager') return true;
  return user.clientId === clientId;
}

function registerAuthRoutes(app) {
  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    // Email is case-insensitive (matches how virtually every real login system behaves -- a typo
    // in capitalization shouldn't lock someone out); the password comparison below stays
    // case-sensitive via bcrypt, unaffected by this.
    const result = await pool.query(
      'select id, email, password_hash, role, client_id, display_name from users where lower(email) = lower($1)',
      [email]
    );
    const row = result.rows[0];
    // Compare against a dummy hash even when no user matches, so a nonexistent email doesn't
    // return faster than a wrong password (a timing side-channel that reveals valid emails).
    const hash = row ? row.password_hash : '$2b$10$6KaDfhzVBOuAAS8j6qcZ.eE3F1qAhFMIF.cxzojcHvbafiXfkkXP6';
    const passwordOk = await bcrypt.compare(password, hash);
    if (!row || !passwordOk) return res.status(401).json({ error: 'Invalid email or password' });

    req.session.user = {
      id: row.id,
      email: row.email,
      role: row.role,
      clientId: row.client_id,
      displayName: row.display_name,
    };
    res.json(req.session.user);
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get('/api/auth/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not signed in' });
    res.json(req.session.user);
  });
}

module.exports = { sessionMiddleware, requireAuth, requireManager, canAccessClient, registerAuthRoutes };
