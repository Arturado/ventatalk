"use client";
import { useEffect, useState } from "react";
import { leadsApi } from "@/lib/api";
import { DollarSign, User, ChevronRight, X } from "lucide-react";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";

interface Lead {
  id: string;
  contact_id: string;
  contact_name: string | null;
  contact_phone: string;
  stage: string;
  estimated_value: number | null;
  notes: string | null;
  created_at: string;
}

const STAGES = [
  { key: "new",         label: "Nuevos",      border: "border-slate-200 dark:border-slate-700",   header: "bg-slate-50 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400",       dot: "bg-slate-400 dark:bg-slate-500" },
  { key: "interested",  label: "Interesados", border: "border-blue-200 dark:border-blue-900",       header: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",               dot: "bg-blue-500" },
  { key: "quoted",      label: "Cotizados",   border: "border-amber-200 dark:border-amber-900",   header: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",       dot: "bg-amber-500" },
  { key: "closed_won",  label: "Cerrados ✓",  border: "border-emerald-200 dark:border-emerald-900", header: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400", dot: "bg-emerald-500" },
  { key: "closed_lost", label: "Perdidos",    border: "border-red-200 dark:border-red-900",       header: "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400",              dot: "bg-red-400" },
];

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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    leadsApi.list().then((r) => {
      setLeads(r.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const moveStage = async (lead: Lead, newStage: string) => {
    if (lead.stage === newStage) return;
    await leadsApi.updateStage(lead.id, newStage);
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage: newStage } : l));
    if (selected?.id === lead.id) setSelected({ ...selected, stage: newStage });
    toast.success(`Lead movido a "${STAGES.find(s => s.key === newStage)?.label}"`);
  };

  const byStage = (stage: string) => leads.filter((l) => l.stage === stage);
  const totalValue = leads
    .filter(l => l.stage === "closed_won")
    .reduce((s, l) => s + (l.estimated_value || 0), 0);

  if (loading) return (
    <div className="flex gap-3 animate-pulse">
      {STAGES.map((_, i) => <div key={i} className="flex-1 h-96 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pipeline de Ventas"
        subtitle={`${leads.length} leads totales`}
        action={
          totalValue > 0 ? (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2 rounded-xl">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                ${totalValue.toLocaleString("es-CL")} cerrado
              </span>
            </div>
          ) : undefined
        }
      />

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {STAGES.map((stage) => {
          const stageLeads = byStage(stage.key);
          return (
            <div
              key={stage.key}
              className={`flex-shrink-0 w-56 flex flex-col rounded-xl border ${stage.border} bg-white dark:bg-slate-800 overflow-hidden shadow-sm`}
            >
              {/* Header columna */}
              <div className={`px-3.5 py-2.5 ${stage.header} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
                  <span className="text-xs font-bold">{stage.label}</span>
                </div>
                <span className="text-xs font-bold bg-white/60 dark:bg-white/10 px-1.5 py-0.5 rounded-full">
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 min-h-[200px]">
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => setSelected(lead)}
                    className="bg-white dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl p-3 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all duration-150 group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${getAvatarColor(lead.contact_phone)}`}>
                        {getInitials(lead.contact_name, lead.contact_phone)}
                      </div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                        {lead.contact_name || lead.contact_phone}
                      </p>
                    </div>
                    {lead.estimated_value && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                        ${lead.estimated_value.toLocaleString("es-CL")}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {new Date(lead.created_at).toLocaleDateString("es-CL")}
                    </p>
                  </div>
                ))}
                {stageLeads.length === 0 && (
                  <div className="flex items-center justify-center h-16 text-slate-300 dark:text-slate-600 text-xs font-medium">
                    Vacío
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Panel detalle lateral */}
      {selected && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-end z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 w-80 h-full shadow-2xl overflow-y-auto border-l border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header panel */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h2 className="font-bold text-gray-900 dark:text-slate-100 text-sm">Detalle del lead</h2>
              <button
                onClick={() => setSelected(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Contacto */}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getAvatarColor(selected.contact_phone)}`}>
                  {getInitials(selected.contact_name, selected.contact_phone)}
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">{selected.contact_name || "Sin nombre"}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">+{selected.contact_phone}</p>
                </div>
              </div>

              {/* Valor */}
              {selected.estimated_value && (
                <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800 rounded-xl px-4 py-3">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">Valor estimado</p>
                  <p className="font-bold text-emerald-700 dark:text-emerald-400 text-lg">
                    ${selected.estimated_value.toLocaleString("es-CL")}
                    <span className="text-xs font-medium ml-1">CLP</span>
                  </p>
                </div>
              )}

              {/* Notas */}
              {selected.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Notas</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selected.notes}</p>
                </div>
              )}

              {/* Mover etapa */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Mover a etapa</p>
                <div className="space-y-1.5">
                  {STAGES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => moveStage(selected, s.key)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                        selected.stage === s.key
                          ? `${s.header} font-bold`
                          : "border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </div>
                      {selected.stage === s.key && <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
