import { describe, it, expect } from "vitest";
import { validateEmail, validatePassword } from "../utils/validate";

describe("validateEmail", () => {
  it("returns error for empty string", () => {
    expect(validateEmail("")).toBe("Email is required");
  });

  it("returns error for string without @", () => {
    expect(validateEmail("nodomain")).toBe("Enter a valid email address");
  });

  it("returns null for valid email", () => {
    expect(validateEmail("user@example.com")).toBeNull();
  });
});

describe("validatePassword", () => {
  it("returns error when shorter than 8 characters", () => {
    expect(validatePassword("Sh0rt!")).toBe(
      "Password must be at least 8 characters"
    );
  });

  it("returns error when missing uppercase", () => {
    expect(validatePassword("lowercase1!")).toBe(
      "Password must contain at least one uppercase letter"
    );
  });

  it("returns error when missing lowercase", () => {
    expect(validatePassword("UPPERCASE1!")).toBe(
      "Password must contain at least one lowercase letter"
    );
  });

  it("returns error when missing digit", () => {
    expect(validatePassword("NoDigits!!")).toBe(
      "Password must contain at least one number"
    );
  });

  it("returns error when missing special character", () => {
    expect(validatePassword("NoSpecial1")).toBe(
      "Password must contain at least one special character (!@#$%^&*...)"
    );
  });

  it("returns null for a valid password", () => {
    expect(validatePassword("Valid1Pass!")).toBeNull();
  });
});
