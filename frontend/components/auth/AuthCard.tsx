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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="bg-sky-600 p-2 rounded-xl shadow-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">VentaBot</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-7 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900 mb-1 tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500 mb-6">{subtitle}</p>
          {children}
        </div>

        <div className="mt-5">{footer}</div>
      </div>
    </div>
  );
}
