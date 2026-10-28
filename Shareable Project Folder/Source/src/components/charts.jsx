import { HelpCircle } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { num, Empty } from '../components/ui.jsx';

export function Metric({ label, value, sub, children, tone, info }) {
  return (
    <article className="metric">
      <div className="metric-label">
        {label}
        <HelpCircle size={13} aria-label={info} title={info} />
      </div>
      <div className={`metric-value ${tone || ""}`}>{value}</div>
      <div className="metric-bottom">
        <span>{sub}</span>
        {children}
      </div>
    </article>
  );
}

export function Chart({ data, type = "pnl", height = 245 }) {
  if (!data.length)
    return (
      <Empty
        title="Your curve starts here"
        text="Closed trades build your performance history."
      />
    );
  const color = type === "drawdown" ? "var(--negative)" : "var(--accent)";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id={`fill-${type}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="var(--line)"
          strokeDasharray="3 5"
        />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "var(--muted)" }}
          axisLine={false}
          tickLine={false}
          minTickGap={40}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--muted)" }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) =>
            Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v
          }
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            color: "var(--text)",
          }}
          formatter={(v) => num(Number(v))}
        />
        <ReferenceLine y={0} stroke="var(--line)" />
        <Area
          type="linear"
          dataKey={type}
          stroke={color}
          strokeWidth={2}
          fill={`url(#fill-${type})`}
          animationDuration={450}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CandleChart({ candles, position }) {
  if (!candles.length) return null;
  const visible = candles.slice(-80),
    min = Math.min(...visible.map((c) => c.low)),
    max = Math.max(...visible.map((c) => c.high)),
    range = max - min || 1,
    w = 900,
    h = 310,
    scale = (v) => 20 + ((max - v) / range) * 250,
    step = 830 / visible.length;
  return (
    <svg
      className="candles"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${visible.length} historical candles through ${visible.at(-1).time}`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line
            x1="15"
            x2="850"
            y1={20 + i * 62.5}
            y2={20 + i * 62.5}
            stroke="var(--line)"
            strokeDasharray="3 5"
          />
          <text x="855" y={24 + i * 62.5} fill="var(--muted)" fontSize="10">
            {(max - (i * range) / 4).toFixed(2)}
          </text>
        </g>
      ))}
      {visible.map((c, i) => {
        const x = 20 + i * step + step / 2,
          col = c.close >= c.open ? "var(--positive)" : "var(--negative)";
        return (
          <g key={c.time}>
            <line
              x1={x}
              x2={x}
              y1={scale(c.high)}
              y2={scale(c.low)}
              stroke={col}
            />
            <rect
              x={x - step * 0.32}
              y={scale(Math.max(c.open, c.close))}
              width={Math.max(1, step * 0.64)}
              height={Math.max(1, Math.abs(scale(c.open) - scale(c.close)))}
              fill={col}
            >
              <title>
                {c.time} O {c.open} H {c.high} L {c.low} C {c.close}
              </title>
            </rect>
          </g>
        );
      })}
      {position && (
        <g>
          <line
            x1="15"
            x2="850"
            y1={scale(position.entryPrice)}
            y2={scale(position.entryPrice)}
            stroke="#b9a7f8"
            strokeDasharray="6 4"
          />
          <text
            x="20"
            y={scale(position.entryPrice) - 7}
            fill="#b9a7f8"
            fontSize="11"
          >
            {position.side.toUpperCase()} ENTRY {position.entryPrice}
          </text>
        </g>
      )}
      <text x="20" y="300" fill="var(--muted)" fontSize="11">
        {visible[0].time}
      </text>
      <text x="620" y="300" fill="var(--muted)" fontSize="11">
        {visible.at(-1).time}
      </text>
    </svg>
  );
}
