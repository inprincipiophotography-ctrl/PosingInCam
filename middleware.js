// Markdown for agents (Vercel Routing Middleware).
//
// A request whose Accept header prefers text/markdown over text/html gets the
// Markdown version of the page (agent/pages.js), or a Markdown 404 for a path
// that doesn't exist. /index.md, /demo.md, ... always return Markdown.
// Everything else, i.e. every browser, falls through untouched to the static
// HTML. Responses carry Vary: Accept so caches keep the two apart.

import { PAGES, NOT_FOUND } from "./agent/pages.js";

export const config = {
  runtime: "edge",
  // Pages only: never the API, static assets or Vercel's own paths.
  matcher: ["/((?!api/|assets/|_vercel/|agent/).*)"],
};

const SITE = "https://cards.notalucis.com";

// True when the client ranks text/markdown at least as high as text/html.
// A bare */* (what browsers and most fetchers send) never counts as Markdown.
export function prefersMarkdown(accept) {
  if (!accept) return false;
  let md = 0, html = 0;
  for (const part of accept.split(",")) {
    const [type, ...params] = part.trim().toLowerCase().split(";").map((s) => s.trim());
    let q = 1;
    for (const p of params) {
      if (p.startsWith("q=")) {
        const v = parseFloat(p.slice(2));
        q = Number.isFinite(v) ? v : 0;
      }
    }
    if (type === "text/markdown" || type === "text/x-markdown") md = Math.max(md, q);
    else if (type === "text/html" || type === "application/xhtml+xml") html = Math.max(html, q);
  }
  return md > 0 && md >= html;
}

function markdown(body, status, canonical) {
  const headers = {
    "Content-Type": "text/markdown; charset=utf-8",
    "Vary": "Accept",
    "Cache-Control": "public, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  };
  if (canonical) headers["Link"] = `<${SITE}${canonical}>; rel="canonical"`;
  else headers["X-Robots-Tag"] = "noindex";
  return new Response(body, { status, headers });
}

export default function middleware(request) {
  const { pathname } = new URL(request.url);
  const explicit = pathname.endsWith(".md");
  if (!explicit && !prefersMarkdown(request.headers.get("accept"))) return; // HTML as usual

  const page = PAGES[pathname];
  if (page) {
    const canonical = pathname === "/index.md" ? "/" : pathname.replace(/\.md$|\/$/, "") || "/";
    return markdown(page, 200, canonical);
  }
  // Real files (robots.txt, sitemap.xml, images, ...) are served as they are.
  if (!explicit && /\.[a-z0-9]+$/i.test(pathname)) return;
  return markdown(NOT_FOUND, 404, null);
}
