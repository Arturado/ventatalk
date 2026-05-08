"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { conversationsApi, contactsApi } from "@/lib/api";
import {
  MessageSquare,
  Send,
  UserCheck,
  X,
  Zap,
  Users,
  CheckCircle,
  Link2,
  Copy,
  Check,
  ArrowLeft,
  Search,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";
import { LeadPanel, type LeadInfo } from "@/components/dashboard/LeadPanel";
import { trackingApi } from "@/lib/api";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  contact_id: string;
  contact_name: string | null;
  contact_phone: string;
  status: string;
  detected_intent: string | null;
  last_message_at: string | null;
  message_count: number;
}

interface TrackingLink {
  token: string;
  tracking_url: string;
  destination_url: string;
  label: string | null;
  converted: boolean;
  converted_at: string | null;
  created_at: string;
}

interface Message {
  id: string;
  role: string;
  content: string | null;
  wa_status: string | null;
  created_at: string;
}

interface ConvDetail extends Conversation {
  messages: Message[];
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ai_handling:  "bg-indigo-100 text-indigo-700 border border-indigo-200",
  human_assigned: "bg-amber-100 text-amber-700 border border-amber-200",
  closed:       "bg-slate-100 text-slate-500 border border-slate-200",
  open:         "bg-emerald-100 text-emerald-700 border border-emerald-200",
};

const STATUS_LABELS: Record<string, string> = {
  ai_handling:    "IA activa",
  human_assigned: "Agente",
  closed:         "Cerrada",
  open:           "Abierta",
};

const STATUS_DOT: Record<string, string> = {
  ai_handling:    "bg-indigo-500",
  human_assigned: "bg-amber-500",
  closed:         "bg-slate-400",
  open:           "bg-emerald-500",
};

