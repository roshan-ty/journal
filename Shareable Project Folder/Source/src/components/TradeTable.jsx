import { CheckCheck } from "lucide-react";
import { net } from "../../shared/analytics.mjs";
import { money, num, Badge, Empty } from '../components/ui.jsx';

export function TradeTable({ rows, currency, timezone, editTrade, state }) {
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Entry time</th>
            <th>Account</th>
            <th>Side</th>
            <th>Size</th>
            <th>Net P&L</th>
            <th>R multiple</th>
            <th>Strategy</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr
              key={t.id}
              onClick={() => editTrade(t)}
              onKeyDown={(e) => e.key === "Enter" && editTrade(t)}
              tabIndex={0}
              aria-label={`Review ${t.symbol} trade`}
            >
              <td>
                <div className="instrument">
                  <span>{t.symbol.slice(0, 2)}</span>
                  <b>{t.symbol}</b>
                </div>
              </td>
              <td>
                {new Date(t.openedAt).toLocaleString("en-GB", {
                  timeZone: timezone,
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="mono">
                {state.accounts.find((a) => a.id === t.accountId)?.number}
              </td>
              <td>
                <Badge tone={t.side === "long" ? "lime" : "purple"}>
                  {t.side === "long" ? "↗ Long" : "↘ Short"}
                </Badge>
              </td>
              <td>{t.quantity}</td>
              <td
                className={
                  t.status === "open"
                    ? ""
                    : net(t) >= 0
                      ? "positive"
                      : "negative"
                }
              >
                <b>
                  {t.status === "open"
                    ? money(t.unrealizedPnl, currency)
                    : money(net(t), currency)}
                </b>
                {t.status === "open" && (
                  <small className="block">Open · last mark</small>
                )}
              </td>
              <td>
                {t.initialRisk && t.status === "closed"
                  ? `${num(net(t) / t.initialRisk)}R`
                  : "—"}
              </td>
              <td>{t.strategy || "—"}</td>
              <td>
                {t.reviewed ? (
                  <span className="reviewed">
                    <CheckCheck size={15} />
                    Reviewed
                  </span>
                ) : (
                  <span className="pending">To review</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
