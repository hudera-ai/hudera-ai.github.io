# -*- coding: utf-8 -*-
# Builds the blog pages from the ARTICLES list below:
#   python3 tools/build_blog.py
# Arabic articles live at /blog/<slug>/, English at /en/blog/<slug>/, and each pair links to the other (hreflang).
import json, html, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
e = html.escape
SITE = "https://hudera.ai"
WA = "https://wa.me/201555159139"

ARTICLES = [
 {
  "pair": "ai-employee-whatsapp",
  "date": "2026-11-10",
  "ar": {
   "slug": "ai-employee-whatsapp",
   "title": "موظف ذكاء اصطناعي على واتساب لشركتك: ماذا يعمل، وكيف تبدأ؟",
   "desc": "دليل عملي لأصحاب الشركات في السعودية والخليج ومصر: ما هو موظف الذكاء الاصطناعي على واتساب، وما المهام التي يتولاها في الموارد البشرية والتحصيل والمبيعات، وكيف تبدأ بتجربة صغيرة.",
   "lead": "عملاؤك وموظفوك يرسلون أسئلتهم على واتساب طوال اليوم: «كم رصيد إجازتي؟»، «أرسل لي كشف الحساب»، «وين وصل طلبي؟». أغلب هذه الرسائل متكررة، وتأخذ وقت فريقك. موظف الذكاء الاصطناعي يرد عليها فوراً، بالعربي والإنجليزي، من بيانات شركتك نفسها.",
   "sections": [
    ("ما هو موظف الذكاء الاصطناعي؟",
     ["هو مساعد يعمل على رقم واتساب شركتك، ويختلف عن «الشات بوت» التقليدي في ثلاث نقاط:",
      "<ul><li><b>يفهم الكلام الطبيعي</b> بالعربي واللهجات والإنجليزي، فلا يحتاج العميل لاختيار أرقام من قائمة.</li><li><b>مربوط ببيانات شركتك</b>: نظام الموارد البشرية، أو النظام المحاسبي، أو قائمة الأصناف، فيرد بأرقام حقيقية وليس بردود عامة.</li><li><b>يلتزم بقواعدك</b>: يعرف ما يقدر يعمله بنفسه، وما يحتاج موافقة شخص من فريقك.</li></ul>"]),
    ("ما المهام التي يتولاها؟",
     ["<ul><li><b>الموارد البشرية:</b> رصيد الإجازات، تقديم طلب إجازة، شهادة راتب، والرد على أسئلة السياسات.</li><li><b>التحصيل والحسابات:</b> كشف الحساب، نسخة فاتورة، تذكير بالمستحقات، واستلام تأكيد التحويل وتحويله للمحاسب ليعتمده.</li><li><b>المبيعات والطلبات:</b> تحويل رسالة واتساب إلى طلب مرتب، عرض سعر مبدئي، ومتابعة العملاء المحتملين.</li><li><b>التشغيل:</b> تقارير يومية من المواقع والمندوبين، والحضور والانصراف بالموقع.</li></ul>",
      "يمكنك تجربة نماذج حية لهذه المهام على <a href=\"/\">الصفحة الرئيسية</a>، وكلها تعمل على بيانات تجريبية."]),
    ("من يتخذ القرار؟ الإنسان دائماً في القرارات الحساسة",
     ["الموظف الذكي لا يعتمد دفعة، ولا يوافق على إجازة خارج القواعد، ولا يرسل شيئاً حساساً بدون مراجعة. هذه القرارات تذهب لشخص من فريقك ليعتمدها بضغطة، وكل خطوة لها سجل واضح: من سأل، وبماذا رد الموظف الذكي، ومن اعتمد."]),
    ("كيف تبدأ؟ تجربة صغيرة بدل مشروع كبير",
     ["<ol><li><b>اختر مهمة واحدة متكررة</b> تأخذ وقت فريقك كل يوم، مثل كشوف الحساب أو أسئلة الإجازات.</li><li><b>حدد القواعد</b>: ماذا يرد الموظف الذكي بنفسه، ومتى يحوّل لشخص.</li><li><b>جرّب لمدة محددة</b> على عدد محدود من العملاء أو الموظفين.</li><li><b>قِس النتيجة</b>: عدد الرسائل التي انتهت بدون تدخل، والوقت الذي وفّره فريقك. ثم قرر هل تكمل وتوسّع.</li></ol>"]),
   ],
   "faq": [
    ("هل يتكلم باللهجة السعودية أو المصرية؟","نعم. يفهم العربية الفصحى واللهجات الخليجية والمصرية والإنجليزية، ويرد بنفس لغة العميل."),
    ("هل يحتاج نظام جديد في الشركة؟","لا. يرتبط بالأنظمة التي تستخدمها حالياً قدر الإمكان، مثل النظام المحاسبي أو ملفات Excel، ونحدد طريقة الربط في أول جلسة."),
    ("ماذا لو لم يعرف الإجابة؟","يحوّل المحادثة لموظف من فريقك مع ملخص بالطلب، فلا يضيع العميل ولا يتكرر السؤال."),
    ("هل بيانات شركتي آمنة؟","يعمل على بيانات شركتك فقط وبالصلاحيات التي تحددها، والقرارات الحساسة لا تتم إلا بموافقة شخص، وكل خطوة مسجلة."),
    ("كم يستغرق التشغيل؟","التجربة الأولى على مهمة واحدة تكون عادة خلال أسابيع قليلة، وتختلف حسب طريقة الربط مع أنظمتك."),
   ],
   "cta": "تود أن ترى موظفاً ذكياً يعمل على مهمة من عملك؟",
   "cta_btn": "تواصل معنا على واتساب",
   "wa_text": "مرحباً، قرأت مقال موظف الذكاء الاصطناعي على واتساب وأحب أعرف أكثر",
   "crumb": "المدونة", "home": "الرئيسية", "faq_h": "أسئلة شائعة", "by": "فريق HUDERA AI",
  },
  "en": {
   "slug": "ai-employees-whatsapp",
   "title": "AI Employees on WhatsApp for Businesses in Saudi Arabia and the Gulf: What They Do and How to Start",
   "desc": "A practical guide for business owners in Saudi Arabia, the Gulf and Egypt: what an AI employee on WhatsApp is, which HR, collections and sales tasks it handles, and how to start with a small pilot.",
   "lead": "Your customers and staff send questions on WhatsApp all day: \"How many leave days do I have?\", \"Send me my statement\", \"Where is my order?\". Most of these messages repeat, and they eat your team's time. An AI employee answers them instantly, in Arabic and English, from your company's own data.",
   "sections": [
    ("What is an AI employee?",
     ["It is an assistant that works on your company's WhatsApp number. It differs from a traditional chatbot in three ways:",
      "<ul><li><b>It understands natural language</b> in Arabic, its dialects and English, so nobody has to pick numbers from a menu.</li><li><b>It is connected to your data</b>: your HR system, accounting system or product list, so it answers with real figures, not generic replies.</li><li><b>It follows your rules</b>: it knows what it can do on its own and what needs approval from someone on your team.</li></ul>"]),
    ("What tasks does it handle?",
     ["<ul><li><b>HR:</b> leave balances, leave requests, salary certificates and policy questions.</li><li><b>Collections and accounts:</b> statements, invoice copies, payment reminders, and receiving transfer confirmations for an accountant to approve.</li><li><b>Sales and orders:</b> turning a WhatsApp message into a clean order, preliminary quotes and lead follow-up.</li><li><b>Operations:</b> daily reports from sites and field reps, and location-based attendance.</li></ul>",
      "You can try live demos of these tasks on the <a href=\"/en/\">home page</a>. They all run on sample data."]),
    ("Who decides? A person, for anything sensitive",
     ["The AI employee does not approve payments, does not grant leave outside the rules, and does not send anything sensitive without review. Those decisions go to someone on your team to approve with one tap, and every step is logged: who asked, what the AI employee replied, and who approved."]),
    ("How to start: a small pilot, not a big project",
     ["<ol><li><b>Pick one repetitive task</b> that takes your team's time every day, such as statements or leave questions.</li><li><b>Set the rules</b>: what the AI employee answers on its own, and when it hands over to a person.</li><li><b>Run it for a fixed period</b> with a limited group of customers or staff.</li><li><b>Measure</b> how many conversations finished without a person and how much time your team saved. Then decide whether to expand.</li></ol>"]),
   ],
   "faq": [
    ("Does it speak Saudi or Egyptian Arabic?","Yes. It understands Modern Standard Arabic, Gulf and Egyptian dialects and English, and replies in the customer's language."),
    ("Do we need a new system?","No. It connects to the systems you already use where possible, such as your accounting system or Excel files, and we agree on the connection in the first session."),
    ("What if it doesn't know the answer?","It hands the conversation to someone on your team with a summary of the request, so the customer is not lost and nobody has to repeat themselves."),
    ("Is our data safe?","It works only on your company's data with the permissions you set. Sensitive decisions only happen with a person's approval, and every step is logged."),
    ("How long does it take to launch?","A first pilot on one task usually takes a few weeks, depending on how it connects to your systems."),
   ],
   "cta": "Want to see an AI employee on a task from your business?",
   "cta_btn": "Message us on WhatsApp",
   "wa_text": "Hi, I read your article about AI employees on WhatsApp and would like to know more",
   "crumb": "Blog", "home": "Home", "faq_h": "Frequently asked questions", "by": "HUDERA AI team",
  },
 },
]

