import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../features/auth/useAuth.js";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <section className="state-panel">
        <p className="eyebrow">One moment</p>
        <h1>Opening your private cellar.</h1>
        <p>Checking your session before revealing personal wine data.</p>
      </section>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
