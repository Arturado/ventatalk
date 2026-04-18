"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MessageSquare, Users,
  TrendingUp, Settings, LogOut, Bot, Zap,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";

const NAV_GROUPS = [
  {
    label: "Principal",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/conversations", label: "Conversaciones", icon: MessageSquare },
      { href: "/dashboard/contacts", label: "Contactos", icon: Users },
      { href: "/dashboard/leads", label: "Pipeline", icon: TrendingUp },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/dashboard/integrations", label: "Integraciones", icon: Zap },
      { href: "/dashboard/settings", label: "Configuración", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { business, logout } = useAuthStore();

  return (
    <aside className="w-64 flex flex-col flex-shrink-0 min-h-screen
      bg-white dark:bg-slate-800
      border-r border-slate-200 dark:border-slate-700/60">

      {/* Logo */}
      <div className="px-5 h-16 flex items-center border-b border-slate-200 dark:border-slate-700/60 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight">VentaTalk</span>
            {business && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate font-medium leading-none mt-0.5">{business.name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-2">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer relative ${
                      active
                        ? "bg-blue-50 dark:bg-blue-600/15 text-blue-700 dark:text-blue-400"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-600 dark:bg-blue-500 rounded-r-full" />
                    )}
                    <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-700/60 space-y-1">
        {business && (
          <div className="px-3 py-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold
              text-blue-600 dark:text-blue-400
              bg-blue-50 dark:bg-blue-500/10
              border border-blue-100 dark:border-blue-500/20
              px-2 py-1 rounded-full">
              <Zap className="w-3 h-3" />
              <span className="capitalize">{business.plan}</span>
            </span>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            text-slate-500 dark:text-slate-400
            hover:bg-red-50 dark:hover:bg-red-500/10
            hover:text-red-500 dark:hover:text-red-400
            transition-all duration-150 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
