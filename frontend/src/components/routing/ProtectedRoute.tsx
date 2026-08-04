import { type PropsWithChildren, useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { ErrorPanel } from "@/components/ui/StatePanels";
import { useAuth } from "../../features/auth/useAuth";
import RouteLoading from "./RouteLoading";

export default function ProtectedRoute({ children }: PropsWithChildren) {
  const { error, isAuthenticated, isLoading, refreshUser, status, user } =
    useAuth();
  const location = useLocation();
  const preservedContent = useRef<
    (HTMLDivElement & { inert?: boolean }) | null
  >(null);
  const isRevalidatingKnownIdentity =
    Boolean(user) && (isLoading || status === "error");

  useEffect(() => {
    if (preservedContent.current) {
      preservedContent.current.inert = isRevalidatingKnownIdentity;
    }
  }, [isRevalidatingKnownIdentity]);

  if (isLoading && !user) {
    return <RouteLoading />;
  }

  const sessionError = status === "error" ? (
    <div className="gv-page-shell" key="session-error">
      <ErrorPanel
        action={
          <Button onClick={() => void refreshUser()} variant="secondary">
            Check session again
          </Button>
        }
        description={
          error?.message ||
          "The authentication service did not respond. Your session state has not been changed."
        }
        headingLevel="h1"
        eyebrow="Session check unavailable"
        title="YOUR PRIVATE SESSION COULD NOT BE VERIFIED"
      />
    </div>
  ) : null;

  if (status === "error" && !user) {
    return sessionError;
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;

    return <Navigate to="/login" replace state={{ from: returnTo }} />;
  }

  return (
    <>
      {isLoading ? <RouteLoading key="session-loading" /> : sessionError}
      <div
        aria-hidden={isRevalidatingKnownIdentity || undefined}
        hidden={isRevalidatingKnownIdentity}
        key="protected-content"
        ref={preservedContent}
        style={isRevalidatingKnownIdentity ? undefined : { display: "contents" }}
      >
        {children}
      </div>
    </>
  );
}
