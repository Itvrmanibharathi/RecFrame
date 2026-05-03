const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIAL_RE = /[!@#$%^&*(),.?":{}|<>]/;

export function validateEmail(email) {
  if (!email) return "Email is required";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address";
  return null;
}

export function validatePassword(password) {
  if (!password || password.length < 8)
    return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password))
    return "Password must contain at least one lowercase letter";
  if (!/\d/.test(password))
    return "Password must contain at least one number";
  if (!SPECIAL_RE.test(password))
    return "Password must contain at least one special character (!@#$%^&*...)";
  return null;
}
