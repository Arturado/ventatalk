"use client";

import { useEffect, useState } from "react";
import { businessApi, type Coupon } from "@/lib/api";
import { Tag, Eye, X, Search } from "lucide-react";

const DISCOUNT_TYPE_MAP: Record<string, { label: string; symbol: string }> = {
  percent:       { label: "Porcentaje", symbol: "%" },
  fixed_cart:    { label: "Fijo carrito", symbol: "$" },
  fixed_product: { label: "Fijo producto", symbol: "$" },
};

function fmtDiscount(type: string, value: number) {
  const info = DISCOUNT_TYPE_MAP[type];
  if (!info) return `${value}`;
  return info.symbol === "%" ? `${value}%` : `$${value.toLocaleString("es-CL")}`;
}

function fmtDate(d?: string | null) {
  if (!d) return "Sin vencimiento";
  return new Date(d).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function UsageCell({ count, limit }: { count: number; limit?: number | null }) {
  if (limit) return <span>{count} / {limit} usos</span>;
  return <span>{count} uso{count !== 1 ? "s" : ""}</span>;
}

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
      Activo
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
      Inactivo
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-slate-400 dark:text-slate-500 w-32 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-800 dark:text-slate-200 break-all">{value || "—"}</span>
    </div>
  );
}

const TABLE_HEADERS = [
  "CÓDIGO",
  "TIPO",
  "DESCUENTO",
  "DESCRIPCIÓN",
  "USO",
  "VENCIMIENTO",
  "ESTADO",
  "ACCIÓN",
];

export default function CuponesPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const [selected, setSelected] = useState<Coupon | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    businessApi
      .getCoupons({
        page,
        limit: 20,
        search: debouncedSearch,
        is_active: activeFilter,
      })
      .then((r) => {
        setCoupons(r.data.coupons);
        setTotal(r.data.total);
        setPages(r.data.pages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, activeFilter]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-wide uppercase">
            Cupones
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
            Comercio electrónico &rsaquo; Cupones
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar código o descripción..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>

        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-5">
        <button className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-px flex items-center gap-2">
          Todos los cupones
          {total > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-blue-100 dark:bg-blue-500/20 text-xs font-bold text-blue-700 dark:text-blue-300">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Tag className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Sin cupones sincronizados</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Los cupones de tu tienda aparecerán aquí después de sincronizar.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/50">
                  {TABLE_HEADERS.map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-5 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                {coupons.map((coupon) => (
                  <tr
                    key={coupon.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-mono font-medium text-slate-900 dark:text-slate-100 uppercase">
                        {coupon.code}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        {DISCOUNT_TYPE_MAP[coupon.discount_type]?.label ?? coupon.discount_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {fmtDiscount(coupon.discount_type, coupon.discount_value)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                        {coupon.description || "—"}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        <UsageCell count={coupon.usage_count} limit={coupon.usage_limit} />
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`text-sm ${coupon.expires_at ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}`}>
                        {fmtDate(coupon.expires_at)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <ActiveBadge active={coupon.is_active} />
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setSelected(coupon)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 dark:hover:text-blue-400 transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-700/60">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Página {page} de {pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                Próximo →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-base font-semibold font-mono uppercase text-slate-900 dark:text-slate-100">
                  {selected.code}
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {selected.source}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <ActiveBadge active={selected.is_active} />
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {fmtDiscount(selected.discount_type, selected.discount_value)}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 p-4 space-y-2.5">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Detalle del cupón
                </p>
                <DetailRow
                  label="Tipo de descuento"
                  value={DISCOUNT_TYPE_MAP[selected.discount_type]?.label ?? selected.discount_type}
                />
                <DetailRow label="Descripción" value={selected.description} />
                <DetailRow
                  label="Monto mínimo"
                  value={selected.min_order_amount != null ? `$${selected.min_order_amount.toLocaleString("es-CL")}` : null}
                />
                <DetailRow
                  label="Usos"
                  value={selected.usage_limit ? `${selected.usage_count} / ${selected.usage_limit}` : `${selected.usage_count} usos`}
                />
                <DetailRow label="Vencimiento" value={fmtDate(selected.expires_at)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
