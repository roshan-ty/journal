import logo from '../../public/assets/ty-logo.png';
import React, {useMemo,useState} from "react";
import { Wallet, Plus, Link2 } from "lucide-react";
import { stats, ruleProgress } from "../../shared/analytics.mjs";

import { money, num, Badge, Empty } from "../components/ui.jsx";

function RuleDetails({value}) {
  const [expanded,setExpanded] = useState(false);
  return <details onToggle={event=>setExpanded(event.currentTarget.open)}><summary>Account rule details</summary>{expanded && <pre>{JSON.stringify(value,null,2)}</pre>}</details>;
}

export function Accounts({
  state,
  filtered,
  currency,
  timezone,
  account,
  connect,
  sync,
  busy,
  adapter,
  isConnected,
  canConnect,
  setToast,
  setModal,
}) {
  const byAccount = useMemo(()=>{
    const rows = new Map();
    for (const trade of state.trades) {
      if (!rows.has(trade.accountId)) rows.set(trade.accountId,[]);
      rows.get(trade.accountId).push(trade);
    }
    return new Map(state.accounts.map(account=>{
      const trades = rows.get(account.id) || [];
      return [account.id,{s:stats(trades,timezone),r:ruleProgress(account,trades,timezone)}];
    }));
  },[state.accounts,state.trades,timezone]);
  return (
    <>
      <div className="connect-callout">
        <div className="row">
          <div className="connection-logo">
            <img src={logo} alt="TradersYard" />
          </div>
          <div>
            <h3>TradersYard connection</h3>
            <p>
              {isConnected
                ? "Read-only sync · Your account, trades and rule data"
                : "Use TradersYard’s official sign-in to connect your accounts."}
            </p>
          </div>
        </div>
        <div className="row">
          <button
            className="button"
            onClick={() => setModal({ type: "account" })}
          >
            <Plus size={16} />
            Manual account
          </button>
          {(isConnected ? adapter.sync : canConnect) && <button
            className="button primary"
            onClick={isConnected ? sync : connect}
            disabled={busy || state.sync.status === "syncing" || (isConnected ? !adapter.sync : !canConnect)}
          >
            <Link2 size={16} />
            {isConnected ? "Sync now" : "Connect TradersYard"}
          </button>}
        </div>
      </div>
      {state.sync.message && ['syncing','error','partial'].includes(state.sync.status) && (
        <div className="notice">
          {state.sync.message}{" "}
          {isConnected && adapter.retry &&
            state.sync.lastFullCoverage?.issues?.length > 0 && (
              <button
                className="text-button"
                disabled={state.sync.status === "syncing"}
                onClick={() => adapter.retry().catch(e => setToast(e.message))}
              >
                Retry incomplete data
              </button>
            )}
        </div>
      )}
      {(state.sync.lastFullCoverage || state.sync.coverage)?.issues?.length >
        0 && (
        <details className="notice">
          <summary>
            History coverage issues (
            {(state.sync.lastFullCoverage || state.sync.coverage).issues.length}
            )
          </summary>
          <ul>
            {(state.sync.lastFullCoverage || state.sync.coverage).issues.map(
              (issue, i) => (
                <li key={i}>{issue}</li>
              ),
            )}
          </ul>
        </details>
      )}
      <div className="accounts-grid">
        {state.accounts
          .filter((a) => account === "all" || account === a.id)
          .map((a) => {
            const {s,r} = byAccount.get(a.id);
            return (
              <section className="panel account-card" key={a.id}>
                <div className="panel-head">
                  <Wallet size={22} />
                  <Badge
                    tone={
                      a.status === "active"
                        ? "lime"
                        : a.status === "failed" || a.status === "breached"
                          ? "red"
                          : "purple"
                    }
                  >
                    {a.status}
                  </Badge>
                </div>
                <div className="account-body">
                  <h2>{a.name}</h2>
                  <p className="mono">{a.number}</p>
                  <div className="account-balance">
                    <small>
                      {a.balance == null
                        ? "Imported net P&L"
                        : "Provider balance"}
                    </small>
                    <strong>{money(a.balance ?? s.total, a.currency)}</strong>
                  </div>
                  <div className="account-stats">
                    <div>
                      <span>Closed P&L</span>
                      <b className={s.total >= 0 ? "positive" : "negative"}>
                        {money(a.providerClosedPnl ?? s.total, a.currency)}
                      </b>
                    </div>
                    <div>
                      <span>Open P&L</span>
                      <b>
                        {money(a.providerOpenPnl ?? s.unrealized, a.currency)}
                      </b>
                    </div>
                    <div>
                      <span>Journal trades</span>
                      <b>{s.count}</b>
                    </div>
                  </div>
                  {a.source === "tradersyard" && (
                    <>
                      <div className="account-stats">
                        <div>
                          <span>Provider daily P&L</span>
                          <b>{money(a.providerDailyPnl, a.currency)}</b>
                        </div>
                        <div>
                          <span>Provider total P&L</span>
                          <b>{money(a.providerTotalPnl, a.currency)}</b>
                        </div>
                      </div>
                      <p className="micro">
                        Imported trade P&L: {money(s.total, a.currency)}.{" "}
                        {Number.isFinite(a.providerClosedPnl) &&
                        Math.abs(s.total - a.providerClosedPnl) > 0.02
                          ? "This differs from provider account P&L; history coverage or provider accounting may differ."
                          : "Matches provider closed P&L within rounding."}
                      </p>
                      <p className="micro">
                        Snapshot:{" "}
                        {a.syncedAt
                          ? new Date(a.syncedAt).toLocaleString()
                          : "Unknown"}
                        . Archived accounts may retain older marks.
                      </p>
                    </>
                  )}
                  {r.rules.map((rule) => (
                    <div className="rule" key={rule.name}>
                      <div>
                        <span>
                          {rule.name}
                          {rule.source === "provider" ? " · Provider" : ""}
                        </span>
                        <b>
                          {rule.value == null
                            ? "Unknown"
                            : rule.unit === "money"
                              ? money(rule.value, a.currency)
                              : num(
                                  rule.value,
                                  rule.unit === "percent" ? 1 : 0,
                                ) + (rule.unit === "percent" ? "%" : "")}
                          {rule.target != null && (
                            <span className="subtle">
                              {" "}
                              /{" "}
                              {rule.unit === "money"
                                ? money(rule.target, a.currency)
                                : rule.target +
                                  (rule.unit === "percent" ? "%" : "")}
                            </span>
                          )}
                        </b>
                      </div>
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${Math.min(100, Math.max(0, ((rule.value || 0) / (rule.target || 1)) * 100))}%`,
                            background: rule.passed
                              ? "var(--accent)"
                              : "var(--purple)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {!r.rules.length && (
                    <p className="subtle">
                      No rule thresholds imported for this account.
                    </p>
                  )}
                  {a.providerRuleStatus && (
                    <RuleDetails value={a.providerRuleStatus}/>
                  )}
                  {a.source === 'manual' && <button className="text-button" onClick={()=>setModal({type:'account',account:a})}>Edit account & rules</button>}
                </div>
              </section>
            );
          })}
      </div>
      {!state.accounts.length && (
        <Empty
          title="Your accounts will appear here"
          text="Each account has its own journal. Select All accounts for a combined view within one currency."
        />
      )}
    </>
  );
}
