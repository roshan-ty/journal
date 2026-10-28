import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayKey } from "../../shared/analytics.mjs";
import { money } from '../components/ui.jsx';
import { TradeTable } from '../components/TradeTable.jsx';

export function Calendar(p) {
  const { s, currency, compact, setPage, filtered, editTrade, timezone } = p;
  const [month, setMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    [selected, setSelected] = useState(null);
  const start = (month.getDay() + 6) % 7,
    count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const map = new Map(s.daily.map((d) => [d.name, d])),
    total = s.daily
      .filter((d) => d.name.startsWith(prefix))
      .reduce((a, d) => a + d.total, 0);
  const shift = (v) => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + v, 1));
    setSelected(null);
  };
  const inner = (
    <>
      <div className="panel-head">
        <div>
          <h2>Trading calendar</h2>
          <p>
            <b className={total >= 0 ? "positive" : "negative"}>
              {money(total, currency)}
            </b>{" "}
            <span> this month</span>
          </p>
        </div>
        <div className="month-control">
          <button aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft size={17} />
          </button>
          <b>
            {month.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </b>
          <button aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
          <div className="week-label" key={d}>
            {d}
          </div>
        ))}
        {Array.from({ length: start }, (_, i) => (
          <div className="calendar-day outside" key={`blank${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const key = `${prefix}-${String(i + 1).padStart(2, "0")}`,
            d = map.get(key);
          return (
            <button
              key={key}
              className={`calendar-day ${d ? (d.total > 0 ? "profit-day" : d.total < 0 ? "loss-day" : "flat-day") : ""} ${selected === key ? "selected-day" : ""}`}
              onClick={() => {
                if (compact) setPage("Calendar");
                else setSelected(key);
              }}
            >
              <span>{i + 1}</span>
              {d ? (
                <>
                  <b>{money(d.total, currency)}</b>
                  <small>
                    {d.count} trade{d.count === 1 ? "" : "s"}
                  </small>
                </>
              ) : (
                <small className="no-trades">—</small>
              )}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>
          <i className="green-dot" />
          Profitable day
        </span>
        <span>
          <i className="red-dot" />
          Losing day
        </span>
        <span>Net of recorded fees</span>
      </div>
    </>
  );
  return compact ? (
    inner
  ) : (
    <>
      <section className="panel">{inner}</section>
      {selected && (
        <section className="panel">
          <div className="panel-head">
            <h2>{selected} · Session detail</h2>
          </div>
          <TradeTable
            {...p}
            rows={filtered.filter(
              (t) => dayKey(t.closedAt || t.openedAt, timezone) === selected,
            )}
          />
        </section>
      )}
    </>
  );
}
