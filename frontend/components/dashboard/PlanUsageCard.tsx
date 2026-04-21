"use client";
import { ArrowUpRight, Zap } from "lucide-react";
import type { UsageData } from "@/lib/api";

const PLAN_STYLES: Record<string, string> = {
  starter: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20",
  pro: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border-violet-100 dark:border-violet-500/20",
  business: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20",
};

function ProgressBar({ pct }: { pct: number }) {
  const color =
    pct >= 95 ? "bg-red-500" :
    pct >= 80 ? "bg-amber-400" :
    "bg-emerald-500";
  return (
    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
      <div
        className={`${color} h-1.5 rounded-full transition-all duration-500`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

export function PlanUsageCard({ usage }: { usage: UsageData }) {
  const badgeStyle = PLAN_STYLES[usage.plan] ?? PLAN_STYLES.starter;
  const convUnlimited = usage.conversations_limit === -1;
  const channelsUnlimited = usage.channels_limit === -1;
  const catalogUnlimited = usage.catalog_limit === -1;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Uso del plan</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Reset en {usage.days_until_reset} día{usage.days_until_reset !== 1 ? "s" : ""}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold border px-2.5 py-1 rounded-full capitalize ${badgeStyle}`}>
          <Zap className="w-3 h-3" />
          {usage.plan}
        </span>
      </div>

      <div className="space-y-4">
        {/* Conversations */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Conversaciones este mes</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {convUnlimited
                ? `${usage.conversations_this_month.toLocaleString()} / ∞`
                : `${usage.conversations_this_month.toLocaleString()} / ${usage.conversations_limit.toLocaleString()}`}
            </span>
          </div>
          {!convUnlimited && (
            <>
              <ProgressBar pct={usage.conversations_pct} />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                {usage.conversations_pct}% utilizado
              </p>
            </>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-700/60" />

        {/* Channels + Catalog */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Canales (WA)</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {usage.channels_used}
              <span className="text-slate-400 dark:text-slate-500 font-normal">
                {channelsUnlimited ? " / ∞" : ` / ${usage.channels_limit}`}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Productos</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {usage.catalog_items.toLocaleString()}
              <span className="text-slate-400 dark:text-slate-500 font-normal">
                {catalogUnlimited ? " / ∞" : ` / ${usage.catalog_limit}`}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Upgrade CTA */}
      <a
        href="https://ventatalk.com/pricing"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 w-full flex items-center justify-center gap-1.5 text-xs font-semibold
          text-blue-600 dark:text-blue-400
          bg-blue-50 dark:bg-blue-500/10
          border border-blue-100 dark:border-blue-500/20
          hover:bg-blue-100 dark:hover:bg-blue-500/20
          rounded-lg px-3 py-2.5 transition-colors"
      >
        Mejorar plan
        <ArrowUpRight className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
