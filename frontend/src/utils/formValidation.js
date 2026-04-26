const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateLoginForm({ email, password }) {
  if (!email.trim()) {
    return "Email is required.";
  }

  if (!EMAIL_PATTERN.test(email.trim())) {
    return "Enter a valid email address.";
  }

  if (!password) {
    return "Password is required.";
  }

  return "";
}

export function validateSignupForm({ email, name, password }) {
  if (!name.trim()) {
    return "Name is required.";
  }

  const loginError = validateLoginForm({ email, password });

  if (loginError) {
    return loginError;
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  return "";
}

export function validateCellarForm({ notes, occasion, userRating }) {
  if (userRating) {
    const numericRating = Number(userRating);

    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return "Rating must be between 1 and 5.";
    }
  }

  if (occasion.length > 160) {
    return "Occasion must be 160 characters or fewer.";
  }

  if (notes.length > 4000) {
    return "Notes must be 4000 characters or fewer.";
  }

  return "";
}

