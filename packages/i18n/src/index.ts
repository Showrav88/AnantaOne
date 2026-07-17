import en from "../locales/en.json";
import bn from "../locales/bn.json";

export const locales = { en, bn } as const;
export type LocaleCode = keyof typeof locales;

export function getMessages(locale: LocaleCode = "bn") {
  return locales[locale] ?? locales.bn;
}
