import {ManualAccountEditor} from './components/ManualAccountEditor.jsx';
import {AccountPicker} from './components/AccountPicker.jsx';
import {useJournal} from './hooks/useJournal.js';
import {Welcome,ProfileForm} from './components/Profile.jsx';
import {product,logo} from './product.js';
import {Partners} from './pages/Partners.jsx';
import React, { useState, useEffect, useMemo, useId } from "react";
import { LayoutDashboard, CalendarDays, ListFilter, BookOpen, BarChart3, Layers, Play, CheckCheck, Sparkles, Wallet, Settings, Sun, Moon, Plus, ChevronDown, RefreshCw, Upload, X, Link2, SlidersHorizontal, Check, Handshake } from "lucide-react";
import { stats, filterTrades } from "../shared/analytics.mjs";
import { isTradersYardConnected } from "../shared/connection.mjs";

import { Badge } from './components/ui.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { TradeJournal } from './pages/TradeJournal.jsx';
import { Calendar } from './pages/Calendar.jsx';
import { Reports } from './pages/Reports.jsx';
import { Accounts } from './pages/Accounts.jsx';
import { Notebook } from './pages/Notebook.jsx';
import { Strategies, StrategyEditor } from './pages/Strategies.jsx';
import { Progress } from './pages/Progress.jsx';
import { Coach } from './pages/Coach.jsx';
import { SettingsPage } from './pages/Settings.jsx';
import { Replay } from './pages/Replay.jsx';
import { TradeEditor } from './components/TradeEditor.jsx';
import { ImportModal } from './components/ImportModal.jsx';

export const navigation = [
  ["Dashboard", LayoutDashboard],
  ["Trade journal", ListFilter],
  ["Calendar", CalendarDays],
  ["Reports", BarChart3],
  ["Notebook", BookOpen],
  ["Strategies", Layers],
  ["Replay & backtest", Play],
  ["Progress tracker", CheckCheck],
  [product.coachName, Sparkles],
  ["Accounts", Wallet],
  ...(product.partners ? [["Partners", Handshake]] : []),
];

