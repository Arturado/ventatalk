"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { conversationsApi } from "./api";

// ─── LocalStorage keys ────────────────────────────────────────────────────────
const LS_ENABLED     = "vt_notif_enabled";
const LS_LAST_SEEN   = "vt_notif_last_seen";
const LS_MODAL_SHOWN = "vt_notif_modal_shown";

const POLL_MS = 10_000;

export type PermState = "default" | "granted" | "denied";

export interface UseNotificationsReturn {
  permission: PermState;
  enabled: boolean;
  badgeCount: number;
  showModal: boolean;
  requestAndEnable: () => Promise<void>;
  dismissModal: () => void;
  toggleEnabled: (val: boolean) => void;
}

// ─── Icon (canvas-generated, no external file needed) ─────────────────────────
function makeIcon(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    // Blue rounded rect
    const g = ctx.createLinearGradient(0, 0, 64, 64);
    g.addColorStop(0, "#2563EB");
    g.addColorStop(1, "#4F46E5");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(0, 0, 64, 64, 14);
    ctx.fill();
    // "VT" text
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 22px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VT", 32, 33);
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] = useState<PermState>("default");
  const [enabled, setEnabled]       = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);
  const [showModal, setShowModal]   = useState(false);

  const lastSeenRef  = useRef<string>("");
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const iconRef      = useRef<string>("");

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Detect browser support
    if (typeof Notification === "undefined") return;

    const browserPerm = Notification.permission as PermState;
    setPermission(browserPerm);

    const savedEnabled = localStorage.getItem(LS_ENABLED) === "true";
    setEnabled(savedEnabled && browserPerm === "granted");

    // Last seen — default to now so we don't spam on first enable
    const ls = localStorage.getItem(LS_LAST_SEEN) || new Date().toISOString();
    lastSeenRef.current = ls;

    // Show modal once if permission not yet decided
    const modalShown = localStorage.getItem(LS_MODAL_SHOWN) === "true";
    if (browserPerm === "default" && !modalShown) {
      const t = setTimeout(() => setShowModal(true), 2_500);
      return () => clearTimeout(t);
    }
  }, []);

  // ── Listen to badge-clear event (dispatched by conversations page) ─────────
  useEffect(() => {
    const handler = () => {
      setBadgeCount(0);
      const now = new Date().toISOString();
      lastSeenRef.current = now;
      localStorage.setItem(LS_LAST_SEEN, now);
    };
    window.addEventListener("vt-badge-clear", handler);
    return () => window.removeEventListener("vt-badge-clear", handler);
  }, []);

  // ── Listen to settings toggle (dispatched by settings page) ───────────────
  useEffect(() => {
    const handler = () => {
      const val = localStorage.getItem(LS_ENABLED) === "true";
      const perm = Notification.permission as PermState;
      setPermission(perm);
      setEnabled(val && perm === "granted");
      if (!val) setBadgeCount(0);
    };
    window.addEventListener("vt-notif-toggle", handler);
    return () => window.removeEventListener("vt-notif-toggle", handler);
  }, []);

  // ── Polling ───────────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    try {
      const { data: convs } = await conversationsApi.list();
      const since = lastSeenRef.current;

      // Conversations with messages newer than last check
      const fresh = (convs as any[]).filter(
        (c) => c.last_message_at && c.last_message_at > since
      );

      setBadgeCount((prev) => prev + fresh.length);

      // Fire browser notifications only when document is not visible
      if (fresh.length > 0 && document.visibilityState !== "visible") {
        if (!iconRef.current) iconRef.current = makeIcon();
        fresh.forEach((conv) => {
          const title  = conv.contact_name || `+${conv.contact_phone}`;
          const body   = `Nuevo mensaje en la conversación con ${title}`;
          try {
            const notif = new Notification("VentaTalk", {
              body,
              icon: iconRef.current || undefined,
              tag: `conv-${conv.id}`,   // prevents duplicates for same conversation
              requireInteraction: false,
            });
            notif.onclick = () => {
              window.focus();
              window.location.href = `/dashboard/conversations?id=${conv.id}`;
            };
          } catch { /* permission revoked mid-session */ }
        });
      }

      // Advance cursor to newest message seen
      if (fresh.length > 0) {
        const latest = fresh.reduce(
          (max: string, c: any) => (c.last_message_at > max ? c.last_message_at : max),
          since
        );
        lastSeenRef.current = latest;
        localStorage.setItem(LS_LAST_SEEN, latest);
      }
    } catch { /* network error — silently ignore */ }
  }, []);

  // Start / stop polling when enabled changes
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (enabled && permission === "granted") {
      poll();
      intervalRef.current = setInterval(poll, POLL_MS);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, permission, poll]);

  // ── Public API ────────────────────────────────────────────────────────────
  const requestAndEnable = useCallback(async () => {
    setShowModal(false);
    localStorage.setItem(LS_MODAL_SHOWN, "true");
    if (typeof Notification === "undefined") return;

    const result = await Notification.requestPermission();
    setPermission(result as PermState);

    if (result === "granted") {
      // Reset cursor to now — don't replay history
      const now = new Date().toISOString();
      lastSeenRef.current = now;
      localStorage.setItem(LS_LAST_SEEN, now);
      localStorage.setItem(LS_ENABLED, "true");
      setEnabled(true);
    }
  }, []);

  const dismissModal = useCallback(() => {
    setShowModal(false);
    localStorage.setItem(LS_MODAL_SHOWN, "true");
  }, []);

  const toggleEnabled = useCallback(
    (val: boolean) => {
      if (val && permission !== "granted") return;
      setEnabled(val);
      localStorage.setItem(LS_ENABLED, val ? "true" : "false");
      if (!val) setBadgeCount(0);
      window.dispatchEvent(new CustomEvent("vt-notif-toggle"));
    },
    [permission]
  );

  return { permission, enabled, badgeCount, showModal, requestAndEnable, dismissModal, toggleEnabled };
}
