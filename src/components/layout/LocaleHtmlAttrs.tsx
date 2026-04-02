"use client";

import { useEffect } from "react";
import { useLocale } from "@/lib/i18n/useT";

/**
 * Syncs <html lang> and <html dir> with the current locale from Zustand.
 * Rendered inside <head> so it runs early on hydration.
 */
export function LocaleHtmlAttrs() {
  const locale = useLocale();

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = locale === "he" ? "rtl" : "ltr";
  }, [locale]);

  return null;
}
