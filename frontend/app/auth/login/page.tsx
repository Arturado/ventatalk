"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
        @keyframes vt-pop {
          0%   { opacity: 0; transform: translateY(8px) scale(.96); }
          100% { opacity: 1; transform: none; }
        }
        .vt-pop { animation: vt-pop .55s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes vt-blink {
          0%, 80%, 100% { opacity: .25; }
          40%            { opacity: 1; }
        }
        .vt-dot { animation: vt-blink 1.4s infinite both; }
        .vt-dot:nth-child(2) { animation-delay: .2s; }
        .vt-dot:nth-child(3) { animation-delay: .4s; }
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
          <span className="hidden sm:inline">¿Eres nuevo aquí?</span>
          <a href="/auth/register" className="px-3 py-1.5 rounded-full border border-[#0e0e12]/10 hover:border-[#0e0e12]/30 hover:bg-white transition">
            Crear cuenta
          </a>
        </div>

        {/* Card */}
        <section
          className="relative w-full max-w-[1080px] grid grid-cols-1 md:grid-cols-[1.05fr_1fr] rounded-[22px] overflow-hidden bg-white border border-[#0e0e12]/[.06]"
          style={{ boxShadow: "0 1px 0 rgba(15,15,30,.04), 0 24px 60px -24px rgba(50,40,120,.18)" }}
        >

          {/* ── LEFT panel ── */}
          <aside className="vt-panel-bg relative text-white p-8 md:p-10 min-h-[560px] overflow-hidden">
            <div className="vt-panel-grid absolute inset-0 opacity-60" aria-hidden="true" />

            {/* Glow blobs */}
            <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full blur-3xl opacity-40" style={{ background: "#7c6dff" }} aria-hidden="true" />
            <div className="absolute -bottom-28 -right-10 w-80 h-80 rounded-full blur-3xl opacity-30" style={{ background: "#10b981" }} aria-hidden="true" />

            <div className="relative h-full flex flex-col">

              {/* Badge */}
              <div>
                <span className="vt-tag inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11.5px] font-medium tracking-wide text-white/85">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Plataforma conversacional de ventas
                </span>
              </div>

              {/* Headline */}
              <div className="mt-7 max-w-[420px]">
                <h1 className="vt-serif text-[42px] leading-[1.15] tracking-tight pb-1">
                  Cierra más ventas <em className="not-italic text-white/70">conversando</em>.
                </h1>
                <p className="mt-4 text-[14px] leading-relaxed text-white/70">
                  Centraliza WhatsApp, Instagram y tu sitio web en una sola bandeja.
                  Tu equipo responde, VentaTalk vende.
                </p>
              </div>

              {/* Chat preview */}
              <div className="relative mt-8 flex-1 flex items-end">
                <div className="w-full rounded-2xl bg-white/[.05] border border-white/10 backdrop-blur-sm p-4">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-300 to-rose-500 grid place-items-center text-[11px] font-semibold text-rose-900">
                        MR
                      </div>
                      <div className="leading-tight">
                        <div className="text-[13px] font-medium">María R.</div>
                        <div className="text-[11px] text-white/50">en línea · WhatsApp</div>
                      </div>
                    </div>
                    <span className="vt-mono text-[10.5px] text-white/50">#A-2840</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="vt-pop max-w-[78%] rounded-2xl rounded-tl-md bg-white/10 px-3.5 py-2 text-[13px]">
                      Hola, vi su catálogo. ¿La silla ergonómica está disponible?
                    </div>
                    <div className="vt-pop max-w-[78%] ml-auto rounded-2xl rounded-tr-md bg-indigo-600 px-3.5 py-2 text-[13px]" style={{ animationDelay: ".25s" }}>
                      ¡Hola María! Sí, en negro y arena. ¿Te paso el link de pago?
                    </div>
                    <div className="vt-pop max-w-[78%] rounded-2xl rounded-tl-md bg-white/10 px-3.5 py-2 text-[13px]" style={{ animationDelay: ".5s" }}>
                      Perfecto, en negro 🙌
                    </div>
                    <div className="vt-pop inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-white/10 px-3 py-2.5" style={{ animationDelay: ".75s" }}>
                      <span className="vt-dot w-1.5 h-1.5 rounded-full bg-white/70" />
                      <span className="vt-dot w-1.5 h-1.5 rounded-full bg-white/70" />
                      <span className="vt-dot w-1.5 h-1.5 rounded-full bg-white/70" />
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI strip */}
              <div className="relative mt-7 grid grid-cols-3 gap-3 text-[12px]">
                <div>
                  <div className="vt-mono text-white text-[18px] tracking-tight">+38%</div>
                  <div className="text-white/55 leading-tight">tasa de conversión</div>
                </div>
                <div>
                  <div className="vt-mono text-white text-[18px] tracking-tight">&lt;45s</div>
                  <div className="text-white/55 leading-tight">primera respuesta</div>
                </div>
                <div>
                  <div className="vt-mono text-white text-[18px] tracking-tight">12k</div>
                  <div className="text-white/55 leading-tight">mensajes / día</div>
                </div>
              </div>

            </div>
          </aside>

          {/* ── RIGHT: form ── */}
          <div className="relative bg-[#fafaf7]/60 p-8 md:p-12 flex flex-col">

            <header className="mb-8">
              <div className="vt-mono text-[12px] uppercase tracking-[.18em] text-[#8a8a99]">Acceso</div>
              <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-[#0e0e12]">Bienvenido de nuevo</h2>
              <p className="mt-1.5 text-[13.5px] text-[#5a5a6b]">
                Inicia sesión para entrar a tu bandeja unificada.
              </p>
            </header>

            <form className="space-y-5" onSubmit={handleLogin}>

              {/* Email */}
              <div>
                <label htmlFor="login-email" className="block text-[12.5px] font-medium text-[#2b2b35] mb-1.5">
                  Correo o usuario
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 grid place-items-center text-[#8a8a99]">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M3 7l9 6 9-6" />
                    </svg>
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    placeholder="tunombre@empresa.com"
                    className="vt-field w-full bg-white border border-[#0e0e12]/10 rounded-xl pl-9 pr-3 py-2.5 text-[14px] text-[#0e0e12] placeholder:text-[#b9b9c4] transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-pwd" className="block text-[12.5px] font-medium text-[#2b2b35]">
                    Contraseña
                  </label>
                  <a href="#" className="text-[12px] font-medium text-indigo-600 hover:text-indigo-700 transition">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 grid place-items-center text-[#8a8a99]">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="11" width="16" height="9" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                  </span>
                  <input
                    id="login-pwd"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••••"
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

              {/* Remember me */}
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <span
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`w-4 h-4 rounded border grid place-items-center transition cursor-pointer ${
                    rememberMe
                      ? "bg-indigo-600 border-indigo-600"
                      : "bg-white border-[#0e0e12]/20"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-3 h-3 text-white transition ${rememberMe ? "opacity-100" : "opacity-0"}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12.5l4 4 10-10" />
                  </svg>
                </span>
                <span className="text-[13px] text-[#2b2b35]">Mantener sesión iniciada</span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-700 text-white font-medium text-[14px] py-3 transition disabled:opacity-50 cursor-pointer"
                style={{ boxShadow: "0 8px 20px -8px rgba(79,70,229,.65)" }}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {loading ? "Iniciando sesión..." : "Iniciar sesión"}
                  {!loading && (
                    <svg viewBox="0 0 24 24" className="w-4 h-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  )}
                </span>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 pt-2">
                <div className="h-px flex-1 bg-[#0e0e12]/10" />
                <span className="vt-mono text-[11.5px] uppercase tracking-[.16em] text-[#8a8a99]">o continúa con</span>
                <div className="h-px flex-1 bg-[#0e0e12]/10" />
              </div>

              {/* Google */}
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-[#0e0e12]/10 bg-white hover:bg-[#f4f3ee] px-3 py-2.5 text-[13.5px] font-medium text-[#0e0e12] transition cursor-pointer"
              >
                <svg viewBox="0 0 48 48" className="w-[18px] h-[18px]" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                Continuar con Google
              </button>

            </form>

            {/* Footer */}
            <div className="mt-auto pt-8 flex items-center justify-between text-[12px] text-[#8a8a99]">
              <span>
                ¿Aún no usas VentaTalk?{" "}
                <a href="/auth/register" className="text-[#2b2b35] font-medium hover:text-indigo-600 transition">
                  Solicita una demo
                </a>
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
