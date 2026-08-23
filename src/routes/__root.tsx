import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import "../styles/app.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Quantora" },
      {
        name: "description",
        content:
          "Quantora evaluates rules-based trading strategies through structured backtesting, with performance, risk and limitations shown clearly.",
      },
      { property: "og:title", content: "Quantora — Strategies you can understand" },
      {
        property: "og:description",
        content:
          "Compare transparent, rules-based trading strategies evaluated through structured backtesting.",
      },
    ],
  }),
  notFoundComponent: () => <div>Page not found</div>,
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
