"use client";
import { useEffect, useState } from "react";
import api, { integrationsApi } from "@/lib/api";
import {
  Database, ShoppingBag, FileSpreadsheet, RefreshCw,
  CheckCircle2, XCircle, Link, Loader2, Key, Edit2,
  Copy, RotateCcw, Globe, AlertTriangle, Eye, EyeOff,
} from "lucide-react";
import toast from "react-hot-toast";
import { PageHeader } from "@/components/ui/PageHeader";

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  last_sync_at: string | null;
  products_synced: number;
  store_name: string | null;
  token_hint: string | null;
}

interface PriceList { id: string; name: string; }

interface WooStatus {
  connected: boolean;
  hint: string | null;
  products_synced: number;
  last_sync_at: string | null;
  store_url: string | null;
}

const inputCls = "w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-shadow";

export default function IntegrationsPage() {
  const [jumpseller, setJumpseller] = useState<IntegrationStatus | null>(null);
  const [bsale, setBsale] = useState<IntegrationStatus | null>(null);
  const [shopify, setShopify] = useState<IntegrationStatus | null>(null);
  const [ml, setMl] = useState<IntegrationStatus | null>(null);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Shopify
  const [sfShop, setSfShop] = useState("");
  const [sfToken, setSfToken] = useState("");
  const [sfConnecting, setSfConnecting] = useState(false);
  const [sfEditing, setSfEditing] = useState(false);

  // MercadoLibre
  const [mlAppId, setMlAppId] = useState("");
  const [mlSecret, setMlSecret] = useState("");
  const [mlSellerId, setMlSellerId] = useState("");
  const [mlSiteId, setMlSiteId] = useState("MLC");
  const [mlConnecting, setMlConnecting] = useState(false);
  const [mlEditing, setMlEditing] = useState(false);

  // WooCommerce
  const [woo, setWoo] = useState<WooStatus | null>(null);
  const [wooToken, setWooToken] = useState<string | null>(null); // token completo (solo al generar)
  const [wooGenerating, setWooGenerating] = useState(false);
  const [wooRevoking, setWooRevoking] = useState(false);
  const [wooTokenVisible, setWooTokenVisible] = useState(false);

  const [jsLogin, setJsLogin] = useState("");
  const [jsToken, setJsToken] = useState("");
  const [jsConnecting, setJsConnecting] = useState(false);
  const [jsEditing, setJsEditing] = useState(false);

  const [bsToken, setBsToken] = useState("");
  const [bsPriceListId, setBsPriceListId] = useState("");
  const [bsMaxProducts, setBsMaxProducts] = useState("500");
  const [bsConnecting, setBsConnecting] = useState(false);
  const [bsEditing, setBsEditing] = useState(false);

  const loadStatus = async () => {
    try {
      const [jsRes, bsRes, sfRes, mlRes, wooRes] = await Promise.all([
        api.get("/api/v1/integrations/jumpseller/status"),
        api.get("/api/v1/integrations/bsale/status"),
        api.get("/api/v1/integrations/shopify/status"),
        api.get("/api/v1/integrations/mercadolibre/status"),
        integrationsApi.woocommerce.status(),
      ]);
      setJumpseller(jsRes.data);
      setBsale(bsRes.data);
      setShopify(sfRes.data);
      setMl(mlRes.data);
      setWoo(wooRes.data);
      if (bsRes.data.connected) {
        try {
          const pl = await api.get("/api/v1/integrations/bsale/price-lists");
          setPriceLists(pl.data);
        } catch {}
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadStatus(); }, []);

  const connectJumpseller = async () => {
    if (!jsLogin || !jsToken) return toast.error("Completa login y token");
    setJsConnecting(true);
    try {
      await api.post("/api/v1/integrations/jumpseller/connect", { login: jsLogin, auth_token: jsToken });
      toast.success(jumpseller?.connected ? "Credenciales actualizadas" : "Jumpseller conectado");
      setJsLogin(""); setJsToken(""); setJsEditing(false);
      loadStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error conectando Jumpseller");
    } finally { setJsConnecting(false); }
  };

  const connectBsale = async () => {
    if (!bsToken) return toast.error("Ingresa el access token");
    setBsConnecting(true);
    try {
      await api.post("/api/v1/integrations/bsale/connect", {
        access_token: bsToken,
        price_list_id: bsPriceListId ? parseInt(bsPriceListId) : null,
      });
      toast.success(bsale?.connected ? "Credenciales actualizadas" : "Bsale conectado");
      setBsToken(""); setBsEditing(false);
      loadStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error conectando Bsale");
    } finally { setBsConnecting(false); }
  };

  const sync = async (provider: string) => {
    setSyncing(provider);
    try {
      const body = provider === "bsale" ? { max_products: parseInt(bsMaxProducts) || 500 } : {};
      await api.post(`/api/v1/integrations/${provider}/sync`, body);
      toast.success("Sincronización iniciada. Espera 1-3 minutos.");
      setTimeout(() => loadStatus(), 12000);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al sincronizar");
    } finally { setSyncing(null); }
  };

  const disconnect = async (provider: string) => {
    if (!confirm(`¿Desconectar ${provider}? Los productos sincronizados se mantienen hasta la próxima sincronización.`)) return;
    try {
      await api.delete(`/api/v1/integrations/${provider}/disconnect`);
      toast.success(`${provider} desconectado`);
      if (provider === "jumpseller") setJsEditing(false);
      if (provider === "bsale") setBsEditing(false);
      loadStatus();
    } catch { toast.error("Error desconectando"); }
  };

  const connectML = async () => {
    if (!mlAppId || !mlSecret || !mlSellerId) return toast.error("Completa App ID, Secret Key y Seller ID");
    setMlConnecting(true);
    try {
      const res = await api.post("/api/v1/integrations/mercadolibre/connect", {
        app_id: mlAppId, secret_key: mlSecret,
        seller_id: mlSellerId, site_id: mlSiteId,
      });
      toast.success(ml?.connected ? "Credenciales actualizadas" : `MercadoLibre conectado — ${res.data.store_name}`);
      setMlAppId(""); setMlSecret(""); setMlSellerId(""); setMlEditing(false);
      loadStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error conectando MercadoLibre");
    } finally { setMlConnecting(false); }
  };

  const connectShopify = async () => {
    if (!sfShop || !sfToken) return toast.error("Completa el dominio y el token");
    setSfConnecting(true);
    try {
      const res = await api.post("/api/v1/integrations/shopify/connect", {
        shop: sfShop,
        access_token: sfToken,
      });
      toast.success(shopify?.connected ? "Credenciales actualizadas" : `Shopify conectado — ${res.data.store_name}`);
      setSfShop(""); setSfToken(""); setSfEditing(false);
      loadStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error conectando Shopify");
    } finally { setSfConnecting(false); }
  };

  const generateWooToken = async () => {
    setWooGenerating(true);
    try {
      const res = await integrationsApi.woocommerce.generateToken();
      setWooToken(res.data.token);
      setWooTokenVisible(true);
      setWoo((prev) => ({ ...prev!, connected: true, hint: res.data.hint }));
      toast.success("Token generado. Cópialo ahora — no se volverá a mostrar completo.");
    } catch {
      toast.error("Error generando token");
    } finally {
      setWooGenerating(false);
    }
  };

  const revokeWooToken = async () => {
    if (!confirm("¿Revocar el token? El plugin WP dejará de poder sincronizar hasta que generes uno nuevo.")) return;
    setWooRevoking(true);
    try {
      await integrationsApi.woocommerce.revokeToken();
      setWooToken(null);
      setWoo(null);
      toast.success("Token revocado");
    } catch {
      toast.error("Error revocando token");
    } finally {
      setWooRevoking(false);
    }
  };

  const copyToken = async () => {
    if (!wooToken) return;
    await navigator.clipboard.writeText(wooToken);
    toast.success("Token copiado al portapapeles");
  };

  const fmt = (iso: string | null) => {
    if (!iso) return "Nunca";
    return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return (
    <div className="animate-pulse space-y-4 max-w-2xl">
      <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded-lg w-40 mb-6" />
      {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Integraciones"
        subtitle="Conecta tu tienda para sincronizar el catálogo automáticamente"
      />

      {/* ── Jumpseller ─────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-100 dark:bg-violet-900/50 rounded-xl flex items-center justify-center">
              <ShoppingBag className="text-violet-600 dark:text-violet-400" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Jumpseller</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {jumpseller?.connected ? jumpseller.store_name || "Conectado" : "No conectado"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {jumpseller?.connected && (
              <button
                onClick={() => setJsEditing(!jsEditing)}
                className="text-xs flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer font-medium"
              >
                <Edit2 className="w-3 h-3" />
                {jsEditing ? "Cancelar" : "Editar"}
              </button>
            )}
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full ${
              jumpseller?.connected
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
            }`}>
              {jumpseller?.connected
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> Conectado</>
                : <><XCircle className="w-3.5 h-3.5" /> Desconectado</>}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {jumpseller?.connected && !jsEditing && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-600">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Productos sincronizados</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{jumpseller.products_synced.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-600">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Última sincronización</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmt(jumpseller.last_sync_at)}</p>
                </div>
              </div>
              {jumpseller.token_hint && (
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  <Key className="w-3 h-3" />
                  <span>Token: <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md font-mono">{jumpseller.token_hint}</code></span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => sync("jumpseller")}
                  disabled={syncing === "jumpseller"}
                  className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
                >
                  {syncing === "jumpseller" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {syncing === "jumpseller" ? "Sincronizando..." : "Sincronizar ahora"}
                </button>
                <button
                  onClick={() => disconnect("jumpseller")}
                  className="px-3.5 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-colors cursor-pointer font-medium"
                >
                  Desconectar
                </button>
              </div>
            </>
          )}

          {(!jumpseller?.connected || jsEditing) && (
            <div className="space-y-3">
              {jsEditing && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  Las nuevas credenciales reemplazarán el token actual.
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Obtén las credenciales desde <strong className="text-slate-700 dark:text-slate-300">Jumpseller Admin → API</strong>
              </p>
              <input value={jsLogin} onChange={(e) => setJsLogin(e.target.value)} placeholder="Login Key" className={inputCls} />
              <input value={jsToken} onChange={(e) => setJsToken(e.target.value)} placeholder="Auth Token" type="password" className={inputCls} />
              <button
                onClick={connectJumpseller}
                disabled={jsConnecting}
                className="flex items-center justify-center gap-2 bg-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 w-full transition-colors cursor-pointer shadow-sm"
              >
                {jsConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                {jsConnecting ? "Verificando..." : jsEditing ? "Actualizar credenciales" : "Conectar Jumpseller"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Bsale ──────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center">
              <Database className="text-amber-600 dark:text-amber-400" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Bsale</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {bsale?.connected ? bsale.store_name || "Conectado" : "No conectado"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {bsale?.connected && (
              <button
                onClick={() => setBsEditing(!bsEditing)}
                className="text-xs flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer font-medium"
              >
                <Edit2 className="w-3 h-3" />
                {bsEditing ? "Cancelar" : "Editar"}
              </button>
            )}
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full ${
              bsale?.connected
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
            }`}>
              {bsale?.connected
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> Conectado</>
                : <><XCircle className="w-3.5 h-3.5" /> Desconectado</>}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {bsale?.connected && !bsEditing && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-600">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Productos sincronizados</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{bsale.products_synced.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-600">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Última sincronización</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmt(bsale.last_sync_at)}</p>
                </div>
              </div>
              {bsale.token_hint && (
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  <Key className="w-3 h-3" />
                  <span>Token: <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md font-mono">{bsale.token_hint}</code></span>
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Máx. productos:</label>
                  <select
                    value={bsMaxProducts}
                    onChange={(e) => setBsMaxProducts(e.target.value)}
                    className="border border-slate-200 dark:border-slate-600 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <option value="200">200</option>
                    <option value="500">500</option>
                    <option value="1000">1.000</option>
                    <option value="2000">2.000</option>
                  </select>
                </div>
                {priceLists.length > 0 && (
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0 font-medium">Lista precio:</label>
                    <select
                      value={bsPriceListId}
                      onChange={(e) => setBsPriceListId(e.target.value)}
                      className="border border-slate-200 dark:border-slate-600 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none flex-1 min-w-0 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      {priceLists.map((pl) => (
                        <option key={pl.id} value={pl.id}>{pl.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => sync("bsale")}
                  disabled={syncing === "bsale"}
                  className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
                >
                  {syncing === "bsale" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {syncing === "bsale" ? "Sincronizando..." : "Sincronizar ahora"}
                </button>
                <button
                  onClick={() => disconnect("bsale")}
                  className="px-3.5 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-colors cursor-pointer font-medium"
                >
                  Desconectar
                </button>
              </div>
            </>
          )}

          {(!bsale?.connected || bsEditing) && (
            <div className="space-y-3">
              {bsEditing && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  El nuevo token reemplazará el token actual de forma segura.
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Obtén tu token desde <strong className="text-slate-700 dark:text-slate-300">Bsale Admin → Mi perfil → Token API</strong>
              </p>
              <input
                value={bsToken}
                onChange={(e) => setBsToken(e.target.value)}
                placeholder="Access Token de Bsale"
                type="password"
                className={inputCls}
              />
              <button
                onClick={connectBsale}
                disabled={bsConnecting}
                className="flex items-center justify-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 w-full transition-colors cursor-pointer shadow-sm"
              >
                {bsConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                {bsConnecting ? "Verificando..." : bsEditing ? "Actualizar token" : "Conectar Bsale"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Shopify ────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
              {/* Shopify bag icon */}
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-emerald-600 dark:fill-emerald-400" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.622-17.73a.333.333 0 00-.33-.282c-.15 0-2.914-.057-2.914-.057s-1.94-1.883-2.14-2.083v21.713zM11.39 2.581c-.013.036-.787 2.434-.787 2.434S9.366 4.63 8.544 4.63c-3.3 0-4.896 4.126-4.896 7.775 0 2.603 1.357 3.979 2.665 3.979 1.339 0 2.146-.878 2.898-2.05l-.001.004-.455 5.66-2.63.003L4.36 23.97l9.617-2.08L15.34 2.583l-3.95-.002zm-1.688 12.3c-.603.9-1.143 1.395-1.796 1.395-.745 0-1.108-.663-1.108-1.974 0-2.494 1.143-5.154 2.733-5.154.437 0 .832.105 1.162.3l-.991 5.433zM13.972.333s-1.31.375-3.44.375c-.22 0-.435-.007-.645-.019C9.516.298 8.81 0 8.81 0l-.327 2.578 3.532.002 1.957-.002L13.972.333z"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Shopify</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {shopify?.connected ? shopify.store_name || "Conectado" : "No conectado"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {shopify?.connected && (
              <button
                onClick={() => setSfEditing(!sfEditing)}
                className="text-xs flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer font-medium"
              >
                <Edit2 className="w-3 h-3" />
                {sfEditing ? "Cancelar" : "Editar"}
              </button>
            )}
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full ${
              shopify?.connected
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
            }`}>
              {shopify?.connected
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> Conectado</>
                : <><XCircle className="w-3.5 h-3.5" /> Desconectado</>}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {shopify?.connected && !sfEditing && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-600">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Productos sincronizados</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{shopify.products_synced.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-600">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Última sincronización</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmt(shopify.last_sync_at)}</p>
                </div>
              </div>
              {shopify.token_hint && (
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  <Key className="w-3 h-3" />
                  <span>Token: <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md font-mono">{shopify.token_hint}</code></span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => sync("shopify")}
                  disabled={syncing === "shopify"}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
                >
                  {syncing === "shopify" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {syncing === "shopify" ? "Sincronizando..." : "Sincronizar ahora"}
                </button>
                <button
                  onClick={() => disconnect("shopify")}
                  className="px-3.5 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-colors cursor-pointer font-medium"
                >
                  Desconectar
                </button>
              </div>
            </>
          )}

          {(!shopify?.connected || sfEditing) && (
            <div className="space-y-3">
              {sfEditing && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  Las nuevas credenciales reemplazarán el token actual.
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Obtén el token en <strong className="text-slate-700 dark:text-slate-300">Shopify Admin → Configuración → Apps → Develop apps</strong>. Necesitas permisos <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-[11px]">read_products</code> e <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-[11px]">read_inventory</code>.
              </p>
              <input
                value={sfShop}
                onChange={(e) => setSfShop(e.target.value)}
                placeholder="mitienda.myshopify.com"
                className={inputCls}
              />
              <input
                value={sfToken}
                onChange={(e) => setSfToken(e.target.value)}
                placeholder="Admin API Access Token"
                type="password"
                className={inputCls}
              />
              <button
                onClick={connectShopify}
                disabled={sfConnecting}
                className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 w-full transition-colors cursor-pointer shadow-sm"
              >
                {sfConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                {sfConnecting ? "Verificando..." : sfEditing ? "Actualizar credenciales" : "Conectar Shopify"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── MercadoLibre ───────────────────────────────── */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-100 dark:bg-yellow-900/40 rounded-xl flex items-center justify-center">
              {/* ML wordmark icon */}
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 6.628 5.374 12 12 12 6.628 0 12-5.372 12-12 0-6.627-5.372-12-12-12z" fill="#FFE600"/>
                <path d="M12 3.5c-4.694 0-8.5 3.806-8.5 8.5s3.806 8.5 8.5 8.5 8.5-3.806 8.5-8.5-3.806-8.5-8.5-8.5zm0 2a6.5 6.5 0 110 13 6.5 6.5 0 010-13z" fill="#333"/>
                <path d="M8.5 10.5l1.5 2 1.5-2 1.5 2 1.5-2v4h-6v-4z" fill="#333"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">MercadoLibre</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {ml?.connected ? ml.store_name || "Conectado" : "No conectado"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ml?.connected && (
              <button
                onClick={() => setMlEditing(!mlEditing)}
                className="text-xs flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer font-medium"
              >
                <Edit2 className="w-3 h-3" />
                {mlEditing ? "Cancelar" : "Editar"}
              </button>
            )}
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full ${
              ml?.connected
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
            }`}>
              {ml?.connected
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> Conectado</>
                : <><XCircle className="w-3.5 h-3.5" /> Desconectado</>}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {ml?.connected && !mlEditing && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-600">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Productos sincronizados</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{ml.products_synced.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-600">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Última sincronización</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmt(ml.last_sync_at)}</p>
                </div>
              </div>
              {ml.token_hint && (
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  <Key className="w-3 h-3" />
                  <span>Secret: <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md font-mono">{ml.token_hint}</code></span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => sync("mercadolibre")}
                  disabled={syncing === "mercadolibre"}
                  className="flex-1 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
                >
                  {syncing === "mercadolibre" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {syncing === "mercadolibre" ? "Sincronizando..." : "Sincronizar ahora"}
                </button>
                <button
                  onClick={() => disconnect("mercadolibre")}
                  className="px-3.5 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-colors cursor-pointer font-medium"
                >
                  Desconectar
                </button>
              </div>
            </>
          )}

          {(!ml?.connected || mlEditing) && (
            <div className="space-y-3">
              {mlEditing && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  Las nuevas credenciales reemplazarán las actuales.
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Obtén las credenciales en <strong className="text-slate-700 dark:text-slate-300">developers.mercadolibre.com → Mis Apps → Crear App</strong>. Tu Seller ID está en tu perfil de ML.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input value={mlAppId} onChange={(e) => setMlAppId(e.target.value)} placeholder="App ID" className={inputCls} />
                <select value={mlSiteId} onChange={(e) => setMlSiteId(e.target.value)} className={`${inputCls} cursor-pointer`}>
                  <option value="MLC">🇨🇱 Chile (MLC)</option>
                  <option value="MLA">🇦🇷 Argentina (MLA)</option>
                  <option value="MLB">🇧🇷 Brasil (MLB)</option>
                  <option value="MLM">🇲🇽 México (MLM)</option>
                  <option value="MLU">🇺🇾 Uruguay (MLU)</option>
                  <option value="MLP">🇵🇪 Perú (MLP)</option>
                  <option value="MCO">🇨🇴 Colombia (MCO)</option>
                </select>
              </div>
              <input value={mlSecret} onChange={(e) => setMlSecret(e.target.value)} placeholder="Secret Key" type="password" className={inputCls} />
              <input value={mlSellerId} onChange={(e) => setMlSellerId(e.target.value)} placeholder="Seller ID (número)" className={inputCls} />
              <button
                onClick={connectML}
                disabled={mlConnecting}
                className="flex items-center justify-center gap-2 bg-yellow-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-yellow-600 disabled:opacity-50 w-full transition-colors cursor-pointer shadow-sm"
              >
                {mlConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                {mlConnecting ? "Verificando..." : mlEditing ? "Actualizar credenciales" : "Conectar MercadoLibre"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── CSV ────────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
            <FileSpreadsheet className="text-slate-500 dark:text-slate-400" style={{ width: 18, height: 18 }} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">CSV Manual</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Siempre disponible</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" /> Disponible
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 ml-12">
          Para subir tu catálogo CSV ve a <strong className="text-slate-700 dark:text-slate-300">Configuración → Fuente del catálogo → CSV</strong>.
        </p>
      </section>

      {/* ── WordPress / WooCommerce ────────────────────── */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-100 dark:bg-sky-900/50 rounded-xl flex items-center justify-center">
              {/* WordPress logo */}
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-sky-600 dark:fill-sky-400" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM3.577 12c0-1.025.2-2.003.557-2.9L7.47 19.61A8.432 8.432 0 013.577 12zm8.423 8.423a8.455 8.455 0 01-2.408-.352l2.557-7.43 2.62 7.181a.41.41 0 00.031.061 8.462 8.462 0 01-2.8.54zm1.165-12.37c.507-.027.965-.08.965-.08.455-.054.401-.722-.054-.695 0 0-1.366.107-2.247.107-.828 0-2.22-.107-2.22-.107-.455-.027-.509.668-.054.695 0 0 .43.053.884.08l1.313 3.598-1.845 5.531-3.069-9.129c.508-.027.965-.08.965-.08.455-.054.401-.722-.054-.695 0 0-1.365.107-2.247.107-.158 0-.344-.004-.541-.01A8.428 8.428 0 0112 3.577c2.203 0 4.21.843 5.717 2.22-.036-.003-.072-.007-.11-.007-.828 0-1.415.722-1.415 1.496 0 .695.401 1.283.829 1.978.321.562.696 1.284.696 2.326 0 .722-.276 1.56-.641 2.726l-.84 2.806-3.071-9.069zm3.92 11.585l2.607-7.531c.486-1.216.648-2.19.648-3.057 0-.314-.02-.604-.059-.878A8.424 8.424 0 0120.42 12a8.436 8.436 0 01-3.335 6.638z"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">WordPress / WooCommerce</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {woo?.connected ? (woo.store_url || "Conectado vía plugin") : "Plugin de catálogo"}
              </p>
            </div>
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full ${
            woo?.connected
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
              : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
          }`}>
            {woo?.connected
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> Activo</>
              : <><XCircle className="w-3.5 h-3.5" /> Sin token</>}
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Stats si ya hay sync */}
          {woo?.connected && woo.products_synced > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-600">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Productos sincronizados</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{woo.products_synced.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/60 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-600">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-0.5">Última sincronización</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmt(woo.last_sync_at)}</p>
              </div>
            </div>
          )}

          {/* Token completo (solo justo después de generar) */}
          {wooToken && (
            <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-sky-700 dark:text-sky-300 font-medium">
                  Copia este token ahora — no volverás a verlo completo.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <code className={`block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 overflow-hidden ${wooTokenVisible ? "" : "blur-sm select-none"}`}>
                    {wooToken}
                  </code>
                </div>
                <button
                  onClick={() => setWooTokenVisible((v) => !v)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  aria-label={wooTokenVisible ? "Ocultar token" : "Mostrar token"}
                >
                  {wooTokenVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={copyToken}
                  className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </button>
              </div>
            </div>
          )}

          {/* Hint si ya tiene token pero no lo acabó de generar */}
          {!wooToken && woo?.connected && woo.hint && (
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
              <Key className="w-3 h-3" />
              <span>Token activo: <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md font-mono">{woo.hint}</code></span>
            </div>
          )}

          {/* Instrucciones de instalación */}
          <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-4 space-y-2.5 border border-slate-100 dark:border-slate-600">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              Cómo conectar tu tienda
            </p>
            <ol className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 list-none">
              <li className="flex gap-2"><span className="flex-shrink-0 w-4 h-4 bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center font-bold text-[10px]">1</span>Genera un token de API aquí abajo</li>
              <li className="flex gap-2"><span className="flex-shrink-0 w-4 h-4 bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center font-bold text-[10px]">2</span>Descarga e instala el plugin <strong className="text-slate-600 dark:text-slate-300">VentaTalk Chat Widget</strong> en tu WordPress</li>
              <li className="flex gap-2"><span className="flex-shrink-0 w-4 h-4 bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center font-bold text-[10px]">3</span>En <strong className="text-slate-600 dark:text-slate-300">Ajustes → VentaTalk</strong> pega el token generado</li>
              <li className="flex gap-2"><span className="flex-shrink-0 w-4 h-4 bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center font-bold text-[10px]">4</span>Haz clic en <strong className="text-slate-600 dark:text-slate-300">Sincronizar catálogo</strong> — los productos aparecen aquí automáticamente</li>
            </ol>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2">
            <button
              onClick={generateWooToken}
              disabled={wooGenerating}
              className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
            >
              {wooGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              {wooGenerating ? "Generando..." : woo?.connected ? "Regenerar token" : "Generar token de API"}
            </button>
            {woo?.connected && (
              <button
                onClick={revokeWooToken}
                disabled={wooRevoking}
                className="px-3.5 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-colors cursor-pointer font-medium flex items-center gap-1.5"
              >
                {wooRevoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Revocar
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Próximamente ───────────────────────────────── */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Próximamente</p>
        <div className="flex flex-wrap gap-2">
          {["Shopify", "MercadoLibre", "Mercado Shops"].map((name) => (
            <span key={name} className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 px-3 py-1.5 rounded-full font-medium">
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
