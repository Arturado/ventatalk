"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  MessageSquare, Users, TrendingUp, DollarSign,
  Bot, AlertCircle, ArrowUpRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import toast from "react-hot-toast";
import { analyticsApi, businessApi, billingApi, type UsageData } from "@/lib/api";
import { KPICard } from "@/components/dashboard/KPICard";
import { PlanUsageCard } from "@/components/dashboard/PlanUsageCard";
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
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const { business } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    analyticsApi.overview().then((r) => setOverview(r.data));
    analyticsApi.conversations(30).then((r) => setChartData(r.data));
    businessApi.usage().then((r) => setUsageData(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      toast.success("¡Plan actualizado exitosamente! 🎉", { duration: 5000 });
      const params = new URLSearchParams(searchParams.toString());
      params.delete("upgraded");
      const newPath = params.toString() ? `?${params.toString()}` : window.location.pathname;
      router.replace(newPath);
    }
  }, [searchParams, router]);

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

  const convPct = usageData?.conversations_pct ?? 0;
  const convLimited = usageData && usageData.conversations_limit !== -1;

  const handleBannerUpgrade = async () => {
    if (!usageData) return;
    const next = usageData.plan === "starter" ? "pro" : "business";
    try {
      const res = await billingApi.createCheckoutSession(next);
      window.location.href = res.data.checkout_url;
    } catch {
      toast.error("Error al iniciar el pago. Inténtalo de nuevo.");
    }
  };

  return (
    <div className="space-y-5 md:space-y-6">

      {/* Plan limit banners */}
      {convLimited && convPct >= 100 && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3.5">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Límite de conversaciones alcanzado</p>
            <p className="text-xs text-red-600 dark:text-red-400/80 mt-0.5">
              Has usado el 100% de tus conversaciones este mes. Los mensajes entrantes están bloqueados hasta el próximo ciclo o al mejorar tu plan.
            </p>
          </div>
          <button
            onClick={handleBannerUpgrade}
            className="flex-shrink-0 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Mejorar plan
          </button>
        </div>
      )}
      {convLimited && convPct >= 90 && convPct < 100 && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-4 py-3.5">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Estás usando el {convPct}% de tus conversaciones</p>
            <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-0.5">
              Te quedan {(usageData!.conversations_limit - usageData!.conversations_this_month).toLocaleString()} conversaciones disponibles este mes. Mejora tu plan para evitar interrupciones.
            </p>
          </div>
          <button
            onClick={handleBannerUpgrade}
            className="flex-shrink-0 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Mejorar plan
          </button>
        </div>
      )}

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-5 md:p-7 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/2 w-96 h-32 rounded-full bg-indigo-800/40 translate-y-1/2" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-blue-200 text-sm font-medium mb-1">Bienvenido de vuelta</p>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{business?.name || "Tu negocio"}</h1>
            <p className="text-blue-200 text-sm mt-1">Resumen del mes actual</p>
          </div>
          <span className="flex-shrink-0 bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full capitalize">
            {business?.plan || "plan"}
          </span>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 md:mt-7">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Charts */}
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
          {/* Horizontal scroll on mobile */}
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

      {/* Plan usage */}
      {usageData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <PlanUsageCard usage={usageData} />
        </div>
      )}

    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5 md:space-y-6 animate-pulse">
      <div className="h-40 md:h-44 bg-gradient-to-br from-blue-200 to-indigo-200 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700/50 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-64 bg-slate-200 dark:bg-slate-700/50 rounded-xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-700/50 rounded-xl" />
      </div>
    </div>
  );
}
