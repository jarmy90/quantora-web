import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLocation,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import "../styles/app.css";
import { t } from "../i18n";
import {
  getActiveLocale,
  htmlLangForLocale,
  resolveBrowserLocale,
  setActiveLocale,
} from "../i18n/locale";
import { resolveLocaleForRequest } from "../i18n/server";
import { absoluteUrl } from "../site";

export const Route = createRootRoute({
  beforeLoad: async () => {
    if (typeof document === "undefined") {
      const resolution = await resolveLocaleForRequest();
      setActiveLocale(resolution.locale);
    } else {
      const resolution = resolveBrowserLocale(
        document.cookie,
        navigator.languages ?? [navigator.language],
      );
      setActiveLocale(resolution.locale);
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Quantora" },
      { name: "description", content: t("seo.homeDescription") },
      { property: "og:title", content: "Quantora — Strategies you can understand" },
      { property: "og:description", content: t("seo.homeDescription") },
    ],
  }),
  notFoundComponent: () => <div>{t("common.notFound")}</div>,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  const lang = htmlLangForLocale(getActiveLocale());
  const locale = getActiveLocale();
  const canonical = absoluteUrl(useLocation().pathname);
  const ogLocale = locale === "es-ES" ? "es_ES" : "en_US";
  const ogAlternateLocale = locale === "es-ES" ? "en_US" : "es_ES";
  return (
    <html lang={lang}>
      <head>
        <link rel="canonical" href={canonical} />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content="Quantora" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content={ogLocale} />
        <meta property="og:locale:alternate" content={ogAlternateLocale} />
        <meta name="twitter:card" content="summary" />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
