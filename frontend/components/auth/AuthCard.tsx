import { ReactNode } from "react";
import { Bot } from "lucide-react";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-xl shadow-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-slate-100 tracking-tight">VentaBot</span>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-7 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1 tracking-tight">{title}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">{subtitle}</p>
          {children}
        </div>

        <div className="mt-5">{footer}</div>
      </div>
    </div>
  );
}
