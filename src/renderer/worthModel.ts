export type Account = {
  id: string;
  name: string;
  institution: string;
  category: string;
  currency: string;
};
export type Entry = {
  id: string;
  accountId: string;
  date: string;
  amountMinor: number;
  rate: number;
};
export type Data = {
  version: 1;
  baseCurrency: string;
  accounts: Account[];
  entries: Entry[];
};
export type Input = Omit<Account, "id"> & {
  id?: string;
  date: string;
  amountMinor: number;
  rate: number;
};
declare global {
  interface Window {
    worth?: {
      read(): Promise<Data>;
      save(input: Input): Promise<Data>;
      remove(id: string): Promise<Data>;
      currency(value: string): Promise<Data>;
      export(format: "json" | "csv" | "template"): Promise<boolean>;
      importCsv(): Promise<Data | null>;
      restore(): Promise<Data | null>;
      location(): Promise<void>;
    };
  }
}
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
export const groups: Record<
  string,
  { name: string; color: string; label: string }
> = {
  cash: { name: "Cash", color: "#8c9d88", label: "Cash & savings" },
  investments: { name: "Investments", color: "#717f9c", label: "Investments" },
  property: { name: "Property", color: "#ba9c76", label: "Property" },
  crypto: { name: "Crypto", color: "#a295b3", label: "Crypto" },
  other: { name: "Other assets", color: "#8ea5a8", label: "Other assets" },
  debt: { name: "Liabilities", color: "#bf8980", label: "Loans & debt" },
};
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function latest(data: Data, id: string, date = today()) {
  return data.entries
    .filter((e) => e.accountId === id && e.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}
export function value(e?: Entry) {
  return e ? Math.round(e.amountMinor * e.rate) / 100 : 0;
}
export function totals(data: Data, date = today()) {
  let assets = 0,
    debt = 0;
  data.accounts.forEach((a) => {
    const v = value(latest(data, a.id, date));
    if (a.category === "debt") debt += v;
    else assets += v;
  });
  return { assets, debt, net: Math.round((assets - debt) * 100) / 100 };
}
export function dateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", options);
}
