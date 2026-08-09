import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "~/styles/app.css?url";
import { SessionProvider } from "~/auth/session";
import { FavoritesProvider } from "~/state/favorites";
import { DraftsProvider } from "~/state/drafts";
import { CompareProvider } from "~/state/compare";
import { ConsentBanner } from "~/components/ui";
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Quantora — Algorithmic strategy discovery & evaluation" },
      {
        name: "description",
        content:
          "Discover and evaluate algorithmic MetaTrader 5 strategies with transparent, auditable Power Scores. Demo product — not investment advice.",
      },
      { property: "og:site_name", content: "Quantora" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => <div>Page not found</div>,
  component: RootComponent,
});
function RootComponent() {
  return (
    <RootDocument>
      <SessionProvider>
        <FavoritesProvider>
          <DraftsProvider>
            <CompareProvider>
              <Outlet />
              <ConsentBanner />
            </CompareProvider>
          </DraftsProvider>
        </FavoritesProvider>
      </SessionProvider>
    </RootDocument>
  );
}
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en-US">
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
