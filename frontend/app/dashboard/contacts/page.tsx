"use client";
import { useEffect, useState } from "react";
import { contactsApi } from "@/lib/api";
import { Search, Trash2, Edit2, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";

interface Contact {
  id: string;
  wa_phone: string;
  name: string | null;
  email: string | null;
  notes: string | null;
  tags: string[];
  last_seen_at: string | null;
  lead_stage: string | null;
}

const STAGE_COLORS: Record<string, string> = {
  new: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  interested: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400",
  quoted: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
  closed_won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400",
  closed_lost: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400",
};

const STAGE_LABELS: Record<string, string> = {
  new: "Nuevo",
  interested: "Interesado",
  quoted: "Cotizado",
  closed_won: "Cerrado ✓",
  closed_lost: "Perdido",
};

const AVATAR_PALETTE = [
  "bg-blue-100 text-blue-700 dark:bg-sky-900/60 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
];

function getAvatarColor(str: string) {
  const hash = str.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function getInitials(name: string | null, phone: string) {
  if (name) {
    const parts = name.trim().split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return phone.slice(-2);
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  const load = (q?: string) => {
    contactsApi.list({ search: q }).then((r) => {
      setContacts(r.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search || undefined), 400);
    return () => clearTimeout(t);
  }, [search]);

  const deleteContact = async (id: string) => {
    if (!confirm("¿Eliminar contacto y todo su historial? Esta acción no se puede deshacer.")) return;
    await contactsApi.delete(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    toast.success("Contacto eliminado");
  };

  const saveEdit = async () => {
    if (!editing) return;
    await contactsApi.update(editing.id, {
      name: editing.name,
      email: editing.email,
      notes: editing.notes,
    });
    setEditing(null);
    load(search || undefined);
    toast.success("Contacto actualizado");
  };

  if (loading) return (
    <div className="animate-pulse space-y-3">
      <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded-lg w-36 mb-6" />
      {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Contactos" subtitle={`${contacts.length} contactos`} />

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o teléfono..."
          className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-base md:text-sm
            bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-shadow"
        />
      </div>

      {/* ── Mobile card view ─────────────────────────────────────────── */}
      <div className="block md:hidden space-y-3">
        {contacts.length === 0 && (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm font-medium">
            Sin contactos aún
          </div>
        )}
        {contacts.map((c) => (
          <div
            key={c.id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAvatarColor(c.wa_phone)}`}>
                  {getInitials(c.name, c.wa_phone)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm truncate">{c.name || "Sin nombre"}</p>
                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    <Phone className="w-3 h-3 flex-shrink-0" />
                    <span>+{c.wa_phone}</span>
                  </div>
                </div>
              </div>
              {c.lead_stage ? (
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${STAGE_COLORS[c.lead_stage] || "bg-slate-100 text-slate-500"}`}>
                  {STAGE_LABELS[c.lead_stage] || c.lead_stage}
                </span>
              ) : null}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {c.last_seen_at
                  ? `Visto: ${new Date(c.last_seen_at).toLocaleDateString("es-CL")}`
                  : "Sin actividad"}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(c)}
                  className="w-11 h-11 flex items-center justify-center hover:bg-blue-50 dark:hover:bg-sky-900/30 rounded-xl text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                  aria-label="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteContact(c.id)}
                  className="w-11 h-11 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                  aria-label="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop table view ───────────────────────────────────────── */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50">
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Contacto</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Teléfono</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Etapa</th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Última actividad</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm font-medium">
                  Sin contactos aún
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAvatarColor(c.wa_phone)}`}>
                      {getInitials(c.name, c.wa_phone)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{c.name || "Sin nombre"}</p>
                      {c.email && <p className="text-xs text-slate-400 dark:text-slate-500">{c.email}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400 text-sm">
                    <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    <span>+{c.wa_phone}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  {c.lead_stage ? (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STAGE_COLORS[c.lead_stage] || "bg-slate-100 text-slate-500"}`}>
                      {STAGE_LABELS[c.lead_stage] || c.lead_stage}
                    </span>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-slate-400 dark:text-slate-500 text-xs font-medium">
                  {c.last_seen_at ? new Date(c.last_seen_at).toLocaleDateString("es-CL") : "—"}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => setEditing(c)}
                      className="p-1.5 hover:bg-blue-50 dark:hover:bg-sky-900/30 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteContact(c.id)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal edición */}
      {editing && (
        <Modal size="md">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 text-base mb-1">Editar contacto</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">Actualiza la información del contacto</p>
          <div className="space-y-4">
            {[
              { label: "Nombre", key: "name" as const, type: "text" },
              { label: "Email", key: "email" as const, type: "email" },
              { label: "Notas", key: "notes" as const, type: "text" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">{label}</label>
                <input
                  type={type}
                  value={(editing[key] as string) || ""}
                  onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
                  className="w-full px-3.5 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-base md:text-sm
                    bg-slate-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setEditing(null)}
              className="flex-1 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm
                text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer font-medium min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              onClick={saveEdit}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer shadow-sm min-h-[44px]"
            >
              Guardar cambios
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
