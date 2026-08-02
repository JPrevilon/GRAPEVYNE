import { ButtonLink } from "@/components/ui/Button";
import { PageShell, SectionHeading } from "@/components/ui/PageShell";
import {
  ErrorPanel,
  LoadingPanel,
  NoticePanel,
} from "@/components/ui/StatePanels";
import { useAuth } from "@/features/auth/useAuth";

function formatAccountDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

export default function ProfilePage() {
  const { isLoading, user } = useAuth();
  const accountCreated = formatAccountDate(user?.createdAt ?? null);

  return (
    <PageShell
      actions={
        !isLoading && user ? (
          <>
            <ButtonLink to="/cellar" variant="primary">
              Open my cellar
            </ButtonLink>
            <ButtonLink to="/discover" variant="ghost">
              Find a bottle
            </ButtonLink>
          </>
        ) : undefined
      }
      className="profile-page"
      description="A private account surface grounded in your authenticated GrapeVyne identity."
      eyebrow="Private profile"
      title="Your GrapeVyne profile"
    >
      {isLoading ? (
        <LoadingPanel
          description="Checking the current Flask session before displaying private account details."
          eyebrow="Session check"
          title="Opening your profile…"
        />
      ) : null}

      {!isLoading && !user ? (
        <ErrorPanel
          action={
            <ButtonLink state={{ from: "/profile" }} to="/login" variant="secondary">
              Sign in
            </ButtonLink>
          }
          description="The protected route normally handles this state. Sign in again to restore access without showing substitute profile data."
          eyebrow="Authentication required"
          title="This profile needs an authenticated session."
        />
      ) : null}

      {!isLoading && user ? (
        <>
          <section className="tool-surface profile-summary" aria-labelledby="account-details-title">
            <SectionHeading
              description="These fields come directly from the authenticated user response."
              eyebrow="Account identity"
              id="account-details-title"
              title="Signed-in details"
            />

            <dl className="profile-summary__details">
              <div>
                <dt>Name</dt>
                <dd>{user.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              {accountCreated ? (
                <div>
                  <dt>Account created</dt>
                  <dd>
                    <time dateTime={user.createdAt ?? undefined}>{accountCreated}</time>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <NoticePanel
            description="Taste Atlas computation is reserved for a later private engine phase. This page does not infer preferences, regions, scores, or statistics from account fields or demonstration bottles."
            eyebrow="Early profile"
            title="Your personal Taste Atlas has not been calculated."
          />
        </>
      ) : null}
    </PageShell>
  );
}
