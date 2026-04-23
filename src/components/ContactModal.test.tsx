import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactModal } from "@/components/ContactModal";

const toastSpy = vi.fn();
const insertSpy = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: insertSpy,
    })),
  },
}));

const fillValidForm = () => {
  fireEvent.change(screen.getByPlaceholderText("Your full name"), {
    target: { value: "Student One" },
  });
  fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
    target: { value: "student@example.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("0712345678"), {
    target: { value: "07123abc456789" },
  });
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "General Question" },
  });
  fireEvent.change(screen.getByPlaceholderText("Your message..."), {
    target: { value: "I would like more information about fees." },
  });
};

describe("ContactModal", () => {
  beforeEach(() => {
    toastSpy.mockReset();
    insertSpy.mockReset();
    insertSpy.mockResolvedValue({ error: null });
  });

  it("shows a validation toast when message is too short", async () => {
    render(<ContactModal isOpen onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Your full name"), {
      target: { value: "Student One" },
    });
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("0712345678"), {
      target: { value: "0712345678" },
    });
    fireEvent.change(screen.getByPlaceholderText("Your message..."), {
      target: { value: "Too short" },
    });

    fireEvent.click(screen.getByRole("button", { name: /send inquiry/i }));

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Validation error",
          description: "Please enter a message with at least 10 characters.",
          variant: "destructive",
        }),
      );
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("normalizes phone input to only 10 digits", () => {
    render(<ContactModal isOpen onOpenChange={vi.fn()} />);

    const phoneInput = screen.getByPlaceholderText("0712345678") as HTMLInputElement;
    fireEvent.change(phoneInput, {
      target: { value: "07123abc456789" },
    });

    expect(phoneInput.value).toBe("0712345678");
  });

  it("submits inquiry and closes modal on success", async () => {
    const onOpenChange = vi.fn();
    render(<ContactModal isOpen onOpenChange={onOpenChange} />);

    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /send inquiry/i }));

    await waitFor(() => {
      expect(insertSpy).toHaveBeenCalledOnce();
    });

    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Success!",
        variant: "default",
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an error toast when save fails", async () => {
    insertSpy.mockRejectedValueOnce(new Error("network"));

    render(<ContactModal isOpen onOpenChange={vi.fn()} />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /send inquiry/i }));

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          variant: "destructive",
        }),
      );
    });
  });
});
