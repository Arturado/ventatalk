"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import { MessageSquare, ArrowUpRight } from "lucide-react";

interface FunnelEntry {
  key: string;
  label: string;
  color: string;
  count: number;
}

interface Props {
  chartData: { date: string; conversations: number }[];
  funnelData: FunnelEntry[];
}

export function DashboardCharts({ chartData, funnelData }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

      {/* Line chart */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-5 md:mb-6">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">Conversaciones</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Últimos 30 días</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 px-2.5 py-1 rounded-full">
            <ArrowUpRight className="w-3 h-3" />
            Este mes
          </div>
        </div>
        <div className="overflow-x-auto -mx-1">
          <div className="min-w-[280px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8", fontFamily: "Plus Jakarta Sans" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8", fontFamily: "Plus Jakarta Sans" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontFamily: "Plus Jakarta Sans", fontSize: 12, borderRadius: 10, border: "1px solid #E2E8F0", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} cursor={{ stroke: "#E2E8F0", strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="conversations" stroke="#2563EB" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: "#2563EB" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 gap-2">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <p className="text-sm font-medium">Sin datos aún</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Funnel bar chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5 md:p-6">
        <div className="mb-5 md:mb-6">
          <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">Pipeline de leads</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Por etapa</p>
        </div>
        <div className="overflow-x-auto -mx-1">
          <div className="min-w-[240px]">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={funnelData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94A3B8", fontFamily: "Plus Jakarta Sans" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#94A3B8", fontFamily: "Plus Jakarta Sans" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontFamily: "Plus Jakarta Sans", fontSize: 12, borderRadius: 10, border: "1px solid #E2E8F0", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }} cursor={{ fill: "#F8FAFC" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {funnelData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
