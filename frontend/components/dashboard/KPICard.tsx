import { LucideIcon } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

export function KPICard({ label, value, icon: Icon, color, bg }: KPICardProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 cursor-default">
      <div className="flex items-start justify-between mb-4">
        <div className={`${bg} w-10 h-10 rounded-xl flex items-center justify-center shadow-sm`}>
          <Icon className={`${color}`} style={{ width: 18, height: 18 }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 tracking-tight leading-none">{value}</p>
      <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-2 leading-snug">{label}</p>
    </div>
  );
}
