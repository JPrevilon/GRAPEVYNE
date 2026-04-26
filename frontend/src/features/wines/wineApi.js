import { apiRequest } from "../../api/client.js";

export function searchWines(query) {
  const params = new URLSearchParams({ query });
  return apiRequest(`/wines/search?${params.toString()}`);
}

export function getWineDetail(externalWineId) {
  return apiRequest(`/wines/${encodeURIComponent(externalWineId)}`);
}
