import React, { useState } from "react";
import { Download, Upload } from "lucide-react";
import { mergeSnapshot } from "../../shared/model.mjs";
import { parseTradeCSV } from "../../shared/import.mjs";
import { download, Modal } from '../components/ui.jsx';

export function ImportModal({ state, commit, onClose, setToast, account }) {
  const [target, setTarget] = useState(
      state.accounts.find(a => a.id === account && a.source !== 'tradersyard')?.id ||
        state.accounts.find(a => a.source !== 'tradersyard')?.id || "",
    ),
    [parsed, setParsed] = useState(null),
    [error, setError] = useState("");
  return (
    <Modal title="Import your trade history" onClose={onClose} wide>
      <p className="subtle">
        Import CSV with one row per closed trade or open position. Review the
        preview before importing. Repeated trade IDs update existing trades in
        this account.
      </p>
      <label className="field">
        Destination account
        <select
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setParsed(null);
          }}
        >
          <option value="">Select an account</option>
          {state.accounts
            .filter((a) => a.source !== "tradersyard")
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.number}
              </option>
            ))}
        </select>
      </label>
      <p className="subtle">
        Use a manual account for CSV files to keep provider sync separate.
      </p>
      <button
        className="button small"
        onClick={() =>
          download(
            "trade_id,symbol,side,quantity,entry_price,exit_price,opened_at,closed_at,gross_pnl,fees,initial_risk,strategy,notes\nexample-1,ES,long,1,6000,6004,2026-10-26T13:30:00Z,2026-10-26T13:45:00Z,200,4.2,100,Opening range breakout,Example only\n",
            "trade-import-template.csv",
            "text/csv",
          )
        }
      >
        <Download size={15} />
        Download CSV template
      </button>
      <label className="upload-zone">
        <Upload size={28} />
        <b>Select a trade CSV</b>
        <span>ISO timestamps must include Z or a timezone offset.</span>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={!target}
          onChange={async (e) => {
            try {
              const file = e.target.files[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > 20e6) throw Error("CSV limit is 20 MB.");
              setParsed(
                parseTradeCSV(await file.text(), target, state.accounts),
              );
              setError("");
            } catch (e) {
              setError(e.message);
            }
          }}
        />
      </label>
      {parsed && (
        <>
          <div className="notice">
            {parsed.trades.length} valid rows · {parsed.rejected.length}{" "}
            rejected ·{" "}
            {
              parsed.trades.filter((t) =>
                state.trades.some((x) => x.id === t.id),
              ).length
            }{" "}
            existing trade IDs
          </div>
          {parsed.rejected.slice(0, 10).map((r) => (
            <p className="form-error" key={r.row}>
              Row {r.row}: {r.error}
            </p>
          ))}
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Direction</th>
                <th>Gross P&L</th>
                <th>Fees</th>
              </tr>
            </thead>
            <tbody>
              {parsed.trades.slice(0, 5).map((t, i) => (
                <tr key={i}>
                  <td>{t.symbol}</td>
                  <td>{t.side}</td>
                  <td>{t.grossPnl}</td>
                  <td>{t.fees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!parsed?.trades.length}
          onClick={async () => {
            const result = mergeSnapshot(state, {
              accounts: [],
              trades: parsed.trades,
            });
            result.state.sync = state.sync;
            if (await commit(result.state)) {
              setToast(
                `${result.added} new trades imported; ${result.updated} updated`,
              );
              onClose();
            }
          }}
        >
          Import valid rows
        </button>
      </div>
    </Modal>
  );
}
