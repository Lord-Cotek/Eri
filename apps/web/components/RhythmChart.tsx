"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { RhythmPoint } from "@/lib/queries";

/**
 * Disclosure honesty over time.
 *
 * Two series only: what he owned, and what he let lapse. There is no "clean
 * days" series and there is no trend line — a trend line invites a man to
 * manage the graph rather than tell the truth.
 *
 * Sage means disclosed. Amber means lapsed. Those are the only two colours
 * here, and both mean exactly what they mean everywhere else in the product.
 */
export function RhythmChart({ data }: { data: RhythmPoint[] }) {
  const hasAnything = data.some((point) => point.events > 0);

  if (!hasAnything) {
    return (
      <div className="flex h-56 items-center justify-center border border-border bg-bg text-sm text-muted">
        Nothing recorded in the last thirty days.
      </div>
    );
  }

  return (
    <div className="h-56 w-full border border-border bg-bg p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval={4}
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgb(var(--steel-rgb) / 0.06)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 2,
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
            labelStyle={{ color: "var(--ink)" }}
          />
          <Bar dataKey="disclosed" name="Told him himself" stackId="a" fill="var(--sage)" />
          <Bar dataKey="lapsed" name="Window lapsed" stackId="a" fill="var(--amber)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
