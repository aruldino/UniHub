import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchAssignmentsBootstrap,
  fetchAssignmentFilterLists,
} from "./assignmentsService";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const mockedSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
};

describe("assignmentsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns lecturer-only subjects and assignments for lecturer role", async () => {
    const lecturerSubjects = [
      { id: "s1", name: "OOP", lecturer_id: "lec1" },
      { id: "s2", name: "DBMS", lecturer_id: "lec1" },
    ];

    const departments = [{ id: "d1", name: "IT" }];

    const assignments = [
      { id: "a1", subject_id: "s1", title: "Assignment 1" },
      { id: "a2", subject_id: "s2", title: "Assignment 2" },
    ];

    const subjectsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: lecturerSubjects }),
    };

    const departmentsBuilder = {
      select: vi.fn().mockResolvedValue({ data: departments }),
    };

    const assignmentsBuilder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: assignments }),
    };

    mockedSupabase.from.mockImplementation((table: string) => {
      if (table === "subjects") return subjectsBuilder;
      if (table === "departments") return departmentsBuilder;
      if (table === "assignments") return assignmentsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await fetchAssignmentsBootstrap("lec1", "lecturer");

    expect(result.subjects).toEqual(lecturerSubjects);
    expect(result.departments).toEqual(departments);
    expect(result.assignments).toEqual(assignments);
    expect(subjectsBuilder.eq).toHaveBeenCalledWith("lecturer_id", "lec1");
    expect(assignmentsBuilder.in).toHaveBeenCalledWith("subject_id", ["s1", "s2"]);
  });

  it("returns only enrolled assignments for student role", async () => {
    const allSubjects = [
      { id: "s1", name: "OOP" },
      { id: "s2", name: "DBMS" },
    ];

    const departments = [{ id: "d1", name: "IT" }];

    const allAssignments = [
      { id: "a1", subject_id: "s1", title: "Assignment 1" },
      { id: "a2", subject_id: "s2", title: "Assignment 2" },
    ];

    const enrollments = [{ subject_id: "s1" }];

    const submissions = [
      {
        assignment_id: "a1",
        id: "sub1",
        marks: 85,
        submitted_at: "2026-04-22",
        file_name: "oop.pdf",
      },
    ];

    const subjectsBuilder = {
      select: vi.fn().mockReturnValue({ data: allSubjects }),
      eq: vi.fn(),
    };

    const departmentsBuilder = {
      select: vi.fn().mockResolvedValue({ data: departments }),
    };

    const assignmentsBuilder = {
      select: vi.fn().mockReturnValue({ data: allAssignments }),
      in: vi.fn(),
    };

    const enrollmentsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: enrollments }),
    };

    const submissionsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: submissions }),
    };

    mockedSupabase.from.mockImplementation((table: string) => {
      if (table === "subjects") return subjectsBuilder;
      if (table === "departments") return departmentsBuilder;
      if (table === "assignments") return assignmentsBuilder;
      if (table === "enrollments") return enrollmentsBuilder;
      if (table === "submissions") return submissionsBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await fetchAssignmentsBootstrap("stu1", "student");

    expect(result.subjects).toEqual(allSubjects);
    expect(result.departments).toEqual(departments);

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]).toEqual(
      expect.objectContaining({
        id: "a1",
        subject_id: "s1",
        mySubmission: expect.objectContaining({
          id: "sub1",
          marks: 85,
        }),
      }),
    );
  });

  it("returns filter lists for departments and batches", async () => {
    const departments = [
      { id: "d1", name: "IT" },
      { id: "d2", name: "SE" },
    ];

    const batches = [
      { id: "b1", name: "Y1S1" },
      { id: "b2", name: "Y2S1" },
    ];

    const departmentsBuilder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: departments }),
    };

    const batchesBuilder = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: batches }),
    };

    mockedSupabase.from.mockImplementation((table: string) => {
      if (table === "departments") return departmentsBuilder;
      if (table === "batches") return batchesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await fetchAssignmentFilterLists();

    expect(result.departments).toEqual(departments);
    expect(result.batches).toEqual(batches);
    expect(departmentsBuilder.order).toHaveBeenCalledWith("name");
    expect(batchesBuilder.order).toHaveBeenCalledWith("name");
  });
});
