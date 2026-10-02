const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'asteria-bank.db');

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function openDatabase() {
  ensureDataDir();
  return new DatabaseSync(dbPath);
}

function initializeDatabase() {
  ensureDataDir();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const db = openDatabase();

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'customer'
    );

    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      balance INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE campaign_claims (
      user_id INTEGER PRIMARY KEY,
      claimed_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_account_id INTEGER NOT NULL,
      to_account_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const insertUser = db.prepare('INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)');
  insertUser.run(1, '山田 太郎', 'taro.yamada@example.local', 'customer');
  insertUser.run(2, '佐藤 花子', 'hanako.sato@example.local', 'customer');

  const insertAccount = db.prepare('INSERT INTO accounts (id, user_id, label, balance) VALUES (?, ?, ?, ?)');
  insertAccount.run(1001, 1, '普通預金', 1250000);
  insertAccount.run(1002, 1, '貯蓄預金', 420000);
  insertAccount.run(2001, 2, '普通預金', 3840000);
  insertAccount.run(2002, 2, '積立預金', 780000);

  db.close();
}

module.exports = { openDatabase, initializeDatabase, dbPath };
