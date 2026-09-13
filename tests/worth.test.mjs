import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, validateBackup } from "../src/main/worthStore.mjs";
import { totals, latest } from "../src/renderer/worthModel.ts";
const input = {
  name: "Savings",
  institution: "Bank",
  category: "cash",
  currency: "USD",
  date: "2025-01-01",
  amountMinor: 100000,
  rate: 1,
};
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "worth-test-"));
  const path = join(dir, "worth.sqlite");
  const store = new Store(path);
  t.after(() => {
    try {
      store.close();
    } catch {}
    rmSync(dir, { recursive: true, force: true });
  });
  return { store, path };
}

test("balances persist across database reopen and same-day updates replace rather than duplicate", (t) => {
  const { store, path } = fixture(t);
  let data = store.save(input);
  const id = data.accounts[0].id;
  data = store.save({ ...input, id, amountMinor: 120000 });
  assert.equal(data.entries.length, 1);
  store.close();
  const reopened = new Store(path);
  assert.equal(reopened.read().entries[0].amountMinor, 120000);
  reopened.close();
});
test("history carries balances forward and liabilities are subtracted", (t) => {
  const { store } = fixture(t);
  let data = store.save(input);
  const id = data.accounts[0].id;
  store.save({ ...input, id, date: "2025-03-01", amountMinor: 130000 });
  data = store.save({
    ...input,
    name: "Loan",
    category: "debt",
    amountMinor: 20000,
    date: "2025-02-01",
  });
  assert.equal(totals(data, "2024-12-31").net, 0);
  assert.equal(totals(data, "2025-01-15").net, 1000);
  assert.equal(totals(data, "2025-02-15").net, 800);
  assert.equal(totals(data, "2025-03-15").net, 1100);
  assert.equal(latest(data, id, "2025-02-15").amountMinor, 100000);
});
test("each foreign-currency balance retains its own conversion rate", (t) => {
  const { store } = fixture(t);
  let data = store.save({ ...input, currency: "EUR", rate: 1.1 });
  const id = data.accounts[0].id;
  data = store.save({
    ...input,
    id,
    currency: "EUR",
    rate: 1.2,
    date: "2025-02-01",
  });
  assert.equal(totals(data, "2025-01-10").net, 1100);
  assert.equal(totals(data, "2025-02-10").net, 1200);
  assert.throws(() => store.currency("AED"));
  assert.throws(() => store.save({ ...input, id, currency: "GBP" }));
});
test("malformed balances and invalid dates cannot write data", (t) => {
  const { store } = fixture(t);
  for (const changes of [
    { amountMinor: -1 },
    { amountMinor: 1.5 },
    { amountMinor: NaN },
    { amountMinor: Infinity },
    { rate: 0 },
    { rate: 2 },
    { date: "2025-02-30" },
    { date: "2099-01-01" },
    { name: "   " },
    { category: "unknown" },
  ])
    assert.throws(() => store.save({ ...input, ...changes }));
  assert.equal(store.read().accounts.length, 0);
});
test("backup roundtrip preserves records; invalid backups leave the current workspace intact", (t) => {
  const { store } = fixture(t);
  const original = store.save(input);
  store.restore(original);
  assert.deepEqual(store.read(), original);
  const broken = structuredClone(original);
  broken.entries.push({ ...broken.entries[0], id: "extra" });
  assert.throws(() => store.restore(broken));
  assert.deepEqual(store.read(), original);
  assert.throws(() => validateBackup({ ...original, entries: [] }));
  assert.throws(() => validateBackup({ ...original, accounts: [] }));
});
test("deleting an account cascades to its history without changing other accounts", (t) => {
  const { store } = fixture(t);
  let data = store.save(input);
  const id = data.accounts[0].id;
  data = store.save({ ...input, name: "Second account" });
  data = store.remove(id);
  assert.equal(data.accounts.length, 1);
  assert.equal(data.entries.length, 1);
  assert.equal(data.accounts[0].name, "Second account");
});

test("CSV import handles quoted names, merges dated updates, and rejects partial or ambiguous imports", async (t) => {
  const { mergeCsv, header } = await import("../src/main/worthCsv.mjs");
  const { store } = fixture(t);
  const current = store.save({ ...input, name: "Cash, savings" });
  const csv =
    header +
    '\r\n"Cash, savings",Bank,cash,USD,2025-01-01,1250.50,1,USD\r\n"Cash, savings",Bank,cash,USD,2025-02-01,1500,1,USD';
  const merged = mergeCsv(csv, current);
  assert.equal(merged.created, 0);
  assert.equal(merged.replaced, 1);
  store.restore(merged.data);
  assert.equal(store.read().entries.length, 2);
  assert.equal(totals(store.read(), "2025-02-01").net, 1500);
  assert.throws(() => mergeCsv(csv.replace("1250.50", "-100"), current));
  assert.throws(() =>
    mergeCsv(csv.replace("2025-02-01", "2025-01-01"), current),
  );
  assert.throws(() => mergeCsv(csv.replace(",1,USD", ",1,AED"), current));
  assert.deepEqual(current.entries[0].amountMinor, 100000);
});
