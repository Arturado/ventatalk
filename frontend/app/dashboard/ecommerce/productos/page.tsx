"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { businessApi, type CatalogItem } from "@/lib/api";
import { Package } from "lucide-react";

export default function ProductosPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    businessApi
      .getCatalog()
      .then((r) => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleAvailable(id: string, currentValue: boolean) {
    if (toggling.has(id)) return;

    const newValue = !currentValue;
    setToggling((prev) => new Set(prev).add(id));
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_available: newValue } : item))
    );

    try {
      await businessApi.toggleCatalogItem(id, newValue);
    } catch {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_available: currentValue } : item))
      );
      toast.error("No se pudo actualizar el producto. Intenta de nuevo.");
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Productos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Catálogo sincronizado con tu tienda
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Sin productos sincronizados</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Conecta tu tienda en Integraciones para ver tu catálogo aquí.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-5 py-3">
                    Producto
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-5 py-3">
                    Stock
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-5 py-3">
                    Precio
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-5 py-3">
                    Publicado
                  </th>
                  <th className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-5 py-3">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="flex items-center gap-3">
                        {item.image_url && !imgErrors.has(item.id) ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded object-cover flex-shrink-0 bg-slate-100 dark:bg-slate-700"
                            onError={() =>
                              setImgErrors((prev) => new Set(prev).add(item.id))
                            }
                          />
                        ) : (
                          <div className="w-10 h-10 rounded flex-shrink-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                            <Package className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {item.name}
                          </p>
                          {item.category && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              {item.category}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {item.stock_quantity == null ? (
                        item.is_available ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                            En stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                            Sin stock
                          </span>
                        )
                      ) : item.stock_quantity === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                          Sin stock
                        </span>
                      ) : (
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {item.stock_quantity}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {item.price != null
                          ? `$${item.price.toLocaleString("es-CL")}`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.is_available
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                        }`}
                      >
                        {item.is_available ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => toggleAvailable(item.id, item.is_available)}
                        role="switch"
                        aria-checked={item.is_available}
                        disabled={toggling.has(item.id)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                          toggling.has(item.id)
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer"
                        } ${
                          item.is_available
                            ? "bg-blue-600"
                            : "bg-slate-200 dark:bg-slate-600"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            item.is_available ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
