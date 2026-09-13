import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

export const currencies = [
  "USD",
  "AED",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "CHF",
  "SGD",
];
export const categories = [
  "cash",
  "investments",
  "property",
  "crypto",
  "other",
  "debt",
];
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function assert(ok, message) {
  if (!ok) throw new Error(message);
}
function label(v, name) {
  assert(
    typeof v === "string" && v.trim().length > 0 && v.trim().length <= 100,
    `${name} must be 1–100 characters.`,
  );
  return v.trim();
}
function validDate(v) {
  assert(
    typeof v === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      v >= "1900-01-01" &&
      v <= today() &&
      new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v,
    "Choose a valid date, no later than today.",
  );
}
function validateEntry(e, sameCurrency) {
  validDate(e.date);
  assert(
    Number.isSafeInteger(e.amountMinor) &&
      e.amountMinor >= 0 &&
      e.amountMinor <= 1e14,
    "Balance must be a non-negative amount with at most two decimal places.",
  );
  assert(
    typeof e.rate === "number" &&
      Number.isFinite(e.rate) &&
      e.rate > 0 &&
      e.rate <= 1e6 &&
      e.amountMinor * e.rate <= Number.MAX_SAFE_INTEGER / 100,
    "Enter a valid conversion rate.",
  );
  assert(
    !sameCurrency || e.rate === 1,
    "The reporting currency must use a conversion rate of 1.",
  );
}
export function validateBackup(data) {
  assert(
    data?.version === 1 &&
      currencies.includes(data.baseCurrency) &&
      Array.isArray(data.accounts) &&
      Array.isArray(data.entries),
    "This is not a supported Worth backup.",
  );
  assert(
    data.accounts.length <= 10000 && data.entries.length <= 100000,
    "This backup is too large.",
  );
  const ids = new Map();
  const dates = new Set();
  const entryIds = new Set();
  for (const a of data.accounts) {
    label(a.id, "Account ID");
    assert(!ids.has(a.id), "Duplicate account ID.");
    label(a.name, "Account name");
    assert(
      typeof a.institution === "string" && a.institution.length <= 100,
      "Invalid institution.",
    );
    assert(
      categories.includes(a.category) && currencies.includes(a.currency),
      "Invalid account category or currency.",
    );
    ids.set(a.id, a);
  }
  for (const e of data.entries) {
    label(e.id, "Entry ID");
    assert(!entryIds.has(e.id), "Duplicate entry ID.");
    entryIds.add(e.id);
    assert(ids.has(e.accountId), "A balance refers to a missing account.");
    validateEntry(e, ids.get(e.accountId).currency === data.baseCurrency);
    const key = e.accountId + ":" + e.date;
    assert(!dates.has(key), "Duplicate balance date for an account.");
    dates.add(key);
  }
  assert(
    data.accounts.every((a) => data.entries.some((e) => e.accountId === a.id)),
    "Every account must have a balance.",
  );
  return data;
}
export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT OR IGNORE INTO settings VALUES ('baseCurrency','USD'); CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, institution TEXT NOT NULL, category TEXT NOT NULL, currency TEXT NOT NULL); CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, accountId TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, date TEXT NOT NULL, amountMinor INTEGER NOT NULL, rate REAL NOT NULL, UNIQUE(accountId,date));`,
    );
  }
  read() {
    return {
      version: 1,
      baseCurrency: this.db
        .prepare("SELECT value FROM settings WHERE key='baseCurrency'")
        .get().value,
      accounts: this.db.prepare("SELECT * FROM accounts ORDER BY rowid").all(),
      entries: this.db
        .prepare("SELECT * FROM entries ORDER BY date, rowid")
        .all(),
    };
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  currency(value) {
    assert(currencies.includes(value), "Unsupported currency.");
    assert(
      this.read().accounts.length === 0,
      "Reporting currency can only be changed before adding accounts.",
    );
    this.db
      .prepare("UPDATE settings SET value=? WHERE key='baseCurrency'")
      .run(value);
    return this.read();
  }
  save(input) {
    const data = this.read();
    const existing = input.id
      ? data.accounts.find((a) => a.id === input.id)
      : null;
    assert(!input.id || existing, "Account no longer exists.");
    const a = {
      id: existing?.id || randomUUID(),
      name: label(input.name, "Account name"),
      institution:
        typeof input.institution === "string" ? input.institution.trim() : "",
      category: input.category,
      currency: input.currency,
    };
    assert(
      a.institution.length <= 100 &&
        categories.includes(a.category) &&
        currencies.includes(a.currency),
      "Invalid account details.",
    );
    assert(
      !existing || a.currency === existing.currency,
      "Account currency cannot be changed after creation.",
    );
    const e = {
      id: randomUUID(),
      accountId: a.id,
      date: input.date,
      amountMinor: input.amountMinor,
      rate: input.rate,
    };
    validateEntry(e, a.currency === data.baseCurrency);
    this.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO accounts VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,institution=excluded.institution,category=excluded.category",
        )
        .run(a.id, a.name, a.institution, a.category, a.currency);
      this.db
        .prepare(
          "INSERT INTO entries VALUES (?,?,?,?,?) ON CONFLICT(accountId,date) DO UPDATE SET amountMinor=excluded.amountMinor,rate=excluded.rate",
        )
        .run(e.id, e.accountId, e.date, e.amountMinor, e.rate);
    });
    return this.read();
  }
  remove(id) {
    assert(typeof id === "string", "Invalid account ID.");
    this.db.prepare("DELETE FROM accounts WHERE id=?").run(id);
    return this.read();
  }
  restore(input) {
    const data = validateBackup(input);
    this.transaction(() => {
      this.db.exec("DELETE FROM entries; DELETE FROM accounts;");
      this.db
        .prepare("UPDATE settings SET value=? WHERE key='baseCurrency'")
        .run(data.baseCurrency);
      for (const a of data.accounts)
        this.db
          .prepare("INSERT INTO accounts VALUES (?,?,?,?,?)")
          .run(a.id, a.name.trim(), a.institution, a.category, a.currency);
      for (const e of data.entries)
        this.db
          .prepare("INSERT INTO entries VALUES (?,?,?,?,?)")
          .run(e.id, e.accountId, e.date, e.amountMinor, e.rate);
    });
    return this.read();
  }
  close() {
    this.db.close();
  }
}
