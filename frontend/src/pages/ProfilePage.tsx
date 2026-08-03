import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import { isAuthenticationRequired } from "@/api/client";
import { getTasteProfile } from "@/api/profile";
import {
  TASTE_PROFILE_QUERY_RESOURCE,
  tasteProfileQueryKey,
} from "@/api/tasteProfileQueryKeys";
import DirectoryHeading from "@/components/typography/DirectoryHeading";
import { DIRECTORY_PAGE_HEADINGS } from "@/components/typography/directoryHeadingPresets";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageShell, SectionHeading } from "@/components/ui/PageShell";
import {
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  NoticePanel,
} from "@/components/ui/StatePanels";
import { useAuth } from "@/features/auth/useAuth";
import TasteAtlas from "@/features/profile/components/TasteAtlas";

function formatAccountDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Your private Taste Profile could not be loaded.";
}

export default function ProfilePage() {
  const {
    handleAuthenticationRequired,
    isLoading,
    status: authStatus,
    user,
  } = useAuth();
  const userId = user?.id;
  const accountCreated = formatAccountDate(user?.createdAt ?? null);
  const profileQuery = useQuery({
    enabled: authStatus === "ready" && userId !== undefined,
    gcTime: 0,
    queryFn: ({ signal }) => {
      if (userId === undefined) {
        throw new Error("An authenticated session is required.");
      }
      return getTasteProfile(signal);
    },
    queryKey:
      userId === undefined
        ? (["disabled", TASTE_PROFILE_QUERY_RESOURCE] as const)
        : tasteProfileQueryKey(userId),
    staleTime: 0,
  });

  useEffect(() => {
    if (userId !== undefined && isAuthenticationRequired(profileQuery.error)) {
      void handleAuthenticationRequired(userId);
    }
  }, [handleAuthenticationRequired, profileQuery.error, userId]);

  const shell = (children: ReactNode) => (
    <PageShell
      actions={
        !isLoading && user ? (
          <>
            <ButtonLink to="/cellar" variant="primary">Open my cellar</ButtonLink>
            <ButtonLink to="/discover" variant="ghost">Find a bottle</ButtonLink>
          </>
        ) : undefined
      }
      className="profile-page"
      description="A deterministic private profile derived only from your persisted cellar behavior and sourced catalog facts."
      eyebrow="03 / PRIVATE TASTE DIRECTORY"
      heading={<DirectoryHeading {...DIRECTORY_PAGE_HEADINGS.profile} />}
    >
      {children}
    </PageShell>
  );

  if (isLoading || (user && profileQuery.isPending)) {
    return shell(
      <LoadingPanel
        description="Reading owner-scoped cellar signals without exposing your tasting-memory text."
        eyebrow="Private Taste Profile"
        title="TRACING YOUR RECORDED BRANCHES"
      />,
    );
  }

  if (!user) {
    return shell(
      <ErrorPanel
        action={<ButtonLink state={{ from: "/profile" }} to="/login" variant="secondary">Sign in</ButtonLink>}
        description="The protected route normally handles this state. Sign in again to restore access without showing substitute profile data."
        eyebrow="Authentication required"
        title="THIS PROFILE NEEDS AN AUTHENTICATED SESSION"
      />,
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return shell(
      <ErrorPanel
        action={
          <Button
            busyLabel="Trying again…"
            isBusy={profileQuery.isFetching}
            onClick={() => void profileQuery.refetch()}
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" size={17} />
            Try again
          </Button>
        }
        description={errorMessage(profileQuery.error)}
        eyebrow="Private profile · No demo fallback"
        title="YOUR TASTE PROFILE IS UNAVAILABLE"
      >
        <p>No demonstration profile has been substituted and no cellar data changed.</p>
      </ErrorPanel>,
    );
  }

  const profile = profileQuery.data;

  return shell(
    <div data-profile-source="authenticated-api" className="gv-private-profile">
      {profileQuery.isFetching ? (
        <p aria-live="polite" className="gv-inline-feedback" role="status">
          Refreshing your owner-scoped Taste Profile…
        </p>
      ) : null}

      <section className="profile-summary" aria-labelledby="account-details-title">
        <SectionHeading
          description="Identity comes from the current signed Flask session."
          eyebrow="Private account"
          id="account-details-title"
          title="SIGNED-IN DETAILS"
        />
        <dl className="profile-summary__details">
          <div><dt>Name</dt><dd>{user.name}</dd></div>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          {accountCreated ? (
            <div><dt>Account created</dt><dd><time dateTime={user.createdAt ?? undefined}>{accountCreated}</time></dd></div>
          ) : null}
        </dl>
      </section>

      <aside className="gv-profile-disclosure" role="note">
        <strong>{profile.state === "active" ? "Active profile" : profile.state === "limited" ? "Early profile" : "Profile beginning"}</strong>
        <p>{profile.summary}</p>
        <p>{profile.disclosure}</p>
        <p>{profile.catalog.limitations}</p>
        <small>Algorithm {profile.algorithmVersion} · Provider {profile.catalog.provider} · {profile.catalog.candidateCount} current catalog candidates</small>
      </aside>

      {profile.state === "empty" ? (
        <EmptyState
          action={<ButtonLink to="/cellar" variant="primary">Open my cellar</ButtonLink>}
          description="Your Taste Atlas begins with the first bottle you taste, rate, or mark as a favorite."
          eyebrow="No meaningful taste evidence yet"
          title="YOUR ATLAS IS READY FOR ITS FIRST BRANCH"
        />
      ) : (
        <>
          {profile.state === "limited" ? (
            <NoticePanel
              description="A few more rated bottles across different styles will make this profile clearer."
              eyebrow="Emerging pattern"
              title="YOUR TASTE PROFILE IS STILL LIMITED"
            />
          ) : null}
          <TasteAtlas profile={profile} />
        </>
      )}
    </div>,
  );
}
