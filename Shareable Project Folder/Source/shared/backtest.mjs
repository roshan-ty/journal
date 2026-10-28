import { round } from "./analytics.mjs";
export function closeSimulation(position, candle, multiplier, feePerSide = 0) {
  if (!position || new Date(candle.time) < new Date(position.openedAt))
    throw Error("Cannot close before the position was opened.");
  if (!(multiplier > 0) || feePerSide < 0)
    throw Error("Invalid contract multiplier or fees.");
  const grossPnl = round(
    (candle.close - position.entryPrice) *
      position.quantity *
      multiplier *
      (position.side === "long" ? 1 : -1),
  );
  return {
    ...position,
    status: "closed",
    closedAt: candle.time,
    exitPrice: candle.close,
    grossPnl,
    fees: round(feePerSide * 2 * position.quantity),
    source: "backtest",
  };
}
export function movingAverageBacktest(
  candles,
  { fast = 9, slow = 21, multiplier = 1, fees = 0 } = {},
) {
  if (!(fast >= 2 && slow > fast && candles.length > slow + 1))
    throw Error(
      "Need enough candles and a slow period larger than the fast period.",
    );
  const result = [];
  let position = null,
    previous = null;
  for (let i = slow - 1; i < candles.length - 1; i++) {
    const average = (n) =>
      candles.slice(i - n + 1, i + 1).reduce((s, c) => s + c.close, 0) / n;
    const signal = average(fast) > average(slow);
    const next = { ...candles[i + 1], close: candles[i + 1].open };
    if (previous !== null && signal !== previous) {
      if (position)
        result.push(closeSimulation(position, next, multiplier, fees));
      position = {
        id: `ma-${i}`,
        symbol: "Imported",
        quantity: 1,
        side: signal ? "long" : "short",
        entryPrice: next.close,
        openedAt: next.time,
      };
    }
    previous = signal;
  }
  if (position)
    result.push(closeSimulation(position, candles.at(-1), multiplier, fees));
  return result;
}
