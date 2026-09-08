import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
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
  return (
    <html lang={lang}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
