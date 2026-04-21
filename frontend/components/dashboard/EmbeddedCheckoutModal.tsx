"use client";
import { useCallback, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { X } from "lucide-react";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface Props {
  clientSecret: string;
  onClose: () => void;
  onComplete: () => void;
}

export function EmbeddedCheckoutModal({ clientSecret, onClose, onComplete }: Props) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Stripe calls fetchClientSecret; we already have it so return directly
  const fetchClientSecret = useCallback(
    () => Promise.resolve(clientSecret),
    [clientSecret]
  );

  const handleComplete = useCallback(() => {
    onComplete();
    onClose();
  }, [onComplete, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-4 max-h-[85vh] overflow-y-auto">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ fetchClientSecret, onComplete: handleComplete }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  );
}
