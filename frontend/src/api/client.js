const browserApiHost =
  typeof window !== "undefined" ? window.location.hostname : "localhost";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || `http://${browserApiHost}:5000/api`;

export async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });
  } catch (networkError) {
    const error = new Error(
      "Could not reach the GrapeVyne API. Make sure the Flask server is running."
    );
    error.code = "network_error";
    error.cause = networkError;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const apiError = payload?.error;
    const error = new Error(apiError?.message || "Request failed");
    error.status = response.status;
    error.code = apiError?.code;
    error.details = apiError?.details;
    throw error;
  }

  return payload;
}

export function getHealth() {
  return apiRequest("/health");
}
