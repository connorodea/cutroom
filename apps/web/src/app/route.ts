export type Route = "landing" | "editor";

/** Map a URL path to the top-level view: the editor lives under /app, everything else is the landing site. */
export function routeFor(pathname: string): Route {
  return pathname === "/app" || pathname.startsWith("/app/") ? "editor" : "landing";
}
