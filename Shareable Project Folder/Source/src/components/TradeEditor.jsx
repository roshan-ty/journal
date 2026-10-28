import React, { useState } from "react";
import { net } from "../../shared/analytics.mjs";
import { validateTrade, uid } from "../../shared/model.mjs";
import { money, Modal } from '../components/ui.jsx';

export function TradeEditor({
  state,
  commit,
  trade,
  onClose,
  account,
  setToast,
  currency,
}) {
  const [t, setT] = useState(() =>
    trade
      ? { ...trade, tagsText: (trade.tags || []).join(", ") }
      : {
          id: uid(),
          accountId: account === "all" ? state.accounts[0]?.id : account,
          symbol: "",
          side: "long",
          status: "closed",
          quantity: 1,
          entryPrice: 0,
          exitPrice: 0,
          grossPnl: 0,
          fees: 0,
          initialRisk: 0,
          openedAt: new Date().toISOString(),
          closedAt: new Date().toISOString(),
          notes: "",
          strategy: "",
          tagsText: "",
          rating: 0,
          reviewed: false,
          source: "manual",
          attachments: [],
        },
  );
  const [error, setError] = useState("");
  const tradeCurrency = state.accounts.find(a => a.id === t.accountId)?.currency || currency;
  const set = (k, v) => setT((x) => ({ ...x, [k]: v }));
  const provider = trade?.source === "tradersyard";
  const save = async (e) => {
    e.preventDefault();
    try {
      const valid = validateTrade(
        {
          ...t,
          tags: t.tagsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          closedAt: t.status === "open" ? null : t.closedAt,
        },
        state.accounts,
      );
      delete valid.tagsText;
      const next = {
        ...state,
        trades: trade
          ? state.trades.map((x) => (x.id === t.id ? valid : x))
          : [...state.trades, valid],
      };
      if (await commit(next)) {
        setToast("Trade saved");
        onClose();
      }
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <Modal
      title={trade ? `${trade.symbol} · Trade review` : "Add a trade"}
      onClose={onClose}
      wide
    >
      <form onSubmit={save}>
        {!state.accounts.length && (
          <div className="notice">
            Create an account in Accounts before adding a trade.
          </div>
        )}
        {provider && (
          <div className="notice">
            Execution fields come from TradersYard. Notes, tags, risk and review
            status belong to your journal.
          </div>
        )}
        <div className="form-grid">
          <label>
            Account
            <select
              value={t.accountId || ""}
              disabled={provider}
              onChange={(e) => set("accountId", e.target.value)}
              required
            >
              <option value="" disabled>
                Select account
              </option>
              {state.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Symbol
            <input
              value={t.symbol}
              disabled={provider}
              onChange={(e) => set("symbol", e.target.value)}
              required
              placeholder="EURUSD / NQ / ES"
            />
          </label>
          <label>
            Direction
            <select
              value={t.side}
              disabled={provider}
              onChange={(e) => set("side", e.target.value)}
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </label>
          <label>
            Status
            <select
              value={t.status}
              disabled={provider}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="closed">Closed</option>
              <option value="open">Open</option>
            </select>
          </label>
          {[
            ["quantity", "Quantity"],
            ["entryPrice", "Entry price"],
            ["exitPrice", "Exit price"],
            ["grossPnl", `Gross P&L (${tradeCurrency})`],
            ["fees", "Fees (positive cost)"],
            ["initialRisk", "Initial planned risk"],
          ].map(([k, n]) => (
            <label key={k}>
              {n}
              <input
                type="number"
                step="any"
                required
                value={t[k] ?? 0}
                disabled={provider && k !== "initialRisk"}
                onChange={(e) => set(k, e.target.value)}
              />
            </label>
          ))}
          <label>
            Entry time (ISO, with timezone)
            <input
              required
              value={t.openedAt}
              disabled={provider}
              onChange={(e) => set("openedAt", e.target.value)}
            />
          </label>
          <label>
            Exit time (ISO, with timezone)
            <input
              required={t.status === "closed"}
              disabled={provider || t.status === "open"}
              value={t.closedAt || ""}
              onChange={(e) => set("closedAt", e.target.value)}
            />
          </label>
          <label>
            Strategy
            <select
              value={t.strategy || ""}
              onChange={(e) => set("strategy", e.target.value)}
            >
              <option value="">Unassigned</option>
              {state.playbooks.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            Tags (comma separated)
            <input
              value={t.tagsText}
              onChange={(e) => set("tagsText", e.target.value)}
              placeholder="Focused, FOMO, A+ setup"
            />
          </label>
          <label>
            Execution rating
            <select
              value={t.rating || 0}
              onChange={(e) => set("rating", Number(e.target.value))}
            >
              <option value="0">Not rated</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={t.reviewed || false}
              onChange={(e) => set("reviewed", e.target.checked)}
            />
            Mark as reviewed
          </label>
        </div>
        <label className="field">
          Trade notes
          <textarea
            rows={5}
            value={t.notes || ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="What did you see? Did you follow your plan? What would you repeat?"
          />
        </label>
        <label className="field">
          Chart screenshots (PNG/JPEG/WebP, up to 2 MB each)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={async (e) => {
              try {
                const images = await Promise.all(
                  [...e.target.files].map((f) => {
                    if (
                      f.size > 2e6 ||
                      !["image/png", "image/jpeg", "image/webp"].includes(
                        f.type,
                      )
                    )
                      throw Error("Use PNG, JPEG or WebP under 2 MB.");
                    return new Promise((resolve, reject) => {
                      const r = new FileReader();
                      r.onload = () =>
                        resolve({ name: f.name, data: r.result });
                      r.onerror = reject;
                      r.readAsDataURL(f);
                    });
                  }),
                );
                set("attachments", [...(t.attachments || []), ...images]);
              } catch (e) {
                setError(e.message);
              }
            }}
          />
        </label>
        <div className="attachments">
          {(t.attachments || []).map((a, i) => (
            <div key={i}>
              <img src={a.data} alt={a.name} />
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  set(
                    "attachments",
                    t.attachments.filter((_, j) => i !== j),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <span className="subtle">Net result: {money(net(t), tradeCurrency)}</span>
          <button className="button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={!state.accounts.length}>
            Save trade
          </button>
        </div>
      </form>
    </Modal>
  );
}
