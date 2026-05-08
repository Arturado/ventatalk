"use client";

import { useState } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
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
        @keyframes vt-success-pop {
          0%   { opacity: 0; transform: scale(.88); }
          60%  { transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
        .vt-success-pop { animation: vt-success-pop .5s cubic-bezier(.2,.8,.2,1) both; }
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

        {/* Card */}
        <section
          className="relative w-full max-w-[1080px] grid grid-cols-1 md:grid-cols-[1.05fr_1fr] rounded-[22px] overflow-hidden bg-white border border-[#0e0e12]/[.06]"
          style={{ boxShadow: "0 1px 0 rgba(15,15,30,.04), 0 24px 60px -24px rgba(50,40,120,.18)" }}
        >

          {/* ── LEFT panel ── */}
          <aside className="vt-panel-bg relative text-white p-8 md:p-10 min-h-[520px] overflow-hidden">
            <div className="vt-panel-grid absolute inset-0 opacity-60" aria-hidden="true" />

            {/* Glow blobs */}
            <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full blur-3xl opacity-40" style={{ background: "#7c6dff" }} aria-hidden="true" />
            <div className="absolute -bottom-28 -right-10 w-80 h-80 rounded-full blur-3xl opacity-30" style={{ background: "#10b981" }} aria-hidden="true" />

            <div className="relative h-full flex flex-col">

              {/* Badge */}
              <div>
                <span className="vt-tag inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11.5px] font-medium tracking-wide text-white/85">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Acceso seguro a tu cuenta
                </span>
              </div>

              {/* Headline */}
              <div className="mt-7 max-w-[400px]">
                <h1 className="vt-serif text-[42px] leading-[1.15] tracking-tight pb-1">
                  Recupera tu acceso <em className="not-italic text-white/70">en segundos</em>.
                </h1>
                <p className="mt-4 text-[14px] leading-relaxed text-white/70">
                  Te enviaremos un enlace seguro para restablecer tu contraseña. Solo necesitas tu correo registrado.
                </p>
              </div>

              {/* Steps */}
              <div className="relative mt-10 flex-1 flex items-end">
                <div className="w-full space-y-4">
                  {[
                    { icon: "M3 8l9 6 9-6", label: "Ingresa tu correo electrónico" },
                    { icon: "M3 7l9 6 9-6M3 17l9 6 9-6", label: "Revisa tu bandeja de entrada" },
                    { icon: "M5 12.5l4 4 10-10", label: "Sigue el enlace para crear nueva contraseña" },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="vt-mono w-6 h-6 rounded-full bg-white/10 border border-white/15 grid place-items-center text-[11px] text-white/70 shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-[13px] text-white/75">{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security note */}
              <div className="relative mt-8 flex items-start gap-2.5 rounded-xl bg-white/[.06] border border-white/10 p-3.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L4 6v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <p className="text-[12px] text-white/60 leading-relaxed">
                  El enlace de recuperación expira en <span className="text-white/85 font-medium">15 minutos</span> por seguridad.
                </p>
              </div>

            </div>
          </aside>

          {/* ── RIGHT: form ── */}
          <div className="relative bg-[#fafaf7]/60 p-8 md:p-12 flex flex-col">

            {!submitted ? (
              <>
                <header className="mb-8">
                  <div className="vt-mono text-[12px] uppercase tracking-[.18em] text-[#8a8a99]">Recuperación</div>
                  <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-[#0e0e12]">¿Olvidaste tu contraseña?</h2>
                  <p className="mt-1.5 text-[13.5px] text-[#5a5a6b]">
                    Ingresa tu correo y te enviaremos instrucciones para recuperar el acceso.
                  </p>
                </header>

                <form className="space-y-5" onSubmit={handleSubmit}>

                  {/* Email */}
                  <div>
                    <label htmlFor="reset-email" className="block text-[12.5px] font-medium text-[#2b2b35] mb-1.5">
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
                        id="reset-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        placeholder="tunombre@empresa.com"
                        className="vt-field w-full bg-white border border-[#0e0e12]/10 rounded-xl pl-9 pr-3 py-2.5 text-[14px] text-[#0e0e12] placeholder:text-[#b9b9c4] transition"
                      />
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-700 text-white font-medium text-[14px] py-3 transition disabled:opacity-60 cursor-pointer"
                    style={{ boxShadow: "0 8px 20px -8px rgba(79,70,229,.65)" }}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {loading ? (
                        "Enviando..."
                      ) : (
                        <>
                          Enviar instrucciones
                          <svg viewBox="0 0 24 24" className="w-4 h-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M13 5l7 7-7 7" />
                          </svg>
                        </>
                      )}
                    </span>
                  </button>

                </form>

                {/* Back to login */}
                <div className="mt-auto pt-8 flex items-center justify-between text-[12px] text-[#8a8a99]">
                  <Link
                    href="/auth/login"
                    className="inline-flex items-center gap-1.5 text-[13px] text-[#5a5a6b] hover:text-indigo-600 transition font-medium"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 12H5M11 5l-7 7 7 7" />
                    </svg>
                    Volver al login
                  </Link>
                  <a href="#" className="hover:text-[#2b2b35] transition">Privacidad</a>
                </div>
              </>
            ) : (
              /* ── Success state ── */
              <div className="vt-success-pop flex flex-col items-center justify-center flex-1 text-center py-8">
                <div
                  className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 grid place-items-center mb-6"
                  style={{ boxShadow: "0 8px 24px -8px rgba(16,185,129,.25)" }}
                >
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8l9 6 9-6" />
                    <rect x="2" y="6" width="20" height="13" rx="2" />
                  </svg>
                </div>

                <div className="vt-mono text-[12px] uppercase tracking-[.18em] text-[#8a8a99] mb-2">Correo enviado</div>
                <h2 className="text-[24px] font-semibold tracking-tight text-[#0e0e12] mb-3">
                  Revisa tu bandeja
                </h2>
                <p className="text-[13.5px] text-[#5a5a6b] max-w-[280px] leading-relaxed">
                  Si el email existe, recibirás instrucciones para restablecer tu contraseña.
                </p>

                <div className="mt-6 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-[12.5px] text-amber-700 max-w-[300px]">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  El enlace expira en 15 minutos. Revisa también tu carpeta de spam.
                </div>

                <Link
                  href="/auth/login"
                  className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#0e0e12]/10 bg-white hover:bg-[#f4f3ee] text-[13.5px] font-medium text-[#2b2b35] transition"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M11 5l-7 7 7 7" />
                  </svg>
                  Volver al login
                </Link>
              </div>
            )}

          </div>
        </section>

        <footer className="vt-mono absolute bottom-5 left-0 right-0 text-center text-[11.5px] text-[#8a8a99]">
          © 2026 VentaTalk · todos los derechos reservados
        </footer>

      </main>
    </>
  );
}
