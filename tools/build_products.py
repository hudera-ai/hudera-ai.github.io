# -*- coding: utf-8 -*-
"""Standalone product pages, one URL per product and language:

    python3 tools/build_products.py            # pages + sitemap
    python3 tools/build_products.py --shots    # also re-take the demo screenshots (needs playwright)

Arabic pages live at /products/<id>/, English at /en/products/<id>/.
Product facts (tagline, problem, features, workflow) are read from the PRODUCTS list in
tools/src/index.html and their Arabic from its AR_DICT, so the pages never drift from the home page.
Only the page title, description, FAQ and related article are written here, in PAGES.
"""
import json, re, subprocess, sys, pathlib
from urllib.parse import quote
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_blog as B
import build_static as S

root, SITE, e = B.root, B.SITE, B.e
SRC = (root / "tools" / "src" / "index.html").read_text(encoding="utf-8")

PAGES = {
 "hesabo": {
  "date": "2026-11-11",
  "ar": {
   "h1": "Hesabo: مساعد واتساب لكشوف الحساب وتأكيد المدفوعات",
   "title": "Hesabo | مساعد واتساب لكشوف الحساب والفواتير وتأكيد المدفوعات",
   "desc": "مساعد واتساب مربوط بنظامك المحاسبي: يرسل كشوف الحساب ونسخ الفواتير للأرقام المسجلة، يقرأ إيصالات الدفع من الصور، والمحاسب يعتمد أي أمر حساس.",
   "faq": [
    ("هل يستطيع أي شخص طلب كشف حساب عميل؟", "لا. المساعد يطابق رقم واتساب مع الأرقام المسجلة على حساب العميل، ولا يرسل بيانات الحساب لأي رقم غير مسجل."),
    ("هل نحتاج إلى تغيير نظامنا المحاسبي؟", "لا. Hesabo يُربط بنظامك المحاسبي الحالي. في المكالمة التعريفية نراجع نظامك وطريقة الربط المناسبة له."),
    ("هل يؤكد المساعد استلام الدفعات وحده؟", "لا. يقرأ المبلغ والبنك والتاريخ من صورة الإيصال ويضعها في قائمة الاعتماد، والمحاسب هو من يوافق قبل إرسال التأكيد وتحديث الرصيد."),
    ("كم يستغرق التنفيذ؟", "نبدأ بمكالمة تعريفية مجانية مدتها 30 دقيقة، ثم نبني نموذجاً تفاعلياً على مسار عملك خلال 1–2 أسابيع، ثم تجربة وإطلاق لفريق واحد خلال 2–6 أسابيع."),
    ("بأي لغة يرد على العملاء؟", "بالعربية والإنجليزية."),
    ("هل يمكن مراجعة ما فعله المساعد؟", "نعم. كل طلب وكل قرار يُسجَّل في سجل التدقيق، ويمكن تتبعه ومراجعته."),
   ],
   "article": ("/blog/collections-automation-whatsapp/", "أتمتة التحصيل على واتساب: كيف تقلل المتأخرات بدون ضغط على فريق الحسابات؟"),
  },
  "en": {
   "h1": "Hesabo: a WhatsApp assistant for statements and payment confirmations",
   "title": "Hesabo | WhatsApp Assistant for Statements, Invoices and Payment Confirmations",
   "desc": "A WhatsApp assistant connected to your accounting system: it sends statements and invoice copies to registered numbers, reads payment receipts from photos, and an accountant approves anything sensitive.",
   "faq": [
    ("Can anyone request a customer's statement?", "No. The assistant matches the WhatsApp number against the numbers registered on the customer's account and sends account data to no one else."),
    ("Do we need to change our accounting system?", "No. Hesabo connects to the accounting system you already use. In the discovery call we review your system and the right way to connect to it."),
    ("Does the assistant confirm payments on its own?", "No. It reads the amount, bank and date from the receipt photo and puts them in the approval queue. An accountant approves before the confirmation is sent and the balance is updated."),
    ("How long does it take?", "We start with a free 30-minute discovery call, build an interactive prototype on your workflow in 1–2 weeks, then pilot and launch with one team in 2–6 weeks."),
    ("Which languages does it answer in?", "Arabic and English."),
    ("Can we review what the assistant did?", "Yes. Every request and every decision is recorded in the audit log and can be traced and reviewed."),
   ],
   "article": ("/en/blog/collections-automation-whatsapp/", "Automating Collections on WhatsApp: Fewer Overdue Invoices Without Overloading Your Finance Team"),
  },
 },
}

