const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { openDatabase, dbPath, initializeDatabase } = require('./db');

const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(dbPath)) initializeDatabase();
const db = openDatabase();
db.exec('PRAGMA foreign_keys = ON;');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('=');
    return i === -1 ? [v, ''] : [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
  }));
}

function currentUser(req) {
  const cookies = parseCookies(req);
  const id = Number(cookies.asteria_user || 1);
  return db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(id) ||
    db.prepare('SELECT id, name, email, role FROM users WHERE id = 1').get();
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  return JSON.parse(body);
}

function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.normalize(path.join(publicDir, requested));
  if (!resolved.startsWith(publicDir) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    return false;
  }
  const ext = path.extname(resolved);
  res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(resolved).pipe(res);
  return true;
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/session') {
    return sendJson(res, 200, { user: currentUser(req) });
  }

  if (req.method === 'GET' && pathname === '/api/users') {
    const users = db.prepare('SELECT id, name FROM users ORDER BY id').all();
    return sendJson(res, 200, { users });
  }

  if (req.method === 'POST' && pathname === '/api/session') {
    const body = await readJson(req);
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(Number(body.userId));
    if (!user) return sendJson(res, 404, { message: '利用者が見つかりません。' });
    return sendJson(res, 200, { user }, {
      'Set-Cookie': `asteria_user=${user.id}; Path=/; HttpOnly; SameSite=Lax`
    });
  }

  if (req.method === 'GET' && pathname === '/api/accounts') {
    const user = currentUser(req);
    const accounts = db.prepare(`
      SELECT a.id, a.label, a.balance, u.name AS ownerName
      FROM accounts a
      JOIN users u ON u.id = a.user_id
      WHERE a.user_id = ?
      ORDER BY a.id
    `).all(user.id);
    return sendJson(res, 200, { accounts });
  }

  const accountMatch = pathname.match(/^\/api\/accounts\/(\d+)$/);
  if (req.method === 'GET' && accountMatch) {
    const user = currentUser(req);
    const account = db.prepare(`
      SELECT a.id, a.label, a.balance, u.name AS ownerName
      FROM accounts a
      JOIN users u ON u.id = a.user_id
      WHERE a.id = ? AND a.user_id = ?
    `).get(Number(accountMatch[1]), user.id);
    if (!account) return sendJson(res, 404, { message: '口座が見つかりません。' });
    return sendJson(res, 200, { account });
  }

  if (req.method === 'POST' && pathname === '/api/transfers') {
    const user = currentUser(req);
    const body = await readJson(req);
    const fromAccountId = Number(body.fromAccountId);
    const toAccountId = Number(body.toAccountId);
    const amount = Number(body.amount);

    if (!Number.isInteger(amount) || amount <= 0) {
      return sendJson(res, 400, { message: '振込金額は1円以上の整数で入力してください。' });
    }

    const from = db.prepare('SELECT id, balance FROM accounts WHERE id = ? AND user_id = ?').get(fromAccountId, user.id);
    const to = db.prepare('SELECT id, balance FROM accounts WHERE id = ?').get(toAccountId);
    if (!from || !to) return sendJson(res, 404, { message: '口座が見つかりません。' });
    if (from.balance < amount) return sendJson(res, 409, { message: '残高が不足しています。' });

    try {
      db.exec('BEGIN IMMEDIATE');
      db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(amount, fromAccountId);
      db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(amount, toAccountId);
      db.prepare('INSERT INTO transfers (from_account_id, to_account_id, amount, created_at) VALUES (?, ?, ?, ?)')
        .run(fromAccountId, toAccountId, amount, new Date().toISOString());
      db.exec('COMMIT');
      return sendJson(res, 200, { message: '振込を受け付けました。' });
    } catch (error) {
      db.exec('ROLLBACK');
      return sendJson(res, 500, { message: '振込を完了できませんでした。' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/campaign/claim') {
    const user = currentUser(req);
    const result = db.prepare('INSERT OR IGNORE INTO campaign_claims (user_id, claimed_at) VALUES (?, ?)')
      .run(user.id, new Date().toISOString());
    if (result.changes === 0) return sendJson(res, 409, { message: '特典は受け取り済みです。' });
    const primary = db.prepare('SELECT id FROM accounts WHERE user_id = ? ORDER BY id LIMIT 1').get(user.id);
    db.prepare('UPDATE accounts SET balance = balance + 5000 WHERE id = ?').run(primary.id);
    return sendJson(res, 200, { message: '特典5,000円を受け取りました。' });
  }

  if (req.method === 'GET' && pathname === '/api/profile') {
    return sendJson(res, 200, { profile: currentUser(req) });
  }

  if (req.method === 'PATCH' && pathname === '/api/profile') {
    const user = currentUser(req);
    const body = await readJson(req);
    const name = typeof body.name === 'string' ? body.name.trim() : user.name;
    const email = typeof body.email === 'string' ? body.email.trim() : user.email;
    const role = typeof body.role === 'string' ? body.role.trim() : user.role;
    if (!name || !email) return sendJson(res, 400, { message: '表示名とメールアドレスを入力してください。' });
    db.prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?').run(name, email, role, user.id);
    const updated = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(user.id);
    return sendJson(res, 200, { profile: updated, message: 'プロフィールを更新しました。' });
  }

  return sendJson(res, 404, { message: '指定された機能が見つかりません。' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url.pathname);
    }
    if (!serveStatic(req, res, url.pathname)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    }
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { message: '処理中にエラーが発生しました。' });
  }
});

server.listen(PORT, () => {
  console.log(`Asteria Bank: http://localhost:${PORT}`);
});
