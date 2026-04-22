"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { conversationsApi, contactsApi } from "@/lib/api";
import {
  MessageSquare,
  Send,
  User,
  Bot,
  UserCheck,
  X,
  Zap,
  Users,
  CheckCircle,
  Link2,
  Copy,
  Check,
  ArrowLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";
import { LeadPanel, type LeadInfo } from "@/components/dashboard/LeadPanel";
import { trackingApi } from "@/lib/api";

// ─── Interfaces ──────────────────────────────────────────────────────────────

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

// ─── Tokens de diseño ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ai_handling:
    "bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
  human_assigned:
    "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  closed:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700/40 dark:text-slate-500 dark:border-slate-700/30",
  open:
    "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  ai_handling: "IA activa",
  human_assigned: "Agente",
  closed: "Cerrada",
  open: "Abierta",
};

const AVATAR_PALETTE = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/70 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-300",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── PipelineBar ─────────────────────────────────────────────────────────────

function PipelineBar({ conversations }: { conversations: Conversation[] }) {
  const total = conversations.length;
  const aiActive = conversations.filter((c) => c.status === "ai_handling").length;
  const withAgent = conversations.filter((c) => c.status === "human_assigned").length;
  const closed = conversations.filter((c) => c.status === "closed").length;

  const metrics = [
    {
      label: "Total leads",
      value: total,
      valueColor: "text-gray-900 dark:text-slate-100",
      labelColor: "text-slate-400 dark:text-slate-500",
      bg: "bg-white dark:bg-slate-900",
      border: "border-slate-200 dark:border-slate-700/50",
      Icon: Users,
      iconColor: "text-slate-400 dark:text-slate-500",
      iconBg: "bg-slate-100 dark:bg-white/5",
    },
    {
      label: "IA activa",
      value: aiActive,
      valueColor: "text-indigo-600 dark:text-indigo-400",
      labelColor: "text-indigo-500/80 dark:text-indigo-500/70",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      border: "border-indigo-200 dark:border-indigo-500/15",
      Icon: Zap,
      iconColor: "text-indigo-500",
      iconBg: "bg-indigo-100 dark:bg-white/5",
    },
    {
      label: "Con agente",
      value: withAgent,
      valueColor: "text-amber-600 dark:text-amber-400",
      labelColor: "text-amber-500/80 dark:text-amber-500/70",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-200 dark:border-amber-500/15",
      Icon: UserCheck,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-100 dark:bg-white/5",
    },
    {
      label: "Cerradas",
      value: closed,
      valueColor: "text-slate-400 dark:text-slate-500",
      labelColor: "text-slate-400 dark:text-slate-600",
      bg: "bg-white dark:bg-slate-900",
      border: "border-slate-200 dark:border-slate-700/50",
      Icon: CheckCircle,
      iconColor: "text-slate-400 dark:text-slate-600",
      iconBg: "bg-slate-100 dark:bg-white/5",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:flex gap-2 md:gap-3">
      {metrics.map(({ label, value, valueColor, labelColor, bg, border, Icon, iconColor, iconBg }) => (
        <div
          key={label}
          className={`flex items-center gap-3 md:gap-4 px-3.5 md:px-5 py-3 md:py-3.5 rounded-xl border flex-1 ${bg} ${border}`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
          <div>
            <p className={`text-xl md:text-2xl font-bold leading-none tracking-tight ${valueColor}`}>
              {value}
            </p>
            <p className={`text-[11px] font-medium mt-0.5 ${labelColor}`}>{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Deep-link helper ────────────────────────────────────────────────────────

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
  const [selected, setSelected] = useState<ConvDetail | null>(null);
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState("all");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Tracking
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingLinks, setTrackingLinks] = useState<TrackingLink[]>([]);
  const [trackingUrl, setTrackingUrl] = useState("");
  const [trackingLabel, setTrackingLabel] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("vt-badge-clear"));
  }, []);

  useEffect(() => {
    const params = filter !== "all" ? { status: filter } : undefined;
    conversationsApi.list(params).then((r) => setConversations(r.data));
    const interval = setInterval(() => {
      conversationsApi.list(params).then((r) => setConversations(r.data));
    }, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  useEffect(() => {
    if (!selected) return;

    const id = selected.id;
    const contactId = selected.contact_id;

    conversationsApi.get(id).then((r) => setSelected(r.data));
    contactsApi.get(contactId).then((r) => {
      setLeadInfo({
        lead_id: r.data.lead_id ?? null,
        lead_stage: r.data.lead_stage ?? null,
        lead_estimated_value: r.data.lead_estimated_value ?? null,
        contact_id: contactId,
      });
    });
    trackingApi.listLinks(id).then((r) => setTrackingLinks(r.data));

    const interval = setInterval(() => {
      conversationsApi.get(id).then((r) => setSelected(r.data));
    }, 5000);
    return () => clearInterval(interval);
  }, [selected?.id]);

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
      setTrackingLinks((prev) => [res.data, ...prev]);
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
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const FILTERS = [
    { key: "all", label: "Todas" },
    { key: "ai_handling", label: "IA activa" },
    { key: "human_assigned", label: "Agente" },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-3">

      <Suspense fallback={null}>
        <DeepLinkOpener onOpen={openConversation} />
      </Suspense>

      {/* Pipeline Bar */}
      <PipelineBar conversations={conversations} />

      {/* Main layout */}
      <div className="flex flex-1 gap-3 overflow-hidden min-h-0">

        {/* ── Conversations list ──────────────────────────────────────── */}
        {/* On mobile: hidden when a conversation is selected */}
        <div className={`flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden
          ${selected ? "hidden md:flex" : "flex"}
          w-full md:w-72 md:flex-shrink-0`}>

          {/* Header sidebar */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700/50">
            <h1 className="font-semibold text-gray-900 dark:text-slate-100 text-sm tracking-tight">
              Conversaciones
            </h1>
            <div className="flex gap-1 mt-3">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`text-xs px-2.5 py-2 rounded-lg font-medium transition-all duration-150 cursor-pointer min-h-[36px] ${
                    filter === f.key
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
            {conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-slate-400 dark:text-slate-600" />
                </div>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-600">
                  Sin conversaciones
                </p>
              </div>
            )}
            {conversations.map((conv) => {
              const initials = getInitials(conv.contact_name, conv.contact_phone);
              const avatarColor = getAvatarColor(conv.contact_phone);
              const isActive = selected?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv.id)}
                  className={`w-full text-left px-4 py-4 transition-colors cursor-pointer border-l-2 min-h-[72px] ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-600/10 border-blue-500"
                      : "border-transparent hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor}`}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p
                          className={`text-sm font-semibold truncate ${
                            isActive
                              ? "text-gray-900 dark:text-slate-100"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {conv.contact_name || conv.contact_phone}
                        </p>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                            STATUS_COLORS[conv.status] || "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {STATUS_LABELS[conv.status] || conv.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-600 truncate">
                        {conv.contact_phone}
                      </p>
                      {conv.last_message_at && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">
                          {formatDistanceToNow(new Date(conv.last_message_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Chat detalle + Lead panel ─────────────────────────────── */}
        {selected ? (
          <>
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden min-w-0">

              {/* Back button – mobile only */}
              <button
                onClick={goBackToList}
                className="md:hidden flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer min-h-[44px]"
              >
                <ArrowLeft className="w-4 h-4" />
                Conversaciones
              </button>

              {/* Header chat */}
              <div className="px-4 md:px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-white dark:bg-slate-900 gap-2 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAvatarColor(
                      selected.contact_phone
                    )}`}
                  >
                    {getInitials(selected.contact_name, selected.contact_phone)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-slate-100 leading-tight truncate">
                      {selected.contact_name || selected.contact_phone}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-600">{selected.contact_phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                      STATUS_COLORS[selected.status] || "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {STATUS_LABELS[selected.status] || selected.status}
                  </span>
                  {/* Botón tracking */}
                  <button
                    onClick={() => setShowTrackingModal((v) => !v)}
                    className={`relative flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors cursor-pointer font-medium min-h-[36px] ${
                      showTrackingModal
                        ? "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30"
                        : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 hover:border-violet-200 dark:hover:border-violet-500/20"
                    }`}
                  >
                    <Link2 className="w-3 h-3" />
                    Links
                    {trackingLinks.filter((l) => l.converted).length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {trackingLinks.filter((l) => l.converted).length}
                      </span>
                    )}
                  </button>
                  {selected.status !== "human_assigned" && (
                    <button
                      onClick={handleAssign}
                      className="flex items-center gap-1.5 text-xs px-3 py-2
                        bg-amber-50 text-amber-700 border border-amber-200
                        dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20
                        rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors cursor-pointer font-medium min-h-[36px]"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span className="hidden sm:inline">Asignarme</span>
                    </button>
                  )}
                  <button
                    onClick={handleClose}
                    className="flex items-center gap-1.5 text-xs px-3 py-2
                      bg-slate-100 text-slate-600 border border-slate-200
                      dark:bg-white/5 dark:text-slate-400 dark:border-white/10
                      rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer font-medium min-h-[36px]"
                  >
                    <X className="w-3 h-3" />
                    <span className="hidden sm:inline">Cerrar</span>
                  </button>
                </div>
              </div>

              {/* Panel de tracking */}
              {showTrackingModal && (
                <div className="border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-900 px-4 md:px-5 py-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Link2 className="w-3 h-3" />
                    Links de seguimiento
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      placeholder="URL de destino (ej: https://tienda.cl/producto)"
                      className="flex-1 text-xs px-3 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-gray-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 text-base sm:text-xs"
                    />
                    <div className="flex gap-2">
                      <input
                        value={trackingLabel}
                        onChange={(e) => setTrackingLabel(e.target.value)}
                        placeholder="Etiqueta (opcional)"
                        className="flex-1 sm:w-32 text-xs px-3 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-gray-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 text-base sm:text-xs"
                      />
                      <button
                        onClick={generateTrackingLink}
                        disabled={generatingLink || !trackingUrl.trim()}
                        className="text-xs px-3 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-500 disabled:opacity-40 transition-colors cursor-pointer font-medium whitespace-nowrap min-h-[44px]"
                      >
                        {generatingLink ? "..." : "Generar"}
                      </button>
                    </div>
                  </div>
                  {trackingLinks.length > 0 && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {trackingLinks.map((link) => (
                        <div
                          key={link.token}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60"
                        >
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${link.converted ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                          <div className="flex-1 min-w-0">
                            {link.label && (
                              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 truncate">{link.label}</p>
                            )}
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">{link.tracking_url}</p>
                          </div>
                          {link.converted && (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800 flex-shrink-0">
                              Convertido
                            </span>
                          )}
                          <button
                            onClick={() => copyLink(link.tracking_url, link.token)}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer flex-shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          >
                            {copiedToken === link.token ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {trackingLinks.length === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-600">Aún no hay links generados para esta conversación.</p>
                  )}
                </div>
              )}

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto px-4 md:px-5 py-5 space-y-4 bg-slate-50 dark:bg-slate-950/80">
                {selected.messages.map((msg) => {
                  const isUser = msg.role === "user";
                  const isAI = msg.role === "assistant";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isUser ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`flex items-end gap-2 max-w-[85%] md:max-w-[72%] ${
                          isUser ? "flex-row" : "flex-row-reverse"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isUser
                              ? "bg-slate-200 dark:bg-slate-700/60"
                              : isAI
                              ? "bg-indigo-100 dark:bg-indigo-900/60"
                              : "bg-emerald-100 dark:bg-emerald-900/60"
                          }`}
                        >
                          {isUser ? (
                            <User className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                          ) : isAI ? (
                            <Bot className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <UserCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </div>
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isUser
                              ? "bg-slate-100 text-slate-800 rounded-bl-sm border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60"
                              : "bg-indigo-600 text-white rounded-br-sm shadow-lg shadow-indigo-900/20"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input respuesta */}
              {selected.status !== "closed" && (
                <div className="px-4 py-3.5 border-t border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-900 flex gap-2 items-center">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendReply()}
                    placeholder="Responder como agente…"
                    className="flex-1 text-sm px-4 py-3
                      bg-slate-100 border border-slate-200 text-slate-800
                      dark:bg-slate-800 dark:border-slate-700/60 dark:text-slate-200
                      rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500
                      placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-shadow
                      text-base md:text-sm"
                  />
                  <button
                    onClick={sendReply}
                    disabled={sending || !replyText.trim()}
                    className="bg-indigo-600 text-white px-3.5 py-3 rounded-xl hover:bg-indigo-500 disabled:opacity-30 transition-colors cursor-pointer shadow-sm shadow-indigo-900/30 min-h-[48px] min-w-[48px] flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Lead pipeline panel – hidden on mobile */}
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
          /* Empty state – desktop only */
          <div className="hidden md:flex flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-slate-400 dark:text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">
                Selecciona una conversación
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
                Los mensajes aparecerán aquí
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
