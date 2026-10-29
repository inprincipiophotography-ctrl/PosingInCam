// Markdown negotiation for agents (middleware.js). Run: node qa/test_agents.mjs
// (also run by qa/test_agents.py).
import assert from "node:assert/strict";
import middleware, { prefersMarkdown, config } from "../middleware.js";
import { PAGES, NOT_FOUND } from "../agent/pages.js";

const SITE = "https://cards.notalucis.com";
const call = (path, accept, method = "GET") =>
  middleware(new Request(SITE + path, { method, headers: accept == null ? {} : { accept } }));

const BROWSER = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
const tests = {
  "homepage: Accept text/markdown gets Markdown with Vary: Accept": async () => {
    const r = call("/", "text/markdown");
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "text/markdown; charset=utf-8");
    assert.equal(r.headers.get("vary"), "Accept");
    assert.equal(r.headers.get("link"), `<${SITE}/>; rel="canonical"`);
    const body = await r.text();
    assert.ok(body.startsWith("# Shoot Cards"), body.slice(0, 40));
    assert.ok(body.length > 1000);
  },
  "homepage: browsers and plain fetchers get the HTML untouched": () => {
    for (const accept of [BROWSER, "text/html", "*/*", "", null, "text/html, text/markdown;q=0.5"]) {
      assert.equal(call("/", accept), undefined, String(accept));
    }
  },
  "q-values decide; markdown wins a tie with html": () => {
    assert.equal(prefersMarkdown("text/markdown, text/html;q=0.9"), true);
    assert.equal(prefersMarkdown("text/html, text/markdown"), true);
    assert.equal(prefersMarkdown("text/markdown;q=0"), false);
    assert.equal(prefersMarkdown("text/x-markdown"), true);
    assert.equal(prefersMarkdown("TEXT/MARKDOWN; charset=utf-8"), true);
    assert.equal(prefersMarkdown("text/markdown;q=abc"), false);
  },
  "every page has Markdown at its path, with a trailing slash and as .md": async () => {
    for (const p of ["/demo", "/about", "/contact", "/privacy"]) {
      for (const [path, accept] of [[p, "text/markdown"], [p + "/", "text/markdown"], [p + ".md", BROWSER], [p + ".md", null]]) {
        const r = call(path, accept);
        assert.equal(r.status, 200, path);
        assert.equal(r.headers.get("link"), `<${SITE}${p}>; rel="canonical"`, path);
      }
    }
    assert.equal(call("/index.md", null).status, 200);
    assert.equal(call("/index.md", null).headers.get("link"), `<${SITE}/>; rel="canonical"`);
  },
  "unknown path: 404 with a Markdown body linking llms.txt and the sitemap": async () => {
    for (const path of ["/__ora-404-probe-ez78yxxe", "/nope/deeper", "/missing.md"]) {
      const r = call(path, "text/markdown");
      assert.equal(r.status, 404, path);
      assert.equal(r.headers.get("content-type"), "text/markdown; charset=utf-8");
      assert.equal(r.headers.get("vary"), "Accept");
      assert.equal(r.headers.get("x-robots-tag"), "noindex");
      const body = await r.text();
      assert.ok(body.length >= 20 && body.includes(`${SITE}/llms.txt`) && body.includes(`${SITE}/sitemap.xml`));
    }
    assert.equal(call("/__ora-404-probe", BROWSER), undefined); // browsers keep the HTML 404 page
  },
  "real files are left to the static server": () => {
    for (const p of ["/robots.txt", "/sitemap.xml", "/llms.txt", "/favicon.svg"]) assert.equal(call(p, "text/markdown"), undefined, p);
  },
  "HEAD works like GET": () => {
    const r = call("/", "text/markdown", "HEAD");
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "text/markdown; charset=utf-8");
  },
  "matcher keeps the middleware off the API, assets and Vercel paths": () => {
    const re = new RegExp("^" + config.matcher[0] + "$");
    for (const p of ["/", "/demo", "/about/", "/x.md", "/__probe"]) assert.ok(re.test(p), p);
    for (const p of ["/api/convert", "/assets/app.js", "/_vercel/insights/script.js", "/agent/pages.js"]) assert.ok(!re.test(p), p);
    assert.equal(config.runtime, "edge");
  },
  "Markdown pages link each other and carry no HTML": () => {
    for (const [path, md] of Object.entries(PAGES)) {
      assert.ok(md.startsWith("# "), path);
      assert.ok(!/<\/?[a-z][^>]*>/i.test(md), `${path} contains HTML`);
    }
    assert.ok(NOT_FOUND.startsWith("# "));
  },
};

let n = 0;
for (const [name, fn] of Object.entries(tests)) {
  await fn();
  console.log("ok:", name);
  n++;
}
console.log(`\nAll ${n} middleware tests passed.`);
