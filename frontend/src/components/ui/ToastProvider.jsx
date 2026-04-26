import { useCallback, useMemo, useState } from "react";

import { ToastContext } from "./toastContextValue.js";

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, title, tone = "success" }) => {
      const id =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setToasts((current) => [...current, { id, message, title, tone }]);
      window.setTimeout(() => dismissToast(id), 4200);
    },
    [dismissToast]
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
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div className={`toast toast--${toast.tone}`} key={toast.id}>
            <div>
              {toast.title ? <strong>{toast.title}</strong> : null}
              <p>{toast.message}</p>
            </div>
            <button
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
              type="button"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
