import { Navigate, useLocation } from "react-router-dom";

import AuthForm from "@/components/auth/AuthForm";
import DirectoryHeading from "@/components/typography/DirectoryHeading";
import { DIRECTORY_PAGE_HEADINGS } from "@/components/typography/directoryHeadingPresets";
import { PageShell } from "@/components/ui/PageShell";
import { useAuth } from "@/features/auth/useAuth";
import { getReturnTo } from "@/lib/returnTo";

export default function SignupPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const returnTo = getReturnTo(location.state);

  if (!isLoading && isAuthenticated) {
    return <Navigate replace to={returnTo} />;
  }

  return (
    <PageShell
      className="gv-auth-page gv-auth-page--signup"
      description="Save bottles, rate them, and build a cellar that remembers what you love."
      eyebrow="05 / NEW DIRECTORY ENTRY"
      heading={<DirectoryHeading {...DIRECTORY_PAGE_HEADINGS.signup} />}
    >
      <AuthForm
        mode="signup"
        navigationState={location.state}
        returnTo={returnTo}
      />
    </PageShell>
  );
}
