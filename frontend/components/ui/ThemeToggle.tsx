"use client";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-9 h-9 rounded-xl" />;

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="relative w-9 h-9 flex items-center justify-center rounded-xl
        text-slate-500 hover:text-slate-700 hover:bg-slate-100
        dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/60
        transition-colors duration-150 cursor-pointer"
    >
      {isDark ? (
        <Sun className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
      ) : (
        <Moon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
      )}
    </button>
  );
}
