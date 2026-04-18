"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import toast from "react-hot-toast";
import { AuthCard } from "@/components/auth/AuthCard";

const inputCls = "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 placeholder:text-slate-400 transition-shadow";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.register(form.name, form.email, form.password);
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      toast.success("¡Cuenta creada! Bienvenido.");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof typeof form, label: string, type = "text", placeholder = "") => (
    <div>
      <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
      <input
        type={type}
        required
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );

  return (
    <AuthCard
      title="Crear cuenta"
      subtitle="Gratis durante los primeros 30 días"
      footer={
        <p className="text-xs text-center text-slate-400">
          ¿Ya tienes cuenta?{" "}
          <a href="/auth/login" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline">
            Inicia sesión
          </a>
        </p>
      }
    >
      <form onSubmit={handle} className="space-y-4">
        {field("name", "Nombre del negocio", "text", "Clínica Bella")}
        {field("email", "Email", "email", "admin@miclinica.cl")}
        {field("password", "Contraseña", "password", "••••••••")}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer shadow-sm mt-2"
        >
          {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
        </button>
      </form>
    </AuthCard>
  );
}
