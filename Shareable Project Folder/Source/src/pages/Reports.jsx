import React, { useState } from "react";
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell, ReferenceLine } from "recharts";
import { groupBy } from "../../shared/analytics.mjs";
import { money, num, Empty } from '../components/ui.jsx';
import { Metric, Chart } from '../components/charts.jsx';

export function Reports(p) {
  const [by, setBy] = useState("symbol");
  const { filtered, timezone, s, currency } = p;
  const groups = groupBy(
    filtered,
    by === "weekday"
      ? (t) =>
          new Date(t.closedAt).toLocaleDateString("en-US", {
            weekday: "long",
            timeZone: timezone,
          })
      : by === "hour"
        ? (t) =>
            new Date(t.openedAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              timeZone: timezone,
            })
        : by,
    timezone,
  ).sort((a, b) => b.total - a.total);
  return (
    <>
      <div className="metrics">
        <Metric
          label="Largest drawdown"
          value={money(s.maxDrawdown, currency)}
          sub="Closed-trade equity only"
        />
        <Metric
          label="Best trade"
          value={money(s.best, currency)}
          sub="Net of fees"
          tone="positive"
        />
        <Metric
          label="Worst trade"
          value={money(s.worst, currency)}
          sub="Net of fees"
          tone="negative"
        />
        <Metric
          label="Recorded fees"
          value={money(s.fees, currency)}
          sub={`${s.winStreak} best win streak · ${s.lossStreak} loss streak`}
        />
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Find your edge</h2>
          <select
            aria-label="Report grouping"
            value={by}
            onChange={(e) => setBy(e.target.value)}
          >
            <option value="symbol">By instrument</option>
            <option value="strategy">By strategy</option>
            <option value="side">By direction</option>
            <option value="weekday">By day of week</option>
            <option value="hour">By entry hour</option>
          </select>
        </div>
        {groups.length ? (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={groups} margin={{ left: 20, right: 25 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                />
                <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    color: "var(--text)",
                  }}
                />
                <ReferenceLine y={0} stroke="var(--muted)" />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={70}>
                  {groups.map((g) => (
                    <Cell
                      key={g.name}
                      fill={
                        g.total >= 0 ? "var(--positive)" : "var(--negative)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="table-scroll"><table>
              <thead>
                <tr>
                  <th>{by}</th>
                  <th>Trades</th>
                  <th>Net P&L</th>
                  <th>Win rate</th>
                  <th>Profit factor</th>
                  <th>Expectancy</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.name}>
                    <td>
                      <b>{g.name}</b>
                    </td>
                    <td>{g.count}</td>
                    <td className={g.total >= 0 ? "positive" : "negative"}>
                      {money(g.total, currency)}
                    </td>
                    <td>{num(g.winRate, 1)}%</td>
                    <td>{num(g.profitFactor)}</td>
                    <td>{money(g.expectancy, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </>
        ) : (
          <Empty />
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Drawdown over time</h2>
          <span className="subtle">
            Realized outcomes; excludes intratrade exposure
          </span>
        </div>
        <Chart data={s.curve} type="drawdown" />
      </section>
    </>
  );
}
