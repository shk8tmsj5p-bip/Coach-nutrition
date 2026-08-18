"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TrendRange } from "@/lib/pesees";

export type TrendPoint = {
  date: string;
  value: number;
  ma7: number;
  ma14: number;
};

function tickDate(iso: string, range: TrendRange) {
  const date = new Date(`${iso}T12:00:00`);
  if (range === "14d") {
    return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
  }
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatValue(value: number, unit: string) {
  const label = value.toFixed(1).replace(".", ",");
  return unit === "%" ? `${label} %` : `${label} ${unit}`;
}

export function TrendChart({
  data,
  color,
  unit,
  range = "all",
}: {
  data: TrendPoint[];
  color: string;
  unit: string;
  range?: TrendRange;
}) {
  if (data.length < 2) {
    return <p className="py-6 text-center text-[13px] text-health-muted">Pas assez de points.</p>;
  }

  const tickGap = range === "14d" ? 18 : range === "1m" ? 24 : 36;

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgb(var(--c-line))" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => tickDate(value, range)}
            tick={{ fontSize: 11, fill: "rgb(var(--c-muted))" }}
            axisLine={false}
            tickLine={false}
            minTickGap={tickGap}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={["auto", "auto"]}
            width={36}
            tick={{ fontSize: 11, fill: "rgb(var(--c-muted))" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => value.toFixed(1).replace(".", ",")}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "none",
              background: "rgb(var(--c-card))",
              color: "rgb(var(--c-ink))",
              boxShadow: "var(--shadow-card)",
              fontSize: 12,
            }}
            labelFormatter={(label) => tickDate(String(label), range)}
            formatter={(value, name) => [
              formatValue(Number(value), unit),
              name === "ma7" ? "Moy. 7 j" : name === "ma14" ? "Moy. 14 j" : "Quotidien",
            ]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#C7C7CC"
            strokeWidth={1.5}
            dot={false}
            name="value"
          />
          <Line
            type="monotone"
            dataKey="ma7"
            stroke={color}
            strokeWidth={2.4}
            dot={false}
            name="ma7"
          />
          <Line
            type="monotone"
            dataKey="ma14"
            stroke={color}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            opacity={0.7}
            name="ma14"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
