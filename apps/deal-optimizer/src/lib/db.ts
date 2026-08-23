import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "deal-optimizer.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  _db = db;
  return db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  -- per-transaction rules, all optional
  min_transaction_amount REAL,      -- e.g. Costco requires nothing, but some rebates need a $X min
  member_fee_amortized REAL DEFAULT 0 -- optional per-trip cost allocation for club stores
);

CREATE TABLE IF NOT EXISTS store_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL, -- lowercased/trimmed for matching across stores
  price REAL NOT NULL,
  unit TEXT,                      -- e.g. "each", "lb", "12ct"
  sale_price REAL,                -- optional ad/sale price, if different from price
  valid_from TEXT,
  valid_to TEXT,
  source TEXT DEFAULT 'manual',   -- 'manual' | 'csv'
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,          -- 'fetch' | 'ibotta' | 'krazycouponlady' | 'store' | 'other'
  title TEXT NOT NULL,
  normalized_item TEXT,            -- what item this applies to (nullable = store-wide/receipt-wide)
  store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL, -- null = any store
  discount_type TEXT NOT NULL,     -- 'percent_off' | 'amount_off' | 'cashback_flat' | 'cashback_percent'
  discount_value REAL NOT NULL,
  min_spend REAL DEFAULT 0,        -- minimum transaction/receipt total required to trigger
  max_uses INTEGER DEFAULT 1,      -- how many times this offer can be applied (e.g. across separate transactions)
  requires_separate_transaction INTEGER DEFAULT 0, -- 1 if this offer needs its own checkout to trigger (e.g. per-receipt cashback caps)
  valid_from TEXT,
  valid_to TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_prices_norm ON store_prices(normalized_name);
CREATE INDEX IF NOT EXISTS idx_offers_norm ON offers(normalized_item);
`;

export function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
