import React, { useState, useMemo } from "react";
import { Download } from "lucide-react";
import { net } from "../../shared/analytics.mjs";
import { exportTradesCSV } from "../../shared/import.mjs";
import { download } from '../components/ui.jsx';
import { TradeTable } from '../components/TradeTable.jsx';

export function TradeJournal(p) {
  const [status, setStatus] = useState(""),
    [sort, setSort] = useState("new"),
    [limit, setLimit] = useState(50);
  const rows = useMemo(() => p.filtered
    .filter((t) => !status || t.status === status)
    .sort((a, b) =>
      sort === "pnl"
        ? net(b) - net(a)
        : new Date(b.openedAt) - new Date(a.openedAt),
    ), [p.filtered,status,sort]);
  return (
    <section className="panel">
      <div className="panel-head">
        <div className="segmented">
          {[
            ["", "All trades"],
            ["open", "Open positions"],
            ["closed", "Closed trades"],
          ].map(([v, n]) => (
            <button
              key={v}
              className={status === v ? "active" : ""}
              onClick={() => setStatus(v)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="row">
          <select
            aria-label="Sort trades"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="new">Newest first</option>
            <option value="pnl">Highest P&L</option>
          </select>
          <button
            className="button small"
            onClick={() =>
              download(
                exportTradesCSV(rows),
                "tradersyard-trades.csv",
                "text/csv",
              )
            }
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>
      <TradeTable {...p} rows={rows.slice(0, limit)} />
      <div className="table-foot">
        <span>
          {Math.min(limit, rows.length)} of {rows.length} trades
        </span>
        {rows.length > limit && (
          <button className="text-button" onClick={() => setLimit(limit + 50)}>
            Show more
          </button>
        )}
        <span>Click a trade to review details and notes</span>
      </div>
    </section>
  );
}
