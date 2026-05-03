"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Toaster } from "react-hot-toast";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NotificationPermissionModal } from "@/components/ui/NotificationPermissionModal";
import { useNotifications } from "@/lib/useNotifications";
import { Bell, Search, Menu, Bot } from "lucide-react";

// ─── Navbar ──────────────────────────────────────────────────────────────────

interface NavbarProps {
  badgeCount: number;
  onMenuClick: () => void;
}

function Navbar({ badgeCount, onMenuClick }: NavbarProps) {
  const { business } = useAuthStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const initials = business?.name
    ? business.name.trim().split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
    : "VT";

  return (
    <header className="relative h-16 flex-shrink-0 flex items-center justify-between px-4 md:px-6
      border-b border-slate-200 dark:border-slate-700/60
      bg-white dark:bg-slate-800 gap-3">

      {/* Left area */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Hamburger – mobile only */}
        <button
          onClick={onMenuClick}
          className="md:hidden w-11 h-11 flex items-center justify-center rounded-xl
            hover:bg-slate-100 dark:hover:bg-slate-700/60
            text-slate-500 dark:text-slate-400
            hover:text-slate-700 dark:hover:text-slate-200
            transition-colors cursor-pointer flex-shrink-0"
          aria-label="Abrir menú"
        >
          <Menu style={{ width: 20, height: 20 }} />
        </button>

        {/* Logo – mobile only (sidebar is hidden on mobile) */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight">VentaTalk</span>
        </div>

        {/* Search bar – sm+ */}
        <div className="relative hidden sm:block w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar..."
            className="w-full pl-10 pr-4 py-2 text-sm
              bg-slate-50 dark:bg-slate-700/50
              border border-slate-200 dark:border-slate-600/60
              rounded-xl text-gray-700 dark:text-slate-200
              focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 dark:focus:border-blue-500
              placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Search icon – mobile only */}
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className="sm:hidden w-11 h-11 flex items-center justify-center rounded-xl
            hover:bg-slate-100 dark:hover:bg-slate-700/60
            text-slate-500 dark:text-slate-400
            hover:text-slate-700 dark:hover:text-slate-200
            transition-colors cursor-pointer"
          aria-label="Buscar"
        >
          <Search style={{ width: 18, height: 18 }} />
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <button
          className="relative w-11 h-11 flex items-center justify-center rounded-xl
            hover:bg-slate-100 dark:hover:bg-slate-700/60
            text-slate-500 dark:text-slate-400
            hover:text-slate-700 dark:hover:text-slate-200
            transition-colors cursor-pointer"
          aria-label="Notificaciones"
          onClick={() => {
            if (badgeCount > 0) {
              window.location.href = "/dashboard/conversations";
            }
          }}
        >
          <Bell style={{ width: 18, height: 18 }} />
          {badgeCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full
              flex items-center justify-center text-white text-[9px] font-bold leading-none
              ring-2 ring-white dark:ring-slate-800">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Avatar + name */}
        <div className="flex items-center gap-2.5 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600
            flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0">
            {initials}
          </div>
          {business && (
            <div className="hidden lg:block">
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 leading-tight">{business.name}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 capitalize leading-tight">{business.plan}</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile search dropdown */}
      {searchOpen && (
        <div className="sm:hidden absolute top-full left-0 right-0 z-30
          bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/60
          px-4 py-3 shadow-lg">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="search"
              placeholder="Buscar..."
              autoFocus
              className="w-full pl-10 pr-4 py-3 text-base
                bg-slate-50 dark:bg-slate-700/50
                border border-slate-200 dark:border-slate-600/60
                rounded-xl text-gray-700 dark:text-slate-200
                focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 dark:focus:border-blue-500
                placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
            />
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { fetchMe } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    showModal,
    badgeCount,
    requestAndEnable,
    dismissModal,
  } = useNotifications();

  useEffect(() => {
    fetchMe().then(() => {
      if (!localStorage.getItem("access_token")) {
        router.push("/auth/login");
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: "Plus Jakarta Sans, sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            borderRadius: "10px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          },
        }}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-h-screen">
        <Navbar badgeCount={badgeCount} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Notification permission modal */}
      {showModal && (
        <NotificationPermissionModal
          onAccept={requestAndEnable}
          onDecline={dismissModal}
        />
      )}
    </div>
  );
}