CSS = """
:root{--ink:#0B1220;--muted:#5b6680;--brand:#3D5AFE;--line:#e6e9f2;--bg:#fff;--soft:#f5f7fc}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.8 "Instrument Sans","IBM Plex Sans Arabic",system-ui,sans-serif}
[lang=ar] body,body[dir=rtl]{font-family:"IBM Plex Sans Arabic","Instrument Sans",system-ui,sans-serif}
a{color:var(--brand)}header{border-bottom:1px solid var(--line)}
.bar{max-width:1080px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;gap:16px}
.logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--ink);font:700 20px "Bricolage Grotesque",sans-serif}.logo img{width:30px;height:30px;border-radius:8px}
.bar nav{margin-inline-start:auto;display:flex;gap:16px;font-size:15px}.bar nav a{color:var(--muted);text-decoration:none}
main{max-width:760px;margin:0 auto;padding:28px 20px 60px}
.crumbs{font-size:14px;color:var(--muted)}.crumbs a{color:var(--muted)}
h1{font:800 clamp(28px,4.4vw,40px)/1.25 "Bricolage Grotesque","IBM Plex Sans Arabic",sans-serif;margin:10px 0 8px}
.meta{color:var(--muted);font-size:14px;margin-bottom:18px}
.lead{font-size:19px;color:#253049}
h2{font:700 24px/1.35 "Bricolage Grotesque","IBM Plex Sans Arabic",sans-serif;margin:34px 0 8px}
li{margin:6px 0}
.faq details{border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:10px 0;background:var(--soft)}
.faq summary{font-weight:700;cursor:pointer}
.cta{margin:36px 0 0;padding:22px;border-radius:16px;background:#0B1324;color:#fff}
.cta p{margin:0 0 12px;font-size:19px;font-weight:700}
.btn{display:inline-block;background:var(--brand);color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:700}
.btn.alt{background:transparent;border:1px solid #39446a;margin-inline-start:8px}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:14px}footer .bar{justify-content:space-between}
.cards{display:grid;gap:14px}.card{display:block;border:1px solid var(--line);border-radius:14px;padding:16px 18px;text-decoration:none;color:var(--ink)}
.card b{display:block;font-size:19px}.card span{color:var(--muted);font-size:15px}
"""

