# -*- coding: utf-8 -*-
"""Builds the two home pages from the English source.

    python3 tools/build_static.py            # translate static text only
    python3 tools/build_static.py --grids    # also pre-fill the main heading and the JS-built grids (needs google-chrome)

Source of truth : tools/src/index.html   (English, edit THIS file)
Generated       : index.html             (Arabic text already in the HTML, for search engines and AI crawlers)
                  en/index.html          (English, with its own <title>/description/canonical)

The page's own script still runs for visitors and leaves the pre-translated text alone
(it skips any text that already contains Arabic), so nothing changes on screen.
"""
import re, json, html, sys, pathlib, subprocess, time, os, signal

root = pathlib.Path(__file__).resolve().parent.parent
SRC = root / "tools" / "src" / "index.html"
GRIDS = ["platforms-grid", "systems-grid", "services-grid", "products", "contact-lines"]
ATTRS = ["placeholder", "aria-label", "title", "data-c"]
NUM = re.compile(r"\d+(?:[.,:\/]\d+)*")
LATIN = re.compile(r"[A-Za-z]")
ARABIC = re.compile(r"[؀-ۿ]")
TOKEN = re.compile(r"(<!--.*?-->|<script\b.*?</script>|<style\b.*?</style>|<[a-zA-Z/!][^>]*>)", re.S)
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
BANNER = "<!-- GENERATED FILE. Edit tools/src/index.html, then run: python3 tools/build_static.py --grids -->\n"


def load_dict(src):
    i = src.index("const AR_DICT = {")
    j = src.index("\n};", i)
    return json.loads(src[i + len("const AR_DICT = "): j + 2])


def make_lookup(d):
    templates = {k: v for k, v in d.items() if "#" in k}

    def lookup(raw):
        s = re.sub(r"\s+", " ", raw).strip()
        if not s or not LATIN.search(s):
            return None
        if s in d:
            return d[s]
        nums = NUM.findall(s)
        if nums:
            tpl = templates.get(NUM.sub("#", s))
            if tpl is not None:
                if re.search(r"\{\d\}", tpl):
                    return re.sub(r"\{(\d)\}", lambda m: nums[int(m.group(1))] if int(m.group(1)) < len(nums) else "", tpl)
                it = iter(nums)
                return re.sub(r"#", lambda m: next(it, ""), tpl)
        return None
    return lookup


def translate_static(src, lookup):
    """Same rules as localize() in the page: translate text nodes and four attributes,
    skip .phone / .no-l10n subtrees, scripts and styles, and anything already Arabic."""
    out, skip_tag, skip_depth, prev_ini = [], None, 0, None
    n_text = n_attr = 0
    for tok in TOKEN.split(src):
        if not tok:
            continue
        if tok.startswith("<"):
            low = tok[:8].lower()
            if low.startswith("<!--") or low.startswith("<script") or low.startswith("<style") or low.startswith("<!"):
                out.append(tok); prev_ini = None; continue
            m = re.match(r"<(/?)([a-zA-Z][a-zA-Z0-9-]*)", tok)
            closing, name = bool(m.group(1)), m.group(2).lower()
            if skip_tag:
                if name == skip_tag and name not in VOID and not tok.endswith("/>"):
                    skip_depth += -1 if closing else 1
                    if skip_depth == 0:
                        skip_tag = None
                out.append(tok); prev_ini = None; continue
            if not closing:
                cls = re.search(r'\bclass="([^"]*)"', tok)
                classes = cls.group(1).split() if cls else []
                if ("phone" in classes or "no-l10n" in classes) and name not in VOID:
                    skip_tag, skip_depth = name, 1
                    out.append(tok); prev_ini = None; continue

                def attr_sub(mm):
                    nonlocal n_attr
                    v = html.unescape(mm.group(2))
                    if not LATIN.search(v) or ARABIC.search(v):
                        return mm.group(0)
                    tr = lookup(v)
                    if tr is None or tr == v:
                        return mm.group(0)
                    n_attr += 1
                    return f'{mm.group(1)}="{html.escape(tr, quote=True)}"'
                tok = re.sub(r'(?<=\s)(' + "|".join(ATTRS) + r')="([^"]*)"', attr_sub, tok)
                ini = re.search(r'\bdata-ini-ar="([^"]*)"', tok)
                prev_ini = html.unescape(ini.group(1)) if ini else None
            else:
                prev_ini = None
            out.append(tok)
            continue
        # text node
        if skip_tag:
            out.append(tok); continue
        v = html.unescape(tok)
        if not LATIN.search(v) or ARABIC.search(v):
            out.append(tok); prev_ini = None; continue
        tr = prev_ini or lookup(v)
        prev_ini = None
        if tr is None:
            out.append(tok); continue
        lead = re.match(r"^\s*", tok).group(0)
        trail = "" if re.search(r"(^|\s)و$", tr) else re.search(r"\s*$", tok).group(0)
        out.append(lead + html.escape(tr, quote=False) + trail)
        n_text += 1
    return "".join(out), n_text, n_attr


