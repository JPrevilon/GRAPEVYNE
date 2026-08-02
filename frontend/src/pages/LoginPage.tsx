import { Navigate, useLocation } from "react-router-dom";

import AuthForm from "@/components/auth/AuthForm";
import { PageShell } from "@/components/ui/PageShell";
import { useAuth } from "@/features/auth/useAuth";
import { getReturnTo } from "@/lib/returnTo";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const returnTo = getReturnTo(location.state);

  if (!isLoading && isAuthenticated) {
    return <Navigate replace to={returnTo} />;
  }

  return (
    <PageShell
      className="gv-auth-page gv-auth-page--login"
      description="Return to your saved bottles, tasting notes, and personal wine memory."
      eyebrow="Welcome back"
      title="Sign in to open your cellar."
    >
      <AuthForm
        mode="login"
        navigationState={location.state}
        returnTo={returnTo}
      />
    </PageShell>
  );
}
