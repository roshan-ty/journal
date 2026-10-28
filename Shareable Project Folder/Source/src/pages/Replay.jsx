import React, { useState, useEffect } from "react";
import { Play, Download, Upload, Pause, SkipForward } from "lucide-react";
import { stats } from "../../shared/analytics.mjs";
import { uid } from "../../shared/model.mjs";
import { exportTradesCSV, parseCandles } from "../../shared/import.mjs";
import { closeSimulation, movingAverageBacktest } from "../../shared/backtest.mjs";
import { money, num, download, Badge, Empty } from '../components/ui.jsx';
import { CandleChart } from '../components/charts.jsx';

export function Replay({ state, commit, currency, timezone, setToast }) {
  const [candles, setCandles] = useState(state.candles || []),
    [cursor, setCursor] = useState(1),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(500),
    [symbol, setSymbol] = useState("ES"),
    [multiplier, setMultiplier] = useState(50),
    [qty, setQty] = useState(1),
    [fees, setFees] = useState(2.1),
    [position, setPosition] = useState(null),
    [trades, setTrades] = useState([]),
    [sessionId, setSessionId] = useState(uid),
    [error, setError] = useState("");
  const candle = candles[cursor - 1],
    ss = stats(trades, timezone);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setCursor((c) => {
          if (c >= candles.length) {
            setPlaying(false);
            return c;
          }
          return c + 1;
        }),
      speed,
    );
    return () => clearInterval(timer);
  }, [playing, speed, candles.length]);
  const open = (side) => {
    if (position || !candle || !(qty > 0 && multiplier > 0)) return;
    setPosition({
      id: uid(),
      symbol,
      side,
      quantity: Number(qty),
      entryPrice: candle.close,
      openedAt: candle.time,
    });
  };
  const close = () => {
    try {
      const t = closeSimulation(
        position,
        candle,
        Number(multiplier),
        Number(fees),
      );
      setTrades([...trades, t]);
      setPosition(null);
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Replay studio</h2>
            <p>
              Imported OHLC candles · Simulation results stay separate from real
              trades
            </p>
          </div>
          <label className="button">
            <Upload size={16} />
            Import price CSV
            <input
              className="hidden-input"
              type="file"
              accept=".csv"
              onChange={async (e) => {
                try {
                  if (position || trades.length)
                    throw Error(
                      "Start a new session before replacing candles.",
                    );
                  const f = e.target.files[0];
                  e.target.value = '';
                  if (!f) return;
                  if (f.size > 20e6) throw Error("Price CSV limit is 20 MB.");
                  const c = parseCandles(await f.text());
                  if (!c.length) throw Error("The CSV has no candles.");
                  setCandles(c);
                  setCursor(1);
                  setPlaying(false);
                  await commit({ ...state, candles: c });
                  setError("");
                } catch (e) {
                  setError(e.message);
                }
              }}
            />
          </label>
        </div>
        {!candles.length ? (
          <Empty
            title="Bring your market data"
            text="Import a CSV with time, open, high, low, close and volume. Use ISO timestamps with a timezone. A live feed, tick history and Level 2 data are not bundled."
            action={
              <button
                className="button"
                onClick={() =>
                  download(
                    "time,open,high,low,close,volume\n2026-10-26T13:30:00Z,6000,6002,5999,6001,100\n2026-10-26T13:31:00Z,6001,6005,6000,6004,120\n",
                    "ohlc-format-example.csv",
                    "text/csv",
                  )
                }
              >
                Download format example
              </button>
            }
          />
        ) : (
          <>
            <div className="replay-meta">
              <b>{symbol}</b>
              <Badge>HISTORICAL SIMULATION</Badge>
              <span>
                {cursor} / {candles.length} candles
              </span>
              <b>{candle?.close}</b>
            </div>
            <CandleChart
              candles={candles.slice(0, cursor)}
              position={position}
            />
            <div className="replay-controls">
              <button
                className="button"
                disabled={cursor >= candles.length}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
                {playing ? "Pause" : "Play"}
              </button>
              <button
                className="button"
                disabled={cursor >= candles.length}
                onClick={() => setCursor(Math.min(candles.length, cursor + 1))}
              >
                <SkipForward size={16} />
                Next candle
              </button>
              <select
                aria-label="Playback speed"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value={1000}>1× speed</option>
                <option value={500}>2× speed</option>
                <option value={200}>5× speed</option>
              </select>
              <span className="subtle">{candle.time}</span>
            </div>
            <div className="simulation-form">
              <label>
                Symbol
                <input
                  value={symbol}
                  disabled={!!position}
                  onChange={(e) => setSymbol(e.target.value)}
                />
              </label>
              <label>
                Point value
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  disabled={!!position}
                  value={multiplier}
                  onChange={(e) => setMultiplier(Number(e.target.value))}
                />
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={qty}
                  disabled={!!position}
                  onChange={(e) => setQty(Number(e.target.value))}
                />
              </label>
              <label>
                Fee / side / unit
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={fees}
                  disabled={!!position}
                  onChange={(e) => setFees(Number(e.target.value))}
                />
              </label>
              <button
                className="button primary"
                disabled={!!position}
                onClick={() => open("long")}
              >
                Simulate long
              </button>
              <button
                className="button"
                disabled={!!position}
                onClick={() => open("short")}
              >
                Simulate short
              </button>
              <button className="button" disabled={!position} onClick={close}>
                Close position
              </button>
            </div>
            {position && (
              <div className="notice">
                Open {position.side} · {position.quantity} {symbol} · Entry{" "}
                {position.entryPrice} · Marked P&L{" "}
                {money(
                  closeSimulation(position, candle, multiplier, fees).grossPnl,
                  currency,
                )}{" "}
                before fees
              </div>
            )}
            <div className="table-foot">
              <span>
                Session net P&L:{" "}
                <b className={ss.total >= 0 ? "positive" : "negative"}>
                  {money(ss.total, currency)}
                </b>{" "}
                · {ss.count} closed trades
              </span>
              <button
                className="button small"
                disabled={!trades.length || !!position}
                onClick={async () => {
                  if (
                    await commit({
                      ...state,
                      backtests: [
                        ...state.backtests.filter((b) => b.id !== sessionId),
                        {
                          id: sessionId,
                          symbol,
                          createdAt: new Date().toISOString(),
                          trades,
                          multiplier,
                          fees,
                        },
                      ],
                    })
                  )
                    setToast("Backtest session saved");
                }}
              >
                Save session
              </button>
              <button
                className="text-button"
                onClick={() => {
                  if (
                    (position || trades.length) &&
                    !window.confirm(
                      "Start a new session? Save your current session first to keep it.",
                    )
                  )
                    return;
                  setPosition(null);
                  setTrades([]);
                  setCursor(1);
                  setPlaying(false);
                  setSessionId(uid());
                }}
              >
                New session
              </button>
            </div>
          </>
        )}
        {error && <p className="form-error padded">{error}</p>}
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Scripted strategy test</h2>
            <p>
              9 / 21 moving-average crossover · Signals at bar close, fills at
              the next bar’s open
            </p>
          </div>
          <button
            className="button"
            disabled={candles.length < 23}
            onClick={async () => {
              try {
                const rows = movingAverageBacktest(candles, {
                  multiplier,
                  fees,
                }).map((t) => ({ ...t, symbol }));
                await commit({
                  ...state,
                  backtests: [
                    ...state.backtests,
                    {
                      id: uid(),
                      symbol,
                      createdAt: new Date().toISOString(),
                      name: "MA 9 / 21 crossover",
                      trades: rows,
                      multiplier,
                      fees,
                    },
                  ],
                });
                setToast("Scripted test saved");
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Run test <Play size={15} />
          </button>
        </div>
        <p className="padded subtle">
          Uses the full imported dataset. No slippage, spread, liquidity
          constraints or intrabar order fills are modeled. This is a basic test
          engine, not evidence of future performance.
        </p>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Saved backtest sessions</h2>
        </div>
        {state.backtests.length ? (
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Trades</th>
                <th>Net P&L</th>
                <th>Win rate</th>
                <th>Export</th>
              </tr>
            </thead>
            <tbody>
              {state.backtests.map((b) => {
                const s = stats(b.trades, timezone);
                return (
                  <tr key={b.id}>
                    <td>
                      {b.name || b.symbol} ·{" "}
                      {new Date(b.createdAt).toLocaleDateString()}
                    </td>
                    <td>{s.count}</td>
                    <td className={s.total >= 0 ? "positive" : "negative"}>
                      {money(s.total, currency)}
                    </td>
                    <td>{num(s.winRate, 1)}%</td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() =>
                          download(
                            exportTradesCSV(b.trades),
                            `backtest-${b.id}.csv`,
                            "text/csv",
                          )
                        }
                      >
                        <Download size={15} />
                        CSV
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty
            title="No saved sessions"
            text="Import your candles, simulate trades, then save the session."
          />
        )}
      </section>
    </>
  );
}
