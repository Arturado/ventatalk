"use client";
import { useEffect, useState } from "react";
import {
  MessageSquare, Users, TrendingUp, DollarSign,
  Bot, AlertCircle, ArrowUpRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import { analyticsApi } from "@/lib/api";
import { KPICard } from "@/components/dashboard/KPICard";
import { useAuthStore } from "@/lib/store";

interface Overview {
  contacts: { total: number };
  conversations: { active: number; this_month: number; escalation_rate_pct: number };
  ai: { messages_sent: number; cost_usd: number };
  leads: Record<string, number>;
  followups: { sent_this_month: number };
}

const FUNNEL_STAGES = [
  { key: "new",         label: "Nuevos",      color: "#94A3B8" },
  { key: "interested",  label: "Interesados", color: "#3B82F6" },
  { key: "quoted",      label: "Cotizados",   color: "#F59E0B" },
  { key: "closed_won",  label: "Ganados",     color: "#10B981" },
  { key: "closed_lost", label: "Perdidos",    color: "#F87171" },
];

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [chartData, setChartData] = useState<{ date: string; conversations: number }[]>([]);
  const { business } = useAuthStore();

  useEffect(() => {
    analyticsApi.overview().then((r) => setOverview(r.data));
    analyticsApi.conversations(30).then((r) => setChartData(r.data));
  }, []);

  if (!overview) return <LoadingSkeleton />;

  const { contacts, conversations, ai, leads, followups } = overview;

  const kpis = [
    { label: "Contactos totales",       value: contacts.total.toLocaleString(),             icon: Users,         color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-500/15" },
    { label: "Conversaciones activas",  value: conversations.active.toLocaleString(),        icon: MessageSquare, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/15" },
    { label: "Mensajes IA este mes",    value: ai.messages_sent.toLocaleString(),            icon: Bot,           color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-500/15" },
    { label: "Costo IA este mes",       value: `$${ai.cost_usd.toFixed(3)} USD`,            icon: DollarSign,    color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-500/15" },
    { label: "Follow-ups enviados",     value: followups.sent_this_month.toLocaleString(),   icon: TrendingUp,    color: "text-teal-600 dark:text-teal-400",    bg: "bg-teal-50 dark:bg-teal-500/15" },
    { label: "Tasa escalada a humano",  value: `${conversations.escalation_rate_pct}%`,      icon: AlertCircle,   color: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-500/15" },
  ];

  const funnelData = FUNNEL_STAGES.map((s) => ({ ...s, count: leads[s.key] || 0 }));
  const totalLeads = funnelData.reduce((s, f) => s + f.count, 0);
  const wonLeads = leads["closed_won"] || 0;

  return (
    <div className="space-y-6">

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-7 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/2 w-96 h-32 rounded-full bg-indigo-800/40 translate-y-1/2" />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium mb-1">Bienvenido de vuelta</p>
            <h1 className="text-2xl font-bold tracking-tight">{business?.name || "Tu negocio"}</h1>
            <p className="text-blue-200 text-sm mt-1">Resumen del mes actual</p>
          </div>
          <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full capitalize">
            {business?.plan || "plan"}
          </span>
        </div>

        <div className="relative grid grid-cols-3 gap-4 mt-7">
          {[
            { label: "Conversaciones este mes", value: conversations.this_month },
            { label: "Leads totales",           value: totalLeads },
            { label: "Leads ganados",           value: wonLeads },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/10 rounded-xl px-4 py-3">
              <p className="text-2xl font-bold leading-none">{value.toLocaleString()}</p>
              <p className="text-blue-200 text-xs mt-1.5 font-medium">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Line chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">Conversaciones</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Últimos 30 días</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 px-2.5 py-1 rounded-full">
              <ArrowUpRight className="w-3 h-3" />
              Este mes
            </div>
          </div>
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

        {/* Funnel bar chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">Pipeline de leads</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Por etapa</p>
          </div>
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
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-44 bg-gradient-to-br from-blue-200 to-indigo-200 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700/50 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 h-64 bg-slate-200 dark:bg-slate-700/50 rounded-xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-700/50 rounded-xl" />
      </div>
    </div>
  );
}
