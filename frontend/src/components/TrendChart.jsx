import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { sliceHistory } from "../format";

export default function TrendChart({ history, metric, range }) {
  const source = history?.[metric] || [];
  const data = sliceHistory(source, range);
  const color = metric === "spo2" ? "#16a34a" : metric === "temp" ? "#7c3aed" : "#2563eb";
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--track)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} minTickGap={24} />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} width={36} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--text)" }} />
          <Area type="monotone" dataKey="v" stroke={color} fill="url(#fill)" strokeWidth={2.5} name={metric === "bp" ? "Systolic" : "Value"} />
          {metric === "bp" ? <Line type="monotone" dataKey="dia" stroke="#94a3b8" strokeWidth={2} dot={false} name="Diastolic" /> : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
