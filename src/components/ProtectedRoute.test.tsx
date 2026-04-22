import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "@/context/AuthContext";

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function renderProtectedRoute(
  authValue: {
    user: any;
    role: string | null;
    loading: boolean;
    hasPermission: (permission: string) => boolean;
  },
  options?: {
    allowedRoles?: string[];
    requiredPermission?: string;
  },
) {
  mockedUseAuth.mockReturnValue({
    user: authValue.user,
    session: null,
    profile: null,
    role: authValue.role as any,
    permissions: [],
    loading: authValue.loading,
    signOut: vi.fn(),
    fetchProfile: vi.fn(),
    hasPermission: authValue.hasPermission,
  });

  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute
              allowedRoles={options?.allowedRoles}
              requiredPermission={options?.requiredPermission}
            >
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner while auth is loading", () => {
    const { container } = renderProtectedRoute({
      user: null,
      role: null,
      loading: true,
      hasPermission: () => false,
    });

    const spinner = container.querySelector("svg.animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("redirects unauthenticated users to login", () => {
    renderProtectedRoute({
      user: null,
      role: null,
      loading: false,
      hasPermission: () => false,
    });

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders protected content for authenticated allowed role", () => {
    renderProtectedRoute(
      {
        user: { id: "u1" },
        role: "admin",
        loading: false,
        hasPermission: () => true,
      },
      {
        allowedRoles: ["admin", "lecturer"],
      },
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects authenticated user with wrong role to dashboard", () => {
    renderProtectedRoute(
      {
        user: { id: "u1" },
        role: "student",
        loading: false,
        hasPermission: () => true,
      },
      {
        allowedRoles: ["admin"],
      },
    );

    expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
  });

  it("shows access denied when permission is missing", () => {
    renderProtectedRoute(
      {
        user: { id: "u1" },
        role: "lecturer",
        loading: false,
        hasPermission: () => false,
      },
      {
        requiredPermission: "manage_users",
      },
    );

    expect(screen.getByText("403")).toBeInTheDocument();
    expect(
      screen.getByText("Access Denied: Insufficient Permissions."),
    ).toBeInTheDocument();
  });

  it("renders protected content when permission exists", () => {
    renderProtectedRoute(
      {
        user: { id: "u1" },
        role: "lecturer",
        loading: false,
        hasPermission: (permission) => permission === "manage_users",
      },
      {
        requiredPermission: "manage_users",
      },
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
