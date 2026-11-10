# Regenerates /en/index.html from index.html. Run after every edit to index.html:
#   python3 tools/build_en.py
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
h = (root / "index.html").read_text(encoding="utf-8")
T = "HUDERA AI | AI Employees for Businesses in Saudi Arabia, the Gulf &amp; Egypt"
D = ("HUDERA AI (هوديرا) builds AI employees that work inside WhatsApp in Arabic and English for HR, collections, "
     "sales and operations, plus dashboards and workflow automation for businesses in Saudi Arabia, the Gulf and Egypt. "
     "Every sensitive decision is approved by a person.")
e = h.replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">', 1)
e = e.replace('<head>\n', '<head>\n<base href="/">\n', 1)
e = re.sub(r'<title>[^<]*</title>', f'<title>{T}</title>', e, count=1)
e = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{D}">', e, count=1)
e = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{T}">', e, count=1)
e = re.sub(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="AI employees for HR, collections, sales and operations that work inside WhatsApp in Arabic and English. Every sensitive decision is approved by a person.">', e, count=1)
e = e.replace('<meta property="og:locale" content="ar_AR">\n<meta property="og:locale:alternate" content="en_US">', '<meta property="og:locale" content="en_US">\n<meta property="og:locale:alternate" content="ar_AR">', 1)
e = e.replace('<meta property="og:url" content="https://hudera.ai/">', '<meta property="og:url" content="https://hudera.ai/en/">', 1)
e = e.replace('<link rel="canonical" href="https://hudera.ai/">', '<link rel="canonical" href="https://hudera.ai/en/">', 1)
fix = ('<script>document.addEventListener("click",function(ev){var a=ev.target.closest&&ev.target.closest(\'a[href^="#"]\');if(!a)return;'
       'var id=a.getAttribute("href").slice(1);ev.preventDefault();if(!id){window.scrollTo({top:0,behavior:"smooth"});history.replaceState(null,"",location.pathname);return;}'
       'var t=document.getElementById(id);if(t)t.scrollIntoView({behavior:"smooth",block:"start"});history.replaceState(null,"","#"+id);},true);</script>\n</head>')
e = e.replace('</head>', fix, 1)
e = e.replace('<a href="blog/" data-blog>', '<a href="en/blog/" data-blog>', 1)
(root / "en").mkdir(exist_ok=True)
(root / "en" / "index.html").write_text(e, encoding="utf-8")
print("en/index.html rebuilt")
