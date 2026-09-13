import { randomUUID } from "node:crypto";
import { validateBackup } from "./worthStore.mjs";
export const header =
  "Account,Institution,Category,Currency,Date,Balance,Conversion rate,Reporting currency";
export function parseCsv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell.length || closed) throw new Error("Invalid quote in CSV.");
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
    } else {
      if (closed)
        throw new Error("Unexpected content after a quoted CSV cell.");
      cell += c;
    }
  }
  if (quoted) throw new Error("Unclosed quote in CSV.");
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((v) => v.trim())) rows.push(row);
  }
  return rows;
}
export function mergeCsv(text, current) {
  const rows = parseCsv(text);
  if (
    rows.length < 2 ||
    rows[0].map((s) => s.trim().toLowerCase()).join(",") !==
      header.toLowerCase()
  )
    throw new Error(
      "Use the Worth CSV template with all eight columns in their original order.",
    );
  if (rows.length > 100001) throw new Error("CSV contains too many rows.");
  const data = structuredClone(current);
  const seen = new Set();
  let created = 0,
    replaced = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].map((s) => s.trim());
    if (row.length !== 8)
      throw new Error(`Row ${i + 1}: expected eight columns.`);
    let [name, institution, category, currency, date, amount, rate, base] = row;
    name = name.replace(/^'(?=[=+@\-\t\r])/, "");
    institution = institution.replace(/^'(?=[=+@\-\t\r])/, "");
    if (base !== data.baseCurrency)
      throw new Error(
        `Row ${i + 1}: reporting currency must be ${data.baseCurrency}.`,
      );
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || !/^\d+(\.\d+)?$/.test(rate))
      throw new Error(
        `Row ${i + 1}: use plain positive numbers without currency symbols or thousands separators.`,
      );
    const matches = data.accounts.filter(
      (a) =>
        a.name === name &&
        a.institution === institution &&
        a.currency === currency,
    );
    if (matches.length > 1)
      throw new Error(
        `Row ${i + 1}: multiple matching accounts. Give these accounts distinct names before importing.`,
      );
    let account = matches[0];
    if (account && account.category !== category)
      throw new Error(
        `Row ${i + 1}: account type does not match the existing account.`,
      );
    if (!account) {
      account = { id: randomUUID(), name, institution, category, currency };
      data.accounts.push(account);
      created++;
    }
    const key = account.id + ":" + date;
    if (seen.has(key))
      throw new Error(
        `Row ${i + 1}: duplicate date for this account in the CSV.`,
      );
    seen.add(key);
    const existing = data.entries.find(
      (e) => e.accountId === account.id && e.date === date,
    );
    if (existing) {
      existing.amountMinor = Math.round(Number(amount) * 100);
      existing.rate = Number(rate);
      replaced++;
    } else
      data.entries.push({
        id: randomUUID(),
        accountId: account.id,
        date,
        amountMinor: Math.round(Number(amount) * 100),
        rate: Number(rate),
      });
  }
  validateBackup(data);
  return { data, created, replaced, rows: rows.length - 1 };
}
