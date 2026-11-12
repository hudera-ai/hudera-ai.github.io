# -*- coding: utf-8 -*-
# Builds the AI news section and the model rankings page:
#   python3 tools/build_ai_news.py
# Data: tools/ai_news.json (one entry per news post, oldest first) and tools/ai_models.json (ranking tables).
# Pages: /blog/ai-news/ (+ one page per post), /blog/ai-models/, and the same under /en/blog/. Keeps sitemap.xml in sync.
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import build_blog as B
e, SITE, root = B.e, B.SITE, B.root
T = pathlib.Path(__file__).resolve().parent

B.CSS += """
.tag{display:inline-block;font-size:13px;font-weight:700;border:1px solid var(--line);border-radius:99px;padding:2px 10px;margin-inline-end:8px}
.src{margin-top:28px;border-top:1px solid var(--line);padding-top:14px;font-size:15px}.src h2{font-size:17px;margin:0 0 6px}.src ol{margin:0;padding-inline-start:20px}.src a{word-break:break-word}
.biz{border-inline-start:4px solid var(--line);padding:10px 16px;margin:22px 0;background:rgba(127,127,127,.07);border-radius:8px}
.biz b{display:block;margin-bottom:4px}
.tw{overflow-x:auto;margin:10px 0 6px}table.rk{border-collapse:collapse;width:100%;font-size:16px}
table.rk th,table.rk td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:start}table.rk td:first-child,table.rk td:last-child{font-variant-numeric:tabular-nums;font-weight:700}
.asof{color:var(--muted);font-size:14px;margin:0 0 22px}
.card time{display:block;color:var(--muted);font-size:13px;margin-bottom:4px}
"""

L = {
 "ar": dict(base="/blog/", home="الرئيسية", homeu="/", blog="المدونة", news="أخبار الذكاء الاصطناعي", models="ترتيب ومقارنة النماذج",
            by="فريق HUDERA AI", biz="ماذا يعني هذا لشركتك؟", src="المصادر", more="كل الأخبار", see_models="ترتيب النماذج الآن",
            news_desc="أهم أخبار الذكاء الاصطناعي يومياً، مختصرة وبالمصادر، مع ما تعنيه لشركتك.",
            note="ملخص من إعداد فريق HUDERA AI اعتماداً على المصادر المذكورة. راجع المصدر الأصلي قبل أي قرار."),
 "en": dict(base="/en/blog/", home="Home", homeu="/en/", blog="Blog", news="AI news", models="AI model rankings and comparison",
            by="HUDERA AI team", biz="What does this mean for your business?", src="Sources", more="All news", see_models="Current model rankings",
            news_desc="The most important AI news every day, short and sourced, with what it means for your business.",
            note="Summary written by the HUDERA AI team from the sources listed. Check the original source before any decision."),
}

def crumbs(lang, trail):
    l = L[lang]
    parts = [f'<a href="{l["homeu"]}">{l["home"]}</a>', f'<a href="{l["base"]}">{l["blog"]}</a>'] + [f'<a href="{u}">{e(t)}</a>' for u, t in trail]
    return '<div class="crumbs">' + " › ".join(parts) + "</div>"

def sources(lang, items):
    return f'<section class="src"><h2>{L[lang]["src"]}</h2><ol>' + "".join(
        f'<li><a href="{e(u)}" target="_blank" rel="noopener nofollow">{e(n)}</a></li>' for n, u in items) + "</ol></section>"

def post_url(lang, p): return f'{L[lang]["base"]}ai-news/{p["slug"]}/'

def post(lang, p):
    l, a, o = L[lang], p[lang], "en" if lang == "ar" else "ar"
    url, alt = SITE + post_url(lang, p), SITE + post_url(o, p)
    ld = {"@context": "https://schema.org", "@type": "NewsArticle", "headline": a["title"], "description": a["desc"], "inLanguage": lang,
          "datePublished": p["date"], "dateModified": p["date"], "mainEntityOfPage": url, "image": f"{SITE}/og.png",
          "author": {"@type": "Organization", "name": "HUDERA AI", "url": SITE + "/"},
          "publisher": {"@type": "Organization", "name": "HUDERA AI", "logo": {"@type": "ImageObject", "url": f"{SITE}/icon-512.png"}},
          "citation": [u for _, u in p["sources"]]}
    body = (crumbs(lang, [(l["base"] + "ai-news/", l["news"])]) +
            f'<article><h1>{e(a["title"])}</h1><div class="meta"><span class="tag">{e(p["tag"][lang])}</span>{l["by"]} · <time datetime="{p["date"]}">{p["date"]}</time></div>'
            + "".join(f"<p>{e(x)}</p>" for x in a["body"])
            + f'<div class="biz"><b>{l["biz"]}</b>{e(a["biz"])}</div>' + sources(lang, p["sources"])
            + f'<p class="asof">{l["note"]}</p>'
            + f'<div class="cta"><a class="btn" href="{l["base"]}ai-news/">{l["more"]}</a><a class="btn alt" href="{l["base"]}ai-models/">{l["see_models"]}</a></div></article>')
    return B.head(lang, a["title"] + " | HUDERA AI", a["desc"], url, o, alt, ld) + B.chrome(lang, body, post_url(o, p))

