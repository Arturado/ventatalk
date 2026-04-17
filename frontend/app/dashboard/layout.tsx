"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Toaster } from "react-hot-toast";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe().then(() => {
      if (!localStorage.getItem("access_token")) {
        router.push("/auth/login");
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
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
      <Sidebar />

      {/* Right side: header + content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-screen">

        {/* Top header */}
        <header className="h-12 flex-shrink-0 flex items-center justify-end px-8
          border-b border-slate-200 dark:border-slate-800
          bg-white dark:bg-slate-900">
          <ThemeToggle />
        </header>

        {/* Scrollable main area */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
