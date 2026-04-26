export function getAuthErrorMessage(error) {
  if (error?.details) {
    return Object.values(error.details).filter(Boolean).join(" ");
  }

  return error?.message || "Something went wrong. Please try again.";
}

