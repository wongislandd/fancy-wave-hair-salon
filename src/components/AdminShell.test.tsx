// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminShell } from "./AdminShell";
import { LanguageProvider } from "../lib/i18n";

vi.mock("../lib/data", () => ({
  isStaffSignedIn: vi.fn(async () => true)
}));

function renderAdminShell() {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminShell title="Appointments" actions={<button type="button">Add appointment</button>}>
          <p>Admin content</p>
        </AdminShell>
      </MemoryRouter>
    </LanguageProvider>
  );
}

describe("AdminShell", () => {
  beforeEach(() => {
    window.localStorage.setItem("fancy-wave-language", "en");
  });

  it("renders page actions without a duplicate sign out button", async () => {
    renderAdminShell();

    expect(await screen.findByRole("heading", { name: "Appointments" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add appointment" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });
});
