"use client";

import { useEffect, useState } from "react";
import { businessApi, type Order, type OrderItem } from "@/lib/api";
import { ShoppingCart, Eye, X, Search } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:    { label: "En espera",  cls: "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400" },
  "on-hold":  { label: "En espera",  cls: "bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400" },
  processing: { label: "En curso",   cls: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
  completed:  { label: "Entregado",  cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  cancelled:  { label: "Cancelado",  cls: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
  refunded:   { label: "Devolución", cls: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" },
  failed:     { label: "Fallido",    cls: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? {
    label: status,
    cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function fmt(n?: number | null) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("es-CL");
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-slate-400 dark:text-slate-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-800 dark:text-slate-200 break-all">{value || "—"}</span>
    </div>
  );
}

const TABLE_HEADERS = [
  "ID DE PEDIDO",
  "CLIENTE",
  "PRODUCTO",
  "FECHA DEL PEDIDO",
  "TOTAL",
  "MÉTODO DE PAGO",
  "ESTADO DEL PEDIDO",
  "ACCIÓN",
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const [selected, setSelected] = useState<Order | null>(null);

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
      .getOrders({
        page,
        limit: 20,
        search: debouncedSearch,
        status: statusFilter,
        payment_method: paymentFilter,
      })
      .then((r) => {
        setOrders(r.data.orders);
        setTotal(r.data.total);
        setPages(r.data.pages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, statusFilter, paymentFilter]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-wide uppercase">
            Órdenes
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
            Comercio electrónico &rsaquo; Órdenes
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          Exportar
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pedido, cliente..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>

        <input
          type="date"
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="">Estado del Pedido</option>
          <option value="pending">En espera</option>
          <option value="on-hold">En espera (on-hold)</option>
          <option value="processing">En curso</option>
          <option value="completed">Entregado</option>
          <option value="cancelled">Cancelado</option>
          <option value="refunded">Devolución</option>
          <option value="failed">Fallido</option>
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => {
            setPaymentFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="">Método de Pago</option>
          <option value="bacs">Transferencia</option>
          <option value="cod">Efectivo</option>
          <option value="paypal">PayPal</option>
          <option value="stripe">Tarjeta</option>
          <option value="webpay">WebPay</option>
          <option value="khipu">Khipu</option>
          <option value="mercadopago">MercadoPago</option>
        </select>
      </div>

      {/* Tab */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-5">
        <button className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-px flex items-center gap-2">
          Todos los pedidos
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
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ShoppingCart className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Sin órdenes sincronizadas</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Conecta tu tienda en Integraciones para ver las órdenes aquí.
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
                {orders.map((order) => {
                  const items = order.items ?? [];
                  const first = items[0];
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          #{order.order_number}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-slate-900 dark:text-slate-100">
                          {order.customer_name || "—"}
                        </p>
                        {order.customer_email && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {order.customer_email}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 max-w-[180px]">
                        <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                          {first?.name || "—"}
                        </p>
                        {items.length > 1 && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            +{items.length - 1} más
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {fmtDate(order.ordered_at)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {fmt(order.total)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-slate-600 dark:text-slate-300 capitalize">
                          {order.payment_method || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setSelected(order)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 dark:hover:text-blue-400 transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Orden #{selected.order_number}
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {fmtDate(selected.ordered_at)} · {selected.source}
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
                <StatusBadge status={selected.status} />
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {fmt(selected.total)}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Cliente
                </p>
                <DetailRow label="Nombre" value={selected.customer_name} />
                <DetailRow label="Email" value={selected.customer_email} />
                <DetailRow label="Teléfono" value={selected.customer_phone} />
                <DetailRow label="Método de pago" value={selected.payment_method} />
              </div>

              {(selected.items ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Productos ({selected.items!.length})
                  </p>
                  <div className="space-y-0">
                    {selected.items!.map((item: OrderItem, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0"
                      >
                        <div className="min-w-0 mr-3">
                          <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                            {item.name || "—"}
                          </p>
                          {item.sku && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                              SKU: {item.sku}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {fmt(item.price)}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            x{item.qty ?? 1}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
