"use client";
import { useEffect, useRef, useState } from "react";
import { authApi, businessApi, phoneNumbersApi, billingApi } from "@/lib/api";
import api from "@/lib/api";
import {
  Bot, Upload, Phone, Save, CheckCircle2,
  EyeOff, RefreshCw, Database,
  FileSpreadsheet, ShoppingBag, AlertTriangle, Globe,
  Plus, Trash2, Eye, Bell, BellOff, BellRing,
  CreditCard, ExternalLink, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { useNotifications } from "@/lib/useNotifications";

interface PhoneNumber {
  id: string;
  phone_number_id: string;
  phone_number: string;
  display_name: string;
  waba_id: string;
  is_active: boolean;
}

interface CatalogSource {
  active_source: string;
  counts: Record<string, number>;
  total: number;
}

const SOURCE_INFO: Record<string, { label: string; icon: any; border: string; bg: string; badge: string }> = {
  csv: {
    label: "CSV Manual",
    icon: FileSpreadsheet,
    border: "border-slate-300 dark:border-slate-600",
    bg: "bg-white dark:bg-slate-800",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  },
  jumpseller: {
    label: "Jumpseller",
    icon: ShoppingBag,
    border: "border-violet-300 dark:border-violet-700",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-400",
  },
  bsale: {
    label: "Bsale",
    icon: Database,
    border: "border-amber-300 dark:border-amber-700",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
  },
  woocommerce: {
    label: "WooCommerce",
    icon: Globe,
    border: "border-sky-300 dark:border-sky-700",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-400",
  },
  shopify: {
    label: "Shopify",
    icon: ShoppingBag,
    border: "border-emerald-300 dark:border-emerald-700",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400",
  },
  mercadolibre: {
    label: "MercadoLibre",
    icon: Database,
    border: "border-yellow-300 dark:border-yellow-700",
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
    badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400",
  },
};

const inputCls = "w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 dark:bg-slate-700 text-gray-900 dark:text-slate-100 transition-shadow placeholder:text-slate-400 dark:placeholder:text-slate-500";
const labelCls = "text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5";

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [catalogSource, setCatalogSource] = useState<CatalogSource | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingSource, setChangingSource] = useState(false);
  const [confirmSource, setConfirmSource] = useState<string | null>(null);
  const [confirmDeleteSource, setConfirmDeleteSource] = useState<string | null>(null);
  const [deletingSource, setDeletingSource] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // WhatsApp phone numbers
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [addingPhone, setAddingPhone] = useState(false);
  const [removingPhone, setRemovingPhone] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [phoneForm, setPhoneForm] = useState({
    display_name: "",
    phone_number: "",
    phone_number_id: "",
    access_token: "",
    waba_id: "",
  });

  const loadCatalog = () => {
    api.get("/api/v1/business/catalog/source").then((r) => setCatalogSource(r.data));
  };

  const reindexCatalog = async () => {
    setReindexing(true);
    try {
      const res = await api.post("/api/v1/business/catalog/reindex");
      toast.success(res.data.message);
    } catch {
      toast.error("Error iniciando reindexación");
    } finally {
      setReindexing(false);
    }
  };

  useEffect(() => {
    authApi.me().then((r) => setProfile(r.data));
    loadCatalog();
    phoneNumbersApi.list().then((r) => setPhoneNumbers(r.data));
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await businessApi.updateProfile({
        name: profile.name,
        ai_tone: profile.ai_tone,
        ai_instructions: profile.ai_instructions,
        ai_enabled: profile.ai_enabled,
      });
      toast.success("Configuración guardada");
    } catch {
      toast.error("Error guardando");
    } finally {
      setSaving(false);
    }
  };

  const changeSource = (source: string) => {
    if (source === catalogSource?.active_source) {
      setConfirmDeleteSource(source);
      return;
    }
    setConfirmSource(source);
  };

  const confirmChangeSource = async () => {
    if (!confirmSource) return;
    setChangingSource(true);
    try {
      const res = await api.post("/api/v1/business/catalog/source", { source: confirmSource });
      toast.success(res.data.message);
      setConfirmSource(null);
      loadCatalog();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error cambiando fuente");
    } finally {
      setChangingSource(false);
    }
  };

  const deleteSource = async () => {
    if (!confirmDeleteSource) return;
    const source = confirmDeleteSource;
    setDeletingSource(true);
    try {
      await businessApi.deleteCatalogSource(source);
      toast.success(`Productos de ${SOURCE_INFO[source]?.label} eliminados`);
      setConfirmDeleteSource(null);
      loadCatalog();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error eliminando productos");
    } finally {
      setDeletingSource(false);
    }
  };

  const uploadCatalog = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await businessApi.uploadCatalog(file);
      toast.success(res.data.message);
      loadCatalog();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error subiendo catálogo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addPhoneNumber = async () => {
    const { display_name, phone_number, phone_number_id, access_token, waba_id } = phoneForm;
    if (!display_name || !phone_number || !phone_number_id || !access_token || !waba_id) {
      toast.error("Completa todos los campos");
      return;
    }
    setAddingPhone(true);
    try {
      const res = await phoneNumbersApi.add(phoneForm);
      setPhoneNumbers((prev) => [...prev, res.data]);
      setPhoneForm({ display_name: "", phone_number: "", phone_number_id: "", access_token: "", waba_id: "" });
      setShowPhoneForm(false);
      toast.success("Número agregado");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error agregando número");
    } finally {
      setAddingPhone(false);
    }
  };

  const removePhoneNumber = async (id: string) => {
    setRemovingPhone(id);
    try {
      await phoneNumbersApi.remove(id);
      setPhoneNumbers((prev) => prev.filter((p) => p.id !== id));
      toast.success("Número desactivado");
    } catch {
      toast.error("Error desactivando número");
    } finally {
      setRemovingPhone(null);
    }
  };

  if (!profile) return (
    <div className="animate-pulse space-y-4 max-w-2xl">
      <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded-lg w-40 mb-6" />
      {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Configuración"
        subtitle="Personaliza tu agente IA y gestiona tu catálogo"
      />

      {/* ── Agente IA ──────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="w-7 h-7 bg-sky-100 dark:bg-sky-900/50 rounded-lg flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          </div>
          <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm">Agente IA</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Nombre del negocio</label>
            <input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Tono del agente</label>
            <select
              value={profile.ai_tone}
              onChange={(e) => setProfile({ ...profile, ai_tone: e.target.value })}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="amigable">Amigable (tutéa, cálido)</option>
              <option value="formal">Formal (de usted, profesional)</option>
              <option value="técnico">Técnico (preciso, detallado)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Instrucciones adicionales</label>
            <textarea
              value={profile.ai_instructions || ""}
              onChange={(e) => setProfile({ ...profile, ai_instructions: e.target.value })}
              placeholder="Horarios, dirección, políticas especiales..."
              rows={4}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div className="flex items-center justify-between py-3 border-t border-slate-100 dark:border-slate-700">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">IA activa</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Desactivar para respuesta solo humana</p>
            </div>
            <button
              onClick={() => setProfile({ ...profile, ai_enabled: !profile.ai_enabled })}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${profile.ai_enabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${profile.ai_enabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </section>

      {/* ── Fuente del catálogo ─────────────────────────── */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-sky-100 dark:bg-sky-900/50 rounded-lg flex items-center justify-center">
              <Database className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm">Fuente del catálogo</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={reindexCatalog}
              disabled={reindexing}
              title="Regenerar embeddings para productos sin IA"
              className="text-xs px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800 disabled:opacity-50 cursor-pointer font-medium transition-colors"
            >
              {reindexing ? "..." : "Re-index IA"}
            </button>
            <button onClick={loadCatalog} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Elige <strong className="text-slate-700 dark:text-slate-300">una</strong> fuente activa. Al cambiar, los productos de la fuente anterior se eliminan automáticamente.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(SOURCE_INFO).map(([source, info]) => {
              const isActive = catalogSource?.active_source === source;
              const count = catalogSource?.counts[source] || 0;
              const Icon = info.icon;
              return (
                <button
                  key={source}
                  onClick={() => changeSource(source)}
                  className={`relative p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    isActive
                      ? `${info.bg} ${info.border}`
                      : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-2.5 right-2.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                  )}
                  <Icon className={`w-5 h-5 mb-2 ${isActive ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}`} />
                  <p className={`text-xs font-bold ${isActive ? "text-gray-900 dark:text-slate-100" : "text-gray-500 dark:text-slate-400"}`}>{info.label}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                    {count > 0 ? `${count} productos` : "Sin productos"}
                  </p>
                </button>
              );
            })}
          </div>
          {catalogSource?.active_source === "csv" && (
            <div>
              <input ref={fileRef} type="file" accept=".csv" onChange={uploadCatalog} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2.5 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-sky-400 dark:hover:border-sky-500 rounded-xl px-4 py-3.5 text-sm text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 w-full justify-center disabled:opacity-50 transition-colors cursor-pointer font-medium"
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Generando embeddings..." : "Subir CSV (name, description, price, category)"}
              </button>
            </div>
          )}
          {catalogSource?.active_source === "woocommerce" && (
            <div className="bg-sky-50 dark:bg-sky-950/40 rounded-xl px-4 py-3 text-xs text-sky-700 dark:text-sky-400 border border-sky-100 dark:border-sky-900 font-medium">
              Para sincronizar ve a <strong>Integraciones → WordPress / WooCommerce</strong> y genera tu token de API. Luego úsalo en el plugin de WordPress.
            </div>
          )}
          {catalogSource?.active_source === "shopify" && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-xl px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 font-medium">
              Para sincronizar ve a <strong>Integraciones → Shopify</strong> y usa el botón <strong>Sincronizar ahora</strong>.
            </div>
          )}
          {catalogSource?.active_source !== "csv"
            && catalogSource?.active_source !== "woocommerce"
            && catalogSource?.active_source !== "shopify"
            && catalogSource?.active_source !== "mercadolibre" && (
            <div className="bg-sky-50 dark:bg-sky-950/40 rounded-xl px-4 py-3 text-xs text-sky-700 dark:text-sky-400 border border-sky-100 dark:border-sky-900 font-medium">
              Para sincronizar ve a <strong>Integraciones</strong> y usa el botón sync de{" "}
              {SOURCE_INFO[catalogSource?.active_source || ""]?.label}.
            </div>
          )}
        </div>
      </section>

      {/* ── WhatsApp ────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center">
              <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm">Números de WhatsApp</h2>
          </div>
          <button
            onClick={() => setShowPhoneForm((v) => !v)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer font-medium shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar número
          </button>
        </div>
        <div className="p-5 space-y-4">

          {/* Formulario agregar */}
          {showPhoneForm && (
            <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-200 dark:border-slate-600 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Credenciales de Meta Cloud API</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nombre / alias</label>
                  <input
                    value={phoneForm.display_name}
                    onChange={(e) => setPhoneForm({ ...phoneForm, display_name: e.target.value })}
                    placeholder="Mi negocio WA"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Teléfono</label>
                  <input
                    value={phoneForm.phone_number}
                    onChange={(e) => setPhoneForm({ ...phoneForm, phone_number: e.target.value })}
                    placeholder="+56912345678"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone Number ID (Meta)</label>
                  <input
                    value={phoneForm.phone_number_id}
                    onChange={(e) => setPhoneForm({ ...phoneForm, phone_number_id: e.target.value })}
                    placeholder="1234567890"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>WABA ID</label>
                  <input
                    value={phoneForm.waba_id}
                    onChange={(e) => setPhoneForm({ ...phoneForm, waba_id: e.target.value })}
                    placeholder="WhatsApp Business Account ID"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Access Token (Meta)</label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={phoneForm.access_token}
                    onChange={(e) => setPhoneForm({ ...phoneForm, access_token: e.target.value })}
                    placeholder="EAAxxxxxxxxxx..."
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={addPhoneNumber}
                  disabled={addingPhone}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {addingPhone ? "Guardando..." : "Guardar número"}
                </button>
                <button
                  onClick={() => setShowPhoneForm(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors font-medium"
                >
                  Cancelar
                </button>
              </div>
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
              >
                → Dónde encontrar estas credenciales (Meta docs)
              </a>
            </div>
          )}

          {/* Lista de números */}
          {phoneNumbers.length === 0 && !showPhoneForm && (
            <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
              <Phone className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No hay números conectados.</p>
              <p className="mt-0.5">Agrega tu número de WhatsApp Business para recibir mensajes.</p>
            </div>
          )}

          {phoneNumbers.map((phone) => (
            <div
              key={phone.id}
              className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-200 dark:border-slate-600"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{phone.display_name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{phone.phone_number}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">ID: {phone.phone_number_id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${phone.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-500"}`}>
                  {phone.is_active ? "Activo" : "Inactivo"}
                </span>
                <button
                  onClick={() => removePhoneNumber(phone.id)}
                  disabled={removingPhone === phone.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Suscripción ────────────────────────────────────────── */}
      <BillingSection />

      {/* ── Notificaciones ─────────────────────────────────────── */}
      <NotificationsSection />

      {/* Modal confirmación cambio fuente */}
      {confirmSource && (
        <Modal size="sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-slate-100">Cambiar fuente de catálogo</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Esta acción elimina los productos existentes</p>
            </div>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
            Al cambiar a <strong>{SOURCE_INFO[confirmSource]?.label}</strong>, se eliminarán{" "}
            <strong>{catalogSource?.counts[catalogSource?.active_source || ""] || 0} productos</strong> de{" "}
            <strong>{SOURCE_INFO[catalogSource?.active_source || "csv"]?.label}</strong>.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-5 leading-relaxed">
            {confirmSource === "csv"
              ? "Podrás subir un nuevo CSV después."
              : `Deberás sincronizar desde Integraciones → ${SOURCE_INFO[confirmSource]?.label}.`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmSource(null)}
              className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmChangeSource}
              disabled={changingSource}
              className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
            >
              {changingSource ? "Cambiando..." : "Sí, cambiar"}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal confirmación eliminar fuente */}
      {confirmDeleteSource && (
        <Modal size="sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-slate-100">
                Eliminar productos de {SOURCE_INFO[confirmDeleteSource]?.label}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Esta acción no se puede deshacer</p>
            </div>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-5">
            ¿Eliminar los{" "}
            <strong>{catalogSource?.counts[confirmDeleteSource] || 0} productos</strong> de{" "}
            <strong>{SOURCE_INFO[confirmDeleteSource]?.label}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDeleteSource(null)}
              disabled={deletingSource}
              className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer font-medium transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={deleteSource}
              disabled={deletingSource}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {deletingSource ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Sí, eliminar"
              )}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Billing section ─────────────────────────────────────────────────────────

function BillingSection() {
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    setLoading(true);
    try {
      const res = await billingApi.getPortalUrl();
      window.location.href = res.data.portal_url;
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || "Error al abrir el portal de suscripción"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-3">
        <div className="w-8 h-8 bg-violet-50 dark:bg-violet-500/15 rounded-lg flex items-center justify-center">
          <CreditCard className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">Suscripción</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Gestiona tu plan, facturas y método de pago
          </p>
        </div>
      </div>
      <div className="px-6 py-5">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Accede al portal de Stripe para ver tus facturas, cambiar de plan o actualizar tu método de pago.
        </p>
        <button
          onClick={openPortal}
          disabled={loading}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer shadow-sm"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ExternalLink className="w-4 h-4" />
          )}
          Gestionar suscripción
        </button>
      </div>
    </section>
  );
}

// ─── Notifications section (isolated component to avoid re-renders) ───────────

function NotificationsSection() {
  const { permission, enabled, toggleEnabled, requestAndEnable } = useNotifications();

  const statusConfig = {
    granted: {
      icon: BellRing,
      label: "Activo",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      border: "border-emerald-100 dark:border-emerald-500/20",
    },
    default: {
      icon: Bell,
      label: "No configurado",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      border: "border-amber-100 dark:border-amber-500/20",
    },
    denied: {
      icon: BellOff,
      label: "Bloqueado por el navegador",
      color: "text-red-500 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-500/10",
      border: "border-red-100 dark:border-red-500/20",
    },
  } as const;

  const cfg = statusConfig[permission];
  const StatusIcon = cfg.icon;

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-50 dark:bg-blue-500/15 rounded-lg flex items-center justify-center">
          <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">Notificaciones del navegador</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Recibe alertas cuando lleguen mensajes nuevos
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Status badge */}
        <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border ${cfg.bg} ${cfg.border}`}>
          <StatusIcon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
        </div>

        {/* Toggle — only when granted */}
        {permission === "granted" && (
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                Notificaciones activas
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Recibe alertas de mensajes nuevos aunque no estés en esta pestaña
              </p>
            </div>
            <button
              onClick={() => toggleEnabled(!enabled)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 ${
                enabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
              }`}
              role="switch"
              aria-checked={enabled}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}

        {/* Request button — only when default */}
        {permission === "default" && (
          <button
            onClick={requestAndEnable}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer shadow-sm"
          >
            <Bell className="w-4 h-4" />
            Solicitar permiso de notificaciones
          </button>
        )}

        {/* Denied instructions */}
        {permission === "denied" && (
          <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              Para activarlas, sigue estos pasos:
            </p>
            <ol className="text-xs text-gray-500 dark:text-slate-400 space-y-1 list-decimal list-inside">
              <li>Haz clic en el icono del candado en la barra de dirección</li>
              <li>Busca la opción &quot;Notificaciones&quot;</li>
              <li>Cámbiala a &quot;Permitir&quot;</li>
              <li>Recarga la página</li>
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
