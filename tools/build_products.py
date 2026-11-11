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
 "vansales": {
  "date": "2026-11-11", "src": "system", "stack": False, "image": ("vansales/docs/dashboard.png", (255, 60, 1260, 688)),
  "ar": {
   "h1": "VanSales: برنامج مندوبي المبيعات بتتبع GPS وحسابات سحابية",
   "title": "VanSales | برنامج مندوبين مبيعات بتتبع GPS وفواتير وتحصيل وحسابات",
   "desc": "نظام واحد لمندوبي المبيعات والحسابات: فواتير وتحصيل من الجوال، تتبع المندوبين على الخريطة لحظياً، ومخزون لكل سيارة وقيود محاسبية تُحدَّث تلقائياً.",
   "boxes": ("المندوبون يبيعون ويحصّلون خارج المكتب طوال اليوم. الفواتير وسندات القبض تُكتب على الورق أو في رسائل متفرقة، والمدير لا يعرف أين كل مندوب، والمحاسب يعيد إدخال كل شيء آخر اليوم.",
             "نظام واحد: المندوب يصدر الفواتير وسندات القبض من جواله حتى بدون إنترنت، والمدير يرى كل مندوب على خريطة لحظية مع تنبيهات، وكل فاتورة تُرحَّل تلقائياً إلى مخزون السيارة ورصيد العميل والقيود المحاسبية.",
             "اليوم يُقفل نفسه: المخزون والأرصدة وعهدة النقد محدّثة، والمدير يحصل على تقرير يومي لكل مندوب دون أن يعيد أحد كتابة شيء."),
   "faq": [
    ("هل يعمل تطبيق المندوب بدون إنترنت؟", "نعم. المندوب يصدر الفاتورة وهو غير متصل، وتُرفع تلقائياً عند عودة الاتصال."),
    ("كيف يتابع المدير المندوبين؟", "على خريطة لحظية تعرض كل مندوب وخط سيره، مع تنبيه إذا خرج عن خط السير أو أطفأ الـ GPS أثناء الدوام، وتقرير يومي لكل مندوب يُطبع PDF."),
    ("هل فيه حسابات أم نحتاج برنامجاً آخر؟", "النظام فيه حسابات سحابية: فواتير وسندات وشجرة حسابات وقيود تلقائية وكشوف حساب العملاء ومخزون لكل سيارة وعهدة نقد لكل مندوب. وإذا كان لديك نظام محاسبي قائم نراجع في المكالمة التعريفية كيف يعمل الاثنان معاً."),
    ("كيف يتعامل مع الشيكات؟", "يسجّل الشيكات تحت التحصيل والمودعة والمرتجعة مع تنبيهات بتواريخ الاستحقاق، والشيك المرتجع يعود إلى رصيد العميل."),
    ("هل الفاتورة مطابقة لمتطلبات الفاتورة الضريبية؟", "تُصمم الفاتورة ببيانات شركتك، ومتطلبات الفاتورة الضريبية في بلدك تُراجع مع محاسبك قبل التفعيل."),
    ("هل يمكن تعديل النظام على طريقة عملنا؟", "نعم. اسم الشركة والألوان والمسميات والأقسام تُضبط على طريقة عمل العميل، مع نسخ احتياطية يومية على سحابة الشركة نفسها."),
    ("كم يستغرق التنفيذ؟", "نبدأ بمكالمة تعريفية مجانية مدتها 30 دقيقة، ثم نموذج تفاعلي على مسار عملك خلال 1–2 أسابيع، ثم تجربة وإطلاق لفريق واحد خلال 2–6 أسابيع."),
   ],
   "article": ("/blog/van-sales-app-gps/", "برنامج مندوبين مبيعات بالـ GPS: تابع فريق التوزيع والفواتير والتحصيل من مكان واحد"),
  },
  "en": {
   "h1": "VanSales: van sales software with GPS tracking and cloud accounting",
   "title": "VanSales | Van Sales App with GPS Tracking, Invoicing, Collections and Accounting",
   "desc": "One system for van-sales reps and accounting: invoices and collections from the phone, every rep live on the map, and van stock and ledger entries that update themselves.",
   "boxes": ("Reps sell and collect outside the office all day. Invoices and receipts are written on paper or in scattered messages, the manager cannot see where each rep is, and accounting re-enters everything at the end of the day.",
             "One system: the rep issues invoices and receipts from his phone, even offline; the manager sees every rep on a live map with alerts; and every invoice posts itself to van stock, the customer balance and the ledger.",
             "The day closes itself: stock, balances and cash custody are current, and the manager gets a daily report per rep without anyone retyping."),
   "faq": [
    ("Does the rep app work without internet?", "Yes. The rep issues the invoice offline and it syncs by itself when the connection is back."),
    ("How does the manager follow the reps?", "On a live map showing every rep and his track, with an alert when a rep leaves the route or turns GPS off during working hours, plus a daily report per rep that prints as a PDF."),
    ("Does it include accounting, or do we need another program?", "It includes cloud accounting: invoices, receipts, chart of accounts, automatic journal entries, customer statements, stock per van and cash custody per rep. If you already run an accounting system, we review in the discovery call how the two should work together."),
    ("How are cheques handled?", "It tracks cheques under collection, deposited or returned, with due-date alerts. A returned cheque goes back to the customer's balance."),
    ("Is the invoice compliant with tax-invoice rules?", "The invoice is designed with your company's details. Your country's tax-invoice requirements are reviewed with your accountant before go-live."),
    ("Can the system be adapted to how we work?", "Yes. Company name, colours, labels and modules are set to the client's way of working, with nightly backups on the company's own cloud."),
    ("How long does it take?", "We start with a free 30-minute discovery call, build an interactive prototype on your workflow in 1–2 weeks, then pilot and launch with one team in 2–6 weeks."),
   ],
   "article": ("/en/blog/van-sales-app-gps/", "Van Sales App with GPS: Track Routes, Invoices and Collections for Your Distribution Team"),
  },
 },
 "connect": {
  "date": "2026-11-11",
  "ar": {
   "h1": "HUDERA Connect: مساعد واتساب ذكي يرد على العملاء ويحجز المواعيد",
   "title": "HUDERA Connect | مساعد واتساب بالذكاء الاصطناعي لخدمة العملاء والحجز",
   "desc": "مساعد ذكي على رقم واتساب للأعمال: يرد بالعربي والإنجليزي، يسجّل العملاء المحتملين، يحجز المواعيد من تقويم فريقك، ويحوّل المحادثة لموظف عند الحاجة.",
   "faq": [
    ("متى يتدخل موظف في المحادثة؟", "متى طلب العميل ذلك، ويمكن لأي موظف أن يستلم أي محادثة بضغطة واحدة من صندوق الرسائل المشترك."),
    ("بأي لغة يرد المساعد؟", "بالعربية والإنجليزية، وبلغة العميل ولهجته."),
    ("هل يحجز المواعيد فعلاً؟", "نعم. يعرض على العميل المواعيد المتاحة فعلاً في تقويم فريقك ويسجّل الحجز."),
    ("أين تذهب بيانات العملاء المحتملين؟", "تُحفظ في نظام إدارة العملاء لديك أثناء المحادثة، ويرى المدير أين وصل كل عميل محتمل."),
    ("هل نحتاج مبرمجاً لتعديل الردود والمسارات؟", "لا. يمكن تشغيل وإيقاف مسارات العمل الآلية بدون مطوّر."),
    ("هل يعمل على رقم واتساب الحالي؟", "المساعد يعمل على رقم واتساب للأعمال. في المكالمة التعريفية نراجع رقمك الحالي والطريقة المناسبة لربطه."),
    ("كم يستغرق التنفيذ؟", "نبدأ بمكالمة تعريفية مجانية مدتها 30 دقيقة، ثم نموذج تفاعلي على مسار عملك خلال 1–2 أسابيع، ثم تجربة وإطلاق لفريق واحد خلال 2–6 أسابيع."),
   ],
   "article": ("/blog/ai-employee-whatsapp/", "موظف ذكاء اصطناعي على واتساب لشركتك: ماذا يعمل، وكيف تبدأ؟"),
  },
  "en": {
   "h1": "HUDERA Connect: a WhatsApp AI assistant that answers customers and books appointments",
   "title": "HUDERA Connect | WhatsApp AI Assistant for Customer Service and Booking",
   "desc": "An AI assistant on your WhatsApp Business number: it answers in Arabic and English, captures leads, books appointments from your team's calendar and hands the chat to a person when needed.",
   "faq": [
    ("When does a person step into the chat?", "Whenever the customer asks, and any team member can take over any chat in one click from the shared inbox."),
    ("Which languages does the assistant answer in?", "Arabic and English, in the customer's language and dialect."),
    ("Does it really book appointments?", "Yes. It offers the customer real slots from your team's calendar and records the booking."),
    ("Where do the leads go?", "They are saved to your CRM as the chat goes, and managers see where each lead stands."),
    ("Do we need a developer to change the flows?", "No. Automations can be turned on and off without a developer."),
    ("Does it work on our current WhatsApp number?", "The assistant runs on a WhatsApp Business number. In the discovery call we review your current number and the right way to connect it."),
    ("How long does it take?", "We start with a free 30-minute discovery call, build an interactive prototype on your workflow in 1–2 weeks, then pilot and launch with one team in 2–6 weeks."),
   ],
   "article": ("/en/blog/ai-employees-whatsapp/", "AI Employees on WhatsApp for Businesses in Saudi Arabia and the Gulf: What They Do and How to Start"),
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


def load(name):
    i = SRC.index(f"const {name} = ["); j = SRC.index("\n];", i)
    js = SRC[i:j + 3] + f"\nprocess.stdout.write(JSON.stringify({name}.map(p=>{{const o={{}};for(const k in p){{if(typeof p[k]!=='function')o[k]=p[k]}}return o}})));"
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
    meta = PAGES[p["id"]]
    x, u, pid, n = meta[lang], UI[lang], p["id"], p["name"]
    system = meta.get("src") == "system"
    tr = (lambda s, prefix="": ar(s, prefix)) if lang == "ar" else (lambda s, prefix="": s)
    base = "" if lang == "ar" else "/en"
    url, other = f"{SITE}{base}/products/{pid}/", f"{SITE}{'/en' if lang == 'ar' else ''}/products/{pid}/"
    demo = f"{base}/#{'s' if system else 'p'}-{pid}"
    wa = f"{B.WA}?text={quote(u['wa_text'].format(n=n))}"
    feats = "".join(f"<div class='feat'><b>{e(tr(t))}</b><span>{e(tr(d))}</span></div>" for _, t, d in p["features"])
    flow = "".join(f"<li><small>{e(tr(k, f'{i + 1:02d} · '))}</small><b>{e(tr(t))}</b><span>{e(tr(d))}</span></li>" for i, (k, t, d) in enumerate(p["flow"]))
    chips = "".join(f"<span>{e(tr(s))}</span>" for s in p["stack"])
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in x["faq"])
    shot = f"/products/{pid}/demo-{lang}.webp"
    img = (f'<a class="shot" href="{demo}"><img src="{shot}" width="1200" height="750" loading="lazy" alt="{e(u["shot"].format(n=n))}"></a><p class="small">{e(u["note"])}</p>'
           if (root / shot.lstrip("/")).exists() else "")
    art_url, art_title = x["article"]
    b1, b2, b3 = x["boxes"] if "boxes" in x else (tr(p["problem"]), tr(p["solution"]), tr(p["value"]))
    stack = f"<h2>{u['stack']}</h2><div class=\"chips\">{chips}</div>" if meta.get("stack", True) else ""
    body = f"""<div class="crumbs"><a href="{base or '/'}{'/' if base else ''}">{u['home']}</a> › <a href="{base}/#work">{u['products']}</a> › {e(n)}</div>
<article><span class="kind">{e(tr(p['kind']))}</span>
<h1>{e(x['h1'])}</h1>
<p class="lead">{e(tr(p['tagline']))}</p>
<div class="acts"><a class="btn" href="{demo}">{u['try']}</a><a class="btn line" href="{wa}" target="_blank" rel="noopener">{u['wa']}</a></div>
{img}
<div class="three"><div class="box"><h2>{u['problem']}</h2><p>{e(b1)}</p></div><div class="box"><h2>{u['build']}</h2><p>{e(b2)}</p></div><div class="box"><h2>{u['value']}</h2><p>{e(b3)}</p></div></div>
<h2>{u['features']}</h2><div class="feats">{feats}</div>
<h2>{u['flow']}</h2><ol class="flow">{flow}</ol>
{stack}
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


def index(lang, P):
    base = "" if lang == "ar" else "/en"
    url, alt = f"{SITE}{base}/products/", f"{SITE}{'/en' if lang == 'ar' else ''}/products/"
    t = "منتجات HUDERA AI: موظفون رقميون وأنظمة للشركات" if lang == "ar" else "HUDERA AI Products: AI Employees and Systems for Businesses"
    d = ("صفحة لكل منتج: ماذا يحل، كيف يعمل، وعرض حي تجرّبه بنفسك. مساعدو واتساب بالذكاء الاصطناعي، وأنظمة للمندوبين والحسابات."
         if lang == "ar" else "One page per product: what it solves, how it works and a live demo you can try. WhatsApp AI assistants and systems for van sales and accounting.")
    cards = "".join(f'<a class="card" href="{base}/products/{pid}/"><b>{e(PAGES[pid][lang]["h1"])}</b><span>{e(PAGES[pid][lang]["desc"])}</span></a>' for pid in PAGES)
    more = (f'<p class="small" style="margin-top:18px">باقي المنتجات والعروض الحية في <a href="/#work">الصفحة الرئيسية</a>.</p>' if lang == "ar"
            else f'<p class="small" style="margin-top:18px">More products and live demos are on the <a href="/en/#work">home page</a>.</p>')
    h1 = "المنتجات" if lang == "ar" else "Products"
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": t, "url": url, "inLanguage": lang,
          "publisher": {"@type": "Organization", "@id": SITE + "/#org", "name": "HUDERA AI", "url": SITE + "/"}}
    page_html = B.head(lang, t, d, url, "en" if lang == "ar" else "ar", alt, ld).replace('<meta property="og:type" content="article">', '<meta property="og:type" content="website">')
    page_html += B.chrome(lang, f"<h1>{h1}</h1><p class='lead'>{e(d)}</p><div class='cards'>{cards}</div>{more}", f"{'/en' if lang == 'ar' else ''}/products/")
    return page_html.replace("</head>", CSS + "\n</head>", 1)


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
                if PAGES[pid].get("image"):
                    src, box = PAGES[pid]["image"]
                    out = root / "products" / pid; out.mkdir(parents=True, exist_ok=True)
                    im = Image.open(root / src).convert("RGB").crop(box).resize((1200, 750), Image.LANCZOS)
                    for lang in ("ar", "en"):
                        im.save(out / f"demo-{lang}.webp", "WEBP", quality=84); im.save(out / f"demo-{lang}.jpg", "JPEG", quality=85, optimize=True)
                    continue
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
    P = {**load("SYSTEMS"), **load("PRODUCTS")}
    for pid, m in PAGES.items():
        if m.get("src") == "system":
            P[pid] = load("SYSTEMS")[pid]
    if "--shots" in sys.argv:
        shots(list(PAGES))
    urls = []
    for pid, meta in PAGES.items():
        for lang, base in (("ar", root / "products"), ("en", root / "en" / "products")):
            d = base / pid; d.mkdir(parents=True, exist_ok=True)
            (d / "index.html").write_text(page(P[pid], lang), encoding="utf-8")
            urls.append((f"{SITE}{'' if lang == 'ar' else '/en'}/products/{pid}/", meta["date"]))
    last = max(m["date"] for m in PAGES.values())
    (root / "products" / "index.html").write_text(index("ar", P), encoding="utf-8")
    (root / "en" / "products" / "index.html").write_text(index("en", P), encoding="utf-8")
    urls = [(f"{SITE}/products/", last), (f"{SITE}/en/products/", last)] + urls
    sm = root / "sitemap.xml"; s = sm.read_text(encoding="utf-8")
    for u, d in urls:
        if f"<loc>{u}</loc>" not in s:
            s = s.replace("</urlset>", f"  <url><loc>{u}</loc><lastmod>{d}</lastmod><priority>0.8</priority></url>\n</urlset>")
    sm.write_text(s, encoding="utf-8")
    print("product pages built:", ", ".join(PAGES))


if __name__ == "__main__":
    main()
