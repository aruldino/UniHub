import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAuthUserBundle } from "./authService";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const mockedSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
};

describe("fetchAuthUserBundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns profile, role, and permissions when user data exists", async () => {
    const profileBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "p1",
          user_id: "u1",
          full_name: "Aruldino",
          email: "arul@example.com",
        },
      }),
    };

    const roleBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "r1",
          user_id: "u1",
          role: "admin",
        },
      }),
    };

    const permissionsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { permissions: { name: "manage_users" } },
          { permissions: { name: "view_reports" } },
        ],
      }),
    };

    mockedSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") return profileBuilder;
      if (table === "user_roles") return roleBuilder;
      if (table === "role_permissions") return permissionsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await fetchAuthUserBundle("u1");

    expect(result.profile).toEqual(
      expect.objectContaining({
        user_id: "u1",
        full_name: "Aruldino",
      }),
    );
    expect(result.role).toBe("admin");
    expect(result.permissions).toEqual(["manage_users", "view_reports"]);
  });

  it("returns empty permissions when role does not exist", async () => {
    const profileBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "p1",
          user_id: "u1",
          full_name: "Aruldino",
          email: "arul@example.com",
        },
      }),
    };

    const roleBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
      }),
    };

    mockedSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") return profileBuilder;
      if (table === "user_roles") return roleBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await fetchAuthUserBundle("u1");

    expect(result.profile).toEqual(
      expect.objectContaining({
        user_id: "u1",
      }),
    );
    expect(result.role).toBeNull();
    expect(result.permissions).toEqual([]);
  });

  it("returns null profile when profile does not exist", async () => {
    const profileBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
      }),
    };

    const roleBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "r1",
          user_id: "u1",
          role: "lecturer",
        },
      }),
    };

    const permissionsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ permissions: { name: "grade_assignments" } }],
      }),
    };

    mockedSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") return profileBuilder;
      if (table === "user_roles") return roleBuilder;
      if (table === "role_permissions") return permissionsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await fetchAuthUserBundle("u1");

    expect(result.profile).toBeNull();
    expect(result.role).toBe("lecturer");
    expect(result.permissions).toEqual(["grade_assignments"]);
  });
});
