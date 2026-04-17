"use client";
import { useEffect, useState } from "react";
import {
  MessageSquare, Users, TrendingUp, DollarSign,
  Bot, AlertCircle,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { analyticsApi } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/dashboard/KPICard";

interface Overview {
  contacts: { total: number };
  conversations: { active: number; this_month: number; escalation_rate_pct: number };
  ai: { messages_sent: number; cost_usd: number };
  leads: Record<string, number>;
  followups: { sent_this_month: number };
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [chartData, setChartData] = useState<{ date: string; conversations: number }[]>([]);

  useEffect(() => {
    analyticsApi.overview().then((r) => setOverview(r.data));
    analyticsApi.conversations(30).then((r) => setChartData(r.data));
  }, []);

  if (!overview) return <LoadingSkeleton />;

  const { contacts, conversations, ai, leads, followups } = overview;

  const kpis = [
    {
      label: "Contactos totales",
      value: contacts.total.toLocaleString(),
      icon: Users,
      color: "text-sky-600",
      bg: "bg-sky-50",
    },
    {
      label: "Conversaciones activas",
      value: conversations.active.toLocaleString(),
      icon: MessageSquare,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Mensajes IA este mes",
      value: ai.messages_sent.toLocaleString(),
      icon: Bot,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Costo IA este mes",
      value: `$${ai.cost_usd.toFixed(3)} USD`,
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Follow-ups enviados",
      value: followups.sent_this_month.toLocaleString(),
      icon: TrendingUp,
      color: "text-teal-600",
      bg: "bg-teal-50",
    },
    {
      label: "Tasa escalada a humano",
      value: `${conversations.escalation_rate_pct}%`,
      icon: AlertCircle,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
  ];

  const funnelStages = [
    { key: "new",         label: "Nuevos",      color: "bg-slate-400" },
    { key: "interested",  label: "Interesados", color: "bg-sky-500" },
    { key: "quoted",      label: "Cotizados",   color: "bg-amber-500" },
    { key: "closed_won",  label: "Cerrados ✓",  color: "bg-emerald-500" },
    { key: "closed_lost", label: "Perdidos",    color: "bg-rose-400" },
  ];
  const maxLeads = Math.max(...funnelStages.map((s) => leads[s.key] || 0), 1);

  return (
    <div className="space-y-7">
      <PageHeader title="Dashboard" subtitle="Resumen del mes actual" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Gráfico + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico conversaciones */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Conversaciones</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Últimos 30 días</p>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-700" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#94A3B8", fontFamily: "Plus Jakarta Sans" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94A3B8", fontFamily: "Plus Jakarta Sans" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    fontFamily: "Plus Jakarta Sans",
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="conversations"
                  stroke="#0284c7"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#0284c7" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-2">
              <MessageSquare className="w-8 h-8 opacity-30" />
              <p className="text-sm">Sin datos aún — empieza a recibir mensajes</p>
            </div>
          )}
        </div>

        {/* Funnel de leads */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Pipeline de leads</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Por etapa</p>
          </div>
          <div className="space-y-3.5">
            {funnelStages.map((stage) => {
              const count = leads[stage.key] || 0;
              const pct = Math.round((count / maxLeads) * 100);
              return (
                <div key={stage.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{stage.label}</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                    <div
                      className={`${stage.color} h-1.5 rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-7 animate-pulse">
      <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded-lg w-40" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-60 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        <div className="h-60 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>
    </div>
  );
}
