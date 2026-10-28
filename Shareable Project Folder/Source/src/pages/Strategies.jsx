import React, { useState } from "react";
import { ArrowUpRight, Layers, Plus } from "lucide-react";
import { stats } from "../../shared/analytics.mjs";
import { uid } from "../../shared/model.mjs";
import { money, num, Empty, Modal } from '../components/ui.jsx';

export function Strategies({ state, filtered, timezone, currency, setModal }) {
  return (
    <>
      <div className="section-actions">
        <span className="subtle">
          {state.playbooks.length} strategies in your playbook
        </span>
        <button
          className="button primary"
          onClick={() => setModal({ type: "strategy" })}
        >
          <Plus size={16} />
          New strategy
        </button>
      </div>
      <div className="strategy-grid">
        {state.playbooks.map((p, i) => {
          const s = stats(
            filtered.filter((t) => t.strategy === p.name),
            timezone,
          );
          return (
            <section className="panel strategy-card" key={p.id}>
              <div className="panel-head">
                <div className="strategy-icon" style={{ color: p.color }}>
                  <Layers size={24} />
                </div>
                <button
                  className="text-button"
                  onClick={() => setModal({ type: "strategy", playbook: p })}
                >
                  Edit <ArrowUpRight size={14} />
                </button>
              </div>
              <h2>{p.name}</h2>
              <p>{p.description}</p>
              <div className="strategy-rules">
                {p.rules.map((r, i) => (
                  <div key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {r}
                  </div>
                ))}
              </div>
              <div className="strategy-results">
                <div>
                  <small>NET P&L</small>
                  <b className={s.total >= 0 ? "positive" : "negative"}>
                    {money(s.total, currency)}
                  </b>
                </div>
                <div>
                  <small>WIN RATE</small>
                  <b>{num(s.winRate, 1)}%</b>
                </div>
                <div>
                  <small>TRADES</small>
                  <b>{s.count}</b>
                </div>
              </div>
            </section>
          );
        })}
      </div>
      {!state.playbooks.length && (
        <Empty
          title="Build your first playbook"
          text="Write the conditions that define a valid trade, then link trades to that strategy."
        />
      )}
    </>
  );
}

export function StrategyEditor({ state, commit, playbook, onClose }) {
  const [p, setP] = useState(
      playbook || {
        id: uid(),
        name: "",
        description: "",
        rules: [],
        color: "#b8f277",
      },
    ),
    [rules, setRules] = useState((playbook?.rules || []).join("\n")),
    [error, setError] = useState("");
  return (
    <Modal
      title={playbook ? "Edit strategy" : "Create a strategy"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            state.playbooks.some(
              (x) => x.id !== p.id && x.name === p.name.trim(),
            )
          ) {
            setError("A strategy with this name already exists.");
            return;
          }
          const next = {
            ...p,
            name: p.name.trim(),
            rules: rules
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean),
          };
          if (
            await commit({
              ...state,
              playbooks: [
                ...state.playbooks.filter((x) => x.id !== p.id),
                next,
              ],
              trades: state.trades.map((t) =>
                playbook && t.strategy === playbook.name
                  ? { ...t, strategy: next.name }
                  : t,
              ),
            })
          )
            onClose();
        }}
      >
        <label className="field">
          Name
          <input
            required
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
          />
        </label>
        <label className="field">
          Description
          <textarea
            rows={3}
            value={p.description}
            onChange={(e) => setP({ ...p, description: e.target.value })}
          />
        </label>
        <label className="field">
          Entry rules (one per line)
          <textarea
            required
            rows={6}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button className="button primary">Save strategy</button>
        </div>
      </form>
    </Modal>
  );
}