def news_index(lang, posts):
    l, o = L[lang], "en" if lang == "ar" else "ar"
    url, alt = f'{SITE}{l["base"]}ai-news/', f'{SITE}{L[o]["base"]}ai-news/'
    t = l["news"] + " | HUDERA AI"
    cards = "".join(f'<a class="card" href="{post_url(lang, p)}"><time datetime="{p["date"]}">{p["date"]} · {e(p["tag"][lang])}</time><b>{e(p[lang]["title"])}</b><span>{e(p[lang]["desc"])}</span></a>'
                    for p in reversed(posts))
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": t, "url": url, "inLanguage": lang,
          "publisher": {"@type": "Organization", "name": "HUDERA AI", "url": SITE + "/"}}
    body = (crumbs(lang, []) + f'<h1>{l["news"]}</h1><p class="lead">{l["news_desc"]}</p>'
            f'<p><a class="btn alt" href="{l["base"]}ai-models/">{l["see_models"]}</a></p><div class="cards">{cards}</div>')
    return B.head(lang, t, l["news_desc"], url, o, alt, ld) + B.chrome(lang, body, L[o]["base"] + "ai-news/")

MTXT = {
 "ar": dict(
  desc="أي نموذج ذكاء اصطناعي هو الأفضل الآن؟ ترتيب Gemini و Claude و GPT في المحادثة والبرمجة والبحث وفهم الصور، بتاريخ كل قياس ومصدره.",
  lead="لا يوجد نموذج واحد «الأفضل في كل شيء». الترتيب يتغير حسب المهمة، ويتغير كل أسابيع. هذه الصفحة تجمع أحدث ما نشرته لوحات القياس المستقلة، بتاريخ كل رقم ومصدره، ونحدّثها دورياً.",
  upd="آخر تحديث للصفحة", asof="تاريخ القياس", cols=("#", "النموذج", "الشركة", "النتيجة"),
  pick_h="أيهم تختار حسب استخدامك؟",
  pick=[("محادثة وكتابة عامة", "Gemini 4 Carbon و Gemini 4 Argon في الصدارة، و Claude Opus 5.5 قريب جداً. الفارق بين الأوائل نقاط قليلة."),
        ("برمجة وبناء مواقع وتطبيقات", "نماذج Claude (Fable 5.2 ثم Opus 5.5) تتصدر لوحة WebDev بفارق واضح."),
        ("بحث على الإنترنت", "نماذج GPT من OpenAI تتصدر لوحة البحث."),
        ("فهم الصور والمستندات المصورة", "نماذج Claude تتصدر لوحة الرؤية بفوارق صغيرة."),
        ("التكلفة", "السعر المعلن لا يكفي: النماذج التي «تفكر» أطول تستهلك رموزاً أكثر في المهمة الواحدة. احسب تكلفة المهمة، لا سعر المليون رمز.")],
  cav_h="كيف تقرأ هذه الأرقام؟",
  cav=["لوحات Arena مبنية على تصويت بشري أعمى بين إجابتين. هي تقيس التفضيل، لا الدقة المطلقة.",
       "المصوّتون يختارون أنفسهم، فالنتيجة تميل لذوق مستخدمي المنصة ومهامهم.",
       "النموذج الجديد يحتاج أسابيع حتى يستقر ترتيبه، والفرق الأقل من نحو 10 نقاط لا يُعتد به كثيراً.",
       "المؤشرات المركبة مثل Artificial Analysis تجمع اختبارات عدة، وقد لا تشبه مهام شركتك.",
       "القرار الصحيح: جرّب نموذجين أو ثلاثة على مهمة حقيقية من عملك، بنفس البيانات، ثم قارن."],
  cta="محتار أي نموذج يناسب شركتك؟ فريق HUDERA AI يختبر النماذج على مهامك الفعلية ويبني عليها موظف الذكاء الاصطناعي.", cta_btn="تواصل معنا على واتساب"),
 "en": dict(
  desc="Which AI model is best right now? How Gemini, Claude and GPT rank for chat, coding, search and vision, with the date and source of every figure.",
  lead="No single model is best at everything. Rankings change with the task, and they change every few weeks. This page gathers the latest figures from independent leaderboards, each with its date and source, and we update it regularly.",
  upd="Page last updated", asof="Measured", cols=("#", "Model", "Company", "Score"),
  pick_h="Which one for your use?",
  pick=[("General chat and writing", "Gemini 4 Carbon and Gemini 4 Argon lead, with Claude Opus 5.5 very close. The top models are only a few points apart."),
        ("Coding and building sites and apps", "Claude models (Fable 5.2, then Opus 5.5) lead the WebDev board by a clear margin."),
        ("Web search", "OpenAI's GPT models lead the search board."),
        ("Understanding images and scanned documents", "Claude models lead the vision board by small margins."),
        ("Cost", "List price is not enough: models that think for longer use more tokens per task. Work out cost per task, not price per million tokens.")],
  cav_h="How to read these numbers",
  cav=["Arena boards come from blind human votes between two answers. They measure preference, not absolute accuracy.",
       "Voters select themselves, so results lean toward the tastes and tasks of that platform's users.",
       "A new model needs weeks before its rank settles, and gaps under roughly 10 points mean little.",
       "Composite indexes such as Artificial Analysis combine several tests that may not resemble your company's work.",
       "The sound decision: try two or three models on one real task of yours, with the same data, then compare."],
  cta="Not sure which model fits your company? The HUDERA AI team tests models on your actual tasks and builds your AI employee on the result.", cta_btn="Message us on WhatsApp"),
}