UI = {
 "ar": {"home": "الرئيسية", "products": "المنتجات", "problem": "المشكلة", "build": "ما نبنيه", "value": "القيمة للأعمال", "features": "المزايا",
        "flow": "كيف يسير العمل", "stack": "يتكامل مع", "faq": "أسئلة شائعة", "try": "جرّب العرض الحي", "wa": "تواصل عبر واتساب",
        "note": "العرض الحي يعمل داخل متصفحك على بيانات تجريبية. أسماء الشركات والأشخاص والأرقام افتراضية.",
        "read": "اقرأ أيضاً", "cta": "تحتاج حلاً مثل {n}؟", "cta_p": "نراجع طريقة عملك الحالية ونريك نموذجاً يعمل على مسار عملك أنت.",
        "wa_text": "مرحباً HUDERA AI، أرغب في مناقشة حل مثل {n}.", "shot": "لقطة من العرض الحي لـ {n}", "by": "من HUDERA AI"},
 "en": {"home": "Home", "products": "Products", "problem": "The problem", "build": "What we build", "value": "Business value", "features": "Features",
        "flow": "How the workflow runs", "stack": "Works with", "faq": "Frequently asked questions", "try": "Try the live demo", "wa": "Chat on WhatsApp",
        "note": "The live demo runs in your browser on sample data. Company names, people and figures are fictional.",
        "read": "Read next", "cta": "Need something like {n}?", "cta_p": "We map your current process and show you a working prototype built on your own workflow.",
        "wa_text": "Hi HUDERA AI, I'd like to discuss a solution like {n}.", "shot": "Screenshot of the {n} live demo", "by": "by HUDERA AI"},
}

CSS = """<style>
.kind{display:inline-block;font-size:13px;font-weight:600;color:var(--brand);background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:4px 12px;margin-top:14px}
.acts{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 6px}.btn.line{background:#fff;color:var(--ink);border:1px solid var(--line)}
.shot{display:block;margin:22px 0 6px;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--soft)}.shot img{display:block;width:100%;height:auto}
.small{font-size:13px;color:var(--muted);margin:6px 0 0}
.three{display:grid;gap:12px;margin-top:26px}.box{border:1px solid var(--line);border-radius:14px;padding:16px 18px;background:#fff}.box h2{font-size:19px;margin:0 0 6px}.box p{margin:0}
.feats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.feat{border:1px solid var(--line);border-radius:12px;padding:12px 14px}.feat b{display:block}.feat span{color:var(--muted);font-size:15px}
.flow{list-style:none;padding:0;margin:0;display:grid;gap:8px;counter-reset:s}.flow li{counter-increment:s;border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:0;background:var(--soft)}
.flow small{display:block;color:var(--brand);font-weight:700;font-size:12.5px}.flow small:before{content:counter(s,decimal-leading-zero) " · "}.flow b{display:block}.flow span{color:var(--muted);font-size:15px}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chips span{border:1px solid var(--line);border-radius:999px;padding:5px 12px;font-size:14px;color:#253049;background:#fff}
.more{margin-top:26px;padding:14px 18px;border:1px solid var(--line);border-radius:14px;background:var(--soft)}.more small{display:block;color:var(--muted)}.more a{font-weight:700}
@media (max-width:560px){.feats{grid-template-columns:1fr}.acts .btn{flex:1 1 100%;text-align:center}}
</style>"""


