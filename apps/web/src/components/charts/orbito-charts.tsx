"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const axisTick = { fontSize: 10, fill: "var(--chart-axis, rgba(245,243,255,0.72))" };
const gridStroke = "var(--chart-grid, rgba(255,255,255,0.1))";

export function OrbitoAreaChart({
  data,
  config,
  xKey = "label",
  className,
  height = 220,
  stacked = false,
}: {
  data: Array<Record<string, unknown>>;
  config: ChartConfig;
  xKey?: string;
  className?: string;
  height?: number;
  stacked?: boolean;
}) {
  const keys = Object.keys(config);
  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height }}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
        <defs>
          {keys.map((key) => (
            <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.35} />
              <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.03} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={axisTick} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} tick={axisTick} width={36} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        {keys.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {keys.map((key) => (
          <Area
            key={key}
            dataKey={key}
            type="monotone"
            fill={`url(#fill-${key})`}
            stroke={`var(--color-${key})`}
            strokeWidth={1.8}
            stackId={stacked ? "a" : undefined}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}

export function OrbitoLineChart({
  data,
  config,
  xKey = "label",
  className,
  height = 220,
}: {
  data: Array<Record<string, unknown>>;
  config: ChartConfig;
  xKey?: string;
  className?: string;
  height?: number;
}) {
  const keys = Object.keys(config);
  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height }}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={axisTick} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} tick={axisTick} width={36} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
        {keys.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {keys.map((key) => (
          <Line
            key={key}
            dataKey={key}
            type="monotone"
            stroke={`var(--color-${key})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

export function OrbitoBarChart({
  data,
  config,
  xKey = "label",
  className,
  height = 220,
  horizontal = false,
}: {
  data: Array<Record<string, unknown>>;
  config: ChartConfig;
  xKey?: string;
  className?: string;
  height?: number;
  horizontal?: boolean;
}) {
  const keys = Object.keys(config);
  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height }}>
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        accessibilityLayer
      >
        <CartesianGrid vertical={!horizontal} horizontal={horizontal} stroke={gridStroke} strokeDasharray="3 3" />
        {horizontal ? (
          <>
            <XAxis type="number" tickLine={false} axisLine={false} tick={axisTick} />
            <YAxis dataKey={xKey} type="category" tickLine={false} axisLine={false} tick={axisTick} width={70} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={axisTick} minTickGap={18} />
            <YAxis tickLine={false} axisLine={false} tick={axisTick} width={36} />
          </>
        )}
        <ChartTooltip cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }} content={<ChartTooltipContent />} />
        {keys.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {keys.map((key) => (
          <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={[4, 4, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

export function OrbitoPieChart({
  data,
  config,
  nameKey = "name",
  valueKey = "value",
  className,
  height = 220,
  innerRadius = 0,
}: {
  data: Array<Record<string, unknown>>;
  config: ChartConfig;
  nameKey?: string;
  valueKey?: string;
  className?: string;
  height?: number;
  innerRadius?: number | string;
}) {
  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height }}>
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey={nameKey} />} />
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          innerRadius={innerRadius}
          outerRadius="78%"
          paddingAngle={2}
          stroke="var(--surface)"
          strokeWidth={2}
        >
          {data.map((entry, index) => {
            const key = String(entry[nameKey] ?? index);
            const color = config[key]?.color ?? `var(--chart-${(index % 5) + 1})`;
            return <Cell key={key} fill={color} />;
          })}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey={nameKey} />} />
      </PieChart>
    </ChartContainer>
  );
}

export function OrbitoRadarChart({
  data,
  config,
  angleKey = "metric",
  className,
  height = 260,
}: {
  data: Array<Record<string, unknown>>;
  config: ChartConfig;
  angleKey?: string;
  className?: string;
  height?: number;
}) {
  const keys = Object.keys(config);
  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height }}>
      <RadarChart data={data} accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent />} />
        <PolarGrid stroke={gridStroke} />
        <PolarAngleAxis dataKey={angleKey} tick={axisTick} />
        {keys.map((key) => (
          <Radar
            key={key}
            dataKey={key}
            fill={`var(--color-${key})`}
            fillOpacity={0.22}
            stroke={`var(--color-${key})`}
            strokeWidth={1.8}
          />
        ))}
        {keys.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
      </RadarChart>
    </ChartContainer>
  );
}

export function OrbitoRadialChart({
  data,
  config,
  valueKey = "value",
  nameKey = "name",
  className,
  height = 220,
  innerRadius = 50,
  outerRadius = 100,
}: {
  data: Array<Record<string, unknown>>;
  config: ChartConfig;
  valueKey?: string;
  nameKey?: string;
  className?: string;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
}) {
  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height }}>
      <RadialBarChart
        data={data}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={90}
        endAngle={-270}
        accessibilityLayer
      >
        <ChartTooltip content={<ChartTooltipContent nameKey={nameKey} />} />
        <PolarGrid gridType="circle" stroke={gridStroke} />
        <RadialBar dataKey={valueKey} background={{ fill: "var(--surface-elevated)" }} cornerRadius={6}>
          {data.map((entry, index) => {
            const key = String(entry[nameKey] ?? index);
            const color = config[key]?.color ?? `var(--chart-${(index % 5) + 1})`;
            return <Cell key={key} fill={color} />;
          })}
        </RadialBar>
        <ChartLegend content={<ChartLegendContent nameKey={nameKey} />} />
      </RadialBarChart>
    </ChartContainer>
  );
}

export type { ChartConfig };