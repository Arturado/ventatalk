import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" },
});

// ─── Token helpers ────────────────────────────────────────────────────────────

/** Decodifica el payload de un JWT sin verificar firma (client-side). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

/** Milisegundos hasta que expira el token. Retorna 0 si ya expiró o no parseable. */
export function msUntilExpiry(token: string): number {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return 0;
  return Math.max(0, payload.exp * 1000 - Date.now());
}

// ─── Refresh-queue: cola para peticiones simultáneas durante el refresh ───────

let isRefreshing = false;
let waitQueue: Array<(newToken: string) => void> = [];

function flushQueue(newToken: string) {
  waitQueue.forEach((cb) => cb(newToken));
  waitQueue = [];
}

async function doRefresh(): Promise<string> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) throw new Error("no refresh token");

  // Llamada directa — fuera del interceptor para evitar loop infinito
  const { data } = await axios.post(
    `${BASE}/api/v1/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: { "Content-Type": "application/json" } }
  );
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  return data.access_token as string;
}

// ─── Request interceptor — inyecta Bearer ─────────────────────────────────────

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor — retry transparente con refresh en 401 ─────────────

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as typeof err.config & { _retry?: boolean };

    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }

    original._retry = true;

    // Si ya hay un refresh en curso, encolar y esperar
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waitQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
        // Si el refresh falla, rechazar también esta petición
        setTimeout(() => reject(err), 15_000);
      });
    }

    isRefreshing = true;
    try {
      const newToken = await doRefresh();
      flushQueue(newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch {
      // Refresh falló → sesión expirada definitivamente
      waitQueue = [];
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      if (typeof window !== "undefined") window.location.href = "/auth/login";
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post("/api/v1/auth/login", new URLSearchParams({ username: email, password }), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }),
  register: (name: string, email: string, password: string) =>
    api.post("/api/v1/auth/register", { name, email, password }),
  me:      () => api.get("/api/v1/auth/me"),
  refresh: (token: string) =>
    api.post("/api/v1/auth/refresh", { refresh_token: token }),
};

// ─── Conversations ─────────────────────────────────────────────────────────────

export const conversationsApi = {
  list:   (params?: { status?: string; page?: number }) => api.get("/api/v1/conversations", { params }),
  get:    (id: string) => api.get(`/api/v1/conversations/${id}`),
  reply:  (id: string, text: string) => api.post(`/api/v1/conversations/${id}/reply`, { text }),
  assign: (id: string) => api.put(`/api/v1/conversations/${id}/assign`),
  close:  (id: string) => api.put(`/api/v1/conversations/${id}/close`),
};

// ─── Contacts ──────────────────────────────────────────────────────────────────

export const contactsApi = {
  list:   (params?: { page?: number; search?: string }) => api.get("/api/v1/contacts", { params }),
  get:    (id: string) => api.get(`/api/v1/contacts/${id}`),
  update: (id: string, data: object) => api.patch(`/api/v1/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/contacts/${id}`),
};

// ─── Leads ────────────────────────────────────────────────────────────────────

export const leadsApi = {
  list:        (stage?: string) => api.get("/api/v1/leads", { params: { stage } }),
  updateStage: (id: string, stage: string, data?: object) =>
    api.put(`/api/v1/leads/${id}/stage`, { stage, ...data }),
  create: (contact_id: string) => api.post("/api/v1/leads", { contact_id }),
};

// ─── Integrations ──────────────────────────────────────────────────────────────

export const integrationsApi = {
  woocommerce: {
    status:        () => api.get("/api/v1/integrations/woocommerce/status"),
    generateToken: () => api.post<{ token: string; hint: string }>("/api/v1/integrations/woocommerce/token"),
    revokeToken:   () => api.delete("/api/v1/integrations/woocommerce/token"),
  },
};

// ─── Phone Numbers ─────────────────────────────────────────────────────────────

export const phoneNumbersApi = {
  list: () => api.get("/api/v1/phone-numbers"),
  add:  (data: {
    phone_number_id: string; phone_number: string;
    display_name: string; access_token: string; waba_id: string;
  }) => api.post("/api/v1/phone-numbers", data),
  remove: (id: string) => api.delete(`/api/v1/phone-numbers/${id}`),
};

// ─── Tracking ──────────────────────────────────────────────────────────────────

export const trackingApi = {
  createLink: (conversationId: string, data: { destination_url: string; label?: string }) =>
    api.post(`/api/v1/conversations/${conversationId}/tracking-link`, data),
  listLinks:  (conversationId: string) =>
    api.get(`/api/v1/conversations/${conversationId}/tracking-links`),
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export const analyticsApi = {
  overview:      () => api.get("/api/v1/analytics/overview"),
  conversations: (days = 30) => api.get("/api/v1/analytics/conversations", { params: { days } }),
};

// ─── Business ─────────────────────────────────────────────────────────────────

export interface UsageData {
  plan: string;
  conversations_this_month: number;
  conversations_limit: number;
  conversations_pct: number;
  channels_used: number;
  channels_limit: number;
  catalog_items: number;
  catalog_limit: number;
  days_until_reset: number;
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export const billingApi = {
  createCheckoutSession: (plan: string) =>
    api.post<{ client_secret: string }>("/api/v1/billing/create-checkout-session", { plan }),
  getPortalUrl: () =>
    api.get<{ portal_url: string }>("/api/v1/billing/portal"),
};

// ─── Business ─────────────────────────────────────────────────────────────────

export const businessApi = {
  uploadCatalog: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/api/v1/business/catalog", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getCatalog:    () => api.get("/api/v1/business/catalog"),
  updateProfile: (data: object) => api.put("/api/v1/business/profile", data),
  usage:         () => api.get<UsageData>("/api/v1/business/usage"),
};

export default api;
