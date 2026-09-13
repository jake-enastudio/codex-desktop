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
export function sampleData(): Data {
  const accounts: Account[] = [
    {
      id: "s1",
      name: "Everyday account",
      institution: "Personal banking",
      category: "cash",
      currency: "USD",
    },
    {
      id: "s2",
      name: "Long-term portfolio",
      institution: "Brokerage",
      category: "investments",
      currency: "USD",
    },
    {
      id: "s3",
      name: "Home",
      institution: "Property valuation",
      category: "property",
      currency: "USD",
    },
    {
      id: "s4",
      name: "Bitcoin & Ethereum",
      institution: "Personal wallet",
      category: "crypto",
      currency: "USD",
    },
    {
      id: "s5",
      name: "Home loan",
      institution: "Mortgage",
      category: "debt",
      currency: "USD",
    },
  ];
  const entries: Entry[] = [];
  const ends = [48250, 186480, 425000, 24860, 168400];
  for (let m = 0; m < 12; m++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 11 + m);
    const date =
      m === 11
        ? today()
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    accounts.forEach((a, i) => {
      const factor =
        i === 4
          ? 1 + (11 - m) * 0.007
          : i === 2
            ? 0.92 + (m * 0.08) / 11
            : 0.7 + (m * 0.3) / 11 + Math.sin(m * 1.8 + i) * 0.02;
      entries.push({
        id: `e${m}-${i}`,
        accountId: a.id,
        date,
        amountMinor: Math.round((m === 11 ? ends[i] : ends[i] * factor) * 100),
        rate: 1,
      });
    });
  }
  return { version: 1, baseCurrency: "USD", accounts, entries };
}