const AVATAR_PALETTE = [
  "bg-pink-500 text-white",
  "bg-orange-400 text-white",
  "bg-teal-500 text-white",
  "bg-indigo-500 text-white",
  "bg-rose-500 text-white",
  "bg-emerald-500 text-white",
  "bg-amber-500 text-white",
  "bg-violet-500 text-white",
  "bg-sky-500 text-white",
  "bg-slate-500 text-white",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null, phone: string) {
  if (name) {
    const parts = name.trim().split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return phone.slice(-2);
}

function getAvatarColor(str: string) {
  const hash = str.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function safeFormat(dateStr: string, fmt: string) {
  try { return format(new Date(dateStr), fmt); } catch { return ""; }
}

// ─── PipelineBar — compact horizontal strip ───────────────────────────────────

function PipelineBar({ conversations }: { conversations: Conversation[] }) {
  const total      = conversations.length;
  const aiActive   = conversations.filter((c) => c.status === "ai_handling").length;
  const withAgent  = conversations.filter((c) => c.status === "human_assigned").length;
  const closed     = conversations.filter((c) => c.status === "closed").length;

  const metrics = [
    { label: "Total leads", value: total,     Icon: Users,       valCls: "text-slate-700 dark:text-slate-200",  dotCls: "text-slate-400 dark:text-slate-500" },
    { label: "IA activa",   value: aiActive,  Icon: Zap,         valCls: "text-indigo-600 dark:text-indigo-400", dotCls: "text-indigo-400 dark:text-indigo-500" },
    { label: "Con agente",  value: withAgent, Icon: UserCheck,   valCls: "text-amber-600 dark:text-amber-400",   dotCls: "text-amber-400 dark:text-amber-500" },
    { label: "Cerradas",    value: closed,    Icon: CheckCircle, valCls: "text-slate-400 dark:text-slate-500",   dotCls: "text-slate-400 dark:text-slate-600" },
  ];

  return (
    <div className="flex items-center gap-5 sm:gap-8 px-5 h-11 border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-900 flex-shrink-0">
      {metrics.map(({ label, value, Icon, valCls, dotCls }) => (
        <div key={label} className="flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${dotCls}`} />
          <span className={`text-[13px] font-bold leading-none ${valCls}`}>{value}</span>
          <span className={`text-[11px] leading-none ${dotCls} hidden sm:inline`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function limitMessages(conv: ConvDetail): ConvDetail {
  return { ...conv, messages: conv.messages.slice(-100) };
}

// ─── Deep-link helper ─────────────────────────────────────────────────────────

function DeepLinkOpener({ onOpen }: { onOpen: (id: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) onOpen(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected]           = useState<ConvDetail | null>(null);
  const [leadInfo, setLeadInfo]           = useState<LeadInfo | null>(null);
  const [replyText, setReplyText]         = useState("");
  const [sending, setSending]             = useState(false);
  const [filter, setFilter]               = useState("all");
  const [searchQuery, setSearchQuery]     = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Tracking
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingLinks, setTrackingLinks]         = useState<TrackingLink[]>([]);
  const [trackingUrl, setTrackingUrl]             = useState("");
  const [trackingLabel, setTrackingLabel]         = useState("");
  const [generatingLink, setGeneratingLink]       = useState(false);
  const [copiedToken, setCopiedToken]             = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("vt-badge-clear"));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const params = filter !== "all" ? { status: filter } : undefined;

    conversationsApi.list(params, signal).then((r) => setConversations(r.data)).catch(() => {});
    const interval = setInterval(() => {
      conversationsApi.list(params, signal).then((r) => setConversations(r.data)).catch(() => {});
    }, 10000);

    return () => { controller.abort(); clearInterval(interval); };
  }, [filter]);

  useEffect(() => {
    if (!selected) return;

    const controller = new AbortController();
    const { signal } = controller;
    const id = selected.id;
    const contactId = selected.contact_id;

    conversationsApi.get(id, signal).then((r) => setSelected(limitMessages(r.data))).catch(() => {});
    contactsApi.get(contactId, signal).then((r) => {
      setLeadInfo({
        lead_id:              r.data.lead_id ?? null,
        lead_stage:           r.data.lead_stage ?? null,
        lead_estimated_value: r.data.lead_estimated_value ?? null,
        contact_id:           contactId,
      });
    }).catch(() => {});
    trackingApi.listLinks(id, signal).then((r) => setTrackingLinks(r.data)).catch(() => {});

    const interval = setInterval(() => {
      conversationsApi.get(id, signal).then((r) => setSelected(limitMessages(r.data))).catch(() => {});
    }, 5000);

    return () => { controller.abort(); clearInterval(interval); };
  }, [selected?.id]);

  useEffect(() => {
    return () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current); };
  }, []);

  const lastMessageId = selected?.messages?.at(-1)?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openConversation = async (id: string) => {
    const r = await conversationsApi.get(id);
    setSelected(r.data);
  };

  const goBackToList = () => {
    setSelected(null);
    setLeadInfo(null);
    setTrackingLinks([]);
    setShowTrackingModal(false);
  };

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    try {
      await conversationsApi.reply(selected.id, replyText);
      setReplyText("");
      const r = await conversationsApi.get(selected.id);
      setSelected(r.data);
      toast.success("Mensaje enviado");
    } catch {
      toast.error("Error enviando mensaje");
    } finally {
      setSending(false);
    }
  };

  const handleAssign = async () => {
    if (!selected) return;
    await conversationsApi.assign(selected.id);
    const r = await conversationsApi.get(selected.id);
    setSelected(r.data);
    toast.success("Conversación asignada a ti");
  };

  const handleClose = async () => {
    if (!selected) return;
    await conversationsApi.close(selected.id);
    goBackToList();
    const r = await conversationsApi.list();
    setConversations(r.data);
    toast.success("Conversación cerrada");
  };

  const generateTrackingLink = async () => {
    if (!selected || !trackingUrl.trim()) return;
    setGeneratingLink(true);
    try {
      const res = await trackingApi.createLink(selected.id, {
        destination_url: trackingUrl.trim(),
        label: trackingLabel.trim() || undefined,
      });
      setTrackingLinks((prev) => [res.data, ...prev].slice(0, 50));
      setTrackingUrl("");
      setTrackingLabel("");
      toast.success("Link generado");
    } catch {
      toast.error("Error generando link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyLink = (url: string, token: string) => {
    navigator.clipboard.writeText(url);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    setCopiedToken(token);
    copiedTimerRef.current = setTimeout(() => setCopiedToken(null), 2000);
  };

  const FILTERS = [
    { key: "all",            label: "Todas" },
    { key: "ai_handling",    label: "IA activa" },
    { key: "human_assigned", label: "Agente" },
  ];

  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) => {
        const q = searchQuery.toLowerCase();
        return (c.contact_name?.toLowerCase().includes(q) ?? false) || c.contact_phone.includes(q);
      })
    : conversations;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    // Break out of the dashboard container's padding for a flush WhatsApp-like layout
    <div
      className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 flex flex-col overflow-hidden bg-white dark:bg-slate-900"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      <Suspense fallback={null}>
        <DeepLinkOpener onOpen={openConversation} />
      </Suspense>

      {/* ── Compact metrics bar ── */}
      <PipelineBar conversations={conversations} />

      {/* ── Two-column chat layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT: conversation list (300 px) ── */}
        <div className={`flex-shrink-0 flex flex-col border-r border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-900
          ${selected ? "hidden md:flex" : "flex w-full"}
          md:w-[300px]`}
        >
          {/* Sidebar header */}
          <div className="px-4 pt-4 pb-3 space-y-3 border-b border-slate-100 dark:border-slate-700/50 flex-shrink-0">
            <h1 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">Conversaciones</h1>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar conversación, contacto..."
                className="w-full pl-8 pr-3 py-2 text-[12.5px] bg-slate-100 dark:bg-slate-800 rounded-full text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`text-[12px] px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                    filter === f.key
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                <p className="text-[12px] text-slate-400 dark:text-slate-600">Sin conversaciones</p>
              </div>
            )}
            {filteredConversations.map((conv) => {
              const initials    = getInitials(conv.contact_name, conv.contact_phone);
              const avatarColor = getAvatarColor(conv.contact_phone);
              const isActive    = selected?.id === conv.id;
              const preview     = conv.detected_intent ?? STATUS_LABELS[conv.status] ?? conv.contact_phone;
              const timeLabel   = conv.last_message_at
                ? formatDistanceToNow(new Date(conv.last_message_at), { locale: es })
                : "";
              return (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv.id)}
                  className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors cursor-pointer border-b border-slate-50 dark:border-slate-800/60 ${
                    isActive
                      ? "bg-indigo-600"
                      : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  {/* Avatar with status dot */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-bold ${avatarColor}`}>
                      {initials}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${
                        isActive ? "border-indigo-600" : "border-white dark:border-slate-900"
                      } ${STATUS_DOT[conv.status] ?? "bg-slate-400"}`}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <p className={`text-[13.5px] font-semibold truncate ${
                        isActive ? "text-white" : "text-slate-800 dark:text-slate-100"
                      }`}>
                        {conv.contact_name || conv.contact_phone}
                      </p>
                      {timeLabel && (
                        <span className={`text-[10.5px] flex-shrink-0 ${
                          isActive ? "text-indigo-200" : "text-slate-400 dark:text-slate-500"
                        }`}>
                          {timeLabel}
                        </span>
                      )}
                    </div>
                    <p className={`text-[12px] truncate ${
                      isActive ? "text-indigo-200" : "text-slate-500 dark:text-slate-500"
                    }`}>
                      {preview}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: chat area ── */}
        {selected ? (
          <>
            <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">

              {/* Mobile back */}
              <button
                onClick={goBackToList}
                className="md:hidden flex items-center gap-2 px-4 py-3 text-[13px] font-medium text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-900 hover:bg-slate-50 transition-colors cursor-pointer flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                Conversaciones
              </button>

              {/* Chat header */}
              <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/50 flex-shrink-0 gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 ${getAvatarColor(selected.contact_phone)}`}>
                    {getInitials(selected.contact_name, selected.contact_phone)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 leading-tight truncate">
                      {selected.contact_name || selected.contact_phone}
                    </h2>
                    <p className="text-[11.5px] text-slate-500 dark:text-slate-500 flex items-center gap-1.5 leading-tight">
                      <span className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${STATUS_DOT[selected.status] ?? "bg-slate-400"}`} />
                      {STATUS_LABELS[selected.status]} · {selected.contact_phone}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Tracking */}
                  <button
                    onClick={() => setShowTrackingModal((v) => !v)}
                    className={`relative flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-xl border font-medium cursor-pointer transition-colors ${
                      showTrackingModal
                        ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Links</span>
                    {trackingLinks.filter((l) => l.converted).length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {trackingLinks.filter((l) => l.converted).length}
                      </span>
                    )}
                  </button>

                  {selected.status !== "human_assigned" && (
                    <button
                      onClick={handleAssign}
                      className="flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-xl border font-medium cursor-pointer transition-colors bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Asignarme</span>
                    </button>
                  )}

                  <button
                    onClick={handleClose}
                    className="flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-xl border font-medium cursor-pointer transition-colors bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cerrar</span>
                  </button>
                </div>
              </div>

              {/* Tracking panel */}
              {showTrackingModal && (
                <div className="border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-900 px-5 py-4 space-y-3 flex-shrink-0">
                  <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" />
                    Links de seguimiento
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      placeholder="URL de destino (ej: https://tienda.cl/producto)"
                      className="flex-1 text-[12px] px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition"
                    />
                    <div className="flex gap-2">
                      <input
                        value={trackingLabel}
                        onChange={(e) => setTrackingLabel(e.target.value)}
                        placeholder="Etiqueta (opcional)"
                        className="flex-1 sm:w-32 text-[12px] px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition"
                      />
                      <button
                        onClick={generateTrackingLink}
                        disabled={generatingLink || !trackingUrl.trim()}
                        className="text-[12px] px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-500 disabled:opacity-40 transition-colors cursor-pointer font-medium whitespace-nowrap"
                      >
                        {generatingLink ? "..." : "Generar"}
                      </button>
                    </div>
                  </div>
                  {trackingLinks.length > 0 && (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {trackingLinks.map((link) => (
                        <div key={link.token} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${link.converted ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                          <div className="flex-1 min-w-0">
                            {link.label && <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 truncate">{link.label}</p>}
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">{link.tracking_url}</p>
                          </div>
                          {link.converted && (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800 flex-shrink-0">
                              Convertido
                            </span>
                          )}
                          <button
                            onClick={() => copyLink(link.tracking_url, link.token)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer flex-shrink-0"
                          >
                            {copiedToken === link.token
                              ? <Check className="w-3 h-3 text-emerald-500" />
                              : <Copy className="w-3 h-3" />
                            }
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {trackingLinks.length === 0 && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-600">Aún no hay links generados para esta conversación.</p>
                  )}
                </div>
              )}

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-5 md:px-8 py-5 space-y-4">
                {selected.messages.map((msg) => {
                  const isUser = msg.role === "user";
                  const timeStr = msg.created_at ? safeFormat(msg.created_at, "HH:mm") : "";
                  return (
                    <div key={msg.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                      <div className={`flex items-end gap-2 max-w-[78%] md:max-w-[65%] ${isUser ? "flex-row" : "flex-row-reverse"}`}>
                        {/* Avatar — only for incoming messages */}
                        {isUser && (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${getAvatarColor(selected.contact_phone)}`}>
                            {getInitials(selected.contact_name, selected.contact_phone)}
                          </div>
                        )}
                        {/* Bubble + timestamp */}
                        <div className={`flex flex-col gap-1 ${isUser ? "items-start" : "items-end"}`}>
                          <div className={`px-4 py-2.5 text-[13.5px] leading-relaxed ${
                            isUser
                              ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 dark:border-slate-700/40"
                              : "bg-indigo-600 text-white rounded-2xl rounded-tr-sm shadow-sm shadow-indigo-900/20"
                          }`}>
                            {msg.content}
                          </div>
                          {timeStr && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1">{timeStr}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Reply input */}
              {selected.status !== "closed" ? (
                <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700/50 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2.5 gap-2 focus-within:ring-2 focus-within:ring-indigo-500/20 transition">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendReply()}
                        placeholder="Escribe un mensaje..."
                        className="flex-1 bg-transparent text-[13.5px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={sendReply}
                      disabled={sending || !replyText.trim()}
                      className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 transition-colors cursor-pointer flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-900/25"
                    >
                      <Send className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700/50 flex-shrink-0 text-center">
                  <span className="text-[12px] text-slate-400 dark:text-slate-500">Conversación cerrada</span>
                </div>
              )}
            </div>

            {/* Lead panel */}
            {leadInfo && (
              <div className="hidden lg:flex flex-shrink-0">
                <LeadPanel
                  lead={leadInfo}
                  onLeadChange={(updated) =>
                    setLeadInfo((prev) => prev ? { ...prev, ...updated } : prev)
                  }
                />
              </div>
            )}
          </>
        ) : (
          /* Empty state */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-semibold text-slate-500 dark:text-slate-400">
                Selecciona una conversación
              </p>
              <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1">
                Los mensajes aparecerán aquí
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
