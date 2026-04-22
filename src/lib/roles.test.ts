import { describe, it, expect } from "vitest";
import { isAdminRole, isStaffRole } from "./roles";

describe("roles helpers", () => {
  describe("isAdminRole", () => {
    it("returns true for admin", () => {
      expect(isAdminRole("admin")).toBe(true);
    });

    it("returns false for lecturer", () => {
      expect(isAdminRole("lecturer")).toBe(false);
    });

    it("returns false for student", () => {
      expect(isAdminRole("student")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isAdminRole(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isAdminRole(undefined)).toBe(false);
    });
  });

  describe("isStaffRole", () => {
    it("returns true for admin", () => {
      expect(isStaffRole("admin")).toBe(true);
    });

    it("returns true for lecturer", () => {
      expect(isStaffRole("lecturer")).toBe(true);
    });

    it("returns false for student", () => {
      expect(isStaffRole("student")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isStaffRole(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isStaffRole(undefined)).toBe(false);
    });
  });
});
