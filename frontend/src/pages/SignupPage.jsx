import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader.jsx";
import { useToast } from "../components/ui/useToast.js";
import { getAuthErrorMessage } from "../features/auth/authErrors.js";
import { useAuth } from "../features/auth/useAuth.js";
import { validateSignupForm } from "../utils/formValidation.js";

export default function SignupPage() {
  const { isAuthenticated, isLoading, signup } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from?.pathname || "/cellar";

  const [formData, setFormData] = useState({
    name: "",
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

    const validationError = validateSignupForm(formData);

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
      await signup(formData);
      showToast({
        title: "Cellar created",
        message: "You can start saving bottles now.",
      });
      navigate(from, { replace: true });
    } catch (error) {
      const message = getAuthErrorMessage(error);
      setErrorMessage(message);
      showToast({
        title: "Signup failed",
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
        eyebrow="Create account"
        title="Begin your personal wine memory."
        description="Save bottles, rate them, and build a cellar that remembers what you love."
      />
      <form className="auth-card" onSubmit={handleSubmit}>
        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
        <label>
          Name
          <input
            autoComplete="name"
            name="name"
            onChange={handleChange}
            placeholder="Your name"
            required
            type="text"
            value={formData.name}
          />
        </label>
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
            autoComplete="new-password"
            minLength={8}
            name="password"
            onChange={handleChange}
            placeholder="Create a password"
            required
            type="password"
            value={formData.password}
          />
        </label>
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
        <p className="auth-switch">
          Already have a cellar? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
