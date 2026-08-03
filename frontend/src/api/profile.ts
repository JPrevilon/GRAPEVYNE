import { apiRequest, unwrapData } from "@/api/client";
import { normalizeTasteProfile } from "@/api/normalizers";
import type { ApiSuccessEnvelope, TasteProfileData } from "@/types/api";
import type { TasteProfile } from "@/types/domain";

export async function getTasteProfile(
  signal?: AbortSignal,
): Promise<TasteProfile> {
  const envelope = await apiRequest<ApiSuccessEnvelope<TasteProfileData>>(
    "/profile/taste",
    { signal },
  );
  const data = unwrapData<TasteProfileData>(envelope);

  return normalizeTasteProfile(data.profile);
}
