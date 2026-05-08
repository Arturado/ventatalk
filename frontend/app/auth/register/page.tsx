"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        .vt-login-root { background: #f4f3ee; font-family: Inter, ui-sans-serif, system-ui; }
        .vt-panel-bg {
          background:
            radial-gradient(120% 80% at 0% 0%, #5b54ff 0%, transparent 55%),
            radial-gradient(80% 60% at 100% 100%, #1f1a4a 0%, transparent 50%),
            linear-gradient(160deg, #2a2270 0%, #15123a 100%);
        }
        .vt-panel-grid {
          background-image:
            linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .vt-grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: radial-gradient(rgba(0,0,0,.025) 1px, transparent 1px);
          background-size: 3px 3px;
          mix-blend-mode: multiply;
        }
        .vt-field:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 4px rgba(79,70,229,.14);
        }
        .vt-tag {
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.14);
          backdrop-filter: blur(6px);
        }
        .vt-serif { font-family: 'Instrument Serif', serif; }
        .vt-mono  { font-family: 'JetBrains Mono', monospace; }
        @keyframes vt-pop {
          0%   { opacity: 0; transform: translateY(8px) scale(.96); }
          100% { opacity: 1; transform: none; }
        }
        .vt-pop { animation: vt-pop .55s cubic-bezier(.2,.7,.2,1) both; }
      `}</style>

      <div className="vt-grain" aria-hidden="true" />

      <main className="vt-login-root relative z-10 min-h-screen w-full flex items-center justify-center p-6 md:p-10">

        {/* Brandmark */}
        <a href="/" className="absolute top-6 left-6 md:top-8 md:left-10 flex items-center gap-2.5">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-[#0e0e12] text-white">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16v11H8l-4 4z" />
              <path d="M9 10.5l2.2 2.2L15.5 8.5" />
            </svg>
          </span>
          <span className="font-semibold tracking-tight text-[15px] text-[#0e0e12]">VentaTalk</span>
        </a>

        {/* Top-right link */}
        <div className="absolute top-6 right-6 md:top-8 md:right-10 flex items-center gap-3 text-[13px] text-[#5a5a6b]">
          <span className="hidden sm:inline">¿Ya tienes cuenta?</span>
          <Link href="/auth/login" className="px-3 py-1.5 rounded-full border border-[#0e0e12]/10 hover:border-[#0e0e12]/30 hover:bg-white transition">
            Iniciar sesión
          </Link>
        </div>

        {/* Card */}
        <section
          className="relative w-full max-w-[1080px] grid grid-cols-1 md:grid-cols-[1.05fr_1fr] rounded-[22px] overflow-hidden bg-white border border-[#0e0e12]/[.06]"
          style={{ boxShadow: "0 1px 0 rgba(15,15,30,.04), 0 24px 60px -24px rgba(50,40,120,.18)" }}
        >

          {/* ── LEFT panel ── */}
          <aside className="vt-panel-bg relative text-white p-8 md:p-10 min-h-[580px] overflow-hidden">
            <div className="vt-panel-grid absolute inset-0 opacity-60" aria-hidden="true" />

            {/* Glow blobs */}
            <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full blur-3xl opacity-40" style={{ background: "#7c6dff" }} aria-hidden="true" />
            <div className="absolute -bottom-28 -right-10 w-80 h-80 rounded-full blur-3xl opacity-30" style={{ background: "#10b981" }} aria-hidden="true" />

            <div className="relative h-full flex flex-col">

              {/* Badge */}
              <div>
                <span className="vt-tag inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11.5px] font-medium tracking-wide text-white/85">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Gratis los primeros 30 días
                </span>
              </div>

              {/* Headline */}
              <div className="mt-7 max-w-[420px]">
                <h1 className="vt-serif text-[42px] leading-[1.15] tracking-tight pb-1">
                  Empieza a vender más <em className="not-italic text-white/70">hoy mismo</em>.
                </h1>
                <p className="mt-4 text-[14px] leading-relaxed text-white/70">
                  Configura tu cuenta en minutos. Sin tarjeta de crédito. Cancela cuando quieras.
                </p>
              </div>

              {/* Feature list */}
              <div className="relative mt-10 flex-1 flex flex-col justify-center space-y-4">
                {[
                  {
                    icon: "M4 5h16v11H8l-4 4z",
                    title: "Bandeja unificada",
                    desc: "WhatsApp, Instagram y web en un solo lugar",
                  },
                  {
                    icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
                    title: "IA que responde por ti",
                    desc: "Respuestas automáticas entrenadas con tu catálogo",
                  },
                  {
                    icon: "M3 3h18v18H3zM9 9h6M9 12h6M9 15h4",
                    title: "Reportes en tiempo real",
                    desc: "Conversiones, tiempos de respuesta y satisfacción",
                  },
                  {
                    icon: "M12 2L4 6v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6z",
                    title: "Datos 100% seguros",
                    desc: "Encriptación end-to-end y cumplimiento GDPR",
                  },
                ].map((feat, i) => (
                  <div key={i} className="vt-pop flex items-start gap-3" style={{ animationDelay: `${i * 0.08}s` }}>
                    <span className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 grid place-items-center shrink-0 mt-0.5">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white/80" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d={feat.icon} />
                      </svg>
                    </span>
                    <div>
                      <div className="text-[13px] font-medium text-white">{feat.title}</div>
                      <div className="text-[12px] text-white/55 leading-snug">{feat.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Social proof */}
              <div className="relative mt-8 flex items-center gap-4 pt-6 border-t border-white/10">
                <div className="flex -space-x-2">
                  {["from-pink-300 to-rose-500", "from-sky-300 to-blue-500", "from-amber-300 to-orange-500"].map((g, i) => (
                    <div key={i} className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} border-2 border-white/20`} />
                  ))}
                </div>
                <p className="text-[12px] text-white/60 leading-snug">
                  <span className="text-white font-medium">+340 negocios</span> ya usan VentaTalk
                </p>
              </div>

            </div>
          </aside>

          {/* ── RIGHT: form ── */}
          <div className="relative bg-[#fafaf7]/60 p-8 md:p-12 flex flex-col">

            <header className="mb-7">
              <div className="vt-mono text-[12px] uppercase tracking-[.18em] text-[#8a8a99]">Registro</div>
              <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-[#0e0e12]">Crea tu cuenta gratis</h2>
              <p className="mt-1.5 text-[13.5px] text-[#5a5a6b]">
                Sin tarjeta de crédito. Cancela cuando quieras.
              </p>
            </header>

            <form className="space-y-4" onSubmit={handle}>

              {/* Business name */}
              <div>
                <label htmlFor="reg-name" className="block text-[12.5px] font-medium text-[#2b2b35] mb-1.5">
                  Nombre del negocio
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 grid place-items-center text-[#8a8a99]">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="7" width="18" height="13" rx="2" />
                      <path d="M16 7V5a2 2 0 0 0-4 0v2M8 7V5a2 2 0 0 1 4 0" />
                    </svg>
                  </span>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Clínica Bella"
                    className="vt-field w-full bg-white border border-[#0e0e12]/10 rounded-xl pl-9 pr-3 py-2.5 text-[14px] text-[#0e0e12] placeholder:text-[#b9b9c4] transition"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="reg-email" className="block text-[12.5px] font-medium text-[#2b2b35] mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 grid place-items-center text-[#8a8a99]">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M3 7l9 6 9-6" />
                    </svg>
                  </span>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    autoComplete="email"
                    placeholder="admin@miclinica.cl"
                    className="vt-field w-full bg-white border border-[#0e0e12]/10 rounded-xl pl-9 pr-3 py-2.5 text-[14px] text-[#0e0e12] placeholder:text-[#b9b9c4] transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="reg-pwd" className="block text-[12.5px] font-medium text-[#2b2b35] mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 grid place-items-center text-[#8a8a99]">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="11" width="16" height="9" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                  </span>
                  <input
                    id="reg-pwd"
                    type={showPassword ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    className="vt-field w-full bg-white border border-[#0e0e12]/10 rounded-xl pl-9 pr-10 py-2.5 text-[14px] text-[#0e0e12] placeholder:text-[#b9b9c4] transition"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-2 px-2 grid place-items-center text-[#8a8a99] hover:text-[#2b2b35] rounded-lg transition"
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
                        <path d="M9.9 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.3 4.2" />
                        <path d="M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7c1.5 0 2.9-.3 4.1-.8" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-700 text-white font-medium text-[14px] py-3 transition disabled:opacity-50 cursor-pointer mt-1"
                style={{ boxShadow: "0 8px 20px -8px rgba(79,70,229,.65)" }}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {loading ? "Creando cuenta..." : (
                    <>
                      Crear cuenta gratis
                      <svg viewBox="0 0 24 24" className="w-4 h-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </span>
              </button>

              {/* Terms */}
              <p className="text-[11.5px] text-[#8a8a99] text-center leading-relaxed pt-1">
                Al registrarte aceptas los{" "}
                <a href="#" className="text-[#5a5a6b] hover:text-indigo-600 transition underline underline-offset-2">
                  Términos de uso
                </a>{" "}
                y la{" "}
                <a href="#" className="text-[#5a5a6b] hover:text-indigo-600 transition underline underline-offset-2">
                  Política de privacidad
                </a>
                .
              </p>

            </form>

            {/* Footer */}
            <div className="mt-auto pt-7 flex items-center justify-between text-[12px] text-[#8a8a99]">
              <span>
                ¿Ya tienes cuenta?{" "}
                <Link href="/auth/login" className="text-[#2b2b35] font-medium hover:text-indigo-600 transition">
                  Inicia sesión
                </Link>
              </span>
              <a href="#" className="hover:text-[#2b2b35] transition">Privacidad</a>
            </div>

          </div>
        </section>

        <footer className="vt-mono absolute bottom-5 left-0 right-0 text-center text-[11.5px] text-[#8a8a99]">
          © 2026 VentaTalk · todos los derechos reservados
        </footer>

      </main>
    </>
  );
}
