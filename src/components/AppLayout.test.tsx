// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "./AppLayout";
import { LanguageProvider } from "../lib/i18n";

vi.mock("../lib/data", async () => {
  const actual = await vi.importActual<typeof import("../lib/data")>("../lib/data");
  return {
    ...actual,
    signOutStaff: vi.fn(async () => undefined)
  };
});

function renderLayout(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppLayout>
            <main>Page content</main>
          </AppLayout>
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("AppLayout", () => {
  beforeEach(() => {
    window.localStorage.setItem("fancy-wave-language", "en");
  });

  it("replaces the public booking action with sign out on admin routes", () => {
    renderLayout("/admin/login");

    expect(screen.getByText("Fancy Wave Beauty Salon")).toBeTruthy();
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.queryByText("Book an appointment")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });
});