def models(lang, M):
    l, m, o = L[lang], MTXT[lang], "en" if lang == "ar" else "ar"
    url, alt = f'{SITE}{l["base"]}ai-models/', f'{SITE}{L[o]["base"]}ai-models/'
    c = m["cols"]; tabs = ""
    for t in M["tables"]:
        rows = "".join(f"<tr><td>{i}</td><td>{e(r[0])}</td><td>{e(r[1])}</td><td>{r[2]}</td></tr>" for i, r in enumerate(t["rows"], 1))
        tabs += (f'<h2 id="{t["id"]}">{e(t[lang])}</h2><div class="tw"><table class="rk"><thead><tr><th>{c[0]}</th><th>{c[1]}</th><th>{c[2]}</th><th>{c[3]} ({t["unit"]})</th></tr></thead><tbody>{rows}</tbody></table></div>'
                 f'<p class="asof">{m["asof"]}: <time datetime="{t["asof"]}">{t["asof"]}</time></p>')
    pick = "<ul>" + "".join(f"<li><b>{e(a)}:</b> {e(b)}</li>" for a, b in m["pick"]) + "</ul>"
    cav = "<ul>" + "".join(f"<li>{e(x)}</li>" for x in m["cav"]) + "</ul>"
    from urllib.parse import quote
    ld = {"@context": "https://schema.org", "@type": "Article", "headline": l["models"], "description": m["desc"], "inLanguage": lang,
          "datePublished": "2026-11-12", "dateModified": M["updated"], "mainEntityOfPage": url, "image": f"{SITE}/og.png",
          "author": {"@type": "Organization", "name": "HUDERA AI", "url": SITE + "/"},
          "publisher": {"@type": "Organization", "name": "HUDERA AI", "logo": {"@type": "ImageObject", "url": f"{SITE}/icon-512.png"}}}
    body = (crumbs(lang, []) + f'<article><h1>{l["models"]}</h1><div class="meta">{l["by"]} · {m["upd"]}: <time datetime="{M["updated"]}">{M["updated"]}</time></div>'
            f'<p class="lead">{e(m["lead"])}</p><h2>{m["pick_h"]}</h2>{pick}{tabs}<h2>{m["cav_h"]}</h2>{cav}{sources(lang, M["sources"])}'
            f'<div class="cta"><p>{e(m["cta"])}</p><a class="btn" href="{B.WA}?text={quote(l["models"])}" target="_blank" rel="noopener">{m["cta_btn"]}</a>'
            f'<a class="btn alt" href="{l["base"]}ai-news/">{l["news"]}</a></div></article>')
    return B.head(lang, l["models"] + " | HUDERA AI", m["desc"], url, o, alt, ld) + B.chrome(lang, body, L[o]["base"] + "ai-models/")

def write(path, s):
    p = root / path.strip("/"); p.mkdir(parents=True, exist_ok=True); (p / "index.html").write_text(s, encoding="utf-8")

def main():
    posts = sorted(json.loads((T / "ai_news.json").read_text(encoding="utf-8")), key=lambda p: p["date"])
    M = json.loads((T / "ai_models.json").read_text(encoding="utf-8"))
    urls = []
    for lang in ("ar", "en"):
        for p in posts:
            write(post_url(lang, p), post(lang, p)); urls.append((SITE + post_url(lang, p), p["date"]))
        write(L[lang]["base"] + "ai-news/", news_index(lang, posts)); write(L[lang]["base"] + "ai-models/", models(lang, M))
    sm = root / "sitemap.xml"; s = sm.read_text(encoding="utf-8")
    import re
    for lang in ("ar", "en"):
        for u, d in ((f'{SITE}{L[lang]["base"]}ai-news/', posts[-1]["date"]), (f'{SITE}{L[lang]["base"]}ai-models/', M["updated"])):
            if f"<loc>{u}</loc>" in s:
                s = re.sub(rf"(<loc>{re.escape(u)}</loc><lastmod>)[^<]+", rf"\g<1>{d}", s)
            else:
                s = s.replace("</urlset>", f"  <url><loc>{u}</loc><lastmod>{d}</lastmod><priority>0.7</priority></url>\n</urlset>")
    for u, d in urls:
        if f"<loc>{u}</loc>" not in s:
            s = s.replace("</urlset>", f"  <url><loc>{u}</loc><lastmod>{d}</lastmod><priority>0.5</priority></url>\n</urlset>")
    sm.write_text(s, encoding="utf-8")
    print("ai news built:", len(posts), "posts x2,", len(M["tables"]), "tables")

if __name__ == "__main__":
    main()
