"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import toast from "react-hot-toast";
import { AuthCard } from "@/components/auth/AuthCard";

const inputCls = "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 placeholder:text-slate-400 transition-shadow";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch {
      toast.error("Email o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Iniciar sesión"
      subtitle="Accede a tu panel de control"
      footer={
        <p className="text-xs text-center text-slate-400">
          ¿Sin cuenta?{" "}
          <a href="/auth/register" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline">
            Regístrate gratis
          </a>
        </p>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="tu@negocio.cl"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">Contraseña</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer shadow-sm mt-2"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </AuthCard>
  );
}