export function JournalApp(props) {
  return <JournalAppView key={props.identity?.id || 'standalone'} {...props}/>;
}
function JournalAppView({ adapter, embedded = false, identity, theme }) {
  const {state,commit,loaded,saveError,reload} = useJournal(adapter);
  const sectionPrefix = useId();
  const singlePage = product.singlePage;
  const [page, changePage] = useState("Dashboard"),
    [account, setAccount] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [search, setSearch] = useState(""),
    [strategy, setStrategy] = useState(""),
    [side, setSide] = useState(""),
    [tag, setTag] = useState(""),
    [showFilters, setShowFilters] = useState(false),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false);
  const sectionId = name => sectionPrefix + '-' + name.replace(/[^a-z0-9]/gi,'-');
  const setPage = name => {
    if (!singlePage) { changePage(name); return; }
    const heading = document.getElementById(sectionId(name));
    heading?.scrollIntoView({behavior:'smooth',block:'start'});
    heading?.focus({preventScroll:true});
  };
  const activeAccount = state.accounts.find((a) => a.id === account);
  useEffect(() => {
    if (account !== 'all' && !state.accounts.some(a => a.id === account)) setAccount('all');
  }, [account, state.accounts]);
  const isConnected = Boolean(identity) || isTradersYardConnected(state.sync);
  const canConnect = !isConnected && typeof adapter.connect === 'function';
  const currency = activeAccount?.currency || state.settings.currency,
    timezone = state.settings.timezone;
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const filtered = useMemo(
    () =>
      filterTrades(state.trades, {
        account,
        from,
        to,
        symbol: search,
        strategy,
        side,
        tag,
        timezone,
        currency,
        accounts: state.accounts,
      }),
    [state.trades, state.accounts, timezone, currency, account, from, to, search, strategy, side, tag],
  );
  const s = useMemo(() => stats(filtered, timezone), [filtered, timezone]);
  const connect = async () => {
    try {
      setBusy(true);
      const result = await adapter.connect();
      setToast(result?.message || "Complete sign-in in the TradersYard window.");
      await reload();
    } catch (e) {
      setToast(e.message);
    } finally {setBusy(false);}
  };
  const sync = async () => {
    if (!adapter.sync) return;
    setBusy(true);
    try {
      const r = await adapter.sync();
      setToast(r.message || "Sync complete");
      await reload();
    } catch (e) {
      setToast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const editTrade = (t) => setModal({ type: "trade", trade: t });
  const props = {
    state,
    adapter,
    canConnect,
    isConnected,
    commit,
    filtered,
    s,
    currency,
    timezone,
    setToast,
    setModal,
    setPage,
    account,
    editTrade,
    overviewOnly: singlePage,
  };
  if (!loaded) return <div className="ty-journal loading" data-theme={theme || "dark"}>{saveError || "Opening your journal…"}{saveError && <button className="button primary" onClick={reload}>Retry opening journal</button>}</div>;
  const needsProfile = !isConnected && !state.profile && !state.accounts.length;
  return (
    <div className={`ty-journal app-shell ${embedded ? "embedded" : ""} ${singlePage ? "single-page" : "tabbed-page"}`} data-theme={theme || state.settings.theme}>
      {needsProfile ? <Welcome connect={connect} createProfile={()=>setModal({type:"profile"})} busy={busy} message={toast || state.sync.message}/> : <>
      {!singlePage && <aside className="sidebar">
        <button className="brand" onClick={() => setPage("Dashboard")}>
          <img src={logo} alt={product.shortName} />
          <span>
            {state.settings.brand.replace(/\s+Journal$/i, "") || product.shortName}
            <small>JOURNAL</small>
          </span>
        </button>
        <nav>
          {navigation.map(([name, Icon], i) => (
            <React.Fragment key={name}>
              {i === 6 && <div className="nav-section">ANALYSIS</div>}
              {i === 9 && <div className="nav-section">WORKSPACE</div>}
              <button
                className={`nav-item ${page === name ? "active" : ""}`}
                onClick={() => {
                  setPage(name);
                  setSearch("");
                }}
              >
                <Icon size={18} />
                {name}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${page === "Settings" ? "active" : ""}`}
            onClick={() => setPage("Settings")}
          >
            <Settings size={18} />
            Settings
          </button>
          <div className="profile">
            <div className="avatar">{product.initials}</div>
            <div>
              {identity?.name || state.profile?.name || "My journal"}
              <small>{state.accounts.length} accounts</small>
            </div>
            <button
              className="icon"
              aria-label="Toggle theme"
              onClick={() =>
                commit({
                  ...state,
                  settings: {
                    ...state.settings,
                    theme: state.settings.theme === "dark" ? "light" : "dark",
                  },
                })
              }
            >
              {state.settings.theme === "dark" ? (
                <Sun size={17} />
              ) : (
                <Moon size={17} />
              )}
            </button>
          </div>
        </div>
      </aside>}
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            {singlePage ? <span className="single-brand"><img src={logo} alt=""/>{product.name}</span> : <>Workspace <span>/</span> <b>{page}</b></>}
          </div>
          <div className="top-actions">
            {singlePage && <button className="icon" aria-label="Toggle theme" onClick={()=>commit({...state,settings:{...state.settings,theme:state.settings.theme==='dark'?'light':'dark'}})}>{state.settings.theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button>}
            <button className="profile-switch" onClick={()=>setModal({type:"profile"})}>{identity?.name || state.profile?.name || "My journal"}<ChevronDown size={14}/></button>
            {canConnect && <button className="button primary small" onClick={connect} disabled={busy}><Link2 size={15}/>Connect Account</button>}
            {adapter.sync && isConnected && <button className="icon" aria-label="Sync accounts" title={state.sync.lastSync ? 'Last synced '+new Date(state.sync.lastSync).toLocaleString() : 'Sync accounts'} onClick={sync} disabled={busy || state.sync.status === 'syncing'}><RefreshCw size={17} className={state.sync.status==='syncing'?'spin':''}/></button>}
          </div>
        </header>
        {saveError && (
          <div className="error-banner" role="alert">
            {saveError}
          </div>
        )}
        <div className="page">
          {embedded && !singlePage && <nav className="embedded-nav" aria-label="Journal pages">{[...navigation.map(([name])=>name),'Settings'].map(name=><button key={name} className={page===name?'active':''} onClick={()=>setPage(name)}>{name}</button>)}</nav>}
          <div className="page-heading">
            <div>
              <h1>{singlePage ? "Trading journal" : page}</h1>
            </div>
            {(singlePage || ![product.coachName,"Settings","Progress tracker","Notebook","Partners"].includes(page)) && <div className="heading-actions">
              {!state.accounts.length && <button className="button primary" onClick={()=>setModal({type:'account'})}><Plus size={16}/>Add account</button>}
              <button
                className="button"
                onClick={() => setModal({ type: "import" })}
              >
                <Upload size={16} />
                Import trades
              </button>
              <button
                className="button primary"
                onClick={() => setModal({ type: "trade" })}
              >
                <Plus size={17} />
                Add trade
              </button>
            </div>}
          </div>
          {['syncing','partial','error'].includes(state.sync.status) && <div className="sync-banner" role="status" aria-live="polite">
            {state.sync.status === 'syncing' && <RefreshCw size={17} className="spin"/>}
            <div><strong>{state.sync.status === 'syncing' ? 'Syncing TradersYard' : state.sync.status === 'partial' ? 'Some account data needs a retry' : 'Sync needs attention'}</strong><span>{state.sync.message}</span>
              {state.sync.progress?.total > 0 && <progress aria-label="Current sync phase" value={state.sync.progress.completed} max={state.sync.progress.total}/>}</div>
            {state.sync.status !== 'syncing' && isConnected && adapter.sync && <button className="button small" disabled={busy} onClick={()=>{setBusy(true);Promise.resolve(state.sync.lastFullCoverage?.issues?.length && adapter.retry ? adapter.retry() : adapter.sync()).then(reload).catch(e=>setToast(e.message)).finally(()=>setBusy(false));}}>Retry sync</button>}
          </div>}
          {(singlePage || ![product.coachName,"Settings","Partners"].includes(page)) && <>
          <div className="filterbar">
            <AccountPicker accounts={state.accounts} value={account} onChange={setAccount}/>
            <div className="date-range">
              <CalendarDays size={16} />
              <input
                aria-label="Start date"
                type="date"
                value={from}
                onChange={(e) => { const next=e.target.value; setFrom(next); if (to && next > to) setTo(next); }}
              />
              <span>—</span>
              <input
                aria-label="End date"
                type="date"
                value={to}
                onChange={(e) => { const next=e.target.value; setTo(next); if (next && from && next < from) setFrom(next); }}
              />
              {(from || to) && (
                <button
                  className="icon"
                  aria-label="Clear date range"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              className={`button small ${showFilters ? "selected" : ""}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal size={15} />
              Filters
              {[strategy, side, tag, search].filter(Boolean).length > 0 && (
                <Badge>
                  {[strategy, side, tag, search].filter(Boolean).length}
                </Badge>
              )}
            </button>
            <span className="filter-spacer" />
            <span className="subtle">
              {currency} <span className="dot-sep">·</span> {timezone}
            </span>
          </div>
          {showFilters && (
            <div className="extra-filters">
              <label>
                Symbol
                <input
                  placeholder="e.g. NQ, EURUSD"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                Strategy
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                >
                  <option value="">All strategies</option>
                  {state.playbooks.map((p) => (
                    <option key={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Direction
                <select value={side} onChange={(e) => setSide(e.target.value)}>
                  <option value="">Both directions</option>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </label>
              <label>
                Tag
                <select value={tag} onChange={(e) => setTag(e.target.value)}>
                  <option value="">All tags</option>
                  {[...new Set(state.trades.flatMap((t) => t.tags || []))].map(
                    (t) => (
                      <option key={t}>{t}</option>
                    ),
                  )}
                </select>
              </label>
              <button
                className="text-button"
                onClick={() => {
                  setSearch("");
                  setSide("");
                  setTag("");
                  setStrategy("");
                }}
              >
                Reset filters
              </button>
            </div>
          )}
          </>}
          {singlePage ? <div className="journal-sections">
            {[
              ['Dashboard',<Dashboard {...props} connect={connect}/>],
              ['Trade journal',<TradeJournal {...props}/>],
              ['Calendar',<Calendar {...props}/>],
              ['Reports',<Reports {...props}/>],
              ['Accounts',<Accounts {...props} connect={connect} sync={sync} busy={busy}/>],
              ['Notebook',<Notebook {...props}/>],
              ['Strategies',<Strategies {...props}/>],
              ['Replay & backtest',<Replay {...props}/>],
              ['Progress tracker',<Progress {...props}/>],
              [product.coachName,<Coach {...props}/>],
              ['Settings',<SettingsPage {...props}/>],
            ].map(([name,content])=><section className="journal-section" aria-labelledby={sectionId(name)} key={name}><h2 className="section-title" id={sectionId(name)} tabIndex={-1}>{name==='Dashboard'?'Performance overview':name}</h2>{content}</section>)}
          </div> : <>
            {page === 'Dashboard' && <Dashboard {...props} connect={connect}/>}
            {page === 'Trade journal' && <TradeJournal {...props}/>}
            {page === 'Calendar' && <Calendar {...props}/>}
            {page === 'Reports' && <Reports {...props}/>}
            {page === 'Notebook' && <Notebook {...props}/>}
            {page === 'Strategies' && <Strategies {...props}/>}
            {page === 'Progress tracker' && <Progress {...props}/>}
            {page === product.coachName && <Coach {...props}/>}
            {page === 'Accounts' && <Accounts {...props} connect={connect} sync={sync} busy={busy}/>}
            {page === 'Settings' && <SettingsPage {...props}/>}
            {page === 'Replay & backtest' && <Replay {...props}/>}
            {product.partners && page === 'Partners' && <Partners/>}
          </>}

        </div>
      </main>
      </>}
      {modal?.type === "profile" && <ProfileForm state={state} commit={commit} onClose={()=>setModal(null)}/>}
      {modal?.type === "trade" && (
        <TradeEditor
          {...props}
          trade={modal.trade}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "import" && (
        <ImportModal {...props} onClose={() => setModal(null)} />
      )}
      {modal?.type === "account" && (
        <ManualAccountEditor {...props} existing={modal.account} onClose={() => setModal(null)} />
      )}
      {modal?.type === "strategy" && (
        <StrategyEditor
          {...props}
          playbook={modal.playbook}
          onClose={() => setModal(null)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

