"""Agent-readiness checks: llms.txt, sitemap.xml, robots.txt, JSON-LD, the
trust pages (about, contact, privacy), vercel.json wiring, and the Markdown
negotiation middleware (qa/test_agents.mjs, run with Node).
Run: python qa/test_agents.py
"""

import html
import json
import os
import re
import subprocess
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://cards.notalucis.com"
PAGES = {"/": "index.html", "/demo": "demo/index.html", "/about": "about/index.html",
         "/contact": "contact/index.html", "/privacy": "privacy/index.html"}


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def visible_text(page):
    s = re.sub(r"<(script|style|svg|head)[^>]*>.*?</\1>", " ", page, flags=re.S)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s)).split())


def node(*args):
    return subprocess.run(["node", *args], cwd=ROOT, capture_output=True, text=True)


def test_middleware_negotiation():
    r = node("qa/test_agents.mjs")
    assert r.returncode == 0, r.stdout + r.stderr
    assert "middleware tests passed" in r.stdout


def test_trust_pages_are_generated_from_the_markdown():
    r = node("scripts/build-pages.mjs", "--check")
    assert r.returncode == 0, "run: node scripts/build-pages.mjs\n" + r.stderr


def test_trust_pages_have_real_content():
    for path in ("/about", "/contact", "/privacy"):
        page = read(PAGES[path])
        text = visible_text(page)
        assert len(text) >= 500, (path, len(text))
        assert f'<link rel="canonical" href="{SITE}{path}" />' in page, path
        assert '<meta name="description" content="' in page, path
    assert "notalucis.dev@gmail.com" in read("contact/index.html")
    privacy = visible_text(read("privacy/index.html"))
    for word in ("Stripe", "Supabase", "Vercel", "cookies", "30 days", "delete"):
        assert word in privacy, word


def test_footers_link_the_trust_pages():
    for rel in ("index.html", "demo/index.html", "404.html", *[PAGES[p] for p in ("/about", "/contact", "/privacy")]):
        page = read(rel)
        for href in ("/about", "/contact", "/privacy"):
            assert f'href="{href}"' in page, (rel, href)


def test_sitemap_lists_every_page():
    root = ET.fromstring(read("sitemap.xml").encode())
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    assert root.tag == "{http://www.sitemaps.org/schemas/sitemap/0.9}urlset"
    urls = {u.find("s:loc", ns).text: u.find("s:lastmod", ns).text for u in root.findall("s:url", ns)}
    assert set(urls) == {SITE + (p if p != "/" else "/") for p in PAGES}, urls
    for loc, lastmod in urls.items():
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", lastmod), (loc, lastmod)
        path = loc[len(SITE):] or "/"
        assert os.path.exists(os.path.join(ROOT, PAGES[path])), loc


def test_robots_points_at_the_sitemap():
    robots = read("robots.txt")
    assert f"Sitemap: {SITE}/sitemap.xml" in robots
    assert re.search(r"^User-agent: \*$", robots, re.M)
    assert "Disallow: /\n" not in robots          # never block the whole site


def test_llms_txt_follows_the_format_and_says_when_to_use():
    txt = read("llms.txt")
    lines = txt.splitlines()
    assert lines[0] == "# Shoot Cards"
    assert lines[2].startswith("> ")                     # summary blockquote
    sections = re.findall(r"^## (.+)$", txt, re.M)
    assert sections[0] == "When to use Shoot Cards", sections
    assert "How an agent should use it" in sections and "Optional" in sections
    when = txt.split("## When to use Shoot Cards", 1)[1].split("\n## ", 1)[0]
    assert "Don't use it for" in when and when.count("\n- ") >= 6
    links = re.findall(r"\]\((https://cards\.notalucis\.com[^)]*)\)", txt)
    md_paths = {"/index.md", "/demo.md", "/about.md", "/contact.md", "/privacy.md"}
    assert md_paths <= {link[len(SITE):] for link in links}, links


def test_json_ld_describes_the_product_and_the_organization():
    page = read("index.html")
    blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', page, re.S)
    assert len(blocks) == 1
    graph = {node["@type"]: node for node in json.loads(blocks[0])["@graph"]}
    org, app, site = graph["Organization"], graph["WebApplication"], graph["WebSite"]
    assert org["name"] == "NotaLucis" and org["contactPoint"]["email"] == "notalucis.dev@gmail.com"
    assert org["contactPoint"]["contactType"]
    assert site["url"] == app["url"] == SITE + "/"
    assert app["name"] == "Shoot Cards" and app["description"] and app["publisher"]["@id"] == org["@id"]
    prices = {o["name"]: o["price"] for o in app["offers"]}
    assert prices == {"Free": "0", "Pro monthly": "3.99", "Pro yearly": "30.00", "20-card pack": "7.99"}, prices
    # The same prices in the Markdown and llms.txt, so agents never see two stories.
    md = read("agent/pages.js")
    for text in (md, read("llms.txt")):
        assert "€3.99 per month" in text and "€30 per year" in text and "€7.99" in text


def test_csp_hash_still_matches_the_inline_script():
    import base64
    import hashlib
    page = read("index.html")
    inline = re.search(r"<script>(.*?)</script>", page, re.S).group(1)
    digest = base64.b64encode(hashlib.sha256(inline.encode()).digest()).decode()
    assert f"'sha256-{digest}'" in read("vercel.json")


def test_vercel_config_wires_it_up():
    cfg = json.loads(read("vercel.json"))
    vary = [h for h in cfg["headers"] if {"key": "Vary", "value": "Accept"} in h["headers"]]
    assert vary and vary[0]["source"] == "/((?!api/|assets/|_vercel/).*)"
    assert {"source": "/agent/:p*", "destination": "/", "permanent": False} in cfg["redirects"]
    ignored = read(".vercelignore").split()
    for needed in ("llms.txt", "robots.txt", "sitemap.xml", "middleware.js", "agent/"):
        assert needed not in ignored, needed


if __name__ == "__main__":
    fns = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print("ok:", fn.__name__)
    print(f"\nAll {len(fns)} agent-readiness tests passed.")