def products():
    i = SRC.index("const PRODUCTS = ["); j = SRC.index("\n];", i)
    js = SRC[i:j + 3] + "\nprocess.stdout.write(JSON.stringify(PRODUCTS.map(p=>{const {mount,...r}=p;return r})));"
    out = subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout
    return {p["id"]: p for p in json.loads(out)}


LOOKUP = S.make_lookup(S.load_dict(SRC))


def ar(text, prefix=""):
    """Arabic for a product string, using the home page dictionary (prefix handles keys like '01 · Verify')."""
    t = LOOKUP(prefix + text)
    if t is None:
        return text
    return re.sub(r"^\d+\s*·\s*", "", t) if prefix else t


def page(p, lang):
    x, u, pid, n = PAGES[p["id"]][lang], UI[lang], p["id"], p["name"]
    tr = (lambda s, prefix="": ar(s, prefix)) if lang == "ar" else (lambda s, prefix="": s)
    base = "" if lang == "ar" else "/en"
    url, other = f"{SITE}{base}/products/{pid}/", f"{SITE}{'/en' if lang == 'ar' else ''}/products/{pid}/"
    demo = f"{base}/#p-{pid}"
    wa = f"{B.WA}?text={quote(u['wa_text'].format(n=n))}"
    feats = "".join(f"<div class='feat'><b>{e(tr(t))}</b><span>{e(tr(d))}</span></div>" for _, t, d in p["features"])
    flow = "".join(f"<li><small>{e(tr(k, f'{i + 1:02d} · '))}</small><b>{e(tr(t))}</b><span>{e(tr(d))}</span></li>" for i, (k, t, d) in enumerate(p["flow"]))
    chips = "".join(f"<span>{e(tr(s))}</span>" for s in p["stack"])
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in x["faq"])
    shot = f"/products/{pid}/demo-{lang}.webp"
    img = (f'<a class="shot" href="{demo}"><img src="{shot}" width="1200" height="750" loading="lazy" alt="{e(u["shot"].format(n=n))}"></a><p class="small">{e(u["note"])}</p>'
           if (root / shot.lstrip("/")).exists() else "")
    art_url, art_title = x["article"]
    body = f"""<div class="crumbs"><a href="{base or '/'}{'/' if base else ''}">{u['home']}</a> › <a href="{base}/#work">{u['products']}</a> › {e(n)}</div>
<article><span class="kind">{e(tr(p['kind']))}</span>
<h1>{e(x['h1'])}</h1>
<p class="lead">{e(tr(p['tagline']))}</p>
<div class="acts"><a class="btn" href="{demo}">{u['try']}</a><a class="btn line" href="{wa}" target="_blank" rel="noopener">{u['wa']}</a></div>
{img}
<div class="three"><div class="box"><h2>{u['problem']}</h2><p>{e(tr(p['problem']))}</p></div><div class="box"><h2>{u['build']}</h2><p>{e(tr(p['solution']))}</p></div><div class="box"><h2>{u['value']}</h2><p>{e(tr(p['value']))}</p></div></div>
<h2>{u['features']}</h2><div class="feats">{feats}</div>
<h2>{u['flow']}</h2><ol class="flow">{flow}</ol>
<h2>{u['stack']}</h2><div class="chips">{chips}</div>
<section class="faq"><h2>{u['faq']}</h2>{faq}</section>
<div class="more"><small>{u['read']}</small><a href="{art_url}">{e(art_title)}</a></div>
<div class="cta"><p>{e(u['cta'].format(n=n))}</p><p style="font-size:16px;font-weight:400;opacity:.85">{e(u['cta_p'])}</p><a class="btn" href="{wa}" target="_blank" rel="noopener">{u['wa']}</a><a class="btn alt" href="{demo}">{u['try']}</a></div></article>"""
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Service", "@id": url + "#service", "name": n, "serviceType": p["kind"] if lang == "en" else tr(p["kind"]), "description": x["desc"], "url": url,
         "inLanguage": lang, "provider": {"@type": "Organization", "@id": SITE + "/#org", "name": "HUDERA AI", "url": SITE + "/"},
         "areaServed": ["SA", "AE", "EG", "JO", "KW", "QA", "BH", "OM"]},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in x["faq"]]},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": u["home"], "item": f"{SITE}{base}/"},
            {"@type": "ListItem", "position": 2, "name": n, "item": url}]}]}
    head = B.head(lang, x["title"] + " | HUDERA AI", x["desc"], url, "en" if lang == "ar" else "ar", other, ld).replace('<meta property="og:type" content="article">', '<meta property="og:type" content="website">')
    if img:
        head = head.replace(f'content="{SITE}/og.png"', f'content="{SITE}{shot.replace(".webp", ".jpg")}"', 1)
    alt = f"{'/en' if lang == 'ar' else ''}/products/{pid}/"
    html_page = head + B.chrome(lang, body, alt)
    return html_page.replace("</head>", CSS + "\n</head>", 1) if "</head>" in html_page else html_page.replace("<body>", CSS + "\n<body>", 1)