def head(lang, title, desc, url, alt_lang, alt_url, extra_ld):
    d = "rtl" if lang == "ar" else "ltr"
    ld = json.dumps(extra_ld, ensure_ascii=False)
    alt = f'<link rel="alternate" hreflang="{lang}" href="{url}">\n<link rel="alternate" hreflang="{alt_lang}" href="{alt_url}">' if alt_url else ""
    return f"""<!doctype html>
<html lang="{lang}" dir="{d}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
{alt}
<meta property="og:type" content="article"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/og.png"><meta property="og:site_name" content="HUDERA AI">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700..800&family=Instrument+Sans:wght@400..700&family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap">
<style>{CSS}</style>
<script type="application/ld+json">{ld}</script>
</head>"""

def chrome(lang, body):
    if lang == "ar":
        nav = '<a href="/">الرئيسية</a><a href="/blog/">المدونة</a><a href="/academy/">الأكاديمية</a><a href="/en/blog/" lang="en">English</a>'
        foot = '<span>© 2026 HUDERA AI (هوديرا)</span><a href="mailto:info@hudera.ai">info@hudera.ai</a>'
        home = "/"
    else:
        nav = '<a href="/en/">Home</a><a href="/en/blog/">Blog</a><a href="/academy/">Academy</a><a href="/blog/" lang="ar">عربي</a>'
        foot = '<span>© 2026 HUDERA AI (هوديرا)</span><a href="mailto:info@hudera.ai">info@hudera.ai</a>'
        home = "/en/"
    return f"""<body>
<header><div class="bar"><a class="logo" href="{home}"><img src="/favicon-96x96.png" alt="HUDERA AI">HUDERA AI</a><nav>{nav}</nav></div></header>
<main>{body}</main>
<footer><div class="bar">{foot}</div></footer>
</body></html>"""

