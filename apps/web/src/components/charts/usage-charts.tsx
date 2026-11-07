"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

const axisStyle = {
  fontSize: 9,
  fill: "var(--foreground-muted)",
  fontFamily: "var(--font-mono)",
};

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  formatter?: (value: number, name?: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-elevated px-2.5 py-2 shadow-[var(--shadow-md)]">
      {label ? <p className="mb-1 font-mono text-[9px] text-foreground-muted">{label}</p> : null}
      <div className="space-y-0.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-3 text-[10.5px]">
            <span className="flex items-center gap-1.5 text-foreground-secondary">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: entry.color ?? "var(--primary)" }}
              />
              {entry.name}
            </span>
            <span className="font-mono text-foreground">
              {formatter && typeof entry.value === "number"
                ? formatter(entry.value, entry.name)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartFrame({
  title,
  description,
  actions,
  children,
  className,
  height = 220,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border-subtle px-4 py-3">
        <div>
          <h2 className="type-h4 text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[11px] text-foreground-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
      </div>
      <div className="p-3" style={{ height }}>
        {children}
      </div>
    </section>
  );
}

export type SeriesPoint = {
  label: string;
  tokens?: number;
  cost?: number;
  requests?: number;
  [key: string]: string | number | undefined;
};

export function UsageAreaChart({
  data,
  formatter,
}: {
  data: SeriesPoint[];
  formatter?: (value: number, name?: string) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="usage-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="requests-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--secondary)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={44} />
        <Tooltip content={<ChartTooltip formatter={formatter} />} cursor={{ stroke: "var(--border-strong)" }} />
        <Area
          type="monotone"
          dataKey="tokens"
          name="Tokens"
          stroke="var(--primary)"
          strokeWidth={1.6}
          fill="url(#usage-fill)"
        />
        <Area
          type="monotone"
          dataKey="requests"
          name="Requests"
          stroke="var(--secondary)"
          strokeWidth={1.4}
          fill="url(#requests-fill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CostBarChart({
  data,
  formatter,
}: {
  data: { label: string; value: number }[];
  formatter?: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          content={<ChartTooltip formatter={(value) => (formatter ? formatter(value) : String(value))} />}
          cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
        />
        <Bar dataKey="value" name="Cost" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  centerLabel,
  centerValue,
}: {
  data: { name: string; value: number; color: string }[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="relative h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTooltip />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-mono text-[17px] font-medium text-foreground">
            {centerValue ?? total}
          </p>
          {centerLabel ? (
            <p className="type-eyebrow mt-0.5 text-[8px] text-foreground-muted">{centerLabel}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function TelemetryAreaChart({
  data,
}: {
  data: { label: string; cpu: number; memory: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="cpu-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--secondary)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="memory-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} width={32} />
        <Tooltip content={<ChartTooltip formatter={(value) => `${value.toFixed(0)}%`} />} />
        <Area
          type="monotone"
          dataKey="cpu"
          name="CPU"
          stroke="var(--secondary)"
          strokeWidth={1.6}
          fill="url(#cpu-fill)"
        />
        <Area
          type="monotone"
          dataKey="memory"
          name="Memory"
          stroke="var(--primary)"
          strokeWidth={1.6}
          fill="url(#memory-fill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export type PricePoint = {
  label: string;
  price: number;
};

export function PriceAreaChart({
  data,
  tone = "success",
}: {
  data: PricePoint[];
  tone?: "success" | "error" | "primary";
}) {
  const stroke =
    tone === "error"
      ? "var(--error)"
      : tone === "primary"
        ? "var(--primary)"
        : "var(--success)";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id={`price-fill-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={28} />
        <YAxis
          tick={axisStyle}
          axisLine={false}
          tickLine={false}
          width={58}
          domain={["auto", "auto"]}
          tickFormatter={(value: number) =>
            value >= 1000
              ? `${(value / 1000).toFixed(1)}k`
              : value >= 1
                ? value.toFixed(0)
                : value.toFixed(3)
          }
        />
        <Tooltip
          content={
            <ChartTooltip
              formatter={(value) =>
                value >= 1
                  ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  : `$${value.toFixed(4)}`
              }
            />
          }
        />
        <Area
          type="monotone"
          dataKey="price"
          name="Price"
          stroke={stroke}
          strokeWidth={1.7}
          fill={`url(#price-fill-${tone})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SparklineChart({
  values,
  positive = true,
  width = 96,
  height = 28,
}: {
  values: number[];
  positive?: boolean;
  width?: number;
  height?: number;
}) {
  if (!values.length) {
    return <span className="font-mono text-[9px] text-foreground-muted">—</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = positive ? "var(--success)" : "var(--error)";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden
    >
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}
