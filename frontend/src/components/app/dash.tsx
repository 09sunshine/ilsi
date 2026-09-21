import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export const panelCard = "rounded-2xl border border-border bg-card";

export function KpiCard({
  label,
  action,
  value,
  delta,
  positive = true,
  chart,
}: {
  label: string;
  action?: ReactNode;
  value: string;
  delta: string;
  positive?: boolean;
  chart: ReactNode;
}) {
  return (
    <div className={cn(panelCard, "p-4")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        {action}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl sm:text-2xl xl:text-3xl font-semibold tracking-tight truncate">
            {value}
          </p>
          <span
            className={cn(
              "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold max-w-full truncate",
              positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            <span aria-hidden>{positive ? "▲" : "▼"}</span>
            <span className="truncate">{delta}</span>
          </span>
        </div>
        <div className="h-12 w-20 sm:h-14 sm:w-28 shrink-0">{chart}</div>
      </div>
    </div>
  );
}

export function SparkLine({ data, color }: { data: number[]; color: string }) {
  const safeData = data && data.length > 0 ? data : [0];
  const series =
    safeData.length === 1
      ? [{ i: 0, v: safeData[0] }, { i: 1, v: safeData[0] }]
      : safeData.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          isAnimationActive={false}
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#sg-${color.replace(/\W/g, "")})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SparkBars({
  data,
  highlight,
  color = "var(--chart-1)",
}: {
  data: number[];
  highlight?: number;
  color?: string;
}) {
  const safeData = data && data.length > 0 ? data : [0];
  const series = safeData.map((v, i) => ({ i, v }));
  const active = highlight ?? safeData.length - 1;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={series} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
        <Bar isAnimationActive={false} dataKey="v" radius={3} barSize={8}>
          {series.map((s) => (
            <Cell key={s.i} fill={s.i === active ? color : "var(--muted)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SparkPlain({ data, color }: { data: number[]; color: string }) {
  const safeData = data && data.length > 0 ? data : [0];
  const series =
    safeData.length === 1
      ? [{ i: 0, v: safeData[0] }, { i: 1, v: safeData[0] }]
      : safeData.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={series} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
        <Line isAnimationActive={false} type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StatusPill({ tone, children }: { tone: "success" | "warning" | "muted" | "danger"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold",
        tone === "success" && "bg-success/10 text-success",
        tone === "warning" && "bg-warning/15 text-warning-foreground",
        tone === "danger" && "bg-destructive/10 text-destructive",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function CompletionBar({ value, color = "var(--chart-1)" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full max-w-32 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

export function SectionHeading({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      {right}
    </div>
  );
}
