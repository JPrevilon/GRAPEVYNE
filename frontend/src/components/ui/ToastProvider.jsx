import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ToastContext } from "./toastContextValue.js";

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const clearToastTimer = useCallback((id) => {
    const timer = timers.current.get(id);

    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const dismissToast = useCallback((id) => {
    clearToastTimer(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, [clearToastTimer]);

  const scheduleDismiss = useCallback((id, delay = 5200) => {
    clearToastTimer(id);
    timers.current.set(
      id,
      window.setTimeout(() => dismissToast(id), delay),
    );
  }, [clearToastTimer, dismissToast]);

  const showToast = useCallback(
    ({ message, title, tone = "success" }) => {
      const id =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setToasts((current) => [...current, { id, message, title, tone }]);
      scheduleDismiss(id);
    },
    [scheduleDismiss]
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const value = useMemo(
    () => ({
      dismissToast,
      showToast,
    }),
    [dismissToast, showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-label="Notifications"
        className="toast-region"
        role="region"
      >
        {toasts.map((toast) => (
          <div
            aria-atomic="true"
            className={`toast toast--${toast.tone}`}
            key={toast.id}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                scheduleDismiss(toast.id, 2200);
              }
            }}
            onFocus={() => clearToastTimer(toast.id)}
            onMouseEnter={() => clearToastTimer(toast.id)}
            onMouseLeave={() => scheduleDismiss(toast.id, 2200)}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <div>
              {toast.title ? <strong>{toast.title}</strong> : null}
              <p>{toast.message}</p>
            </div>
            <button
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
