import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Plus,
  LayoutDashboard,
  Wallet,
  History,
  Settings,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  HardDrive,
  Download,
  Upload,
  Search,
  X,
  Check,
  Sun,
  Moon,
  Building2,
  Landmark,
  TrendingUp,
  House,
  Bitcoin,
  Shapes,
  CreditCard,
  MoreHorizontal,
  ArrowLeft,
  Trash2,
  FolderOpen,
} from "lucide-react";
import {
  type Account,
  type Data,
  type Input,
  type Entry,
  currencies,
  groups,
  today,
  latest,
  value,
  totals,
  dateLabel,
  sampleData,
} from "./worthModel.js";
import "./styles.css";
import "./worth.css";
const empty: Data = {
  version: 1,
  baseCurrency: "USD",
  accounts: [],
  entries: [],
};
const icons: Record<string, typeof Wallet> = {
  cash: Landmark,
  investments: TrendingUp,
  property: House,
  crypto: Bitcoin,
  other: Shapes,
  debt: CreditCard,
};
const cleanError = (e: unknown) =>
  String(e instanceof Error ? e.message : e).replace(
    /^Error invoking remote method '[^']+': Error: /,
    "",
  );
function App() {
  const [data, setData] = useState<Data>(empty),
    [loaded, setLoaded] = useState(false),
    [view, setView] = useState("Overview"),
    [sample, setSample] = useState(false),
    [privateMode, setPrivate] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [theme, setTheme] = useState(localStorage.getItem("worth.theme") || "dark");
  const [modal, setModal] = useState<Account | "new" | null>(null),
    [detail, setDetail] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [range, setRange] = useState("1Y"),
    [busy, setBusy] = useState(false);
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
  const demo = useRef(sampleData());
  const shown = sample ? demo.current : data;
  const total = totals(shown);
  const account = shown.accounts.find((a) => a.id === detail);
  useEffect(() => {
    if (!window.worth) {
      setError("Open Worth as a desktop app to access your local data.");
      setLoaded(true);
      return;
    }
    window.worth
      .read()
      .then(setData)
      .catch((e) => setError(cleanError(e)))
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("worth.theme", theme);
  }, [theme]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const money = (v: number, currency = shown.baseCurrency, decimals = false) =>
    privateMode
      ? "••••••"
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          maximumFractionDigits: decimals ? 2 : 0,
          minimumFractionDigits: decimals ? 2 : 0,
        }).format(v);
  const nav = (v: string) => {
    setView(v);
    setDetail(null);
    setQuery("");
    setFilter("all");
  };
  async function run(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setBusy(false);
    }
  }
  const save = async (input: Input) => {
    if (!window.worth) throw new Error("Please open the desktop app.");
    setData(await window.worth.save(input));
    setModal(null);
    setToast(input.id ? "Balance saved" : "Account added");
  };
  const exportData = (format: "json" | "csv") =>
    run(async () => {
      if (await window.worth?.export(format))
        setToast(
          format === "json" ? "Backup saved" : "Balance history exported",
        );
    });
  const begin = () => {
    setSample(false);
    setDetail(null);
    setModal("new");
  };
  const startDate = () => {
    const d = new Date();
    if (range === "1M") d.setMonth(d.getMonth() - 1);
    else if (range === "3M") d.setMonth(d.getMonth() - 3);
    else if (range === "1Y") d.setFullYear(d.getFullYear() - 1);
    else if (range === "YTD") {
      d.setMonth(0, 1);
    } else return shown.entries[0]?.date || today();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const firstDate = shown.entries.map((e) => e.date).sort()[0] || today();
  const chartStart = firstDate > startDate() ? firstDate : startDate();
  const initial = totals(shown, chartStart).net;
  const change = total.net - initial;
  const percent = initial > 0 ? (change / initial) * 100 : null;
  const filtered = shown.accounts.filter(
    (a) =>
      (filter === "all" ||
        (filter === "assets"
          ? a.category !== "debt"
          : a.category === "debt")) &&
      `${a.name} ${a.institution}`.toLowerCase().includes(query.toLowerCase()),
  );
  const assetGroups = Object.entries(groups)
    .filter(([key]) => key !== "debt")
    .map(([key, g]) => ({
      ...g,
      key,
      amount: shown.accounts
        .filter((a) => a.category === key)
        .reduce((s, a) => s + value(latest(shown, a.id)), 0),
    }))
    .filter((g) => g.amount > 0);
  const table = (accounts: Account[]) => (
    <div className="account-table">
      <div className="table-head">
        <span>Account</span>
        <span>Type</span>
        <span>Last updated</span>
        <span>
          Balance <small>{shown.baseCurrency}</small>
        </span>
        <span />
      </div>
      {accounts.map((a) => {
        const e = latest(shown, a.id);
        const Icon = icons[a.category];
        return (
          <button
            className="account-row"
            key={a.id}
            onClick={() => {
              setDetail(a.id);
              setView("Accounts");
            }}
          >
            <span className="account-identity">
              <span
                className="account-icon"
                style={
                  {
                    "--category": groups[a.category].color,
                  } as React.CSSProperties
                }
              >
                <Icon size={18} />
              </span>
              <span>
                <strong>{a.name}</strong>
                <small>{a.institution || groups[a.category].label}</small>
              </span>
            </span>
            <span className="type-tag">
              <i style={{ background: groups[a.category].color }} />
              {groups[a.category].name}
            </span>
            <span className="muted">{e ? dateLabel(e.date) : "—"}</span>
            <span className="row-balance">
              {a.category === "debt" ? "−" : ""}
              {money(value(e))}
              {a.currency !== shown.baseCurrency && (
                <small>
                  {money((e?.amountMinor || 0) / 100, a.currency, true)}
                </small>
              )}
            </span>
            <ChevronRight size={15} />
          </button>
        );
      })}
    </div>
  );
  return (
    <div className={`shell worth-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="traffic-spacer" aria-hidden="true" />
        <div className="worth-brand">
          Worth <span>Personal</span>
        </div>
        <div className="nav-block top-actions">
          <button
            className={`ghost-button ${view === "Overview" ? "active" : ""}`}
            onClick={() => nav("Overview")}
          >
            <LayoutDashboard className="nav-icon" size={17} />
            Overview
          </button>
          <button
            className={`ghost-button ${view === "Accounts" ? "active" : ""}`}
            onClick={() => nav("Accounts")}
          >
            <Wallet className="nav-icon" size={17} />
            Accounts
          </button>
          <button
            className={`ghost-button ${view === "History" ? "active" : ""}`}
            onClick={() => nav("History")}
          >
            <History className="nav-icon" size={17} />
            History
          </button>
        </div>
        <section className="threads-section">
          <div className="section-title">
            <span>Accounts</span>
            <span className="section-tools">
              <button
                className="section-tool-button"
                type="button"
                onClick={begin}
                title="Add account"
                aria-label="Add account to sidebar"
              >
                <Plus className="section-tool-icon" size={16} />
              </button>
            </span>
          </div>
          <div className="threads-scroll">
            {Object.entries(groups)
              .filter(([key]) => shown.accounts.some((a) => a.category === key))
              .map(([key, g]) => {
                const Icon = icons[key];
                return (
                  <div key={key} className="worth-account-group">
                    <button
                      className="project-pill"
                      aria-expanded={!closedGroups[key]}
                      onClick={() =>
                        setClosedGroups((current) => ({
                          ...current,
                          [key]: !current[key],
                        }))
                      }
                    >
                      <span
                        className={`disclosure ${closedGroups[key] ? "" : "open"}`}
                        aria-hidden="true"
                      />
                      <Icon size={16} />
                      <strong>{g.name}</strong>
                      <span>
                        {
                          shown.accounts.filter((a) => a.category === key)
                            .length
                        }
                      </span>
                    </button>
                    {!closedGroups[key] &&
                      shown.accounts
                        .filter((a) => a.category === key)
                        .map((a) => (
                          <button
                            className={`thread-item ${detail === a.id ? "active-thread" : ""}`}
                            key={a.id}
                            onClick={() => {
                              setDetail(a.id);
                              setView("Accounts");
                            }}
                          >
                            <span className="thread-title">{a.name}</span>
                          </button>
                        ))}
                  </div>
                );
              })}
            {!shown.accounts.length && (
              <p className="sidebar-empty">Your accounts will appear here.</p>
            )}
          </div>
        </section>
        <button className="add-project" onClick={begin}>
          <Plus className="sidebar-action-icon" size={16} />
          Add account
        </button>
        <button
          className={`settings ${view === "Settings" ? "active" : ""}`}
          onClick={() => nav("Settings")}
        >
          <Settings className="sidebar-action-icon" size={16} />
          Settings
        </button>
      </aside>
      <section className="workspace worth-workspace">
        <header className="topbar titlebar">
          <button
            className="icon-button sidebar-toggle"
            aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
          <span className="breadcrumb">
            Workspace <ChevronRight size={12} />
            <strong>{view}</strong>
            {account && (
              <>
                <ChevronRight size={12} />
                {account.name}
              </>
            )}
          </span>
          <div className="title-actions">
            {sample && <span className="sample-pill">Sample data</span>}
            <button
              className="icon-button"
              title={privateMode ? "Show balances" : "Hide balances"}
              aria-label={privateMode ? "Show balances" : "Hide balances"}
              onClick={() => setPrivate(!privateMode)}
            >
              {privateMode ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
            <span className="title-divider" />
            <span className="currency-label">{shown.baseCurrency}</span>
          </div>
        </header>
        <main className="content worth-content">
          <div className="worth-page">
            {sample && (
              <div className="sample-banner">
                <span>
                  You’re exploring a sample workspace. Your data is unchanged.
                </span>
                <button
                  onClick={() => {
                    setSample(false);
                    setDetail(null);
                  }}
                >
                  Exit preview <X size={14} />
                </button>
              </div>
            )}
            {error && (
              <div role="alert" className="error-banner">
                <span>{error}</span>
                <button
                  className="icon-button"
                  aria-label="Dismiss error"
                  onClick={() => setError("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {!loaded ? (
              <div className="loading">Opening your workspace…</div>
            ) : (
              <>
                {view === "Overview" && (
                  <>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">YOUR FINANCIAL PICTURE</div>
                        <h1>Overview</h1>
                        <p>
                          Everything you own. Everything you owe. One place.
                        </p>
                      </div>
                      <button className="button primary" onClick={begin}>
                        <Plus size={16} />
                        Add account
                      </button>
                    </div>
                    {shown.accounts.length === 0 ? (
                      <>
                        <section className="welcome-card">
                          <div className="welcome-art">
                            <span />
                            <span />
                            <span />
                            <Wallet size={28} />
                          </div>
                          <div className="eyebrow">A CLEARER START</div>
                          <h2>Your whole picture starts here.</h2>
                          <p>
                            Add your first account to see where you stand.
                            <br />
                            Build a history, one balance update at a time.
                          </p>
                          <button className="button primary" onClick={begin}>
                            <Plus size={16} />
                            Add your first account
                          </button>
                          <button
                            className="text-button"
                            onClick={() => setSample(true)}
                          >
                            Explore a sample workspace <ArrowRight size={14} />
                          </button>
                          <div className="welcome-trust">
                            <HardDrive size={14} />
                            Local to your Mac<span>·</span>No bank connection
                            required
                          </div>
                        </section>
                        <div className="start-grid">
                          {[
                            [
                              Landmark,
                              "Gather your accounts",
                              "Cash, investments, property, and debt.",
                            ],
                            [
                              History,
                              "Keep a little history",
                              "Update balances whenever it suits you.",
                            ],
                            [
                              ShieldCheck,
                              "Keep it personal",
                              "Your records stay in your local workspace.",
                            ],
                          ].map(([Icon, title, body]: any) => (
                            <div key={title}>
                              <Icon size={19} />
                              <h3>{title}</h3>
                              <p>{body}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <section className="wealth-section">
                          <div className="wealth-top">
                            <div>
                              <div className="section-label">
                                Total net worth <span className="subtle-dot" />
                              </div>
                              <div className="net-worth">
                                {money(total.net)}
                                <span>{shown.baseCurrency}</span>
                              </div>
                              <div
                                className={`change ${change < 0 ? "negative" : ""}`}
                              >
                                {change < 0 ? (
                                  <ArrowDownLeft size={15} />
                                ) : (
                                  <ArrowUpRight size={15} />
                                )}
                                <strong>
                                  {change >= 0 ? "+" : "−"}
                                  {money(Math.abs(change))}
                                  {percent !== null && !privateMode
                                    ? ` (${Math.abs(percent).toFixed(1)}%)`
                                    : ""}
                                </strong>
                                <span>since {dateLabel(chartStart)}</span>
                              </div>
                            </div>
                            <div className="ranges">
                              {["1M", "3M", "YTD", "1Y", "ALL"].map((r) => (
                                <button
                                  key={r}
                                  onClick={() => setRange(r)}
                                  className={range === r ? "selected" : ""}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>
                          <Chart
                            data={shown}
                            start={chartStart}
                            money={money}
                            hidden={privateMode}
                          />
                          <div className="wealth-foot">
                            <span>
                              <i />
                              Recorded balances · carried forward between
                              updates
                            </span>
                            <span>
                              As of{" "}
                              {dateLabel(today(), {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </section>
                        <div className="summary-grid">
                          <section className="summary-item">
                            <div className="summary-label">
                              <span className="mini-icon asset">
                                <ArrowUpRight size={16} />
                              </span>
                              Total assets
                            </div>
                            <strong>{money(total.assets)}</strong>
                            <small>
                              {
                                shown.accounts.filter(
                                  (a) => a.category !== "debt",
                                ).length
                              }{" "}
                              asset accounts
                            </small>
                          </section>
                          <section className="summary-item">
                            <div className="summary-label">
                              <span className="mini-icon liability">
                                <ArrowDownLeft size={16} />
                              </span>
                              Total liabilities
                            </div>
                            <strong>{money(total.debt)}</strong>
                            <small>
                              {
                                shown.accounts.filter(
                                  (a) => a.category === "debt",
                                ).length
                              }{" "}
                              liability accounts
                            </small>
                          </section>
                          <section className="summary-item allocation">
                            <div className="summary-label">
                              Asset allocation
                            </div>
                            <div className="allocation-bar">
                              {assetGroups.map((g) => (
                                <span
                                  key={g.key}
                                  style={{
                                    width: `${(g.amount / total.assets) * 100}%`,
                                    background: g.color,
                                  }}
                                  title={
                                    privateMode
                                      ? g.name
                                      : `${g.name}: ${Math.round((g.amount / total.assets) * 100)}%`
                                  }
                                />
                              ))}
                            </div>
                            <div className="allocation-legend">
                              {assetGroups.map((g) => (
                                <span key={g.key}>
                                  <i style={{ background: g.color }} />
                                  {g.name}
                                  {!privateMode && (
                                    <small>
                                      {Math.round(
                                        (g.amount / total.assets) * 100,
                                      )}
                                      %
                                    </small>
                                  )}
                                </span>
                              ))}
                              {assetGroups.length === 0 && (
                                <span>No asset balances yet</span>
                              )}
                            </div>
                          </section>
                        </div>
                        <section className="accounts-section">
                          <div className="section-heading">
                            <h2>
                              Your accounts <span>{shown.accounts.length}</span>
                            </h2>
                            <button
                              className="text-button"
                              onClick={() => nav("Accounts")}
                            >
                              View all accounts <ArrowRight size={14} />
                            </button>
                          </div>
                          {table(shown.accounts.slice(0, 5))}
                        </section>
                      </>
                    )}
                  </>
                )}
                {view === "Accounts" && !account && (
                  <>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">THE BUILDING BLOCKS</div>
                        <h1>Accounts</h1>
                        <p>A home for every part of your net worth.</p>
                      </div>
                      <button className="button primary" onClick={begin}>
                        <Plus size={16} />
                        Add account
                      </button>
                    </div>
                    <div className="accounts-total">
                      <span>Across {shown.accounts.length} accounts</span>
                      <strong>
                        {money(total.net)}
                        <small>net worth</small>
                      </strong>
                    </div>
                    <div className="table-toolbar">
                      <div className="tabs">
                        {[
                          ["all", "All accounts"],
                          ["assets", "Assets"],
                          ["debt", "Liabilities"],
                        ].map(([key, title]) => (
                          <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={filter === key ? "selected" : ""}
                          >
                            {title}
                          </button>
                        ))}
                      </div>
                      <label className="search">
                        <Search size={15} />
                        <input
                          aria-label="Search accounts"
                          placeholder="Search accounts…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                    </div>
                    {filtered.length ? (
                      table(filtered)
                    ) : (
                      <div className="empty-state">
                        <Wallet size={25} />
                        <h2>
                          {shown.accounts.length
                            ? "No matching accounts"
                            : "Room for your whole picture"}
                        </h2>
                        <p>
                          {shown.accounts.length
                            ? "Try a different name or account type."
                            : "Add cash, investments, property, or a liability to get started."}
                        </p>
                        {!shown.accounts.length && (
                          <button className="button" onClick={begin}>
                            <Plus size={15} />
                            Add account
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
                {view === "Accounts" && account && (
                  <>
                    <button
                      className="text-button back"
                      onClick={() => setDetail(null)}
                    >
                      <ArrowLeft size={14} />
                      All accounts
                    </button>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">
                          {groups[account.category].label.toUpperCase()}
                        </div>
                        <h1>{account.name}</h1>
                        <p>
                          {account.institution || "Personal account"} ·{" "}
                          {account.currency}
                        </p>
                      </div>
                      <button
                        className="button primary"
                        disabled={sample}
                        onClick={() => setModal(account)}
                      >
                        <Plus size={16} />
                        Update balance
                      </button>
                    </div>
                    <section className="detail-balance">
                      <div className="section-label">
                        {account.category === "debt"
                          ? "Outstanding balance"
                          : "Current balance"}
                      </div>
                      <div className="net-worth">
                        {money(
                          (latest(shown, account.id)?.amountMinor || 0) / 100,
                          account.currency,
                          true,
                        )}
                        <span>{account.currency}</span>
                      </div>
                      <p className="muted">
                        Last updated{" "}
                        {dateLabel(latest(shown, account.id)?.date || today(), {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {account.currency !== shown.baseCurrency &&
                          ` · ${money(value(latest(shown, account.id)))} in ${shown.baseCurrency}`}
                      </p>
                    </section>
                    <div className="section-heading">
                      <h2>Balance history</h2>
                      <span className="muted">One balance per day</span>
                    </div>
                    <HistoryList
                      data={shown}
                      money={money}
                      accountId={account.id}
                      onEdit={sample ? undefined : (a) => setModal(a)}
                    />
                    {!sample && (
                      <div className="danger-zone">
                        <span>
                          Deleting this account also removes its balance
                          history.
                        </span>
                        <button
                          className="text-button danger"
                          onClick={() =>
                            setModal({ ...account, id: "delete:" + account.id })
                          }
                        >
                          <Trash2 size={14} />
                          Delete account
                        </button>
                      </div>
                    )}
                  </>
                )}
                {view === "History" && (
                  <>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">ONE UPDATE AT A TIME</div>
                        <h1>History</h1>
                        <p>
                          The balance updates behind your financial picture.
                        </p>
                      </div>
                      <button
                        className="button"
                        disabled={sample || !data.entries.length || busy}
                        onClick={() => exportData("csv")}
                      >
                        <Download size={15} />
                        Export CSV
                      </button>
                    </div>
                    {shown.entries.length ? (
                      <HistoryList data={shown} money={money} />
                    ) : (
                      <div className="empty-state">
                        <History size={25} />
                        <h2>Your history is ahead of you</h2>
                        <p>
                          Start with an account. Each balance update will appear
                          here.
                        </p>
                        <button className="button" onClick={begin}>
                          <Plus size={15} />
                          Add account
                        </button>
                      </div>
                    )}
                  </>
                )}
                {view === "Settings" && (
                  <>
                    <div className="page-heading">
                      <div>
                        <div className="eyebrow">MAKE YOURSELF AT HOME</div>
                        <h1>Settings</h1>
                        <p>Your workspace, your preferences.</p>
                      </div>
                    </div>
                    <div className="settings-group">
                      <h2>Workspace</h2>
                      <div className="settings-card">
                        <div className="setting-row">
                          <div>
                            <strong>Reporting currency</strong>
                            <p>
                              {data.accounts.length
                                ? "Fixed for this workspace to preserve historical conversions."
                                : "Choose your reporting currency before adding your first account."}
                            </p>
                          </div>
                          <select
                            aria-label="Reporting currency"
                            disabled={!!data.accounts.length || sample || busy}
                            value={data.baseCurrency}
                            onChange={(e) =>
                              run(async () => {
                                setData(
                                  await window.worth!.currency(e.target.value),
                                );
                                setToast("Reporting currency updated");
                              })
                            }
                          >
                            {currencies.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div className="setting-row">
                          <div>
                            <strong>Appearance</strong>
                            <p>A light or dark space for your numbers.</p>
                          </div>
                          <div className="tabs theme-tabs">
                            <button
                              className={theme === "light" ? "selected" : ""}
                              onClick={() => setTheme("light")}
                            >
                              <Sun size={15} />
                              Light
                            </button>
                            <button
                              className={theme === "dark" ? "selected" : ""}
                              onClick={() => setTheme("dark")}
                            >
                              <Moon size={15} />
                              Dark
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="settings-group">
                      <h2>Your data</h2>
                      <div className="settings-card">
                        <div className="setting-row">
                          <div>
                            <strong>Back up your workspace</strong>
                            <p>
                              Save all accounts, balances, and currency settings
                              as a JSON file.
                            </p>
                          </div>
                          <button
                            className="button"
                            disabled={sample || busy}
                            onClick={() => exportData("json")}
                          >
                            <Download size={15} />
                            Save backup
                          </button>
                        </div>
                        <div className="setting-row">
                          <div>
                            <strong>Restore a backup</strong>
                            <p>
                              Replace this workspace with a previously saved
                              Worth backup.
                            </p>
                          </div>
                          <button
                            className="button"
                            disabled={sample || busy}
                            onClick={() =>
                              run(async () => {
                                const restored = await window.worth?.restore();
                                if (restored) {
                                  setData(restored);
                                  setToast("Workspace restored");
                                }
                              })
                            }
                          >
                            <Upload size={15} />
                            Restore
                          </button>
                        </div>
                        <div className="setting-row">
                          <div>
                            <strong>Import from a spreadsheet</strong>
                            <p>
                              Add dated balances using the Worth CSV format.{" "}
                              <button
                                className="text-button"
                                disabled={sample || busy}
                                onClick={() =>
                                  run(async () => {
                                    if (await window.worth?.export("template"))
                                      setToast("CSV template saved");
                                  })
                                }
                              >
                                Download template
                              </button>
                            </p>
                          </div>
                          <button
                            className="button"
                            disabled={sample || busy}
                            onClick={() =>
                              run(async () => {
                                const imported =
                                  await window.worth?.importCsv();
                                if (imported) {
                                  setData(imported);
                                  setToast("Balances imported");
                                }
                              })
                            }
                          >
                            <Upload size={15} />
                            Import CSV
                          </button>
                        </div>
                        <div className="setting-row">
                          <div>
                            <strong>Export balance history</strong>
                            <p>
                              Take a readable copy of every balance to your
                              spreadsheet.
                            </p>
                          </div>
                          <button
                            className="button"
                            disabled={sample || busy || !data.entries.length}
                            onClick={() => exportData("csv")}
                          >
                            <Download size={15} />
                            Export CSV
                          </button>
                        </div>
                        <div className="setting-row">
                          <div>
                            <strong>Local storage</strong>
                            <p>
                              A SQLite database in this Mac’s application
                              support folder.
                            </p>
                          </div>
                          <button
                            className="button"
                            onClick={() =>
                              run(async () => {
                                await window.worth?.location();
                              })
                            }
                          >
                            <FolderOpen size={15} />
                            Show in Finder
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="privacy-note">
                      <ShieldCheck size={20} />
                      <div>
                        <strong>Personal by design.</strong>
                        <p>
                          No cloud sync, tracking, or bank connections. Worth
                          stores data locally; database and backup files are not
                          encrypted by the app. Currency conversions use the
                          manual rate recorded with each balance.
                        </p>
                      </div>
                    </div>
                    <div className="settings-footer">
                      <span className="brand-mark">
                        w<span>·</span>
                      </span>
                      <span>
                        Worth{" "}
                        <small>
                          Version 0.1.0 · Based on Codex Desktop by MangoWork
                        </small>
                      </span>
                      <button
                        className="text-button"
                        onClick={() => {
                          setSample(true);
                          nav("Overview");
                        }}
                      >
                        Explore sample workspace <ArrowRight size={14} />
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </main>
        <footer className="footer-status worth-footer">
          <div className="footer-left">
            <span>
              <HardDrive className="footer-icon" size={15} />
              Local
            </span>
            <span>{sample ? "Sample workspace" : "Stored on this Mac"}</span>
          </div>
          <span>{shown.baseCurrency}</span>
        </footer>
      </section>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {modal &&
        (typeof modal === "object" && modal.id.startsWith("delete:") ? (
          <DeleteDialog
            name={modal.name}
            close={() => setModal(null)}
            remove={() =>
              run(async () => {
                setData(await window.worth!.remove(modal.id.slice(7)));
                setModal(null);
                setDetail(null);
                setToast("Account deleted");
              })
            }
          />
        ) : (
          <AccountDialog
            account={modal === "new" ? undefined : modal}
            data={data}
            close={() => setModal(null)}
            save={save}
          />
        ))}
    </div>
  );
}
function HistoryList({
  data,
  money,
  accountId,
  onEdit,
}: {
  data: Data;
  money: (n: number, c?: string, d?: boolean) => string;
  accountId?: string;
  onEdit?: (a: Account) => void;
}) {
  const entries = data.entries
    .filter((e) => !accountId || e.accountId === accountId)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="history-list">
      {entries.map((e) => {
        const a = data.accounts.find((a) => a.id === e.accountId)!;
        const prev = latest(
          data,
          a.id,
          new Date(new Date(e.date + "T12:00:00Z").getTime() - 86400000)
            .toISOString()
            .slice(0, 10),
        );
        const diff = prev ? (e.amountMinor - prev.amountMinor) / 100 : null;
        const Icon = icons[a.category];
        return (
          <div className="history-row" key={e.id}>
            <span className="history-date">
              {dateLabel(e.date, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span
              className="account-icon"
              style={
                {
                  "--category": groups[a.category].color,
                } as React.CSSProperties
              }
            >
              <Icon size={17} />
            </span>
            <span className="history-name">
              <strong>{a.name}</strong>
              <small>
                {prev ? "Balance updated" : "Opening balance"}
                {a.currency !== data.baseCurrency &&
                  ` · 1 ${a.currency} = ${e.rate} ${data.baseCurrency}`}
              </small>
            </span>
            <span className="history-amount">
              <strong>{money(e.amountMinor / 100, a.currency, true)}</strong>
              <small>
                {diff === null
                  ? "First recorded balance"
                  : `${diff >= 0 ? "+" : "−"}${money(Math.abs(diff), a.currency, true)}`}
              </small>
            </span>
            {onEdit && (
              <button
                className="icon-button"
                title="Update this account"
                aria-label="Update this account"
                onClick={() => onEdit(a)}
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
function Chart({
  data,
  start,
  money,
  hidden,
}: {
  data: Data;
  start: string;
  money: (n: number) => string;
  hidden: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const end = today();
  const dates = [
    ...new Set([
      start,
      ...data.entries.filter((e) => e.date >= start).map((e) => e.date),
      end,
    ]),
  ].sort();
  const points = dates.map((date) => ({ date, value: totals(data, date).net }));
  const nums = points.map((p) => p.value);
  const low = Math.min(...nums),
    high = Math.max(...nums);
  const spread = Math.max(high - low, Math.abs(high) * 0.1, 100);
  const min = low - spread * 0.18,
    max = high + spread * 0.18;
  const W = 1000,
    H = 232,
    L = 4,
    R = 900,
    T = 16,
    B = 204;
  const stamp = (date: string) => new Date(date + "T12:00:00Z").getTime();
  const duration = stamp(end) - stamp(start) || 1;
  const x = (date: string) =>
    L + ((stamp(date) - stamp(start)) / duration) * (R - L);
  const y = (v: number) => B - ((v - min) / (max - min)) * (B - T);
  const path = points
    .map((p, i) =>
      i === 0
        ? `M ${x(p.date)} ${y(p.value)}`
        : `H ${x(p.date)} V ${y(p.value)}`,
    )
    .join(" ");
  const line =
    points.length === 1 ? `M ${L} ${y(points[0].value)} H ${R}` : path;
  const lastX = points.length === 1 ? R : x(end);
  const selected =
    hover === null ? null : points[Math.min(hover, points.length - 1)];
  return (
    <div className="chart-wrap">
      {hidden ? (
        <div className="chart-private">
          <EyeOff size={22} />
          <span>Balances hidden</span>
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Net worth history from ${dateLabel(start)} to ${dateLabel(end)}. Current net worth ${money(totals(data).net)}.`}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const px = ((event.clientX - rect.left) / rect.width) * W;
              let idx = 0;
              points.forEach((p, i) => {
                if (x(p.date) <= px) idx = i;
              });
              setHover(idx);
            }}
          >
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-line)"
                  stopOpacity=".16"
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-line)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((t) => {
              const v = min + (max - min) * t;
              return (
                <g key={t}>
                  <line
                    className="chart-grid"
                    x1={L}
                    x2={R}
                    y1={y(v)}
                    y2={y(v)}
                  />
                  <text
                    x={W}
                    y={y(v) + 4}
                    textAnchor="end"
                    className="chart-label"
                  >
                    {money(v)}
                  </text>
                </g>
              );
            })}
            <path
              d={`${line} L ${lastX} ${B} L ${L} ${B} Z`}
              fill="url(#chartFill)"
            />
            <path
              d={line}
              fill="none"
              stroke="var(--chart-line)"
              strokeWidth="2.3"
              strokeLinejoin="round"
            />
            <circle
              cx={lastX}
              cy={y(points[points.length - 1].value)}
              r="4"
              fill="var(--chart-line)"
              stroke="var(--bg)"
              strokeWidth="2"
            />
            {selected && (
              <>
                <line
                  x1={x(selected.date)}
                  x2={x(selected.date)}
                  y1={T}
                  y2={B}
                  stroke="var(--muted)"
                  strokeDasharray="3 5"
                />
                <circle
                  cx={x(selected.date)}
                  cy={y(selected.value)}
                  r="4"
                  fill="var(--chart-line)"
                />
              </>
            )}
          </svg>
          <div className="chart-dates">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <span key={t}>
                {dateLabel(
                  new Date(stamp(start) + duration * t)
                    .toISOString()
                    .slice(0, 10),
                  {
                    month: "short",
                    ...(duration < 90 * 86400000
                      ? { day: "numeric" }
                      : { year: "2-digit" }),
                  },
                )}
              </span>
            ))}
          </div>
          {selected && (
            <div className="chart-tooltip">
              <span>
                {dateLabel(selected.date, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <strong>{money(selected.value)}</strong>
            </div>
          )}
        </>
      )}
    </div>
  );
}
function AccountDialog({
  account,
  data,
  close,
  save,
}: {
  account?: Account;
  data: Data;
  close: () => void;
  save: (v: Input) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const current = account ? latest(data, account.id) : undefined;
  const [name, setName] = useState(account?.name || ""),
    [institution, setInstitution] = useState(account?.institution || ""),
    [category, setCategory] = useState(account?.category || "cash"),
    [currency, setCurrency] = useState(account?.currency || data.baseCurrency),
    [amount, setAmount] = useState(
      current ? String(current.amountMinor / 100) : "",
    ),
    [date, setDate] = useState(today()),
    [rate, setRate] = useState(current ? String(current.rate) : ""),
    [err, setErr] = useState(""),
    [saving, setSaving] = useState(false);
  const needsRate = currency !== data.baseCurrency;
  const existingDate =
    account &&
    data.entries.some((e) => e.accountId === account.id && e.date === date);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      setErr(
        "Enter a positive balance or zero, with at most two decimal places.",
      );
      return;
    }
    setSaving(true);
    try {
      await save({
        id: account?.id,
        name,
        institution,
        category,
        currency,
        amountMinor: Math.round(Number(amount) * 100),
        date,
        rate: needsRate ? Number(rate) : 1,
      });
    } catch (e) {
      setErr(cleanError(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        if (saving) e.preventDefault();
        else close();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !saving) close();
      }}
    >
      <form onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <div className="eyebrow">
              {account
                ? "KEEP YOUR PICTURE CURRENT"
                : "A NEW PIECE OF YOUR PICTURE"}
            </div>
            <h2>{account ? "Update account" : "Add an account"}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            disabled={saving}
            onClick={close}
          >
            <X size={19} />
          </button>
        </div>
        <label>
          Account name
          <input
            autoFocus
            required
            maxLength={100}
            placeholder="e.g. Everyday savings"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Account type
            <select
              aria-label="Account type"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {Object.entries(groups).map(([key, g]) => (
                <option value={key} key={key}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Currency
            <select
              aria-label="Account currency"
              disabled={!!account}
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setRate("");
              }}
            >
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Institution <span className="optional">Optional</span>
          <input
            maxLength={100}
            placeholder="Bank, broker, or a personal label"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            {category === "debt" ? "Amount owed" : "Balance"}
            <div className="amount-input">
              <span>{currency}</span>
              <input
                required
                inputMode="decimal"
                aria-label={category === "debt" ? "Amount owed" : "Balance"}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </label>
          <label>
            As of
            <input
              type="date"
              min="1900-01-01"
              max={today()}
              required
              value={date}
              onChange={(e) => {
                const d = e.target.value;
                setDate(d);
                const prior = account
                  ? data.entries.find(
                      (e) => e.accountId === account.id && e.date === d,
                    )
                  : undefined;
                if (prior) {
                  setAmount(String(prior.amountMinor / 100));
                  setRate(String(prior.rate));
                }
              }}
            />
          </label>
        </div>
        {needsRate && (
          <label>
            Conversion rate
            <div className="amount-input rate-input">
              <span>1 {currency} =</span>
              <input
                required
                type="number"
                step="any"
                min="0.00000001"
                max="1000000"
                placeholder="Enter rate"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
              <span>{data.baseCurrency}</span>
            </div>
            <small>
              Manual rate saved with this dated balance. No live exchange-rate
              feed.
            </small>
          </label>
        )}
        <div className="form-note">
          {existingDate
            ? "Saving will replace the existing balance for this date."
            : category === "debt"
              ? "Enter a positive amount. Worth subtracts liabilities from your assets."
              : `This balance will be included in your net worth in ${data.baseCurrency}.`}
        </div>
        {err && (
          <p className="form-error" role="alert">
            {err}
          </p>
        )}
        <div className="modal-footer">
          <button
            type="button"
            className="button"
            disabled={saving}
            onClick={close}
          >
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? "Saving…" : account ? "Save balance" : "Add account"}
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </dialog>
  );
}
function DeleteDialog({
  name,
  close,
  remove,
}: {
  name: string;
  close: () => void;
  remove: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className="delete-dialog"
      ref={ref}
      onCancel={(e) => {
        if (pending) e.preventDefault();
        else close();
      }}
    >
      <h2>Delete {name}?</h2>
      <p>
        This removes the account and all of its balance history. You can save a
        backup in Settings before deleting.
      </p>
      <div className="modal-footer">
        <button className="button" autoFocus onClick={close} disabled={pending}>
          Keep account
        </button>
        <button
          className="button destructive"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await remove();
            setPending(false);
          }}
        >
          Delete account
        </button>
      </div>
    </dialog>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
