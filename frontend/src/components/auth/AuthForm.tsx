import { type ChangeEvent, type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { isAbortError } from "@/api/client";
import BrandLockup from "@/components/brand/BrandLockup";
import { Button } from "@/components/ui/Button";
import { PasswordInput, TextInput } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/useToast.js";
import { getAuthErrorMessage } from "@/features/auth/authErrors";
import { useAuth } from "@/features/auth/useAuth";
import {
  validateLoginForm,
  validateSignupForm,
} from "@/utils/formValidation.js";

export type AuthMode = "login" | "signup";

interface AuthFormProps {
  mode: AuthMode;
  navigationState: unknown;
  returnTo: string;
}

interface AuthFormValues {
  email: string;
  name: string;
  password: string;
}

const AUTH_COPY = {
  login: {
    busyLabel: "Signing in…",
    submitLabel: "Sign in",
    successMessage: "Your cellar is ready.",
    successTitle: "Welcome back",
  },
  signup: {
    busyLabel: "Creating account…",
    submitLabel: "Create account",
    successMessage: "You can start saving bottles now.",
    successTitle: "Cellar created",
  },
} as const;

const INITIAL_VALUES: AuthFormValues = {
  email: "",
  name: "",
  password: "",
};

export default function AuthForm({
  mode,
  navigationState,
  returnTo,
}: AuthFormProps) {
  const { error: authError, isLoading, login, signup, status } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<AuthFormValues>(INITIAL_VALUES);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignup = mode === "signup";
  const isBusy = isLoading || isSubmitting;
  const copy = AUTH_COPY[mode];
  const errorId = `${mode}-form-error`;
  const sessionWarningId = `${mode}-session-warning`;
  const sessionWarning =
    status === "error"
      ? authError?.message || "The existing session could not be checked."
      : "";

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const fieldName = event.currentTarget.name as keyof AuthFormValues;
    const { value } = event.currentTarget;

    setFormData((current) => ({ ...current, [fieldName]: value }));
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    setErrorMessage("");

    const validationError = isSignup
      ? validateSignupForm(formData)
      : validateLoginForm(formData);

    if (validationError) {
      setErrorMessage(validationError);
      showToast({
        message: validationError,
        title: "Check the form",
        tone: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignup) {
        await signup({
          email: formData.email,
          name: formData.name,
          password: formData.password,
        });
      } else {
        await login({
          email: formData.email,
          password: formData.password,
        });
      }

      showToast({
        message: copy.successMessage,
        title: copy.successTitle,
      });
      navigate(returnTo, { replace: true });
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      const message = getAuthErrorMessage(error);

      setErrorMessage(message);
      showToast({
        message,
        title: isSignup ? "Signup failed" : "Sign in failed",
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      aria-busy={isBusy || undefined}
      aria-describedby={
        errorMessage ? errorId : sessionWarning ? sessionWarningId : undefined
      }
      aria-label={isSignup ? "Create account form" : "Sign in form"}
      className="gv-auth-card"
      noValidate
      onSubmit={handleSubmit}
    >
      <BrandLockup className="gv-auth-card__brand" />
      {errorMessage ? (
        <p
          aria-live="assertive"
          className="gv-auth-card__error"
          id={errorId}
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      {!errorMessage && sessionWarning ? (
        <p
          className="gv-auth-card__error"
          id={sessionWarningId}
          role="status"
        >
          Session check unavailable: {sessionWarning} You can retry by signing in.
        </p>
      ) : null}

      <div className="gv-auth-card__fields">
        {isSignup ? (
          <TextInput
            autoComplete="name"
            disabled={isBusy}
            label="Name"
            name="name"
            onChange={handleChange}
            placeholder="Your name"
            required
            value={formData.name}
          />
        ) : null}

        <TextInput
          autoComplete="email"
          disabled={isBusy}
          label="Email"
          name="email"
          onChange={handleChange}
          placeholder="you@example.com"
          required
          type="email"
          value={formData.email}
        />

        <PasswordInput
          autoComplete={isSignup ? "new-password" : "current-password"}
          description={
            isSignup
              ? "Use at least 8 characters."
              : "Enter the password for your GRAPEVYNE account."
          }
          disabled={isBusy}
          label="Password"
          minLength={isSignup ? 8 : undefined}
          name="password"
          onChange={handleChange}
          placeholder={isSignup ? "Create a password" : "Your password"}
          required
          value={formData.password}
        />
      </div>

      <div className="gv-auth-card__actions">
        <Button
          busyLabel={isLoading ? "Checking session…" : copy.busyLabel}
          isBusy={isBusy}
          type="submit"
          variant="primary"
        >
          {copy.submitLabel}
        </Button>
      </div>

      <p className="gv-auth-card__switch">
        {isSignup ? "Already have a cellar?" : "New to GRAPEVYNE?"}{" "}
        <Link state={navigationState} to={isSignup ? "/login" : "/signup"}>
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