def article(a, lang, other_url, date):
    url = f"{SITE}/blog/{a['slug']}/" if lang == "ar" else f"{SITE}/en/blog/{a['slug']}/"
    blog = "/blog/" if lang == "ar" else "/en/blog/"
    homeu = "/" if lang == "ar" else "/en/"
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Article", "headline": a["title"], "description": a["desc"], "inLanguage": lang, "datePublished": date, "dateModified": date,
         "mainEntityOfPage": url, "image": f"{SITE}/og.png",
         "author": {"@type": "Organization", "name": "HUDERA AI", "url": SITE + "/"},
         "publisher": {"@type": "Organization", "name": "HUDERA AI", "logo": {"@type": "ImageObject", "url": f"{SITE}/icon-512.png"}}},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": r}} for q, r in a["faq"]]},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": a["home"], "item": SITE + homeu},
            {"@type": "ListItem", "position": 2, "name": a["crumb"], "item": SITE + blog},
            {"@type": "ListItem", "position": 3, "name": a["title"], "item": url}]}]}
    secs = "".join(f"<h2>{e(h)}</h2>" + "".join(p if p.startswith("<") else f"<p>{p}</p>" for p in ps) for h, ps in a["sections"])
    faq = "".join(f"<details><summary>{e(q)}</summary><p>{e(r)}</p></details>" for q, r in a["faq"])
    from urllib.parse import quote
    wa = f"{WA}?text={quote(a['wa_text'])}"
    demos = "/" if lang == "ar" else "/en/"
    demo_lbl = "جرّب النماذج الحية" if lang == "ar" else "Try the demos"
    body = f"""<div class="crumbs"><a href="{homeu}">{e(a['home'])}</a> › <a href="{blog}">{e(a['crumb'])}</a></div>
<article><h1>{e(a['title'])}</h1><div class="meta">{e(a['by'])} · <time datetime="{date}">{date}</time></div>
<p class="lead">{e(a['lead'])}</p>{secs}
<section class="faq"><h2>{e(a['faq_h'])}</h2>{faq}</section>
<div class="cta"><p>{e(a['cta'])}</p><a class="btn" href="{wa}" target="_blank" rel="noopener">{e(a['cta_btn'])}</a><a class="btn alt" href="{demos}">{demo_lbl}</a></div></article>"""
    other_lang = "en" if lang == "ar" else "ar"
    return url, head(lang, a["title"] + " | HUDERA AI", a["desc"], url, other_lang, other_url, ld) + chrome(lang, body)

