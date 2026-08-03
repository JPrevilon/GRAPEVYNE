export interface ApiSuccessEnvelope<T> {
  data: T;
  message?: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorEnvelope {
  error: ApiErrorBody;
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export interface AuthenticatedUserData {
  authenticated: true;
  user: unknown;
}

export interface LoggedOutData {
  authenticated: false;
}

export interface WineSearchData {
  query: unknown;
  results: unknown;
  source: unknown;
}

export interface WineDetailData {
  wine: unknown;
  source: unknown;
}

export interface RecommendationData {
  query: unknown;
  intent: unknown;
  personalization: unknown;
  catalog: unknown;
  results: unknown;
}

export interface CellarListData {
  entries: unknown;
  count: unknown;
}

export interface CellarEntryData {
  entry: unknown;
}

export interface DeletedCellarEntryData {
  deletedId: unknown;
}

export interface HealthData {
  service: string;
  status: string;
}
