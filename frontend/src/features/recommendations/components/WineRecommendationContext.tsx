import { useQuery } from "@tanstack/react-query";

import { isAbortError } from "@/api/client";
import { recommendationQueryKey } from "@/api/recommendationQueryKeys";
import {
  DEFAULT_RECOMMENDATION_LIMIT,
  getWineRecommendations,
} from "@/api/recommendations";
import { useAuth } from "@/features/auth/useAuth";

import RecommendationExplanation from "./RecommendationExplanation";

function UnavailableContext({
  description,
  role = "status",
}: {
  description: string;
  role?: "alert" | "status";
}) {
  return (
    <section
      aria-labelledby="recommendation-context-title"
      className="gv-recommendation-context gv-recommendation-context--unavailable"
    >
      <p className="gv-eyebrow">Request context</p>
      <h2 id="recommendation-context-title">WHY IT FITS THIS REQUEST</h2>
      <p role={role}>{description}</p>
    </section>
  );
}

function ReadyWineRecommendationContext({
  externalWineId,
  query,
  userId,
}: {
  externalWineId: string;
  query: string;
  userId: number | null;
}) {
  const recommendationQuery = useQuery({
    queryFn: ({ signal }) =>
      getWineRecommendations(query, {
        limit: DEFAULT_RECOMMENDATION_LIMIT,
        signal,
      }),
    queryKey: recommendationQueryKey(
      query,
      DEFAULT_RECOMMENDATION_LIMIT,
      userId,
    ),
    staleTime: 60_000,
  });

  if (recommendationQuery.isPending) {
    return (
      <UnavailableContext description="Reconstructing this match from the safe request text…" />
    );
  }

  if (recommendationQuery.isError) {
    if (isAbortError(recommendationQuery.error)) return null;
    return (
      <UnavailableContext
        description="The bottle record remains available, but its recommendation context could not be reconstructed right now."
        role="alert"
      />
    );
  }

  const result = recommendationQuery.data.results.find(
    (candidate) => candidate.wine.externalWineId === externalWineId,
  );
  if (!result) {
    return (
      <UnavailableContext description="This request no longer returns the bottle within the current limited catalog, so no prior score is being claimed." />
    );
  }

  return (
    <section
      aria-labelledby="recommendation-context-title"
      className="gv-recommendation-context"
    >
      <p className="gv-assistive-status" role="status">
        Recommendation context is ready for {result.wine.name}.
      </p>
      <header>
        <p className="gv-eyebrow">Reconstructed request context</p>
        <h2 id="recommendation-context-title">WHY IT FITS THIS REQUEST</h2>
        <p>“{recommendationQuery.data.query}”</p>
        <p>{recommendationQuery.data.personalization.disclosure}</p>
      </header>
      <RecommendationExplanation match={result.match} wineName={result.wine.name} />
    </section>
  );
}

export default function WineRecommendationContext({
  externalWineId,
  query,
}: {
  externalWineId: string;
  query: string;
}) {
  const { status, user } = useAuth();

  if (status === "loading") {
    return (
      <UnavailableContext description="Verifying the session before reconstructing identity-sensitive recommendation context…" />
    );
  }

  if (status === "error") {
    return (
      <UnavailableContext
        description="Session context could not be verified, so GRAPEVYNE will not reuse an anonymous or prior-user recommendation."
        role="alert"
      />
    );
  }

  return (
    <ReadyWineRecommendationContext
      externalWineId={externalWineId}
      query={query}
      userId={user?.id ?? null}
    />
  );
}
