"use client";

import { ShoppingCart } from "lucide-react";

export default function OrdersPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <ShoppingCart className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
      <p className="text-slate-500 dark:text-slate-400 font-medium">Órdenes — Próximamente</p>
    </div>
  );
}
