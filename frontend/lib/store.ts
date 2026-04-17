import { create } from "zustand";
import { authApi } from "@/lib/api";

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

export const useAuthStore = create<AuthState>((set) => ({
  business: null,
  loading: false,

  login: async (email, password) => {
    set({ loading: true });
    const res = await authApi.login(email, password);
    localStorage.setItem("access_token", res.data.access_token);
    const me = await authApi.me();
    set({ business: me.data, loading: false });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    set({ business: null });
    window.location.href = "/auth/login";
  },

  fetchMe: async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;
      const me = await authApi.me();
      set({ business: me.data });
    } catch {
      localStorage.removeItem("access_token");
    }
  },
}));
