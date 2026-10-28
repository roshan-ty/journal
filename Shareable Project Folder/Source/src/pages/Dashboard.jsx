import {product} from '../product.js';
import React, { useState } from "react";
import { ArrowUpRight, Sparkles, Link2, ArrowRight, Target, TrendingUp, TrendingDown, Activity } from "lucide-react";

import { money, num } from "../components/ui.jsx";
import { Metric, Chart } from '../components/charts.jsx';
import { TradeTable } from '../components/TradeTable.jsx';
import { Calendar } from '../pages/Calendar.jsx';

export function Dashboard(p) {
  const {
    s,
    currency,
    state,
    filtered,
    timezone,
    setPage,
    editTrade,
    connect,
  } = p;
  const [curve, setCurve] = useState("pnl");
  const days = s.daily,
    green = days.filter((d) => d.total > 0).length;
  return (
    <>
      <div className="metrics">
        <Metric
          label="Net P&L"
          value={money(s.total, currency)}
          sub={`${s.count} closed trades`}
          tone={s.total >= 0 ? "positive" : "negative"}
          info="Gross realized P&L minus recorded fees."
        >
          <span className={`mini-trend ${s.total<0?'negative':''}`}>
            {s.total>=0?<TrendingUp size={24}/>:<TrendingDown size={24}/>}
          </span>
        </Metric>
        <Metric
          label="Trade win rate"
          value={`${num(s.winRate, 1)}%`}
          sub={`${s.wins} wins / ${s.losses} losses`}
          info="Winning trades divided by all closed trades, including breakeven trades."
        >
          <div
            className="mini-ring"
            style={{ "--progress": `${s.winRate}%` }}
          />
        </Metric>
        <Metric
          label="Profit factor"
          value={num(s.profitFactor)}
          sub="Gross wins ÷ absolute losses"
          info="Sum of positive net trades divided by the absolute sum of negative net trades."
        >
          <div className="mini-bars">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </Metric>
        <Metric
          label="Trade expectancy"
          value={money(s.expectancy, currency)}
          sub={`${num(s.averageR)}R average · ${s.rCoverage} recorded`}
          info="Average net outcome per closed trade. R needs recorded initial risk."
        >
          <Target size={27} className="muted" />
        </Metric>
      </div>
      <div className="dashboard-grid">
        <section className="panel equity-panel">
          <div className="panel-head">
            <div>
              <h2>Performance overview</h2>
              
            </div>
            <div className="segmented">
              <button
                className={curve === "pnl" ? "active" : ""}
                onClick={() => setCurve("pnl")}
              >
                Net P&L
              </button>
              <button
                className={curve === "drawdown" ? "active" : ""}
                onClick={() => setCurve("drawdown")}
              >
                Drawdown
              </button>
            </div>
          </div>
          <div className="chart-head">
            <strong className={curve === "pnl" && s.total>=0 ? "positive" : "negative"}>
              {money(curve === "pnl" ? s.total : -s.maxDrawdown, currency)}
            </strong>
            <span>
              <span className="legend-dot" />
              {curve === "pnl" ? "Cumulative net P&L" : "Closed-trade drawdown"}
            </span>
          </div>
          <Chart data={s.curve} type={curve} />
        </section>
        <section className="panel snapshot">
          <div className="panel-head">
            <h2>Performance snapshot</h2>
            <Activity size={17} />
          </div>
          <div className="win-donut" style={{ "--progress": `${s.winRate}%` }}>
            <div>
              <small>WIN RATE</small>
              <strong>
                {num(s.winRate, 1)}
                <em>%</em>
              </strong>
              <span>{s.count} closed trades</span>
            </div>
          </div>
          <div className="legend-row">
            <span>
              <i className="green-dot" />
              Wins <b>{s.wins}</b>
            </span>
            <span>
              <i className="red-dot" />
              Losses <b>{s.losses}</b>
            </span>
            <span>
              <i className="gray-dot" />
              B/E <b>{s.breakeven}</b>
            </span>
          </div>
          <div className="snapshot-row">
            <span>Average win</span>
            <b className="positive">{money(s.averageWin, currency)}</b>
          </div>
          <div className="snapshot-row">
            <span>Average loss</span>
            <b className="negative">{money(s.averageLoss, currency)}</b>
          </div>
          <div className="snapshot-row">
            <span>Profitable days</span>
            <b>
              {green} / {days.length}
            </b>
          </div>
        </section>
        {!p.overviewOnly && <><section className="panel calendar-panel">
          <Calendar {...p} compact />
        </section>
        <section className="panel coach-preview">
          <div className="panel-head">
            <h2>
              <Sparkles size={18} />
              {product.coachName}
            </h2>
            
          </div>
          <div className="coach-orb">
            <Sparkles size={27} />
          </div>
          <h3>Review your performance</h3>
          <p>
            {s.count
              ? `${s.count - s.reviewed} trades are waiting for your review. Add context to your decisions and uncover patterns in your process.`
              : "Connect your account and turn your trading history into useful observations."}
          </p>
          <button className="button full" onClick={() => setPage(product.coachName)}>
            Review my performance <ArrowRight size={16} />
          </button>

        </section></>}
      </div>
      {!p.overviewOnly && <section className="panel">
        <div className="panel-head">
          <div>
            <h2>
              Recent trades <span className="count">{filtered.length}</span>
            </h2>
            
          </div>
          <button
            className="text-button"
            onClick={() => setPage("Trade journal")}
          >
            View all trades <ArrowUpRight size={16} />
          </button>
        </div>
        <TradeTable
          {...p}
          rows={[...filtered]
            .sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt))
            .slice(0, 5)}
        />
      </section>}
      {!state.accounts.length && (
        <div className="connect-callout">
          <div>
            <h3>Add your accounts</h3>
            <p>
              Connect TradersYard, create a manual account, or import your
              history.
            </p>
          </div>
          <button className="button primary" onClick={p.canConnect ? connect : ()=>p.setModal({type:'account'})}>
            <Link2 size={16} />
            {p.canConnect ? 'Connect TradersYard' : 'Add account'}
          </button>
        </div>
      )}
    </>
  );
}
