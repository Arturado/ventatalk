"use client";
import { useState } from "react";
import { TrendingUp, Plus, ChevronRight, DollarSign, Loader2 } from "lucide-react";
import { leadsApi, contactsApi } from "@/lib/api";
import toast from "react-hot-toast";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface LeadInfo {
  lead_id: string | null;
  lead_stage: string | null;
  lead_estimated_value: number | null;
  contact_id: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const STAGES = [
  {
    key: "new",
    label: "Nuevo",
    dot: "bg-slate-400",
    active: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600",
    inactive: "text-slate-500 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800",
  },
  {
    key: "interested",
    label: "Interesado",
    dot: "bg-sky-500",
    active: "bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-700",
    inactive: "text-slate-500 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800",
  },
  {
    key: "quoted",
    label: "Cotizado",
    dot: "bg-amber-500",
    active: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700",
    inactive: "text-slate-500 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800",
  },
  {
    key: "closed_won",
    label: "Ganado",
    dot: "bg-emerald-500",
    active: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700",
    inactive: "text-slate-500 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800",
  },
  {
    key: "closed_lost",
    label: "Perdido",
    dot: "bg-red-400",
    active: "bg-red-50 text-red-600 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-700",
    inactive: "text-slate-500 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800",
  },
] as const;

// ─── Componente ──────────────────────────────────────────────────────────────

interface LeadPanelProps {
  lead: LeadInfo;
  onLeadChange: (updated: Partial<LeadInfo>) => void;
}

export function LeadPanel({ lead, onLeadChange }: LeadPanelProps) {
  const [moving, setMoving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const currentStage = STAGES.find((s) => s.key === lead.lead_stage);
  const stageIndex = STAGES.findIndex((s) => s.key === lead.lead_stage);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await leadsApi.create(lead.contact_id);
      onLeadChange({
        lead_id: res.data.id,
        lead_stage: res.data.stage,
        lead_estimated_value: res.data.estimated_value,
      });
      toast.success("Lead creado");
    } catch {
      toast.error("Error creando lead");
    } finally {
      setCreating(false);
    }
  };

  const handleMoveStage = async (stageKey: string) => {
    if (!lead.lead_id || stageKey === lead.lead_stage) return;
    setMoving(stageKey);
    try {
      await leadsApi.updateStage(lead.lead_id, stageKey);
      onLeadChange({ lead_stage: stageKey });
      toast.success(`Lead → ${STAGES.find((s) => s.key === stageKey)?.label}`);
    } catch {
      toast.error("Error moviendo lead");
    } finally {
      setMoving(null);
    }
  };

  return (
    <div className="w-56 flex-shrink-0 flex flex-col bg-white dark:bg-[#13161e] rounded-xl border border-slate-200 dark:border-[#1e2330] overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 dark:border-[#1e2330] flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 tracking-tight">
          Pipeline del lead
        </span>
      </div>

      {/* Sin lead → botón crear */}
      {!lead.lead_id ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-6">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-slate-400 dark:text-slate-600" />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-600 text-center leading-snug">
            No hay lead asociado a este contacto
          </p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer font-medium"
          >
            {creating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
            Crear lead
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">

          {/* Barra de progreso visual */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex gap-0.5">
              {STAGES.map((s, i) => (
                <div
                  key={s.key}
                  className={`flex-1 h-1 rounded-full transition-colors duration-300 ${
                    i <= stageIndex
                      ? i === stageIndex
                        ? s.dot
                        : "bg-slate-300 dark:bg-slate-600"
                      : "bg-slate-100 dark:bg-slate-800"
                  }`}
                />
              ))}
            </div>
            {currentStage && (
              <div className="mt-2.5 flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${currentStage.dot} flex-shrink-0`} />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {currentStage.label}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-600 ml-auto">
                  {stageIndex + 1}/5
                </span>
              </div>
            )}
          </div>

          {/* Valor estimado */}
          {lead.lead_estimated_value != null && (
            <div className="mx-4 mb-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 rounded-lg flex items-center gap-2">
              <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                ${lead.lead_estimated_value.toLocaleString("es-CL")}
              </span>
            </div>
          )}

          {/* Etapas clickeables */}
          <div className="px-3 pb-3 space-y-1 flex-1">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest px-1 mb-2">
              Mover a
            </p>
            {STAGES.map((s) => {
              const isActive = s.key === lead.lead_stage;
              const isLoading = moving === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => handleMoveStage(s.key)}
                  disabled={isActive || !!moving}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer border ${
                    isActive
                      ? `${s.active} font-semibold`
                      : `border-transparent ${s.inactive}`
                  } disabled:cursor-default`}
                >
                  <div className="flex items-center gap-2">
                    {isLoading ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin flex-shrink-0" />
                    ) : (
                      <div className={`w-1.5 h-1.5 rounded-full ${s.dot} flex-shrink-0`} />
                    )}
                    {s.label}
                  </div>
                  {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
