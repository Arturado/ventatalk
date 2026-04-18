"use client";
import { Bell, X, MessageSquare, AlertCircle, Volume2 } from "lucide-react";

interface Props {
  onAccept: () => void;
  onDecline: () => void;
}

const BENEFITS = [
  { icon: MessageSquare, text: "Alerta cuando llegue un mensaje nuevo de un cliente" },
  { icon: AlertCircle,   text: "Notificación de conversaciones sin responder" },
  { icon: Volume2,       text: "Sin spam — solo mensajes de WhatsApp reales" },
];

export function NotificationPermissionModal({ onAccept, onDecline }: Props) {
  return (
    <div
      className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm
        flex items-end sm:items-center justify-center z-[100] p-4"
      onClick={onDecline}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl
          border border-slate-200 dark:border-slate-700/60
          w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 px-6 pt-8 pb-7 text-white">
          <button
            onClick={onDecline}
            aria-label="Cerrar"
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Bell icon */}
          <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center mb-4 border border-white/20">
            <Bell className="w-6 h-6" />
          </div>

          <h2 className="text-lg font-bold leading-snug">Activa las notificaciones</h2>
          <p className="text-blue-200 text-sm mt-1 leading-snug">
            Nunca pierdas un mensaje de un cliente potencial
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <ul className="space-y-3.5 mb-6">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm text-gray-700 dark:text-slate-300 leading-snug">{text}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2">
            <button
              onClick={onAccept}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl
                text-sm font-semibold transition-colors cursor-pointer shadow-sm"
            >
              Activar notificaciones
            </button>
            <button
              onClick={onDecline}
              className="w-full py-2 text-gray-500 dark:text-slate-400 hover:text-gray-700
                dark:hover:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
