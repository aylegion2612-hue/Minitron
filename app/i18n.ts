import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "./locales/en/common.json";
import enChat from "./locales/en/chat.json";
import hiCommon from "./locales/hi/common.json";
import urCommon from "./locales/ur/common.json";
import arCommon from "./locales/ar/common.json";
import esCommon from "./locales/es/common.json";

const resources = {
  en: { common: enCommon, chat: enChat },
  hi: { common: hiCommon },
  ur: { common: urCommon },
  ar: { common: arCommon },
  es: { common: esCommon },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

const rtlLangs = new Set(["ar", "ur", "he", "fa"]);
i18n.on("languageChanged", (lng) => {
  if (typeof document === "undefined") return;
  document.documentElement.dir = rtlLangs.has(lng) ? "rtl" : "ltr";
});

export { i18n };
