import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// Inyectar token en cada request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirigir al login si el token expiró
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      window.location.href = "/auth/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/api/v1/auth/login", new URLSearchParams({ username: email, password }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }),
  register: (name: string, email: string, password: string) =>
    api.post("/api/v1/auth/register", { name, email, password }),
  me: () => api.get("/api/v1/auth/me"),
};

// ── Conversations ─────────────────────────────────────────────────
export const conversationsApi = {
  list: (params?: { status?: string; page?: number }) =>
    api.get("/api/v1/conversations", { params }),
  get: (id: string) => api.get(`/api/v1/conversations/${id}`),
  reply: (id: string, text: string) =>
    api.post(`/api/v1/conversations/${id}/reply`, { text }),
  assign: (id: string) => api.put(`/api/v1/conversations/${id}/assign`),
  close: (id: string) => api.put(`/api/v1/conversations/${id}/close`),
};

// ── Contacts ──────────────────────────────────────────────────────
export const contactsApi = {
  list: (params?: { page?: number; search?: string }) =>
    api.get("/api/v1/contacts", { params }),
  get: (id: string) => api.get(`/api/v1/contacts/${id}`),
  update: (id: string, data: object) => api.patch(`/api/v1/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/api/v1/contacts/${id}`),
};

// ── Leads ─────────────────────────────────────────────────────────
export const leadsApi = {
  list: (stage?: string) => api.get("/api/v1/leads", { params: { stage } }),
  updateStage: (id: string, stage: string, data?: object) =>
    api.put(`/api/v1/leads/${id}/stage`, { stage, ...data }),
  create: (contact_id: string) =>
    api.post("/api/v1/leads", { contact_id }),
};

// ── Integrations ──────────────────────────────────────────────────
export const integrationsApi = {
  woocommerce: {
    status:        ()  => api.get("/api/v1/integrations/woocommerce/status"),
    generateToken: ()  => api.post<{ token: string; hint: string }>("/api/v1/integrations/woocommerce/token"),
    revokeToken:   ()  => api.delete("/api/v1/integrations/woocommerce/token"),
  },
};

// ── Phone Numbers ─────────────────────────────────────────────────
export const phoneNumbersApi = {
  list: () => api.get("/api/v1/phone-numbers"),
  add: (data: {
    phone_number_id: string;
    phone_number: string;
    display_name: string;
    access_token: string;
    waba_id: string;
  }) => api.post("/api/v1/phone-numbers", data),
  remove: (id: string) => api.delete(`/api/v1/phone-numbers/${id}`),
};

// ── Tracking ──────────────────────────────────────────────────────
export const trackingApi = {
  createLink: (conversationId: string, data: { destination_url: string; label?: string }) =>
    api.post(`/api/v1/conversations/${conversationId}/tracking-link`, data),
  listLinks: (conversationId: string) =>
    api.get(`/api/v1/conversations/${conversationId}/tracking-links`),
};

// ── Analytics ─────────────────────────────────────────────────────
export const analyticsApi = {
  overview: () => api.get("/api/v1/analytics/overview"),
  conversations: (days = 30) =>
    api.get("/api/v1/analytics/conversations", { params: { days } }),
};

// ── Business ──────────────────────────────────────────────────────
export const businessApi = {
  uploadCatalog: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/api/v1/business/catalog", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getCatalog: () => api.get("/api/v1/business/catalog"),
  updateProfile: (data: object) => api.put("/api/v1/business/profile", data),
};

export default api;
