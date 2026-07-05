// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../lib/i18n";
import { AdminLoginPage } from "./AdminLoginPage";

vi.mock("../lib/data", () => ({
  signInStaff: vi.fn(async () => undefined)
}));

function renderAdminLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter>
          <AdminLoginPage />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("AdminLoginPage", () => {
  beforeEach(() => {
    window.localStorage.setItem("fancy-wave-language", "en");
  });

  it("renders a standard blank staff login without demo messaging", () => {
    renderAdminLoginPage();

    expect(screen.getByRole("heading", { name: "Staff sign in" })).toBeTruthy();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
    expect(screen.queryByText(/demo/i)).toBeNull();
    expect(screen.queryByText(/supabase/i)).toBeNull();
    expect(screen.queryByText(/connected/i)).toBeNull();
  });
});
