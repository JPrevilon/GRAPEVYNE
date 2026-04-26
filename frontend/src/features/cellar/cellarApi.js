import { apiRequest } from "../../api/client.js";

export function getCellarEntries() {
  return apiRequest("/cellar");
}

export function saveWineToCellar(payload) {
  return apiRequest("/cellar", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCellarEntry(entryId) {
  return apiRequest(`/cellar/${entryId}`);
}

export function updateCellarEntry(entryId, payload) {
  return apiRequest(`/cellar/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteCellarEntry(entryId) {
  return apiRequest(`/cellar/${entryId}`, {
    method: "DELETE",
  });
}
