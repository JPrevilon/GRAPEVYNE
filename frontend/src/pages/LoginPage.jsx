import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader.jsx";
import { useToast } from "../components/ui/useToast.js";
import { getAuthErrorMessage } from "../features/auth/authErrors.js";
import { useAuth } from "../features/auth/useAuth.js";
import { validateLoginForm } from "../utils/formValidation.js";

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from?.pathname || "/cellar";

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");

    const validationError = validateLoginForm(formData);

    if (validationError) {
      setErrorMessage(validationError);
      showToast({
        title: "Check the form",
        message: validationError,
        tone: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await login(formData);
      showToast({
        title: "Welcome back",
        message: "Your cellar is ready.",
      });
      navigate(from, { replace: true });
    } catch (error) {
      const message = getAuthErrorMessage(error);
      setErrorMessage(message);
      showToast({
        title: "Sign in failed",
        message,
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <PageHeader
        eyebrow="Welcome back"
        title="Sign in to open your cellar."
        description="Return to your saved bottles, tasting notes, and personal wine memory."
      />
      <form className="auth-card" onSubmit={handleSubmit}>
        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
        <label>
          Email
          <input
            autoComplete="email"
            name="email"
            onChange={handleChange}
            placeholder="you@example.com"
            required
            type="email"
            value={formData.email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            name="password"
            onChange={handleChange}
            placeholder="Your password"
            required
            type="password"
            value={formData.password}
          />
        </label>
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
        <p className="auth-switch">
          New to GrapeVyne? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
