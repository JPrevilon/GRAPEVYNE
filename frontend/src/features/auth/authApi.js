import { apiRequest } from "../../api/client.js";

export function signup(payload) {
  return apiRequest("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return apiRequest("/auth/logout", {
    method: "POST",
  });
}

export function getCurrentUser() {
  return apiRequest("/auth/me");
}
