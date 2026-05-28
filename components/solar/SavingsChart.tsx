"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface Props {
  monthlySavings: number[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-4 py-3 rounded-xl text-sm"
      style={{ background: "#0c1525", border: "1px solid rgba(14,165,233,0.25)", color: "#e8f0fe" }}
    >
      <div className="font-semibold mb-0.5">{label}</div>
      <div className="text-sky-400 font-bold">${payload[0].value}</div>
      <div className="text-slate-400 text-xs">estimated savings</div>
    </div>
  );
}

export default function SavingsChart({ monthlySavings }: Props) {
  const data = MONTHS.map((month, i) => ({ month, savings: monthlySavings[i] ?? 0 }));
  const max = Math.max(...monthlySavings);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: "#64748b", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v}`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(14,165,233,0.06)" }} />
        <Bar dataKey="savings" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.savings >= max * 0.85 ? "#0ea5e9" : entry.savings >= max * 0.6 ? "#0284c7" : "#0c4a6e"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
