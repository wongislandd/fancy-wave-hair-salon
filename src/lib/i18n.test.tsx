// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "./i18n";
import { useLanguage } from "./use-language";

const storageKey = "fancy-wave-language";

function setBrowserLanguages(languages: string[], language = languages[0] ?? "") {
  Object.defineProperty(window.navigator, "languages", {
    configurable: true,
    value: languages
  });
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: language
  });
}

function LanguageProbe() {
  const { language, setLanguage } = useLanguage();

  return (
    <>
      <span data-testid="language">{language}</span>
      <button type="button" onClick={() => setLanguage("zh")}>
        Switch to Chinese
      </button>
    </>
  );
}

function renderProbe() {
  return render(
    <LanguageProvider>
      <LanguageProbe />
    </LanguageProvider>
  );
}

describe("LanguageProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
    setBrowserLanguages(["fr-FR"], "fr-FR");
  });

  it("falls back to English when there is no saved or supported browser language", async () => {
    renderProbe();

    expect(screen.getByTestId("language").textContent).toBe("en");
    await waitFor(() => expect(document.documentElement.lang).toBe("en-US"));
  });

  it("uses browser language metadata when it is supported", async () => {
    setBrowserLanguages(["zh-CN", "en-US"], "zh-CN");

    renderProbe();

    expect(screen.getByTestId("language").textContent).toBe("zh");
    await waitFor(() => expect(document.documentElement.lang).toBe("zh-CN"));
  });

  it("prefers a saved language over browser language metadata", async () => {
    window.localStorage.setItem(storageKey, "en");
    setBrowserLanguages(["zh-CN"], "zh-CN");

    renderProbe();

    expect(screen.getByTestId("language").textContent).toBe("en");
    await waitFor(() => expect(document.documentElement.lang).toBe("en-US"));
  });

  it("persists explicit language changes and updates the document language", async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: "Switch to Chinese" }));

    expect(window.localStorage.getItem(storageKey)).toBe("zh");
    expect(screen.getByTestId("language").textContent).toBe("zh");
    await waitFor(() => expect(document.documentElement.lang).toBe("zh-CN"));
  });
});
