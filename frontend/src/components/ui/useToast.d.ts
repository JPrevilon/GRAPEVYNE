export type ToastTone = "error" | "success";

export interface ToastInput {
  message: string;
  title?: string;
  tone?: ToastTone;
}

export interface ToastApi {
  clearToasts: () => void;
  dismissToast: (id: string) => void;
  showToast: (toast: ToastInput) => void;
}

export function useToast(): ToastApi;