def index(lang, items):
    url = f"{SITE}/blog/" if lang == "ar" else f"{SITE}/en/blog/"
    alt = f"{SITE}/en/blog/" if lang == "ar" else f"{SITE}/blog/"
    t = "مدونة HUDERA AI: الذكاء الاصطناعي للشركات" if lang == "ar" else "HUDERA AI Blog: AI for Businesses"
    d = ("مقالات عملية عن موظفي الذكاء الاصطناعي، وأتمتة واتساب، والتحصيل والموارد البشرية للشركات في السعودية والخليج ومصر."
         if lang == "ar" else "Practical articles on AI employees, WhatsApp automation, collections and HR for businesses in Saudi Arabia, the Gulf and Egypt.")
    cards = "".join(f'<a class="card" href="{u}"><b>{e(ti)}</b><span>{e(de)}</span></a>' for u, ti, de in items)
    h1 = "المدونة" if lang == "ar" else "Blog"
    ld = {"@context": "https://schema.org", "@type": "Blog", "name": t, "url": url, "inLanguage": lang,
          "publisher": {"@type": "Organization", "name": "HUDERA AI", "url": SITE + "/"}}
    return head(lang, t, d, url, "en" if lang == "ar" else "ar", alt, ld) + chrome(lang, f"<h1>{h1}</h1><p class='lead'>{e(d)}</p><div class='cards'>{cards}</div>")

ar_items, en_items, urls = [], [], []
for A in ARTICLES:
    ar, en, date = A["ar"], A["en"], A["date"]
    ar_url, en_url = f"{SITE}/blog/{ar['slug']}/", f"{SITE}/en/blog/{en['slug']}/"
    _, page = article(ar, "ar", en_url, date)
    p = root / "blog" / ar["slug"]; p.mkdir(parents=True, exist_ok=True); (p / "index.html").write_text(page, encoding="utf-8")
    _, page = article(en, "en", ar_url, date)
    p = root / "en" / "blog" / en["slug"]; p.mkdir(parents=True, exist_ok=True); (p / "index.html").write_text(page, encoding="utf-8")
    ar_items.append((f"/blog/{ar['slug']}/", ar["title"], ar["desc"])); en_items.append((f"/en/blog/{en['slug']}/", en["title"], en["desc"]))
    urls += [(ar_url, date), (en_url, date)]
(root / "blog").mkdir(exist_ok=True); (root / "blog" / "index.html").write_text(index("ar", ar_items), encoding="utf-8")
(root / "en" / "blog").mkdir(parents=True, exist_ok=True); (root / "en" / "blog" / "index.html").write_text(index("en", en_items), encoding="utf-8")

# keep sitemap in sync
sm = root / "sitemap.xml"; s = sm.read_text(encoding="utf-8")
for u, d in [(f"{SITE}/blog/", ARTICLES[-1]["date"]), (f"{SITE}/en/blog/", ARTICLES[-1]["date"])] + urls:
    if f"<loc>{u}</loc>" not in s:
        s = s.replace("</urlset>", f"  <url><loc>{u}</loc><lastmod>{d}</lastmod><priority>0.6</priority></url>\n</urlset>")
sm.write_text(s, encoding="utf-8")
print("blog built:", len(ARTICLES), "article pairs")
