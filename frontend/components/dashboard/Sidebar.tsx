"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, MessageSquare, Users,
  TrendingUp, Settings, LogOut, Bot, Zap, X,
  Package, ShoppingCart, Tag,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { businessApi, type UsageData } from "@/lib/api";

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
    label: "Ecommerce",
    items: [
      { href: "/dashboard/ecommerce/productos", label: "Productos", icon: Package },
      { href: "/dashboard/ecommerce/orders", label: "Órdenes", icon: ShoppingCart },
      { href: "/dashboard/ecommerce/cupones", label: "Cupones", icon: Tag },
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

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { business, logout } = useAuthStore();
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    businessApi.usage().then((r) => setUsage(r.data)).catch(() => {});
  }, []);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          flex flex-col flex-shrink-0
          w-64 md:w-16 lg:w-64
          min-h-screen
          bg-white dark:bg-slate-800
          border-r border-slate-200 dark:border-slate-700/60
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="px-5 md:px-0 lg:px-5 h-16 flex items-center justify-between md:justify-center lg:justify-between border-b border-slate-200 dark:border-slate-700/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="md:hidden lg:block">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight">VentaTalk</span>
              {business && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate font-medium leading-none mt-0.5">{business.name}</p>
              )}
            </div>
          </div>
          {/* Close button – mobile only */}
          <button
            onClick={onClose}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 transition-colors cursor-pointer"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 md:px-2 lg:px-3 py-5 space-y-5 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-2 md:hidden lg:block">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      title={label}
                      className={`flex items-center gap-3 md:justify-center lg:justify-start px-3 md:px-0 lg:px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer relative ${
                        active
                          ? "bg-blue-50 dark:bg-blue-600/15 text-blue-700 dark:text-blue-400"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-600 dark:bg-blue-500 rounded-r-full md:hidden lg:block" />
                      )}
                      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                      <span className="md:hidden lg:block">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 md:px-2 lg:px-3 py-4 border-t border-slate-200 dark:border-slate-700/60 space-y-1">
          {business && (
            <div className="px-3 py-2 mb-1 md:hidden lg:block">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold
                text-blue-600 dark:text-blue-400
                bg-blue-50 dark:bg-blue-500/10
                border border-blue-100 dark:border-blue-500/20
                px-2 py-1 rounded-full">
                <Zap className="w-3 h-3" />
                <span className="capitalize">{business.plan}</span>
              </span>
              {usage && usage.conversations_limit !== -1 && (
                <div className="mt-2.5">
                  <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-1">
                    <span>Conversaciones</span>
                    <span>{usage.conversations_this_month}/{usage.conversations_limit}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all ${
                        usage.conversations_pct >= 95 ? "bg-red-500" :
                        usage.conversations_pct >= 80 ? "bg-amber-400" :
                        "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, usage.conversations_pct)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="w-full flex items-center gap-3 md:justify-center lg:justify-start px-3 md:px-0 lg:px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium
              text-slate-500 dark:text-slate-400
              hover:bg-red-50 dark:hover:bg-red-500/10
              hover:text-red-500 dark:hover:text-red-400
              transition-all duration-150 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="md:hidden lg:block">Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
