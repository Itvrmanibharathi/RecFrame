import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Login from "../pages/Login";

const mockLogin = vi.fn();
const mockRegister = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ login: mockLogin, register: mockRegister }),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

function submitForm() {
  fireEvent.submit(document.querySelector("form"));
}

describe("Login form", () => {
  beforeEach(() => {
    mockLogin.mockClear();
    mockRegister.mockClear();
  });

  it("renders email and password inputs", () => {
    renderLogin();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("shows email error and blocks API call when email is invalid (login mode)", () => {
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "notanemail" },
    });
    submitForm();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("shows password error and blocks API call when password is weak (register mode)", () => {
    renderLogin();
    fireEvent.click(screen.getAllByText("Register")[0]);
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), {
      target: { value: "weak" },
    });
    submitForm();
    expect(
      screen.getByText("Password must be at least 8 characters")
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("does not call login API when email is empty", () => {
    renderLogin();
    submitForm();
    expect(mockLogin).not.toHaveBeenCalled();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
  });
});
