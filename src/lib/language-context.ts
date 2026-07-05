import { createContext } from "react";
import type { Language } from "./localization";

export type TranslationFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;

export type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: TranslationFunction;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);
