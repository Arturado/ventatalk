"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MessageSquare, Users,
  TrendingUp, Settings, LogOut, Bot, Zap,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/conversations", label: "Conversaciones", icon: MessageSquare },
  { href: "/dashboard/contacts", label: "Contactos", icon: Users },
  { href: "/dashboard/leads", label: "Pipeline", icon: TrendingUp },
  { href: "/dashboard/integrations", label: "Integraciones", icon: Zap },
  { href: "/dashboard/settings", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { business, logout } = useAuthStore();

  return (
    <aside className="w-64 bg-slate-900 flex flex-col flex-shrink-0 min-h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="bg-sky-500 p-1.5 rounded-lg flex items-center justify-center shadow-sm">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">VentaBot</span>
        </div>
        {business && (
          <p className="text-xs text-slate-500 mt-2 truncate font-medium">{business.name}</p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">Menú</p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                active
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/[0.06] space-y-1">
        {business && (
          <div className="flex items-center gap-2 px-3 py-2">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-xs text-slate-500 capitalize font-medium">{business.plan}</span>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
