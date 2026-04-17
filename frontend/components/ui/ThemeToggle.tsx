"use client";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

const CYCLE: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
const ICONS = { light: Sun, dark: Moon, system: Monitor };
const LABELS = { light: "Claro", dark: "Oscuro", system: "Sistema" };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Prevent hydration mismatch — render placeholder until client mounts
  if (!mounted) return <div className="w-8 h-8 rounded-lg" />;

  const current = (theme as "light" | "dark" | "system") ?? "system";
  const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
  const Icon = ICONS[current] ?? Monitor;

  return (
    <button
      onClick={() => setTheme(next)}
      title={`Tema: ${LABELS[current]} → cambiar a ${LABELS[next]}`}
      aria-label={`Tema actual: ${LABELS[current]}. Click para cambiar a ${LABELS[next]}.`}
      className="w-8 h-8 flex items-center justify-center rounded-lg
        text-slate-500 hover:text-slate-700 hover:bg-slate-100
        dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800
        transition-colors duration-150 cursor-pointer"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