def shots(ids):
    """Screenshot of each product's live demo, Arabic and English, from a local copy of the site."""
    import asyncio, signal, time
    from playwright.async_api import async_playwright
    from PIL import Image
    port = 8795
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port)], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    async def run():
        async with async_playwright() as pw:
            b = await pw.chromium.launch(args=["--no-sandbox"])
            for pid in ids:
                for lang, path in (("ar", "/"), ("en", "/en/")):
                    ctx = await b.new_context(viewport={"width": 1200, "height": 900}, device_scale_factor=1)
                    await ctx.add_init_script("try{localStorage.setItem('hudera.consent',JSON.stringify({analytics:false}))}catch(e){}")
                    await ctx.route("**/*", lambda r: r.abort() if "supabase" in r.request.url else r.continue_())
                    pg = await ctx.new_page()
                    await pg.goto(f"http://localhost:{port}{path}#p-{pid}", wait_until="load")
                    await pg.wait_for_timeout(3500)
                    el = pg.locator("#demo-host")
                    await el.scroll_into_view_if_needed()
                    box = await el.bounding_box()
                    out = root / "products" / pid; out.mkdir(parents=True, exist_ok=True)
                    tmp = out / f"_demo-{lang}.png"
                    await pg.screenshot(path=str(tmp), clip={"x": box["x"], "y": box["y"], "width": box["width"], "height": min(box["height"], box["width"] * 0.625)})
                    im = Image.open(tmp).convert("RGB").resize((1200, 750))
                    im.save(out / f"demo-{lang}.webp", "WEBP", quality=82); im.save(out / f"demo-{lang}.jpg", "JPEG", quality=84, optimize=True)
                    tmp.unlink(); await ctx.close()
            await b.close()
    try:
        time.sleep(1.0); asyncio.run(run())
    finally:
        srv.send_signal(signal.SIGTERM)


def main():
    P = products()
    if "--shots" in sys.argv:
        shots(list(PAGES))
    urls = []
    for pid, meta in PAGES.items():
        for lang, base in (("ar", root / "products"), ("en", root / "en" / "products")):
            d = base / pid; d.mkdir(parents=True, exist_ok=True)
            (d / "index.html").write_text(page(P[pid], lang), encoding="utf-8")
            urls.append((f"{SITE}{'' if lang == 'ar' else '/en'}/products/{pid}/", meta["date"]))
    sm = root / "sitemap.xml"; s = sm.read_text(encoding="utf-8")
    for u, d in urls:
        if f"<loc>{u}</loc>" not in s:
            s = s.replace("</urlset>", f"  <url><loc>{u}</loc><lastmod>{d}</lastmod><priority>0.8</priority></url>\n</urlset>")
    sm.write_text(s, encoding="utf-8")
    print("product pages built:", ", ".join(PAGES))


if __name__ == "__main__":
    main()
