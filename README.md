# Worth

A personal net worth tracker for macOS, built as a fork of [Codex Desktop by MangoWork / dfones288](https://github.com/dfones288/codex-desktop).

Worth keeps the upstream Electron window configuration, React/Vite project structure, dark sidebar, project/thread navigation styles, and packaging tools. Accounts replace the project/thread list. The active application has no chat, Codex CLI, model selection, skills, or Git operations. The original coding modules remain in the repository for upstream comparison, but the Worth entry point does not register or invoke them.

The presentation follows the supplied official Codex screenshot: a centered 768px content column, neutral dark sidebar, regular-weight navigation, and grouped cards. These are explicit Worth overrides in `src/renderer/worth.css`; the upstream stylesheet remains available unchanged.

## What works

- Overview with assets, liabilities, net worth, allocation, and dated history.
- Cash, investments, property, crypto, other assets, and debt accounts.
- Add, update, backdate, and delete accounts. Updating an existing date replaces that day's balance.
- Eight account currencies; manual conversion rates are stored with each dated balance.
- Search and asset/liability filters, light/dark appearance, and a balance-visibility control beside the overview total.
- Local SQLite persistence, complete JSON backups/restores, and CSV import.

## Run and package

Requires Node.js 24+ and npm. No Codex CLI, bank connection, or API key is required.

```sh
npm install
npm run dev
npm run build
npm start
npm run package:local
```

The local Apple Silicon app is written to `release/mac-arm64/Worth.app`. This is a local development build, not a Developer ID signed or notarized distribution. The inherited cross-platform packaging scripts remain available; this version is tested on macOS Apple Silicon.

## Local data

Worth stores `worth.sqlite` in the app's macOS Application Support directory. Settings → Show in Finder opens the actual location. Development and packaged builds use the Worth application name; test runs use isolated `WORTH_DATA_DIR` folders.

The database and exported backups are not encrypted by Worth. No application data is uploaded or synced. Use Settings → Save backup for a portable copy. Before a CSV import or JSON restore, Worth automatically writes a recovery JSON file beside its database. Restore requires confirmation after validating the entire file.

Choose your reporting currency in Settings before adding accounts. It is fixed once accounts exist, so historical conversion amounts cannot silently change denomination. Each foreign-currency balance records its manual rate in reporting-currency units per one account-currency unit. A balance is carried forward until the next recorded update; the chart does not invent market values between updates. Before an account's first dated balance, its contribution is zero. History is an account-balance history, not a transaction ledger or investment-return calculation.

## CSV format

Download an empty template in Settings. Columns must appear in this order:

```csv
Account,Institution,Category,Currency,Date,Balance,Conversion rate,Reporting currency
Savings,My bank,cash,USD,2026-01-01,10000.25,1,USD
Home loan,My lender,debt,USD,2026-01-01,2500,1,USD
```

Allowed categories: `cash`, `investments`, `property`, `crypto`, `other`, `debt`. Allowed currencies: `USD`, `AED`, `EUR`, `GBP`, `CAD`, `AUD`, `CHF`, `SGD`. Enter liabilities as positive amounts; they are subtracted from net worth. Dates use `YYYY-MM-DD`, no later than today. Amounts use up to two decimal places, without symbols or thousands separators. Conversion rates must be positive and must equal 1 for the reporting currency.

Import matches accounts by name, institution, and currency, adds new dates, and replaces matching dated balances after confirmation. Duplicate rows, ambiguous account matches, invalid dates/values, and mismatched reporting currencies are rejected before anything changes. CSV export neutralizes spreadsheet formula prefixes in text cells; the importer reverses that escaping for names and institutions. This is the Worth interchange format, not automatic bank-statement parsing.

## Verification

```sh
npm run typecheck
npm test
npm run test:worth
npm run test:ui
```

The Worth tests cover persistence, dated balances, liabilities, historical exchange rates, backup validation, deletion, and CSV merging. The desktop smoke script exercises the actual Electron app with temporary data. Test screenshots and databases are ignored under `.qa/`.

## Fork provenance

Original project: **Codex Desktop** — https://github.com/dfones288/codex-desktop

Original author: **MangoWork**. Original README and permission/attribution terms: [docs/UPSTREAM.md](docs/UPSTREAM.md).

The active `codex/worth-desktop` branch descends from the upstream repository. An earlier standalone experiment is preserved only on the local `codex/standalone-draft` branch; it is not the foundation of this branch. The SQLite finance model and finance-specific views were ported from that experiment into the upstream shell.