def english_page(src):
    T = "HUDERA AI | AI Employees for Businesses in Saudi Arabia, the Gulf &amp; Egypt"
    D = ("HUDERA AI (هوديرا) builds AI employees that work inside WhatsApp in Arabic and English for HR, collections, "
         "sales and operations, plus dashboards and workflow automation for businesses in Saudi Arabia, the Gulf and Egypt. "
         "Every sensitive decision is approved by a person.")
    e = src.replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">', 1)
    e = e.replace("<head>\n", '<head>\n<base href="/">\n', 1)
    e = re.sub(r"<title>[^<]*</title>", f"<title>{T}</title>", e, count=1)
    e = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{D}">', e, count=1)
    e = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{T}">', e, count=1)
    e = re.sub(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="AI employees for HR, collections, sales and operations that work inside WhatsApp in Arabic and English. Every sensitive decision is approved by a person.">', e, count=1)
    e = e.replace('<meta property="og:locale" content="ar_AR">\n<meta property="og:locale:alternate" content="en_US">', '<meta property="og:locale" content="en_US">\n<meta property="og:locale:alternate" content="ar_AR">', 1)
    e = e.replace('<meta property="og:url" content="https://hudera.ai/">', '<meta property="og:url" content="https://hudera.ai/en/">', 1)
    e = e.replace('<link rel="canonical" href="https://hudera.ai/">', '<link rel="canonical" href="https://hudera.ai/en/">', 1)
    e = e.replace('<a href="blog/" data-blog>', '<a href="en/blog/" data-blog>')
    e = e.replace('<a href="products/" data-products>', '<a href="en/products/" data-products>')
    # <base href="/"> would send in-page "#x" links to the Arabic home page; keep them on /en/
    fix = ('<script>document.addEventListener("click",function(ev){var a=ev.target.closest&&ev.target.closest(\'a[href^="#"]\');'
           'if(!a||ev.defaultPrevented)return;ev.preventDefault();var h=a.getAttribute("href");'
           'if(h==="#"){window.scrollTo({top:0,behavior:"smooth"});return;}'
           'if(location.hash===h){var t=document.getElementById(h.slice(1));if(t)t.scrollIntoView({behavior:"smooth"});}else{location.hash=h;}});</script>\n')
    assert "</body></html>" in e
    e = e.replace("</body></html>", fix + "</body></html>", 1)
    return e


def dump_grids(port, path):
    """Renders the built page in headless Chrome and returns {grid id: innerHTML}."""
    out = subprocess.run(["google-chrome", "--headless", "--no-sandbox", "--disable-gpu", "--virtual-time-budget=9000",
                          "--window-size=1366,900", "--dump-dom", f"http://localhost:{port}{path}"],
                         capture_output=True, timeout=120).stdout.decode("utf-8", "replace")
    res = {}
    h1 = re.search(r'<h1 class="no-l10n" id="hero-h1">(.*?)</h1>', out, re.S)
    if h1:
        res["hero-h1"] = h1.group(1)
    for gid in GRIDS:
        m = re.search(r'<div class="[^"]*" id="' + gid + r'"[^>]*>', out)
        if not m:
            continue
        i, depth = m.end(), 1
        for t in re.finditer(r"<(/?)div\b[^>]*>", out[i:]):
            depth += -1 if t.group(1) else 1
            if depth == 0:
                inner = out[i:i + t.start()]
                inner = re.sub(r'\sdata-en-[a-z-]+="[^"]*"', "", inner)
                res[gid] = inner
                break
    return res


def fill_grids(page, grids):
    n = 0
    for gid, inner in grids.items():
        pat = re.compile(r'(<(?:div|h1) class="[^"]*" id="' + gid + r'"[^>]*>)(</(?:div|h1)>)')
        if inner.strip() and pat.search(page):
            page = pat.sub(lambda m: m.group(1) + inner + m.group(2), page, count=1)
            n += 1
    return page, n


def main():
    src = SRC.read_text(encoding="utf-8")
    assert "GENERATED FILE" not in src, "tools/src/index.html must be the English source, not a generated file"
    lookup = make_lookup(load_dict(src))
    ar, n_text, n_attr = translate_static(src, lookup)
    en = english_page(src)
    (root / "en").mkdir(exist_ok=True)

    def write(a, e):
        (root / "index.html").write_text(a.replace("<!doctype html>\n", "<!doctype html>\n" + BANNER, 1), encoding="utf-8")
        (root / "en" / "index.html").write_text(e.replace("<!doctype html>\n", "<!doctype html>\n" + BANNER, 1), encoding="utf-8")
    write(ar, en)
    print(f"static text translated: {n_text} text nodes, {n_attr} attributes")

    if "--grids" in sys.argv:
        port = 8791
        srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port)], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            time.sleep(1.2)
            g_ar, g_en = dump_grids(port, "/"), dump_grids(port, "/en/")
        finally:
            srv.send_signal(signal.SIGTERM)
        ar2, a = fill_grids(ar, g_ar)
        en2, b = fill_grids(en, g_en)
        write(ar2, en2)
        print(f"grids pre-filled: {a} (ar), {b} (en)")


if __name__ == "__main__":
    main()
