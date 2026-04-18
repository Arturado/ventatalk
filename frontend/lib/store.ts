import { create } from "zustand";
import { authApi, msUntilExpiry } from "@/lib/api";

interface Business {
  id: string;
  name: string;
  email: string;
  plan: string;
  ai_tone: string;
  ai_enabled: boolean;
}

interface AuthState {
  business: Business | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

// Umbral: si el access token expira en menos de 1 día, refrescarlo al montar.
const PROACTIVE_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export const useAuthStore = create<AuthState>((set) => ({
  business: null,
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    const res = await authApi.login(email, password);
    localStorage.setItem("access_token", res.data.access_token);
    localStorage.setItem("refresh_token", res.data.refresh_token);
    const me = await authApi.me();
    set({ business: me.data, loading: false });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ business: null });
    window.location.href = "/auth/login";
  },

  fetchMe: async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      // Refresh proactivo: si el token expira pronto, renovarlo antes de hacer /me
      const remaining = msUntilExpiry(token);
      if (remaining > 0 && remaining < PROACTIVE_REFRESH_THRESHOLD_MS) {
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          try {
            const r = await authApi.refresh(refreshToken);
            localStorage.setItem("access_token", r.data.access_token);
            localStorage.setItem("refresh_token", r.data.refresh_token);
          } catch {
            // Si el refresh falla aquí, el interceptor de 401 lo manejará
          }
        }
      }

      const me = await authApi.me();
      set({ business: me.data });
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
  },
}));
