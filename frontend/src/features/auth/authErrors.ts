interface AuthErrorLike {
  details?: Record<string, unknown>;
  message?: string;
}

function isAuthErrorLike(error: unknown): error is AuthErrorLike {
  return typeof error === "object" && error !== null;
}

export function getAuthErrorMessage(error: unknown): string {
  if (!isAuthErrorLike(error)) {
    return "Something went wrong. Please try again.";
  }

  if (error.details) {
    const details = Object.values(error.details).filter(
      (detail): detail is string =>
        typeof detail === "string" && detail.trim().length > 0
    );

    if (details.length > 0) {
      return details.join(" ");
    }
  }

  return error.message || "Something went wrong. Please try again.";
}
