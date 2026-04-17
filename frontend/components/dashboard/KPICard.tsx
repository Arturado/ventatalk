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
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 cursor-default">
      <div className={`${bg} w-9 h-9 rounded-xl flex items-center justify-center mb-4`}>
        <Icon className={`w-4.5 h-4.5 ${color}`} style={{ width: 18, height: 18 }} />
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">{value}</p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">{label}</p>
    </div>
  );
}
