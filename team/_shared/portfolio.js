(function(){
"use strict";
var STATE = JSON.parse(document.getElementById("state").textContent);
var ICONS = STATE.__icons || {};
var LOGOS = STATE.__logos || {};
var IMG = STATE.images || {};
var lang = STATE.settings.defaultLang || "en";
try { var sl = localStorage.getItem("ms_lang"); if (sl === "en" || sl === "ar") lang = sl; } catch (e) {}
var root = document.getElementById("root");
var ARTIFACT = null, USER = null, CAN_EDIT = false, DOWNLOADS = null, SAMPLE = null, AUTH_READY = false, ROOM = null, PEERS = [];
var liveDraft = {text: "", frame: "hearts", secs: 20, target: ""};
var SB_CFG = window.SITE_CONFIG || null, SB = null, SB_USER = null;
var MODE = (SB_CFG && SB_CFG.supabaseUrl && window.supabase) ? "supabase" : ((window.claude && window.claude.use) ? "claude" : "static");
var route = routeFromHash();
function routeFromHash(){ var x = decodeURIComponent((location.hash || "").slice(1)); return (x === "dashboard" || x === "sheko" || /^p-[\w-]{1,40}$/.test(x)) ? x : "site"; }
var dirty = false, adminOpen = false, adminTab = "overview", filter = "all", openEd = {};

/* ---------- visitor, targeting, theme, analytics ---------- */
function lsGet(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
var VISITOR = lsGet("ms_vid"); if (!VISITOR) { VISITOR = Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-6); lsSet("ms_vid", VISITOR); }
var TO = (function(){ var m = /[?&]to=([^&#]+)/.exec(location.search); var v = m ? decodeURIComponent(m[1]).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30) : ""; if (v) lsSet("ms_to", v); return v || lsGet("ms_to") || ""; })();
var REF = (function(){ var m = /[?&]utm_source=([^&#]+)/.exec(location.search); if (m) return decodeURIComponent(m[1]).slice(0, 80); try { var r = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; return r && r !== location.hostname && !/accounts\.google|supabase\.co$/.test(r) ? r.slice(0, 80) : "direct"; } catch (e) { return "direct"; } })();
var IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
var theme = lsGet("ms_theme") || ((window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark");
function applyTheme(){ document.documentElement.setAttribute("data-theme", theme); var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", theme === "light" ? "#F5F7FB" : "#0A1120"); }
applyTheme();
function toggleTheme(){ theme = theme === "light" ? "dark" : "light"; lsSet("ms_theme", theme); applyTheme(); render(); }
var IS_OWNER_DEVICE = lsGet("ms_owner") === "1";
function track(type, item){
  if (!SB || IS_OWNER_DEVICE || CAN_EDIT) return;
  try { SB.from("events").insert({type: type, page: String(route).slice(0, 80), item: item ? String(item).slice(0, 80) : null, ref: REF, lang: lang, device: IS_MOBILE ? "mobile" : "desktop", visitor: VISITOR.slice(0, 24), target: TO || null}).then(function(){}, function(){}); } catch (e) {}
}
function ytEmbed(u){
  if (!u) return "";
  var m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/.exec(u); if (m) return "https://www.youtube-nocookie.com/embed/" + m[1] + "?autoplay=1&rel=0";
  var d = /drive\.google\.com\/file\/d\/([\w-]+)/.exec(u); if (d) return "https://drive.google.com/file/d/" + d[1] + "/preview";
  var v = /vimeo\.com\/(\d+)/.exec(u); if (v) return "https://player.vimeo.com/video/" + v[1] + "?autoplay=1";
  return "";
}
function videoModal(url, title){
  var emb = ytEmbed(url);
  var media = emb ? h("iframe", {src: emb, allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowfullscreen: true, title: title || "Video"}) : h("video", {src: url, controls: true, autoplay: true, playsinline: true});
  var m = h("div", {class: "modal vmodal", role: "dialog", "aria-modal": "true", "aria-label": title || "Video", onclick: function(e){ if (e.target === m) close(); }}, [h("div", {class: "vbox"}, [media, h("button", {class: "ib vclose", "aria-label": L("Close","إغلاق"), onclick: close, text: "✕"})])]);
  function close(){ m.remove(); document.removeEventListener("keydown", onk); }
  function onk(e){ if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onk); document.body.appendChild(m);
}
function cvUrl(){ return lang === "ar" ? (STATE.profile.cvUrlAr || "files/Mahmoud_Shahab_CV_AR.pdf") : (STATE.profile.cvUrl || "files/Mahmoud_Shahab_CV.pdf"); }
function cvChooser(from){
  var P = STATE.profile, en = P.cvUrl || "files/Mahmoud_Shahab_CV.pdf", ar = P.cvUrlAr || "files/Mahmoud_Shahab_CV_AR.pdf";
  var m = h("div", {class: "modal cvmodal", role: "dialog", "aria-modal": "true", "aria-label": L("Choose CV language","اختار لغة الـ CV"), onclick: function(e){ if (e.target === m) close(); }}, [h("div", {class: "cvbox"}, [
    h("button", {class: "ib cvx", "aria-label": L("Close","إغلاق"), onclick: close, text: "✕"}),
    h("b", {class: "cvt", text: L("Download my CV","حمّل الـ CV")}),
    h("p", {class: "lbl2", text: L("Choose the language you prefer.","اختار اللغة اللي تناسبك.")}),
    h("div", {class: "cvopts"}, [
      h("a", {class: "cvopt", href: ar, target: "_blank", rel: "noopener", download: "Mahmoud_Shahab_CV_AR.pdf", onclick: function(){ track("cv", from + "-ar"); setTimeout(close, 150); }}, [h("span", {class: "cvl", text: "ع"}), h("span", {}, [h("b", {text: "العربية"}), h("small", {text: "PDF"})])]),
      h("a", {class: "cvopt", href: en, target: "_blank", rel: "noopener", download: "Mahmoud_Shahab_CV.pdf", onclick: function(){ track("cv", from + "-en"); setTimeout(close, 150); }}, [h("span", {class: "cvl", text: "EN"}), h("span", {}, [h("b", {text: "English"}), h("small", {text: "PDF"})])])
    ])
  ])]);
  function close(){ m.remove(); document.removeEventListener("keydown", onk); }
  function onk(e){ if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onk); document.body.appendChild(m);
  var f = m.querySelector(lang === "ar" ? ".cvopt" : ".cvopt:last-child"); if (f) f.focus();
}
function cvName(){ return lang === "ar" ? "Mahmoud_Shahab_CV_AR.pdf" : "Mahmoud_Shahab_CV.pdf"; }
function cvOn(){ return STATE.settings.showCv !== false && MODE !== "claude"; }

/* ---------- helpers ---------- */
function t(o){ if (o == null) return ""; if (typeof o === "string") return o; return o[lang] || o.en || ""; }
function L(en, ar){ return lang === "ar" ? ar : en; }
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); }
function h(tag, attrs, kids){
  var el = document.createElement(tag);
  if (attrs) for (var k in attrs) {
    var v = attrs[k]; if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "text") el.textContent = v;
    else if (k.slice(0,2) === "on") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  (kids || []).forEach(function(c){ if (c == null || c === false) return; el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
  return el;
}
function img(key){ return IMG[key] || ""; }
function iconSvg(id, color){
  var ic = ICONS[id]; if (!ic) return "";
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="' + (color || ("#" + ic.h)) + '" d="' + ic.p + '"/></svg>';
}
function luminance(hex){ hex = (hex||"000000").replace("#",""); var r=parseInt(hex.substr(0,2),16),g=parseInt(hex.substr(2,2),16),b=parseInt(hex.substr(4,2),16); return (0.299*r+0.587*g+0.114*b)/255; }
function tile(item, size){
  var box = h("span", {class: "tile" + (size ? " " + size : "")});
  var id = item.id;
  if (item.img && img(item.img)) { box.classList.add("photo"); box.appendChild(h("img", {src: img(item.img), alt: ""})); }
  else if (LOGOS[id]) { box.innerHTML = LOGOS[id]; }
  else if (ICONS[id]) { var hex = ICONS[id].h; box.classList.add("brand"); box.style.setProperty("--c", "#" + (luminance(hex) < .12 ? "1E2A44" : hex)); box.innerHTML = iconSvg(id, "#fff"); }
  else { box.classList.add("brand", "lt"); box.style.setProperty("--c", "#" + (item.hex || "4C86FF")); box.textContent = item.letter || (item.name || item.label || "?").charAt(0); if ((item.letter || "").length > 2) box.style.fontSize = "11px"; }
  return box;
}
function toolIcon(tool){ return tile(tool); }
function toolName(tool){ return tool.name || (ICONS[tool.id] ? ICONS[tool.id].t : tool.id); }
function sectionNum(id){ var vis = visibleSections(); var i = vis.indexOf(id); return "SHT-" + String(i + 1).padStart(2, "0"); }
function visibleSections(){ return STATE.settings.sectionOrder.filter(function(s){ return STATE.settings.sections[s] && (s !== "testimonials" || (STATE.testimonials || []).some(function(x){ return x.show; })) && (s !== "comments" || MODE === "supabase"); }); }
function migrate(S){
  S.settings = S.settings || {}; var o = S.settings.sectionOrder || (S.settings.sectionOrder = []);
  if (o.indexOf("testimonials") < 0) { var ci = o.indexOf("contact"); o.splice(ci < 0 ? o.length : ci, 0, "testimonials"); }
  S.settings.sections = S.settings.sections || {}; if (S.settings.sections.testimonials === undefined) S.settings.sections.testimonials = true;
  if (!Array.isArray(S.testimonials)) S.testimonials = [];
  if (o.indexOf("comments") < 0) { var ci2 = o.indexOf("contact"); o.splice(ci2 < 0 ? o.length : ci2, 0, "comments"); }
  if (S.settings.sections.comments === undefined) S.settings.sections.comments = true;
  if (S.settings.showCv === undefined) S.settings.showCv = true;
  (S.categories || []).forEach(function(c){ if (c.ar === "ديمو تجربه") c.ar = "ديمو تجربة"; });
  S.projects.forEach(function(p){ if (!Array.isArray(p.gallery)) p.gallery = []; });
  return S;
}
migrate(STATE);
var SEC_LABEL = {
  about: {en:"About", ar:"عني"}, projects: {en:"Projects", ar:"المشاريع"}, services: {en:"Services", ar:"الخدمات"},
  skills: {en:"Skills", ar:"المهارات"}, tools: {en:"Tools", ar:"البرامج"}, experience: {en:"Experience", ar:"الخبرات"}, testimonials: {en:"Testimonials", ar:"آراء العملاء"}, comments: {en:"Comments", ar:"التعليقات"}, contact: {en:"Contact", ar:"تواصل"}
};
var SVC_ICONS = {
  grid: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7"/></svg>',
  chart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  bolt: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  doc: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
  spark: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>'
};

/* ---------- generated project covers (no photo yet) ---------- */
function drawCover(canvas, seed, title){
  var w = canvas.width = 640, hh = canvas.height = 360, c = canvas.getContext("2d");
  var g = c.createLinearGradient(0,0,w,hh); g.addColorStop(0,"#101C36"); g.addColorStop(1,"#0B1326"); c.fillStyle = g; c.fillRect(0,0,w,hh);
  c.strokeStyle = "rgba(76,134,255,.10)"; c.lineWidth = 1;
  for (var x=0;x<w;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x,hh);c.stroke();}
  for (var y=0;y<hh;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  var r = seed * 9301 + 49297;
  function rnd(){ r = (r * 9301 + 49297) % 233280; return r / 233280; }
  // window frame
  c.fillStyle = "#15244A"; c.strokeStyle = "#2F4675"; c.lineWidth = 1.5;
  roundRect(c, 70, 50, 500, 260, 12); c.fill(); c.stroke();
  c.fillStyle = "#2F4675"; for (var i=0;i<3;i++){ c.beginPath(); c.arc(92 + i*16, 70, 4, 0, 7); c.fill(); }
  var kind = seed % 3;
  if (kind === 0) { // bars
    for (var b=0;b<9;b++){ var bh = 40 + rnd()*140; c.fillStyle = b===6 ? "#E2A85B" : "#4C86FF"; c.globalAlpha = b===6?1:.75; roundRect(c, 110 + b*48, 280 - bh, 28, bh, 4); c.fill(); }
    c.globalAlpha = 1;
  } else if (kind === 1) { // table rows
    for (var rr=0;rr<6;rr++){ var yy = 100 + rr*32; c.fillStyle = "rgba(141,178,255,.14)"; roundRect(c, 100, yy, 300, 18, 4); c.fill(); var st = rnd(); c.fillStyle = st > .66 ? "#1FC79A" : st > .33 ? "#E2A85B" : "#4C86FF"; roundRect(c, 420, yy, 70, 18, 9); c.fill(); c.fillStyle = "rgba(141,178,255,.3)"; roundRect(c, 505, yy+6, 40*rnd()+10, 6, 3); c.fill(); }
  } else { // line + kpis
    c.strokeStyle = "#4C86FF"; c.lineWidth = 3; c.beginPath(); var py = 250;
    for (var p=0;p<10;p++){ py = Math.max(130, Math.min(280, py - 20 + rnd()*30 - 10)); var px = 110 + p*46; p ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.stroke();
    for (var k=0;k<3;k++){ c.fillStyle = "rgba(141,178,255,.12)"; roundRect(c, 110 + k*150, 92, 130, 34, 8); c.fill(); c.fillStyle = k===1 ? "#E2A85B" : "#8DB2FF"; roundRect(c, 122 + k*150, 104, 50, 10, 4); c.fill(); }
  }
}
function roundRect(c,x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function coverEl(p, i){
  if (p.img && img(p.img)) return h("img", {src: img(p.img), alt: t(p.title)});
  var cv = h("canvas", {"aria-hidden": "true"}); drawCover(cv, i + 1, t(p.title)); return cv;
}

/* ---------- render ---------- */
function render(){
  document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  var scrollY = window.scrollY;
  if (scene3) { scene3.stop(); scene3 = null; }
  root.innerHTML = "";
  if (route === "dashboard") { document.title = L("Portfolio Dashboard","لوحة تحكم البورتفوليو"); root.appendChild(renderDashboard()); return; }
  if (route === "sheko") { document.title = L("Sheko · Mahmoud's assistant","شيكو · مساعد محمود"); root.appendChild(renderShekoPage()); return; }
  if (route.slice(0, 2) === "p-") {
    var pp = STATE.projects.filter(function(p){ return p.id === route.slice(2) && p.show; })[0];
    if (pp) { document.title = t(pp.title) + " · " + t(STATE.profile.name); root.appendChild(renderNav()); root.appendChild(renderProjectPage(pp)); root.appendChild(renderFooter()); if (shekoOn()) root.appendChild(renderShekoWidget()); initFx(); return; }
    route = "site";
  }
  document.title = t(STATE.profile.name) + " · " + L("Portfolio","بورتفوليو");
  root.appendChild(renderNav());
  root.appendChild(renderHero());
  visibleSections().forEach(function(s){
    var fn = {about: renderAbout, projects: renderProjects, services: renderServices, skills: renderSkills, tools: renderTools, experience: renderExperience, testimonials: renderTestimonials, comments: renderComments, contact: renderContact}[s];
    var el = fn ? fn() : null; if (el) root.appendChild(el);
  });
  root.appendChild(renderFooter());
  if (shekoOn()) root.appendChild(renderShekoWidget());
  window.scrollTo(0, scrollY);
  startScene();
  initFx();
}
function go(r){ location.hash = r === "site" ? "" : r; if (r === "site" && location.hash) history.replaceState(null, "", location.pathname + location.search); route = r; window.scrollTo(0, 0); render(); }
window.addEventListener("hashchange", function(){
  var r = routeFromHash(); if (r === route) return;
  route = r; window.scrollTo(0, 0); render(); if (r.slice(0, 2) !== "p-") track("view"); trackPresence();
  var id = location.hash.slice(1), el = r === "site" && id ? document.getElementById(id) : null; if (el) setTimeout(function(){ el.scrollIntoView({block: "start"}); }, 30);
});
document.addEventListener("click", function(e){
  var a = e.target.closest && e.target.closest("a[href^='#']"); if (!a) return;
  var id = a.getAttribute("href").slice(1);
  if (id === "dashboard" || id === "sheko") { e.preventDefault(); go(id); return; }
  if (id === "" || id === "top") { e.preventDefault(); if (route !== "site") go("site"); window.scrollTo({top: 0, behavior: "smooth"}); return; }
  var el = document.getElementById(id); if (el && route === "site") { e.preventDefault(); el.scrollIntoView({behavior: "smooth", block: "start"}); }
});

var tapN = 0, tapT = 0;
function secretTap(e){
  var now = Date.now(); tapN = (now - tapT < 700) ? tapN + 1 : 1; tapT = now;
  if (tapN >= 4) { tapN = 0; e.preventDefault(); e.stopPropagation(); go("dashboard"); }
}
function renderNav(){
  var links = h("nav", {class: "navlinks", "aria-label": L("Sections","الأقسام")}, visibleSections().map(function(s){ return h("a", {href: "#" + s, text: t(SEC_LABEL[s])}); }));
  var menuBtn = h("button", {class: "btn sm ghost icon menubtn", "aria-label": L("Menu","القائمة"), "aria-expanded": "false", html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'});
  var sheet = h("nav", {class: "mnav", hidden: true, "aria-label": L("Sections","الأقسام")}, visibleSections().map(function(sec){ return h("a", {href: "#" + sec, text: t(SEC_LABEL[sec]), onclick: function(){ sheet.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); }}); }).concat(cvOn() ? [h("a", {class: "cvlink", href: "#", onclick: function(e){ e.preventDefault(); sheet.hidden = true; cvChooser("menu"); }, text: L("Download CV","حمّل الـ CV")})] : []));
  menuBtn.addEventListener("click", function(){ sheet.hidden = !sheet.hidden; menuBtn.setAttribute("aria-expanded", String(!sheet.hidden)); });
  var tools = h("div", {class: "navtools"}, [
    h("button", {class: "btn sm ghost icon", onclick: toggleTheme, "aria-label": theme === "light" ? L("Dark mode","الوضع الليلي") : L("Light mode","الوضع الفاتح"), title: theme === "light" ? L("Dark mode","الوضع الليلي") : L("Light mode","الوضع الفاتح"), html: theme === "light" ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'}),
    h("button", {class: "btn sm ghost", onclick: function(){ lang = lang === "en" ? "ar" : "en"; try { localStorage.setItem("ms_lang", lang); } catch(e){} render(); }, text: lang === "en" ? "عربي" : "English", "aria-label": L("Switch language","تغيير اللغة")}),
    menuBtn
  ]);
  return h("header", {class: "nav"}, [h("div", {class: "wrap"}, [
    h("a", {class: "brand", href: "#top", onclick: secretTap}, [img(STATE.profile.avatar) ? h("img", {src: img(STATE.profile.avatar), alt: ""}) : null, h("span", {text: t(STATE.profile.name)})]),
    links, tools
  ]), sheet]);
}

function renderHero(){
  var P = STATE.profile, S = STATE.settings;
  var hl = t(P.headline);
  var roles = h("div", {class: "roles"}, P.roles.filter(function(r){ return r.show; }).map(function(r){
    var lg = (S.showCompanyLogos && r.logo && img(r.logo)) ? h("span", {class: "lg" + (r.logo === "logo_hudera" ? " full" : "")}, [h("img", {src: img(r.logo), alt: r.org + " logo"})]) : null;
    return h("div", {class: "role"}, [lg, h("b", {text: t(r.title)}), h("span", {text: "· " + r.org})]);
  }));
  var wa = STATE.accounts.filter(function(a){ return a.id === "whatsapp" && a.show; })[0];
  var copy = h("div", {class: "hero-copy"}, [
    h("div", {class: "eyebrow"}, [S.available ? h("span", {class: "avail"}, [h("i"), t(P.availableText)]) : h("span", {class: "mono", text: L("Portfolio","بورتفوليو")})]),
    h("h1", {class: "display", text: t(P.name)}),
    h("p", {class: "headline display", text: hl}),
    h("p", {class: "sub", text: t(P.sub)}),
    roles,
    h("div", {class: "cta"}, [
      STATE.settings.sections.projects ? h("a", {class: "btn primary", href: "#projects", text: L("See my projects","شوف المشاريع")}) : null,
      wa ? h("a", {class: "btn", href: wa.url, target: "_blank", rel: "noopener", onclick: function(){ track("whatsapp", "hero"); }, text: L("Message me on WhatsApp","كلمني واتساب")}) : null,
      cvOn() ? h("button", {class: "btn", type: "button", onclick: function(){ cvChooser("hero"); }}, [h("span", {html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>'}), L("Download CV","حمّل الـ CV")]) : null,
      P.videoUrl ? h("button", {class: "btn ghost", onclick: function(){ track("video", "intro"); videoModal(P.videoUrl, L("Intro video","فيديو تعريفي")); }}, [h("span", {class: "play", "aria-hidden": "true", text: "▶"}), L("Watch my intro","شوف الفيديو التعريفي")]) : null
    ]),
    h("p", {class: "mono muted", style: "margin-top:22px;font-size:11px", text: t(P.location)})
  ]);
  var stage;
  if (img(P.cutout)) {
    var orbitIds = (S.orbitTools && S.orbitTools.length) ? S.orbitTools : ["claude","openai","googlegemini","supabase","flutter","x_excel","python","make","whatsapp","github"];
    if (window.innerWidth < 520) orbitIds = orbitIds.slice(0, 7);
    var orbit = h("div", {class: "orbit", id: "orbit", "aria-hidden": "true"}, orbitIds.map(function(id){
      var tl = STATE.tools.filter(function(x){ return x.id === id; })[0] || {id: id};
      return h("span", {class: "orb"}, [tile(tl, "lg")]);
    }));
    var chips = (S.heroChips && S.heroChips.length ? S.heroChips : [{en:"AI Agents",ar:"وكلاء ذكاء اصطناعي"},{en:"Dashboards",ar:"داشبوردات"},{en:"Automation",ar:"أتمتة"},{en:"Tracking Systems",ar:"سيستمز متابعة"}]);
    stage = h("div", {class: "stage stage2", id: "stage"}, [
      use3d() ? h("canvas", {id: "scene", "aria-hidden": "true"}) : null,
      h("div", {class: "halo", "aria-hidden": "true"}, [h("i", {class: "ring r1"}), h("i", {class: "ring r2"}), h("i", {class: "glow"})]),
      orbit,
      h("div", {class: "cutwrap"}, [h("img", {class: "cutout", src: img(P.cutout), alt: t(P.name), fetchpriority: "high", decoding: "async"})]),
      h("div", {class: "hchips", "aria-hidden": "true"}, chips.map(function(c, i){ return h("span", {class: "hchip c" + i, text: t(c)}); })),
    ]);
    var plate = h("div", {class: "nameplate"}, [h("b", {text: t(P.heroTitle) || L("Co-Founder & CTO","الشريك المؤسس والمدير التقني")}), h("span", {text: P.heroOrg || "HUDERA AI"})]);
  } else {
  stage = h("div", {class: "stage", id: "stage"}, [
    S.show3d ? h("canvas", {id: "scene", "aria-hidden": "true"}) : null,
    h("figure", {class: "sheetcard", style: "margin:0"}, [
      h("span", {class: "corner tl"}), h("span", {class: "corner tr"}),
      img(P.photo) ? h("img", {src: img(P.photo), alt: t(P.name)}) : null,
      h("figcaption", {class: "tblock"}, [
        h("div", {}, [h("b", {text: t(P.name)}), document.createTextNode(P.roles[0] ? t(P.roles[0].title) : "")]),
        h("div", {text: "SHT-00"})
      ])
    ])
  ]);
  }
  if (img(P.cutout)) return h("section", {class: "hero hero2", id: "top"}, [h("div", {class: "grid-bg"}), h("div", {class: "wrap"}, [stage, plate, copy])]);
  return h("section", {class: "hero", id: "top"}, [h("div", {class: "grid-bg"}), h("div", {class: "wrap"}, [copy, stage])]);
}

function secHead(id, title, desc){
  return h("div", {class: "sechead"}, [h("div", {}, [h("span", {class: "mono", text: sectionNum(id) + " · " + t(SEC_LABEL[id])}), h("h2", {class: "display", text: title})]), desc ? h("p", {text: desc}) : null]);
}

function renderAbout(){
  var P = STATE.profile;
  var shown = STATE.projects.filter(function(p){ return p.show; }).length;
  var tools = STATE.tools.filter(function(x){ return x.show; }).length;
  return h("section", {class: "sec", id: "about"}, [h("div", {class: "wrap"}, [
    secHead("about", L("From the site file to the system","من ملف الموقع للسيستم")),
    h("div", {class: "about"}, [
      img(P.aboutPhoto) ? h("div", {class: "ph"}, [h("img", {src: img(P.aboutPhoto), alt: L("Mahmoud at his desk","محمود على مكتبه")})]) : h("div", {class: "txt lead"}, [h("p", {text: t(P.about)})]),
      h("div", {class: "txt"}, [
        img(P.aboutPhoto) ? h("p", {text: t(P.about)}) : null,
        h("div", {class: "facts"}, P.facts.map(function(f){ return h("div", {}, [h("span", {class: "mono", text: t(f.k)}), h("b", {text: t(f.v)})]); })),
        h("div", {class: "stats"}, [
          h("div", {}, [h("b", {text: String(shown)}), h("span", {text: L("projects in this portfolio","مشروع في البورتفوليو")})]),
          h("div", {}, [h("b", {text: String(tools)}), h("span", {text: L("tools I work with","برنامج بشتغل عليه")})]),
          h("div", {}, [h("b", {text: "3"}), h("span", {text: L("markets: KSA, UAE, Egypt","أسواق: السعودية، الإمارات، مصر")})])
        ])
      ])
    ])
  ])]);
}

function renderProjects(){
  var list = STATE.projects.filter(function(p){ return p.show; });
  var cats = STATE.categories.filter(function(c){ return c.id === "all" || list.some(function(p){ return p.cat === c.id; }); });
  var shown = list.filter(function(p){ return filter === "all" || p.cat === filter; });
  var grid = h("div", {class: "pgrid"}, shown.map(function(p, i){
    var idx = STATE.projects.indexOf(p);
    var dev = /dev|تطوير/i.test(t(p.status));
    var card = h("div", {class: "pcard" + (p.featured ? " feat" : ""), role: "button", tabindex: "0", "aria-label": t(p.title), onclick: function(e){ if (e.target.closest("a")) return; openProject(p, idx); }, onkeydown: function(e){ if ((e.key === "Enter" || e.key === " ") && e.target === card) { e.preventDefault(); openProject(p, idx); } }}, [
      h("div", {class: "cover"}, [coverEl(p, idx), h("span", {class: "code", text: "PRJ-" + String(idx + 1).padStart(2, "0")}), p.demo ? h("span", {class: "trybadge", text: L("Try it live","جرّبه بنفسك")}) : null]),
      h("div", {class: "body"}, [
        h("span", {class: "status" + (dev ? " dev" : ""), text: t(p.status)}),
        h("h3", {text: t(p.title)}),
        h("p", {text: t(p.problem)}),
        h("div", {class: "tags"}, (p.tags || []).map(function(tg){ return h("span", {class: "tag", text: tg}); })),
        (p.demo || p.repo) ? h("div", {class: "plinks"}, [
          p.demo ? h("a", {class: "btn sm primary", href: p.demo, target: p.demo.charAt(0) === "#" ? null : "_blank", rel: "noopener", onclick: function(){ track("demo", p.id); }, text: L("Try the demo","جرّب الديمو")}) : null,
          p.repo ? h("a", {class: "btn sm", href: p.repo, target: "_blank", rel: "noopener", onclick: function(){ track("repo", p.id); }, text: "GitHub"}) : null
        ]) : null
      ])
    ]);
    return card;
  }));
  return h("section", {class: "sec", id: "projects"}, [h("div", {class: "wrap"}, [
    secHead("projects", L("Systems I've built","سيستمز بنيتها"), L("Client names and real data are left out. Open any card for the problem and the solution.","أسماء العملاء والبيانات الحقيقية مش معروضة. افتح أي كارت تشوف المشكلة والحل.")),
    h("div", {class: "filters", role: "group", "aria-label": L("Filter projects","فلترة المشاريع")}, cats.map(function(c){
      return h("button", {class: "chip", "aria-pressed": String(filter === c.id), onclick: function(){ filter = c.id; render(); document.getElementById("projects").scrollIntoView({block: "start"}); }, text: c[lang] || c.en});
    })),
    grid
  ])]);
}

function openProject(p, idx){
  if (p.id) { go("p-" + p.id); return; }
  var m = h("div", {class: "modal", role: "dialog", "aria-modal": "true", "aria-label": t(p.title), onclick: function(e){ if (e.target === m) close(); }}, [
    h("div", {class: "box"}, [
      coverEl(p, idx),
      h("div", {class: "in"}, [
        h("span", {class: "status", text: "PRJ-" + String(idx + 1).padStart(2, "0") + " · " + t(p.status)}),
        h("h3", {class: "display", text: t(p.title)}),
        h("div", {}, [h("div", {class: "lbl", text: L("The problem","المشكلة")}), h("p", {text: t(p.problem)})]),
        h("div", {}, [h("div", {class: "lbl", text: L("What I built","اللي بنيته")}), h("p", {text: t(p.solution)})]),
        h("div", {class: "tags"}, (p.tags || []).map(function(tg){ return h("span", {class: "tag", text: tg}); })),
        h("div", {class: "plinks"}, [
          p.demo ? h("a", {class: "btn primary", href: p.demo, target: p.demo.charAt(0) === "#" ? null : "_blank", rel: "noopener", onclick: function(){ if (p.demo.charAt(0) === "#") close(); }, text: L("Try the live demo","جرّب الديمو الحي")}) : null,
          p.repo ? h("a", {class: "btn", href: p.repo, target: "_blank", rel: "noopener", text: L("Code on GitHub","الكود على GitHub")}) : null,
          h("button", {class: "btn ghost", onclick: close, text: L("Close","إغلاق")})
        ])
      ])
    ])
  ]);
  function close(){ m.remove(); document.removeEventListener("keydown", onk); }
  function onk(e){ if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onk);
  document.body.appendChild(m); var fb = m.querySelector(".btn"); if (fb) fb.focus();
}

function statsEditor(p){
  if (!Array.isArray(p.stats)) p.stats = [];
  while (p.stats.length < 3) p.stats.push({v: {en: "", ar: ""}, l: {en: "", ar: ""}});
  return h("div", {}, [h("div", {class: "lbl2", text: L("Key numbers (optional, up to 3, only real ones), e.g. value \"70%\" + label \"less time on reports\"","أرقام مهمة (اختياري، لحد 3، الحقيقية بس)، مثلاً القيمة \"70%\" والوصف \"وقت أقل في التقارير\"")}),
    h("div", {class: "pstatsed"}, p.stats.slice(0, 3).map(function(x, i){ return h("div", {class: "pair"}, [bi(x, "v", false, L("Value ","القيمة ") + (i + 1)), bi(x, "l", false, L("Label ","الوصف ") + (i + 1))]); }))]);
}
function renderProjectPage(p){
  var list = STATE.projects.filter(function(x){ return x.show; }), i = list.indexOf(p), idx = STATE.projects.indexOf(p);
  var prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
  var pics = [p.img].concat(p.gallery || []).filter(function(k){ return k && img(k); });
  var cur = 0;
  var mainImg = pics.length ? h("img", {class: "pmain", src: img(pics[0]), alt: t(p.title), decoding: "async"}) : coverEl(p, idx);
  var thumbs = pics.length > 1 ? h("div", {class: "pthumbs", role: "group", "aria-label": L("Screenshots","صور المشروع")}, pics.map(function(k, j){
    return h("button", {class: "pthumb", "aria-pressed": String(j === 0), "aria-label": L("Image ","صورة ") + (j + 1), onclick: function(e){ cur = j; mainImg.src = img(k); [].forEach.call(thumbs.children, function(b, q){ b.setAttribute("aria-pressed", String(q === j)); }); }}, [h("img", {src: img(k), alt: "", decoding: "async"})]);
  })) : null;
  var dev = /dev|تطوير/i.test(t(p.status));
  track("project", p.id);
  return h("main", {class: "ppage"}, [h("div", {class: "wrap"}, [
    h("a", {class: "btn sm ghost back", href: "#projects", text: L("← All projects","→ كل المشاريع")}),
    h("div", {class: "phead"}, [
      h("span", {class: "mono muted", text: "PRJ-" + String(idx + 1).padStart(2, "0")}),
      h("h1", {class: "display", text: t(p.title)}),
      h("div", {class: "pmeta"}, [h("span", {class: "status" + (dev ? " dev" : ""), text: t(p.status)})].concat((p.tags || []).map(function(tg){ return h("span", {class: "tag", text: tg}); })))
    ]),
    h("div", {class: "pgal"}, [h("div", {class: "pframe"}, [mainImg]), thumbs]),
    h("div", {class: "pcols"}, [
      h("div", {class: "pblock"}, [h("div", {class: "lbl", text: L("The problem","المشكلة")}), h("p", {text: t(p.problem)})]),
      h("div", {class: "pblock"}, [h("div", {class: "lbl", text: L("What I built","اللي بنيته")}), h("p", {text: t(p.solution)})]),
      p.result && t(p.result) ? h("div", {class: "pblock res"}, [h("div", {class: "lbl", text: L("The result","النتيجة")}), h("p", {text: t(p.result)})]) : null
    ]),
    (p.stats || []).filter(function(x){ return x && t(x.v); }).length ? h("div", {class: "pstats"}, p.stats.filter(function(x){ return x && t(x.v); }).map(function(x){ return h("div", {class: "pstat"}, [h("b", {dir: "auto", text: t(x.v)}), h("span", {class: "lbl2", text: t(x.l)})]); })) : null,
    p.video ? h("div", {class: "pvideo"}, [ytEmbed(p.video) ? h("iframe", {src: ytEmbed(p.video).replace("autoplay=1", "autoplay=0"), title: t(p.title), allow: "encrypted-media; picture-in-picture; fullscreen", allowfullscreen: true, loading: "lazy"}) : h("video", {src: p.video, controls: true, preload: "metadata", playsinline: true})]) : null,
    h("div", {class: "plinks big"}, [
      p.demo ? h("a", {class: "btn primary", href: p.demo, target: p.demo.charAt(0) === "#" ? null : "_blank", rel: "noopener", onclick: function(){ track("demo", p.id); }, text: L("Try the live demo","جرّب الديمو الحي")}) : null,
      p.repo ? h("a", {class: "btn", href: p.repo, target: "_blank", rel: "noopener", onclick: function(){ track("repo", p.id); }, text: L("Code on GitHub","الكود على GitHub")}) : null,
      h("button", {class: "btn ghost", onclick: function(ev){ var u = location.origin + location.pathname + "#p-" + p.id; if (navigator.share) { navigator.share({title: t(p.title), url: u}).catch(function(){}); } else { var b = ev.currentTarget; try { navigator.clipboard.writeText(u).then(function(){ b.textContent = L("Link copied ✓","اتنسخ اللينك ✓"); }); } catch (e) {} } }, text: L("Share","شارك")})
    ]),
    list.length > 1 ? h("nav", {class: "pnext", "aria-label": L("More projects","مشاريع تانية")}, [
      h("a", {href: "#p-" + prev.id}, [h("span", {class: "lbl2", text: L("← Previous","→ السابق")}), h("b", {text: t(prev.title)})]),
      h("a", {href: "#p-" + next.id, class: "nx"}, [h("span", {class: "lbl2", text: L("Next →","التالي ←")}), h("b", {text: t(next.title)})])
    ]) : null
  ])]);
}

function renderTestimonials(){
  var items = (STATE.testimonials || []).filter(function(x){ return x.show && t(x.quote); });
  if (!items.length) return null;
  return h("section", {class: "sec", id: "testimonials"}, [h("div", {class: "wrap"}, [
    secHead("testimonials", L("What people say","قالوا عني")),
    h("div", {class: "tsm"}, items.map(function(x){
      return h("figure", {class: "tq"}, [
        h("div", {class: "qmark", "aria-hidden": "true", text: "“"}),
        h("blockquote", {dir: "auto", text: t(x.quote)}),
        h("figcaption", {}, [x.photo && img(x.photo) ? h("img", {src: img(x.photo), alt: ""}) : x.photoUrl ? h("img", {src: x.photoUrl, alt: "", referrerpolicy: "no-referrer"}) : h("span", {class: "av", text: (x.name || "?").charAt(0)}), h("div", {style: "min-width:0"}, [h("b", {text: x.name || ""}), h("small", {text: t(x.role)})]), x.link ? h("a", {class: "ib", href: x.link, target: "_blank", rel: "noopener", "aria-label": L("Source","المصدر"), text: "↗"}) : null])
      ]);
    }))
  ])]);
}

function renderServices(){
  var wa = STATE.accounts.filter(function(a){ return a.id === "whatsapp" && a.show; })[0];
  return h("section", {class: "sec", id: "services"}, [h("div", {class: "wrap"}, [
    secHead("services", L("What I can build for you","اللي أقدر أعمله لك"), L("Every project is priced on its scope. Send the details and get a clear quote.","كل مشروع بيتسعّر حسب حجمه. ابعت التفاصيل وهيوصلك عرض واضح.")),
    h("div", {class: "svc"}, STATE.services.filter(function(s){ return s.show; }).map(function(s){
      return h("div", {class: "it"}, [h("span", {class: "ic", html: SVC_ICONS[s.icon] || SVC_ICONS.grid}), h("h3", {text: t(s.title)}), h("p", {text: t(s.text)})]);
    })),
    h("div", {class: "svc-cta"}, [h("span", {text: L("Also on Mostaql and Khamsat for freelance work.","وموجود كمان على مستقل وخمسات للشغل الحر.")}), STATE.settings.sections.contact ? h("a", {class: "btn primary", href: "#contact", text: L("Contact me","تواصل معايا")}) : null])
  ])]);
}

function renderSkills(){
  return h("section", {class: "sec", id: "skills"}, [h("div", {class: "wrap"}, [
    secHead("skills", L("What I'm good at","المهارات")),
    h("div", {class: "skills"}, STATE.skills.filter(function(s){ return s.show; }).map(function(s){
      return h("div", {class: "skg"}, [h("h3", {text: t(s.group)}), h("ul", {}, s.items.map(function(i){ return h("li", {text: i}); }))]);
    }))
  ])]);
}

function renderTools(){
  var groups = STATE.toolGroups.map(function(g){
    var items = STATE.tools.filter(function(x){ return x.show && x.group === g.id; });
    if (!items.length) return null;
    return h("div", {class: "tgroup"}, [h("h3", {text: g[lang] || g.en}), h("div", {class: "tgrid"}, items.map(function(x){
      var lv = h("div", {class: "lvl", "aria-label": L("Level ","المستوى ") + x.level + "/5"}); for (var i=1;i<=5;i++) lv.appendChild(h("i", {class: i <= x.level ? "on" : ""}));
      return h("div", {class: "tool"}, [toolIcon(x), h("div", {style: "min-width:0"}, [h("div", {class: "nm", text: toolName(x)}), lv])]);
    }))]);
  });
  return h("section", {class: "sec", id: "tools"}, [h("div", {class: "wrap"}, [
    secHead("tools", L("Tools I use every day","البرامج اللي بستخدمها"), L("The bars show how deeply I use each one, from 1 to 5.","المؤشرات بتوضّح مستوى استخدامي لكل برنامج من 1 لـ 5.")),
    h("div", {class: "tgroups"}, groups)
  ])]);
}

function renderExperience(){
  return h("section", {class: "sec", id: "experience"}, [h("div", {class: "wrap"}, [
    secHead("experience", L("Where I work","الشغل والدراسة")),
    h("div", {class: "tl"}, STATE.experience.filter(function(e){ return e.show; }).map(function(e){
      var hasLogo = STATE.settings.showCompanyLogos && e.logo && img(e.logo);
      var lg = hasLogo ? h("div", {class: "lg" + (e.logo === "logo_hudera" ? " fill" : "")}, [h("img", {src: img(e.logo), alt: e.org + " logo"})]) : h("div", {class: "lg none", text: e.org.charAt(0)});
      return h("div", {class: "ex"}, [lg, h("div", {style: "min-width:0"}, [
        h("div", {}, [h("span", {class: "org", text: e.org}), h("span", {class: "when", text: t(e.when)})]),
        h("h3", {text: t(e.role)}), h("p", {text: t(e.text)})
      ])]);
    }))
  ])]);
}

function renderContact(){
  var accs = STATE.accounts.filter(function(a){ return a.show; });
  var wa = accs.filter(function(a){ return a.id === "whatsapp"; })[0];
  var grid = h("div", {class: "accs"}, accs.map(function(a){
    var ic = tile(a, "lg");
    var sub = a.handle || a.text || (a.url || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    var inner = [ic, h("div", {style: "min-width:0"}, [h("b", {text: a.label}), h("small", {text: sub, dir: "ltr"})])];
    if (a.url) return h("a", {class: "acc", href: a.url, target: "_blank", rel: "noopener", onclick: function(){ track(a.id === "whatsapp" ? "whatsapp" : "contact", a.id); }}, inner);
    var div = h("div", {class: "acc"}, inner.concat([h("button", {class: "ib", "aria-label": L("Copy","نسخ"), title: L("Copy","نسخ"), onclick: function(ev){ copyText(a.text, ev.currentTarget); }, text: "⧉"})]));
    return div;
  }));
  return h("section", {class: "sec", id: "contact"}, [h("div", {class: "wrap"}, [
    secHead("contact", L("Let's talk","يلا نتكلم"), L("The fastest way to reach me is WhatsApp.","أسرع طريقة توصلّي بيها هي الواتساب.")),
    grid,
    MODE === "supabase" ? contactForm() : null,
    cvOn() ? h("div", {class: "cvband"}, [h("div", {}, [h("b", {text: L("My CV","الـ CV بتاعي")}), h("span", {class: "lbl2", text: L("PDF, ready to share with your team.","ملف PDF جاهز تبعته لفريقك.")})]), h("button", {class: "btn primary", type: "button", onclick: function(){ cvChooser("contact"); }, text: L("Download CV (PDF)","حمّل الـ CV (PDF)")})]) : null
  ])]);
}
function contactForm(){
  var meta = SB_USER ? (SB_USER.user_metadata || {}) : {};
  var f = h("form", {class: "cform", novalidate: true}, []);
  function fld(id, label, el){ el.id = id; return h("label", {class: "cfl", for: id}, [h("span", {class: "lbl2", text: label}), el]); }
  var nm = h("input", {type: "text", maxlength: "120", autocomplete: "name", required: true, value: meta.full_name || meta.name || ""});
  var ct = h("input", {type: "text", maxlength: "160", autocomplete: "email", dir: "ltr", required: true, placeholder: L("Email or WhatsApp number","الإيميل أو رقم الواتساب"), value: SB_USER ? (SB_USER.email || "") : ""});
  var bd = h("select", {}, [["", L("Not sure yet","لسه مش محدد")], ["< $500", "< $500"], ["$500 – $2,000", "$500 – $2,000"], ["$2,000 – $5,000", "$2,000 – $5,000"], ["> $5,000", "> $5,000"]].map(function(o){ return h("option", {value: o[0], text: o[1]}); }));
  var ms = h("textarea", {rows: "4", maxlength: "2000", dir: "auto", required: true, placeholder: L("What do you need? A short description is enough.","محتاج إيه؟ وصف بسيط كفاية.")}, []);
  var st = h("p", {class: "cfst", role: "status", "aria-live": "polite"});
  var bt = h("button", {class: "btn primary", type: "submit", text: L("Send request","ابعت الطلب")});
  f.appendChild(h("div", {class: "cfhead"}, [h("b", {text: L("Or send me your request","أو ابعتلي طلبك")}), h("span", {class: "lbl2", text: L("It reaches me directly by email.","بيوصلّي على الإيميل على طول.")})]));
  f.appendChild(h("div", {class: "cfgrid"}, [fld("cf-name", L("Your name","اسمك"), nm), fld("cf-contact", L("Email or WhatsApp","الإيميل أو الواتساب"), ct), fld("cf-budget", L("Budget (optional)","الميزانية (اختياري)"), bd)]));
  f.appendChild(fld("cf-msg", L("Message","رسالتك"), ms));
  f.appendChild(h("div", {class: "cfbar"}, [st, bt]));
  function fail(msg){ bt.disabled = false; bt.textContent = L("Send request","ابعت الطلب"); st.className = "cfst err"; st.textContent = msg; }
  f.addEventListener("submit", function(e){
    e.preventDefault();
    var c = ct.value.trim(), okC = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) || c.replace(/[^\d]/g, "").length >= 8;
    if (!nm.value.trim() || !ms.value.trim() || !okC) { st.className = "cfst err"; st.textContent = L("Add your name, a valid email or phone number, and a message.","اكتب اسمك، وإيميل أو رقم صحيح، ورسالتك."); return; }
    bt.disabled = true; bt.textContent = L("Sending…","بيتبعت…"); st.className = "cfst"; st.textContent = "";
    SB.functions.invoke(SB_CFG.shekoFunction, {body: {action: "lead", name: nm.value.trim(), contact: c, budget: bd.value, message: ms.value.trim(), lang: lang, visitor: VISITOR.slice(0, 24)}}).then(function(r){
      var d = (r && r.data) || {};
      if (d.ok) { track("contact", "form"); f.replaceWith(h("div", {class: "cform done", role: "status"}, [h("b", {text: L("Thanks! Your request reached me.","شكراً! طلبك وصلني.")}), h("span", {class: "lbl2", text: L("I'll get back to you soon.","هرد عليك قريب.")})])); return; }
      fail(d.error === "rate_limited" ? L("Too many requests. Try again later or use WhatsApp.","طلبات كتير. جرّب بعد شوية أو كلمني واتساب.") : L("Couldn't send. Try again or use WhatsApp.","ما اتبعتش. جرّب تاني أو كلمني واتساب."));
    }, function(){ fail(L("Couldn't send. Try again or use WhatsApp.","ما اتبعتش. جرّب تاني أو كلمني واتساب.")); });
  });
  return f;
}
function copyText(txt, btn){
  function ok(){ btn.textContent = "✓"; setTimeout(function(){ btn.textContent = "⧉"; }, 1400); }
  try { navigator.clipboard.writeText(txt).then(ok, fallback); } catch (e) { fallback(); }
  function fallback(){ var r = document.createRange(); var s = btn.parentNode.querySelector("small"); r.selectNodeContents(s); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
}
function renderFooter(){
  return h("footer", {}, [h("div", {class: "wrap"}, [h("span", {text: "© " + new Date().getFullYear() + " " + t(STATE.profile.name)}), h("span", {class: "mono", text: L("All rights reserved","جميع الحقوق محفوظة")})])]);
}

/* ---------- scroll + mouse effects ---------- */
var fxIO = null, fxBound = false;
function initFx(){
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  if (fxIO) { fxIO.disconnect(); fxIO = null; }
  if (!document.getElementById("fxbar")) { document.body.appendChild(h("div", {id: "fxbar", "aria-hidden": "true"})); document.body.appendChild(h("div", {id: "fxglow", "aria-hidden": "true"})); }
  if (!reduce && "IntersectionObserver" in window) {
    document.documentElement.classList.add("fx-on");
    var groups = [".sechead", ".about .txt", ".about .lead", ".filters", ".pcard", ".svc .it", ".svc-cta", ".skg", ".tgroup h3", ".tool", ".ex", ".acc", ".facts", ".stats", ".tq", ".pblock", ".pgal", ".cvband", ".pnext"];
    fxIO = new IntersectionObserver(function(entries){ entries.forEach(function(en){ if (en.isIntersecting) { en.target.classList.add("in"); fxIO.unobserve(en.target); } }); }, {rootMargin: "0px 0px -8% 0px", threshold: .12});
    groups.forEach(function(sel){
      var els = [].slice.call(document.querySelectorAll(sel));
      els.forEach(function(el, i){
        if (el.classList.contains("rv")) return;
        el.classList.add("rv"); el.style.setProperty("--d", Math.min(i % 6, 5) * 70 + "ms");
        var r = el.getBoundingClientRect(); if (r.top < innerHeight * .92 && r.bottom > 0) { el.classList.add("in"); } else fxIO.observe(el);
      });
    });
  }
  if (fine && !reduce) {
    [].slice.call(document.querySelectorAll(".pcard, .svc .it, .skg, .ex, .acc, .tool")).forEach(function(el){
      el.classList.add("tilt");
      el.addEventListener("pointermove", function(e){ var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.setProperty("--rx", (-y * 6).toFixed(2) + "deg"); el.style.setProperty("--ry", (x * 8).toFixed(2) + "deg"); el.style.setProperty("--mx", ((x + .5) * 100).toFixed(1) + "%"); el.style.setProperty("--my", ((y + .5) * 100).toFixed(1) + "%"); });
      el.addEventListener("pointerleave", function(){ el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
    });
    [].slice.call(document.querySelectorAll(".cta .btn, .svc-cta .btn")).forEach(function(b){
      b.addEventListener("pointermove", function(e){ var r = b.getBoundingClientRect(); b.style.transform = "translate(" + ((e.clientX - r.left - r.width / 2) * .18).toFixed(1) + "px," + ((e.clientY - r.top - r.height / 2) * .25).toFixed(1) + "px)"; });
      b.addEventListener("pointerleave", function(){ b.style.transform = ""; });
    });
  }
  if (!fxBound) {
    fxBound = true;
    var glow = document.getElementById("fxglow"), ticking = false;
    if (fine && !reduce) window.addEventListener("pointermove", function(e){ glow.style.transform = "translate(" + (e.clientX - 300) + "px," + (e.clientY - 300) + "px)"; glow.style.opacity = route === "site" ? 1 : 0; }, {passive: true});
    window.addEventListener("scroll", function(){
      if (ticking) return; ticking = true;
      requestAnimationFrame(function(){
        ticking = false;
        var max = document.documentElement.scrollHeight - innerHeight, y = window.scrollY;
        var bar = document.getElementById("fxbar"); if (bar) bar.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
        if (reduce || route !== "site") return;
        var st = document.querySelector(".hero2 .stage2"), cp = document.querySelector(".hero2 .hero-copy");
        var k = Math.min(1, y / (innerHeight * .9));
        if (st) { st.style.transform = "translateY(" + (y * .25).toFixed(1) + "px) scale(" + (1 - k * .12).toFixed(3) + ")"; st.style.opacity = (1 - k * .8).toFixed(3); }
        if (cp) cp.style.transform = "translateY(" + (y * .08).toFixed(1) + "px)";
        var nav = document.querySelector(".nav"); if (nav) nav.classList.toggle("scrolled", y > 20);
      });
    }, {passive: true});
  }
}

/* ---------- 3D hero scene ---------- */
var scene3 = null;
var orbitRaf = 0;
function use3d(){
  if (!STATE.settings.show3d) return false;
  if (window.innerWidth < 768) return false;
  var cn = navigator.connection; if (cn && (cn.saveData || /2g/.test(cn.effectiveType || ""))) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4 && IS_MOBILE) return false;
  return true;
}
function startOrbit(){
  cancelAnimationFrame(orbitRaf);
  var box = document.getElementById("orbit"); if (!box) return;
  var items = [].slice.call(box.children), n = items.length; if (!n) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var t0 = performance.now();
  function place(now){
    if (!document.body.contains(box)) return;
    var w = box.clientWidth, hh = box.clientHeight, el = (now - t0) / 1000;
    items.forEach(function(it, i){
      var ring = i % 2, sm = w < 520, rx = w * (sm ? (ring ? .5 : .46) : (ring ? .47 : .42)), ry = hh * (ring ? .07 : .06), cy = hh * (ring ? .78 : .66);
      var a = (i / n) * Math.PI * 2 + el * (ring ? -.22 : .3);
      var x = w / 2 + Math.cos(a) * rx, y = cy + Math.sin(a) * ry, front = Math.sin(a) > 0;
      var sc = .72 + (Math.sin(a) + 1) * .2;
      it.style.transform = "translate(" + (x - 23) + "px," + (y - 23) + "px) scale(" + sc.toFixed(3) + ")";
      it.style.zIndex = front ? 6 : 2; it.style.opacity = 1; it.style.filter = "none";
    });
    if (!reduce) orbitRaf = requestAnimationFrame(place);
  }
  place(t0 + 1500);
}
function startScene(){
  if (scene3) { scene3.stop(); scene3 = null; }
  startOrbit();
  var cv = document.getElementById("scene");
  if (!cv) return;
  if (!window.THREE) { loadThree(); return; }
  try { scene3 = cv.closest(".stage2") ? buildNeural(cv) : buildScene(cv); } catch (e) { cv.remove(); }
}
var threeLoading = false;
function loadThree(){
  if (threeLoading) return; threeLoading = true;
  var go3 = function(){ var sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"; sc.async = true; sc.onload = function(){ if (document.getElementById("scene")) startScene(); }; document.head.appendChild(sc); };
  if (document.readyState === "complete") setTimeout(go3, 200); else window.addEventListener("load", function(){ setTimeout(go3, 200); });
}
function panelTexture(kind){
  var c = document.createElement("canvas"); c.width = 512; c.height = 320; var x = c.getContext("2d");
  x.fillStyle = "rgba(14,24,48,0.92)"; roundRect(x, 4, 4, 504, 312, 22); x.fill();
  x.strokeStyle = "rgba(141,178,255,0.55)"; x.lineWidth = 3; x.stroke();
  x.fillStyle = "rgba(141,178,255,.5)"; roundRect(x, 28, 26, 150, 14, 7); x.fill();
  if (kind === 0) { var hs = [90,140,110,180,150,210,190,240]; hs.forEach(function(v,i){ x.fillStyle = i===7 ? "#E2A85B" : "#4C86FF"; roundRect(x, 40 + i*56, 290 - v, 34, v, 6); x.fill(); }); }
  else if (kind === 1) { for (var r=0;r<5;r++){ var y = 70 + r*46; x.fillStyle = "rgba(141,178,255,.18)"; roundRect(x, 30, y, 290, 26, 8); x.fill(); x.fillStyle = ["#1FC79A","#E2A85B","#4C86FF","#1FC79A","#4C86FF"][r]; roundRect(x, 340, y, 130, 26, 13); x.fill(); } }
  else { x.strokeStyle = "#1FC79A"; x.lineWidth = 6; x.beginPath(); [250,230,240,190,200,150,160,110,90].forEach(function(v,i){ var px = 40 + i*54; i ? x.lineTo(px, v) : x.moveTo(px, v); }); x.stroke(); x.fillStyle = "#E7ECF5"; x.font = "700 56px Manrope, sans-serif"; x.fillText("98%", 330, 120); }
  var tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; return tex;
}
function buildNeural(cv){
  var stage = cv.parentNode;
  var renderer = new THREE.WebGLRenderer({canvas: cv, antialias: true, alpha: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  var scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, .1, 100); cam.position.set(0, 0, 9.5);
  var g = new THREE.Group(); scene.add(g);
  // points on a sphere (fibonacci)
  var N = 160, R = 3.1, pts = [];
  for (var i = 0; i < N; i++) { var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996; pts.push(new THREE.Vector3(Math.cos(th) * r * R, y * R, Math.sin(th) * r * R)); }
  var pg = new THREE.BufferGeometry().setFromPoints(pts);
  g.add(new THREE.Points(pg, new THREE.PointsMaterial({color: 0x8DB2FF, size: .07, transparent: true, opacity: .95})));
  // connections between near neighbours
  var seg = [];
  for (var a = 0; a < N; a++) for (var b = a + 1; b < N; b++) { if (pts[a].distanceTo(pts[b]) < .82) seg.push(pts[a], pts[b]); }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), new THREE.LineBasicMaterial({color: 0x4C86FF, transparent: true, opacity: .28})));
  // inner icosahedron core + gold equator ring
  var core = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.5, 1)), new THREE.LineBasicMaterial({color: 0xE2A85B, transparent: true, opacity: .55})); g.add(core);
  var ringGeo = new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, 4.1, 4.1, 0, Math.PI * 2).getPoints(160).map(function(p){ return new THREE.Vector3(p.x, 0, p.y); }));
  var ring = new THREE.Line(ringGeo, new THREE.LineBasicMaterial({color: 0x1FC79A, transparent: true, opacity: .5})); ring.rotation.x = .35; scene.add(ring);
  // travelling pulses along random connections
  var PC = 24, ppos = new Float32Array(PC * 3), pulses = [];
  for (var k = 0; k < PC; k++) { var si = Math.floor(Math.random() * (seg.length / 2)) * 2; pulses.push({a: seg[si], b: seg[si + 1], t: Math.random()}); }
  var pp = new THREE.BufferGeometry(); pp.setAttribute("position", new THREE.BufferAttribute(ppos, 3));
  g.add(new THREE.Points(pp, new THREE.PointsMaterial({color: 0xE2A85B, size: .14, transparent: true, opacity: .95})));
  var running = true, visible = true, raf = 0, t0 = performance.now(), mx = 0, my = 0;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function size(){ var r = cv.getBoundingClientRect(); var w = Math.max(1, r.width), hh = Math.max(1, r.height); renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); }
  function onMove(e){ var r = stage.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5; }
  window.addEventListener("resize", size); stage.addEventListener("pointermove", onMove);
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function(en){ visible = en[0].isIntersecting; if (visible && running && !raf) loop(); }) : null; if (io) io.observe(cv);
  size();
  function frame(now){
    var el = (now - t0) / 1000;
    g.rotation.y = el * .12 + mx * .4; g.rotation.x = .25 + my * .25; core.rotation.y = -el * .3; core.rotation.x = el * .15;
    ring.rotation.z = el * .05;
    for (var k = 0; k < PC; k++) { var q = pulses[k]; q.t += .006; if (q.t > 1) { q.t = 0; var si = Math.floor(Math.random() * (seg.length / 2)) * 2; q.a = seg[si]; q.b = seg[si + 1]; } ppos[k*3] = q.a.x + (q.b.x - q.a.x) * q.t; ppos[k*3+1] = q.a.y + (q.b.y - q.a.y) * q.t; ppos[k*3+2] = q.a.z + (q.b.z - q.a.z) * q.t; }
    pp.attributes.position.needsUpdate = true;
    renderer.render(scene, cam);
  }
  function loop(){ raf = 0; if (!running || !visible) return; frame(performance.now()); if (!reduce) raf = requestAnimationFrame(loop); }
  loop(); if (reduce) setTimeout(function(){ frame(performance.now()); }, 50);
  return {stop: function(){ running = false; cancelAnimationFrame(raf); window.removeEventListener("resize", size); if (io) io.disconnect(); renderer.dispose(); }};
}
function buildScene(cv){
  var stage = cv.parentNode;
  var renderer = new THREE.WebGLRenderer({canvas: cv, antialias: true, alpha: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  var group = new THREE.Group(); scene.add(group); var rtl = document.documentElement.dir === "rtl"; group.position.x = rtl ? 1.6 : -1.9;
  var blue = new THREE.LineBasicMaterial({color: 0x4C86FF, transparent: true, opacity: .55});
  var blueDim = new THREE.LineBasicMaterial({color: 0x4C86FF, transparent: true, opacity: .2});
  var gold = new THREE.LineBasicMaterial({color: 0xE2A85B, transparent: true, opacity: .9});
  // ground grid
  var grid = new THREE.GridHelper(14, 28, 0x2F4675, 0x1A2A4C); grid.material.transparent = true; grid.material.opacity = .5; group.add(grid);
  // building: floors appear over time
  var floors = [], FW = 2.6, FD = 1.8, FH = .42, N = 9;
  for (var i = 0; i < N; i++) {
    var geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(FW, FH, FD));
    var mat = i === N - 1 ? gold : (i > N - 3 ? blueDim : blue);
    var m = new THREE.LineSegments(geo, mat.clone()); m.position.set(-1.1, FH / 2 + i * FH, 0); m.material.opacity = 0; group.add(m); floors.push(m);
  }
  // columns
  var colPts = [];
  [[-1,-1],[1,-1],[-1,1],[1,1],[0,-1],[0,1]].forEach(function(p){ colPts.push(new THREE.Vector3(-1.1 + p[0]*FW/2, 0, p[1]*FD/2), new THREE.Vector3(-1.1 + p[0]*FW/2, FH * (N - 2), p[1]*FD/2)); });
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(colPts), blueDim));
  // crane
  var cr = [new THREE.Vector3(.7,0,-.6), new THREE.Vector3(.7,4.6,-.6), new THREE.Vector3(-2.8,4.6,-.6), new THREE.Vector3(1.6,4.6,-.6), new THREE.Vector3(.7,5.1,-.6), new THREE.Vector3(-2.8,4.6,-.6), new THREE.Vector3(.7,5.1,-.6), new THREE.Vector3(1.6,4.6,-.6)];
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cr), blue));
  var hookGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.9,4.6,-.6), new THREE.Vector3(-1.9,3.9,-.6)]);
  var hook = new THREE.Line(hookGeo, gold); group.add(hook);
  // floating panels
  var panels = [];
  [[1.9, 2.9, .6, 0], [2.5, 1.5, -.4, 1], [-2.9, 2.3, .9, 2]].forEach(function(p, k){
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({map: panelTexture(p[3]), transparent: true, side: THREE.DoubleSide, depthWrite: false}));
    mesh.position.set(p[0], p[1], p[2]); mesh.rotation.y = -0.35 + k * 0.25; mesh.userData = {y: p[1], ph: k * 1.7}; group.add(mesh); panels.push(mesh);
  });
  // data particles rising from building
  var PC = 140, pos = new Float32Array(PC * 3), spd = [];
  for (var j = 0; j < PC; j++) { pos[j*3] = -1.1 + (Math.random() - .5) * 2.4; pos[j*3+1] = Math.random() * 5; pos[j*3+2] = (Math.random() - .5) * 1.6; spd.push(.004 + Math.random() * .01); }
  var pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  var pts = new THREE.Points(pg, new THREE.PointsMaterial({color: 0x8DB2FF, size: .045, transparent: true, opacity: .8})); group.add(pts);

  var mx = 0, my = 0, running = true, visible = true, t0 = performance.now(), raf = 0;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function size(){ var r = cv.getBoundingClientRect(); var w = Math.max(1, r.width), hh = Math.max(1, r.height); renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); }
  function onMove(e){ var r = stage.getBoundingClientRect(); mx = ((e.clientX - r.left) / r.width - .5); my = ((e.clientY - r.top) / r.height - .5); }
  window.addEventListener("resize", size); stage.addEventListener("pointermove", onMove);
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function(en){ visible = en[0].isIntersecting; if (visible && running && !raf) loop(); }) : null; if (io) io.observe(cv);
  size();
  function frame(now){
    var el = (now - t0) / 1000;
    floors.forEach(function(f, i){ var target = (i === N - 1 ? .9 : i > N - 3 ? .25 : .55); var k = Math.min(1, Math.max(0, (el - i * .18) / .6)); f.material.opacity = target * (reduce ? 1 : k); });
    panels.forEach(function(p){ p.position.y = p.userData.y + Math.sin(el * .9 + p.userData.ph) * .08; });
    if (!reduce) { for (var j = 0; j < PC; j++) { pos[j*3+1] += spd[j]; if (pos[j*3+1] > 5.2) pos[j*3+1] = 0; } pg.attributes.position.needsUpdate = true; }
    var ang = reduce ? .5 : .5 + Math.sin(el * .12) * .25 + mx * .35;
    cam.position.set(Math.sin(ang) * 10.5, 3.4 - my * 1.2, Math.cos(ang) * 10.5); cam.lookAt(0, 2.3, 0);
    hook.position.x = reduce ? 0 : Math.sin(el * .5) * .4;
    renderer.render(scene, cam);
  }
  function loop(){ raf = 0; if (!running || !visible) return; frame(performance.now()); if (!reduce) raf = requestAnimationFrame(loop); }
  loop(); if (reduce) setTimeout(function(){ frame(performance.now() + 5000); }, 50);
  return {stop: function(){ running = false; cancelAnimationFrame(raf); window.removeEventListener("resize", size); if (io) io.disconnect(); renderer.dispose(); }};
}

/* ---------- admin dashboard ---------- */
function markDirty(){ dirty = true; var m = document.getElementById("admmsg"); if (m) { m.className = "dstatus warn"; m.textContent = L("Unsaved changes","فيه تعديلات لسه ما اتحفظتش"); } }
function sw(checked, onchange, label){
  var inp = h("input", {type: "checkbox", "aria-label": label || ""}); inp.checked = !!checked;
  inp.addEventListener("change", function(){ onchange(inp.checked); markDirty(); rerenderKeepAdmin(); });
  return h("label", {class: "sw", title: label || ""}, [inp, h("span")]);
}
function rerenderKeepAdmin(){ var st = window.scrollY; render(); window.scrollTo(0, st); }
function txt(obj, key, opts){
  opts = opts || {};
  var el = h(opts.area ? "textarea" : "input", {type: opts.area ? null : (opts.type || "text"), dir: opts.dir || null, placeholder: opts.ph || null});
  el.value = obj[key] == null ? "" : obj[key];
  el.addEventListener("input", function(){ obj[key] = opts.type === "number" ? Number(el.value) : el.value; markDirty(); });
  el.addEventListener("change", function(){ rerenderKeepAdmin(); });
  return el;
}
function bi(obj, key, area, label){
  if (!obj[key] || typeof obj[key] !== "object") obj[key] = {en: obj[key] || "", ar: ""};
  return h("div", {}, [label ? h("div", {class: "lbl2", text: label}) : null, h("div", {class: "pair"}, [txt(obj[key], "en", {area: area, ph: "English"}), txt(obj[key], "ar", {area: area, dir: "rtl", ph: "عربي"})])]);
}
function move(arr, i, d){ var j = i + d; if (j < 0 || j >= arr.length) return; var x = arr[i]; arr[i] = arr[j]; arr[j] = x; markDirty(); rerenderKeepAdmin(); }
function itemRow(arr, i, title, isOn, setOn, editor, opts){
  opts = opts || {};
  var item = arr[i], key = (opts.kind || "") + (item.id || i);
  var top = h("div", {class: "top"}, [
    setOn ? sw(isOn, setOn, L("Show","إظهار")) : null,
    opts.icon ? tile(opts.icon, "sm") : null,
    opts.thumb && img(opts.thumb) ? h("img", {class: "mini", src: img(opts.thumb), alt: ""}) : null,
    h("b", {text: title}),
    h("button", {class: "ib", "aria-label": L("Move up","لفوق"), onclick: function(){ move(arr, i, -1); }, text: "↑"}),
    h("button", {class: "ib", "aria-label": L("Move down","لتحت"), onclick: function(){ move(arr, i, 1); }, text: "↓"}),
    editor ? h("button", {class: "ib", "aria-label": L("Edit","تعديل"), onclick: function(){ openEd[key] = !openEd[key]; rerenderKeepAdmin(); }, text: "✎"}) : null,
    opts.del ? h("button", {class: "ib", "aria-label": L("Delete","حذف"), onclick: function(){ if (openEd["del" + key]) { arr.splice(i, 1); markDirty(); rerenderKeepAdmin(); } else { openEd["del" + key] = true; rerenderKeepAdmin(); } }, text: openEd["del" + key] ? "✓?" : "🗑"}) : null
  ]);
  return h("div", {class: "ai" + (setOn && !isOn ? " off" : "")}, [top, editor && openEd[key] ? h("div", {class: "ed"}, editor()) : null]);
}
function imagePicker(currentKey, onSet, label){
  var inp = h("input", {type: "file", accept: "image/*", style: "display:none"});
  inp.addEventListener("change", function(){
    var f = inp.files && inp.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function(){
      var im = new Image();
      im.onload = function(){
        var max = 1400, sc = Math.min(1, max / Math.max(im.width, im.height));
        var c = document.createElement("canvas"); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        var data = c.toDataURL("image/webp", .8); if (data.indexOf("image/webp") < 0) data = c.toDataURL("image/jpeg", .82);
        var k = "u_" + Date.now().toString(36);
        if (SB) { c.toBlob(function(blob){ sbUpload(k, blob).then(function(url){ IMG[k] = url; onSet(k); markDirty(); rerenderKeepAdmin(); }, function(){ setMsg(L("Image upload failed. Try again.","رفع الصورة فشل. جرّب تاني."), "err"); }); }, "image/webp", .82); return; }
        IMG[k] = data; onSet(k); markDirty(); rerenderKeepAdmin();
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(f);
  });
  return h("div", {}, [label ? h("div", {class: "lbl2", text: label}) : null,
    currentKey && img(currentKey) ? h("img", {class: "thumb", src: img(currentKey), alt: ""}) : null,
    h("div", {style: "display:flex;gap:8px;margin-top:6px"}, [h("button", {class: "btn sm", onclick: function(){ inp.click(); }, text: L("Upload image","ارفع صورة")}), currentKey ? h("button", {class: "btn sm ghost", onclick: function(){ onSet(""); markDirty(); rerenderKeepAdmin(); }, text: L("Remove","شيل")}) : null]), inp]);
}
function tags(obj, key, label){
  var el = h("input", {type: "text", placeholder: "React, Supabase, Excel"}); el.value = (obj[key] || []).join(", ");
  el.addEventListener("input", function(){ obj[key] = el.value.split(",").map(function(s){ return s.trim(); }).filter(Boolean); markDirty(); });
  el.addEventListener("change", rerenderKeepAdmin);
  return h("div", {}, [h("div", {class: "lbl2", text: label}), el]);
}
function uid(p){ return p + Date.now().toString(36); }

function pdfPicker(onSet){
  if (!SB) return null;
  var inp = h("input", {type: "file", accept: "application/pdf", style: "display:none"});
  var b = h("button", {class: "btn sm primary", type: "button", onclick: function(){ inp.click(); }, text: L("Upload new PDF","ارفع PDF جديد")});
  inp.addEventListener("change", function(){
    var f = inp.files && inp.files[0]; if (!f) return;
    if (f.type !== "application/pdf" || f.size > 8 * 1024 * 1024) { setMsg(L("Choose a PDF under 8 MB.","اختار ملف PDF أقل من 8 ميجا."), "err"); return; }
    b.textContent = L("Uploading…","جاري الرفع…");
    var path = "files/cv-" + Date.now().toString(36) + ".pdf";
    SB.storage.from("media").upload(path, f, {contentType: "application/pdf", upsert: true}).then(function(r){
      if (r.error) throw r.error; onSet(SB.storage.from("media").getPublicUrl(path).data.publicUrl); markDirty(); rerenderKeepAdmin(); setMsg(L("CV uploaded. Press Save & publish.","الـ CV اترفع. دوس احفظ وانشر."), "warn");
    }).catch(function(){ b.textContent = L("Upload new PDF","ارفع PDF جديد"); setMsg(L("Upload failed. Try again.","الرفع فشل. جرّب تاني."), "err"); });
  });
  return h("span", {}, [b, inp]);
}
function galleryEditor(p){
  if (!Array.isArray(p.gallery)) p.gallery = [];
  var row = h("div", {class: "gal-ed"}, p.gallery.map(function(k, i){
    return h("div", {class: "gi"}, [img(k) ? h("img", {src: img(k), alt: ""}) : h("span", {text: "?"}), h("button", {class: "ib", type: "button", "aria-label": L("Remove","شيل"), onclick: function(){ p.gallery.splice(i, 1); markDirty(); rerenderKeepAdmin(); }, text: "✕"})]);
  }));
  return h("div", {}, [h("div", {class: "lbl2", text: L("Extra screenshots for the project page","صور إضافية لصفحة المشروع") + " (" + p.gallery.length + ")"}), row, imagePicker("", function(k){ if (k) p.gallery.push(k); }, null)]);
}
function onlineList(){
  var v = PEERS.filter(function(x){ return !x.isMe && x.kind === "viewer"; });
  var box = h("div", {id: "liveonline", class: "online"});
  if (!v.length) { box.appendChild(h("p", {class: "lbl2", text: L("Nobody else has the site open right now.","مفيش حد تاني فاتح الموقع دلوقتي.")})); return box; }
  v.forEach(function(x){ box.appendChild(h("div", {class: "on-row"}, [h("i", {class: "dot"}), h("b", {text: x.to || L("Visitor","زائر")}), h("span", {class: "lbl2", text: (x.mobile ? L("Mobile","موبايل") : L("Desktop","كمبيوتر")) + " · " + (x.page === "site" || !x.page ? L("Home","الرئيسية") : x.page)}), x.to ? h("button", {class: "btn sm", type: "button", onclick: function(){ liveDraft.target = x.to; var el = document.getElementById("livetarget"); if (el) { el.value = x.to; el.focus(); } }, text: L("Message them","ابعتله")}) : null]));
  });
  return box;
}
var anRange = 30, anCache = {};
function renderAnalytics(){
  var wrap = h("div", {class: "an"});
  if (!SB) { wrap.appendChild(card(L("Analytics","الإحصائيات"), L("Analytics works on the live site.","الإحصائيات شغالة على الموقع الأساسي."))); return wrap; }
  var sel = h("select", {"aria-label": L("Period","الفترة")}, [[1, L("Today","النهاردة")], [7, L("Last 7 days","آخر 7 أيام")], [30, L("Last 30 days","آخر 30 يوم")], [90, L("Last 90 days","آخر 90 يوم")]].map(function(o){ return h("option", {value: String(o[0]), text: o[1]}); })); sel.value = String(anRange);
  sel.addEventListener("change", function(){ anRange = Number(sel.value); rerenderKeepAdmin(); });
  var refresh = h("button", {class: "btn sm", type: "button", onclick: function(){ delete anCache[anRange]; rerenderKeepAdmin(); }, text: L("Refresh","تحديث")});
  wrap.appendChild(h("div", {class: "dhead"}, [h("div", {}, [h("h2", {class: "display", text: L("Analytics","الإحصائيات")}), h("p", {class: "lbl2", text: L("Visits and clicks from real visitors. Your own visits are not counted.","زيارات وضغطات الزوار الحقيقيين. زياراتك إنت مش بتتحسب.")})]), h("div", {class: "dlinks"}, [sel, refresh])]));
  var body = h("div", {}, [h("p", {class: "lbl2", text: L("Loading…","جاري التحميل…")})]); wrap.appendChild(body);
  function draw(rows){
    body.innerHTML = "";
    var views = rows.filter(function(r){ return r.type === "view"; });
    var uniq = {}; rows.forEach(function(r){ if (r.visitor) uniq[r.visitor] = 1; });
    function cnt(type){ return rows.filter(function(r){ return r.type === type; }).length; }
    body.appendChild(h("div", {class: "dstats"}, [[L("Visits","زيارات"), views.length], [L("Unique visitors","زوار مختلفين"), Object.keys(uniq).length], [L("CV downloads","تحميل CV"), cnt("cv")], [L("WhatsApp clicks","ضغطات واتساب"), cnt("whatsapp")], [L("Demo opens","فتح الديمو"), cnt("demo")], [L("Sheko questions","أسئلة شيكو"), cnt("sheko")]].map(function(x){ return h("div", {class: "dstat"}, [h("span", {class: "lbl2", text: x[0]}), h("b", {text: String(x[1])})]); })));
    if (!rows.length) { body.appendChild(card(null, L("No data for this period yet. Share your link and check back.","لسه مفيش بيانات في الفترة دي. انشر اللينك وارجع تاني."))); return; }
    var days = anRange === 1 ? 1 : anRange, byDay = {}, keys = [];
    for (var d = days - 1; d >= 0; d--) { var dt = new Date(Date.now() - d * 864e5); var k = dt.toISOString().slice(0, 10); keys.push(k); byDay[k] = 0; }
    views.forEach(function(r){ var k = String(r.created_at).slice(0, 10); if (k in byDay) byDay[k]++; });
    var mx = Math.max.apply(null, keys.map(function(k){ return byDay[k]; }).concat([1]));
    if (days > 1) body.appendChild(card(L("Visits per day","الزيارات في اليوم"), null, [h("div", {class: "chart"}, keys.map(function(k){ return h("div", {class: "col", title: k + ": " + byDay[k]}, [h("span", {class: "v", text: byDay[k] ? String(byDay[k]) : ""}), h("i", {style: "height:" + Math.max(2, byDay[k] / mx * 100) + "%"}), h("small", {text: k.slice(8)})]); }))]));
    function top(arr, keyFn, nameFn, n){
      var m = {}; arr.forEach(function(r){ var k = keyFn(r); if (k) m[k] = (m[k] || 0) + 1; });
      var ks = Object.keys(m).sort(function(a, b){ return m[b] - m[a]; }).slice(0, n || 8); var mm = ks.length ? m[ks[0]] : 1;
      if (!ks.length) return h("p", {class: "lbl2", text: L("Nothing yet.","لسه مفيش.")});
      return h("div", {class: "bars"}, ks.map(function(k){ return h("div", {class: "bar"}, [h("span", {class: "nm", text: nameFn ? nameFn(k) : k}), h("span", {class: "tr"}, [h("i", {style: "width:" + (m[k] / mm * 100) + "%"})]), h("b", {text: String(m[k])})]); }));
    }
    var pname = function(id){ var p = STATE.projects.filter(function(x){ return x.id === id; })[0]; return p ? t(p.title) : id; };
    body.appendChild(h("div", {class: "dgrid2"}, [
      card(L("Where visitors come from","الزوار جايين منين"), null, [top(views, function(r){ return r.ref || "direct"; }, function(k){ return k === "direct" ? L("Direct / app","مباشر / تطبيق") : k; })]),
      card(L("Most opened projects","أكتر مشاريع اتفتحت"), null, [top(rows.filter(function(r){ return r.type === "project"; }), function(r){ return r.item; }, pname)]),
      card(L("Demos tried","الديموهات اللي اتجربت"), null, [top(rows.filter(function(r){ return r.type === "demo"; }), function(r){ return r.item; }, pname)]),
      card(L("Devices & language","الأجهزة واللغة"), null, [top(views, function(r){ return r.device; }, function(k){ return k === "mobile" ? L("Mobile","موبايل") : L("Desktop","كمبيوتر"); }), top(views, function(r){ return r.lang; }, function(k){ return k === "ar" ? "عربي" : "English"; })])
    ]));
    var tg = rows.filter(function(r){ return r.target; });
    if (tg.length) {
      var last = {}; tg.forEach(function(r){ if (!last[r.target] || r.created_at > last[r.target].created_at) last[r.target] = r; });
      body.appendChild(card(L("Personal links","اللينكات الشخصية"), null, [h("div", {class: "bars"}, Object.keys(last).map(function(k){ var n = tg.filter(function(r){ return r.target === k && r.type === "view"; }).length; return h("div", {class: "bar"}, [h("span", {class: "nm", text: k}), h("span", {class: "lbl2", text: L("last seen ","آخر ظهور ") + new Date(last[k].created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB")}), h("b", {text: String(n)})]); }))]));
    }
    var TN = {view: L("Visit","زيارة"), project: L("Opened project","فتح مشروع"), demo: L("Tried demo","جرّب ديمو"), repo: L("Opened GitHub","فتح GitHub"), whatsapp: L("WhatsApp click","ضغط واتساب"), cv: L("Downloaded CV","نزّل الـ CV"), sheko: L("Asked Sheko","سأل شيكو"), video: L("Watched video","شاف الفيديو"), contact: L("Opened account","فتح أكونت")};
    body.appendChild(card(L("Latest activity","آخر النشاط"), null, [h("div", {class: "feed"}, rows.slice(0, 25).map(function(r){
      var what = r.type === "project" || r.type === "demo" || r.type === "repo" ? pname(r.item) : (r.item || "");
      return h("div", {class: "fe-row"}, [h("span", {class: "lbl2", text: new Date(r.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {dateStyle: "short", timeStyle: "short"})}), h("b", {text: TN[r.type] || r.type}), h("span", {class: "fe-what", dir: "auto", text: what + (r.target ? " · " + r.target : "")}), h("span", {class: "lbl2", text: r.device === "mobile" ? "📱" : "💻"})]);
    }))]));
  }
  if (anCache[anRange]) { setTimeout(function(){ draw(anCache[anRange]); }, 0); return wrap; }
  var since = new Date(Date.now() - (anRange === 1 ? (Date.now() - new Date().setHours(0, 0, 0, 0)) : anRange * 864e5)).toISOString();
  var all = [];
  (function page(from){
    SB.from("events").select("created_at,type,item,ref,lang,device,visitor,target").gte("created_at", since).order("created_at", {ascending: false}).range(from, from + 999).then(function(r){
      if (r.error) { body.innerHTML = ""; body.appendChild(h("p", {class: "lbl2", text: L("Could not load: ","ما اتحمّلش: ") + r.error.message})); return; }
      all = all.concat(r.data || []);
      if ((r.data || []).length === 1000 && all.length < 20000) page(from + 1000); else { anCache[anRange] = all; draw(all); }
    });
  })(0);
  return wrap;
}

var TABS = [
  ["overview", {en:"Overview",ar:"نظرة عامة"}, "◧"], ["inbox", {en:"Inbox",ar:"الوارد"}, "📥"], ["profile", {en:"Profile",ar:"البيانات الشخصية"}, "☺"], ["sections", {en:"Sections",ar:"الأقسام"}, "☰"],
  ["projects", {en:"Projects",ar:"المشاريع"}, "▦"], ["services", {en:"Services",ar:"الخدمات"}, "✦"], ["skills", {en:"Skills",ar:"المهارات"}, "◆"],
  ["tools", {en:"Tools",ar:"البرامج"}, "⚙"], ["experience", {en:"Experience",ar:"الخبرات"}, "⌂"], ["accounts", {en:"Accounts",ar:"الأكونتات"}, "@"], ["testimonials", {en:"Testimonials",ar:"آراء العملاء"}, "❝"], ["sheko", {en:"Sheko assistant",ar:"المساعد شيكو"}, "✉"], ["live", {en:"Live message",ar:"رسالة مباشرة"}, "📣"], ["analytics", {en:"Analytics",ar:"الإحصائيات"}, "📈"]
];
function card(title, desc, kids){ return h("section", {class: "dcard"}, [title ? h("h3", {text: title}) : null, desc ? h("p", {class: "lbl2", text: desc}) : null].concat(kids || [])); }
function toggleRow(label, desc, val, set){ return h("div", {class: "trow"}, [h("div", {style: "min-width:0"}, [h("b", {text: label}), desc ? h("div", {class: "lbl2", text: desc}) : null]), sw(val, set, label)]); }
function countOf(arr){ var on = arr.filter(function(x){ return x.show; }).length; return on + "/" + arr.length; }
function renderDashboard(){
  if (!AUTH_READY) return h("div", {class: "dgate"}, [h("div", {class: "dcard"}, [h("h3", {text: L("Checking access…","جاري التأكد من الصلاحية…")})])]);
  if (!CAN_EDIT && MODE === "supabase") return h("div", {class: "dgate"}, [h("div", {class: "dcard"}, SB_USER ? [
    h("h3", {text: L("This account can't open the dashboard","الحساب ده مش مسموحله يفتح لوحة التحكم")}),
    h("p", {class: "lbl2", text: (SB_USER.email || "") }),
    h("div", {class: "dlinks"}, [h("button", {class: "btn", onclick: sbSignOut, text: L("Sign out","تسجيل خروج")}), h("a", {class: "btn primary", href: "#top", text: L("Open the portfolio","افتح البورتفوليو")})])
  ] : [
    img(STATE.profile.avatar) ? h("img", {src: img(STATE.profile.avatar), alt: "", style: "width:64px;height:64px;border-radius:50%;object-fit:cover"}) : null,
    h("h3", {text: L("Owner sign-in","دخول صاحب الموقع")}),
    h("p", {class: "lbl2", text: L("Sign in with the owner's Google account to open the dashboard.","سجّل بحساب جوجل بتاع صاحب الموقع علشان تفتح لوحة التحكم.")}),
    h("button", {class: "btn primary", onclick: sbSignIn}, [h("span", {html: '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>'}), L("Continue with Google","الدخول بحساب جوجل")]),
    h("a", {class: "btn ghost sm", href: "#top", text: L("Back to the portfolio","رجوع للبورتفوليو")})
  ])]);
  if (!CAN_EDIT) return h("div", {class: "dgate"}, [h("div", {class: "dcard"}, [
    h("h3", {text: L("This page is for the site owner","الصفحة دي لصاحب الموقع بس")}),
    h("p", {class: "lbl2", text: L("Open the portfolio to see Mahmoud's work.","افتح البورتفوليو علشان تشوف شغل محمود.")}),
    h("a", {class: "btn primary", href: "#top", text: L("Open the portfolio","افتح البورتفوليو")})])]);
  var S = STATE.settings, P = STATE.profile;
  var nav = h("nav", {class: "dside", "aria-label": L("Dashboard sections","أقسام لوحة التحكم")}, TABS.map(function(tb){
    var cnt = {inbox: INBOX.newCount ? String(INBOX.newCount) : "", projects: countOf(STATE.projects), services: countOf(STATE.services), skills: countOf(STATE.skills), tools: countOf(STATE.tools), experience: countOf(STATE.experience), accounts: countOf(STATE.accounts)}[tb[0]];
    return h("button", {class: "dnav", "aria-current": adminTab === tb[0] ? "page" : null, onclick: function(){ adminTab = tb[0]; window.scrollTo(0, 0); render(); }}, [h("span", {class: "dic", text: tb[2]}), h("span", {class: "dlbl", text: t(tb[1])}), cnt ? h("span", {class: "dcnt", text: cnt}) : null]);
  }));
  var main = h("div", {class: "dmain"});
  var head = function(title, desc, action){ main.appendChild(h("div", {class: "dhead"}, [h("div", {}, [h("h2", {class: "display", text: title}), desc ? h("p", {class: "lbl2", text: desc}) : null]), action || null])); };
  var addBtn = function(label, fn){ return h("button", {class: "btn sm primary", onclick: fn, text: "+ " + label}); };
  var list = function(){ return h("div", {class: "dlist"}); };

  if (adminTab === "overview") {
    head(L("Overview","نظرة عامة"), L("A summary of what visitors see. Changes stay local until you press Save & publish.","ملخص اللي الزوار بيشوفوه. التعديلات مش بتتنشر غير لما تدوس احفظ وانشر."));
    var stats = [[L("Projects shown","مشاريع ظاهرة"), countOf(STATE.projects), "projects"], [L("Tools shown","برامج ظاهرة"), countOf(STATE.tools), "tools"], [L("Accounts shown","أكونتات ظاهرة"), countOf(STATE.accounts), "accounts"], [L("Sections on","أقسام شغالة"), visibleSections().length + "/" + S.sectionOrder.length, "sections"]];
    main.appendChild(h("div", {class: "dstats"}, stats.map(function(x){ return h("button", {class: "dstat", onclick: function(){ adminTab = x[2]; render(); }}, [h("span", {class: "lbl2", text: x[0]}), h("b", {text: x[1]})]); })));
    main.appendChild(card(L("Quick switches","تحكم سريع"), null, [
      toggleRow(L("Available for freelance","متاح للفريلانس"), L("Green badge at the top of the page","العلامة الخضرا أول الصفحة"), S.available, function(v){ S.available = v; }),
      toggleRow(L("3D scene","مشهد 3D"), L("The building animation behind your photo","المبنى المتحرك ورا صورتك"), S.show3d, function(v){ S.show3d = v; }),
      toggleRow(L("Company logos","لوجوهات الشركات"), L("Petra and HUDERA logos in titles and experience","لوجو بترا وهوديرا في المناصب والخبرات"), S.showCompanyLogos, function(v){ S.showCompanyLogos = v; }),
      toggleRow(L("Sheko assistant","المساعد شيكو"), L("Chat button on every page","زرار الشات في الموقع"), shekoOn(), function(v){ shekoCfg().enabled = v; }),
      toggleRow(L("CV download","تحميل الـ CV"), L("Download CV buttons in the hero and contact","زراير تحميل الـ CV في أول الصفحة والتواصل"), S.showCv !== false, function(v){ S.showCv = v; })
    ]));
    var dl = h("select", {id: "deflang"}, [h("option", {value: "en", text: "English"}), h("option", {value: "ar", text: "عربي"})]); dl.value = S.defaultLang;
    dl.addEventListener("change", function(){ S.defaultLang = dl.value; markDirty(); });
    main.appendChild(card(L("Language","اللغة"), L("Language a first-time visitor sees","اللغة اللي الزائر الجديد بيشوفها"), [dl]));
    main.appendChild(card(L("Links","اللينكات"), L("Each page has its own link.","كل صفحة ليها لينك لوحدها."), [h("div", {class: "dlinks"}, [h("a", {class: "btn sm", href: "#top", text: L("Portfolio","البورتفوليو")}), h("a", {class: "btn sm", href: "#sheko", text: L("Sheko page","صفحة شيكو")}), h("span", {class: "lbl2", text: L("Dashboard link = portfolio link + #dashboard","لينك اللوحة = لينك البورتفوليو + ‎#dashboard")})])]));
  }
  if (adminTab === "profile") {
    head(L("Profile","البيانات الشخصية"), L("Name, headline, intro and photos.","الاسم والعنوان والنبذة والصور."));
    main.appendChild(card(L("Texts","النصوص"), null, [bi(P, "name", false, L("Name","الاسم")), bi(P, "headline", true, L("Headline","العنوان الرئيسي")), bi(P, "sub", true, L("Short intro","نبذة قصيرة")), bi(P, "availableText", false, L("Availability text","نص الإتاحة")), bi(P, "location", false, L("Location line","سطر المكان")), bi(P, "about", true, L("About text","نص قسم عني"))]));
    var rl = list(); P.roles.forEach(function(r, i){ rl.appendChild(itemRow(P.roles, i, t(r.title) + " · " + r.org, r.show, function(v){ r.show = v; }, function(){ return [bi(r, "title", false, L("Title","المنصب")), h("div", {}, [h("div", {class: "lbl2", text: L("Company","الشركة")}), txt(r, "org")])]; }, {kind: "role"})); });
    main.appendChild(card(L("Titles under your name","المناصب تحت اسمك"), null, [rl]));
    main.appendChild(card(L("Intro video","الفيديو التعريفي"), L("YouTube, Google Drive or Vimeo link. A Watch button appears in the hero. Leave empty to hide it.","لينك يوتيوب أو جوجل درايف أو Vimeo. هيظهر زرار مشاهدة أول الصفحة. سيبه فاضي علشان يختفي."), [txt(P, "videoUrl", {type: "url", dir: "ltr", ph: "https://youtu.be/…"})]));
    main.appendChild(card(L("CV (PDF)","الـ CV (PDF)"), L("The file visitors download. Upload a new PDF to replace it.","الملف اللي الزوار بينزّلوه. ارفع PDF جديد علشان تبدّله."), [
      h("div", {class: "lbl2", text: L("English CV (for English visitors)","الـ CV الإنجليزي (للزوار بالإنجليزي)")}),
      h("div", {class: "dlinks"}, [h("a", {class: "btn sm", href: P.cvUrl || "files/Mahmoud_Shahab_CV.pdf", target: "_blank", rel: "noopener", text: L("Open","افتح")}), pdfPicker(function(url){ P.cvUrl = url; }), P.cvUrl ? h("button", {class: "btn sm ghost", onclick: function(){ P.cvUrl = ""; markDirty(); rerenderKeepAdmin(); }, text: L("Back to the default file","ارجع للملف الأصلي")}) : null]),
      h("div", {class: "lbl2", text: L("Arabic CV (for Arabic visitors)","الـ CV العربي (للزوار بالعربي)")}),
      h("div", {class: "dlinks"}, [h("a", {class: "btn sm", href: P.cvUrlAr || "files/Mahmoud_Shahab_CV_AR.pdf", target: "_blank", rel: "noopener", text: L("Open","افتح")}), pdfPicker(function(url){ P.cvUrlAr = url; }), P.cvUrlAr ? h("button", {class: "btn sm ghost", onclick: function(){ P.cvUrlAr = ""; markDirty(); rerenderKeepAdmin(); }, text: L("Back to the default file","ارجع للملف الأصلي")}) : null])
    ]));
    main.appendChild(card(L("Photos","الصور"), null, [h("div", {class: "dgrid2"}, [imagePicker(P.photo, function(k){ P.photo = k; }, L("Main photo","الصورة الرئيسية")), imagePicker(P.avatar, function(k){ P.avatar = k; }, L("Round photo (nav and Sheko)","الصورة الدائرية (القائمة وشيكو)")), imagePicker(P.aboutPhoto, function(k){ P.aboutPhoto = k; }, L("About photo (optional)","صورة قسم عني (اختياري)"))])]));
  }
  if (adminTab === "sections") {
    head(L("Sections","الأقسام"), L("Turn sections on or off and change their order with the arrows.","شغّل أو اقفل الأقسام وغيّر ترتيبها بالأسهم."));
    var sl = list(); S.sectionOrder.forEach(function(x, i){ sl.appendChild(itemRow(S.sectionOrder, i, t(SEC_LABEL[x]), S.sections[x], function(v){ S.sections[x] = v; })); });
    main.appendChild(sl);
  }
  if (adminTab === "projects") {
    head(L("Projects","المشاريع"), L("Show, hide, reorder, edit or add projects. Large cards appear first and wider.","أظهر أو أخفي أو رتّب أو عدّل أو ضيف مشاريع. الكروت الكبيرة بتظهر أعرض."), addBtn(L("Add project","إضافة مشروع"), function(){ var id = uid("p"); STATE.projects.unshift({id: id, show: true, featured: false, cat: "systems", img: "", title: {en: "New project", ar: "مشروع جديد"}, problem: {en: "", ar: ""}, solution: {en: "", ar: ""}, tags: [], status: {en: "Built", ar: "اتبنى"}}); openEd["proj" + id] = true; markDirty(); render(); }));
    var pl = list();
    STATE.projects.forEach(function(p, i){
      pl.appendChild(itemRow(STATE.projects, i, t(p.title), p.show, function(v){ p.show = v; }, function(){
        var cat = h("select", {}, STATE.categories.filter(function(c){ return c.id !== "all"; }).map(function(c){ return h("option", {value: c.id, text: c[lang] || c.en}); })); cat.value = p.cat;
        cat.addEventListener("change", function(){ p.cat = cat.value; markDirty(); });
        return [
          bi(p, "title", false, L("Title","العنوان")), bi(p, "problem", true, L("The problem","المشكلة")), bi(p, "solution", true, L("What you built","اللي بنيته")), bi(p, "result", true, L("The result (real outcome, e.g. time saved)","النتيجة (اللي حصل فعلاً، زي وقت اتوفر)")), statsEditor(p),
          bi(p, "status", false, L("Status label","الحالة")), tags(p, "tags", L("Tags (comma separated)","التاجز (افصل بفاصلة)")),
          h("div", {class: "pair"}, [h("div", {}, [h("div", {class: "lbl2", text: L("Live demo link","لينك الديمو")}), txt(p, "demo", {type: "url", dir: "ltr", ph: "https://"})]), h("div", {}, [h("div", {class: "lbl2", text: L("Code / GitHub link","لينك الكود")}), txt(p, "repo", {type: "url", dir: "ltr", ph: "https://github.com/"})])]),
          h("div", {class: "pair"}, [h("div", {}, [h("div", {class: "lbl2", text: L("Category","التصنيف")}), cat]), toggleRow(L("Large card","كارت كبير"), null, p.featured, function(v){ p.featured = v; })]),
          imagePicker(p.img, function(k){ p.img = k; }, L("Cover image","صورة الغلاف")),
          galleryEditor(p),
          h("div", {}, [h("div", {class: "lbl2", text: L("Video link (YouTube / Drive / Vimeo / mp4)","لينك فيديو (يوتيوب / درايف / Vimeo / mp4)")}), txt(p, "video", {type: "url", dir: "ltr", ph: "https://"})]),
          h("a", {class: "btn sm", href: "#p-" + p.id, text: L("Open project page","افتح صفحة المشروع")})
        ];
      }, {kind: "proj", del: true, thumb: p.img}));
    });
    main.appendChild(pl);
  }
  if (adminTab === "services") {
    head(L("Services","الخدمات"), null, addBtn(L("Add service","إضافة خدمة"), function(){ var id = uid("s"); STATE.services.push({id: id, show: true, icon: "grid", title: {en: "New service", ar: "خدمة جديدة"}, text: {en: "", ar: ""}}); openEd["svc" + id] = true; markDirty(); render(); }));
    var vl = list(); STATE.services.forEach(function(x, i){
      vl.appendChild(itemRow(STATE.services, i, t(x.title), x.show, function(v){ x.show = v; }, function(){
        var ic = h("select", {}, Object.keys(SVC_ICONS).map(function(k){ return h("option", {value: k, text: k}); })); ic.value = x.icon; ic.addEventListener("change", function(){ x.icon = ic.value; markDirty(); });
        return [bi(x, "title", false, L("Title","العنوان")), bi(x, "text", true, L("Description","الوصف")), h("div", {}, [h("div", {class: "lbl2", text: L("Icon","الأيقونة")}), ic])];
      }, {kind: "svc", del: true}));
    }); main.appendChild(vl);
  }
  if (adminTab === "skills") {
    head(L("Skills","المهارات"), null, addBtn(L("Add group","إضافة مجموعة"), function(){ var id = uid("k"); STATE.skills.push({id: id, show: true, group: {en: "New group", ar: "مجموعة جديدة"}, items: []}); openEd["sk" + id] = true; markDirty(); render(); }));
    var kl = list(); STATE.skills.forEach(function(x, i){ kl.appendChild(itemRow(STATE.skills, i, t(x.group) + " · " + x.items.length, x.show, function(v){ x.show = v; }, function(){ return [bi(x, "group", false, L("Group name","اسم المجموعة")), tags(x, "items", L("Skills (comma separated)","المهارات (افصل بفاصلة)"))]; }, {kind: "sk", del: true})); });
    main.appendChild(kl);
  }
  if (adminTab === "tools") {
    head(L("Tools","البرامج"), L("Set each tool's level from 1 to 5, hide it, or add a new one.","حدد مستوى كل برنامج من 1 لـ 5، أو اخفيه، أو ضيف جديد."), addBtn(L("Add tool","إضافة برنامج"), function(){ var id = "x_" + Date.now().toString(36); STATE.tools.push({id: id, show: true, level: 3, group: "office", name: "New tool", letter: "N", hex: "4C86FF"}); openEd["tool" + id] = true; markDirty(); render(); }));
    STATE.toolGroups.forEach(function(g){
      var gl = list();
      STATE.tools.forEach(function(x, i){ if (x.group !== g.id) return;
        gl.appendChild(itemRow(STATE.tools, i, toolName(x) + "  ·  " + x.level + "/5", x.show, function(v){ x.show = v; }, function(){
          var lv = h("input", {type: "range", min: "1", max: "5", step: "1", "aria-label": L("Level","المستوى")}); lv.value = x.level; lv.addEventListener("input", function(){ x.level = Number(lv.value); markDirty(); }); lv.addEventListener("change", rerenderKeepAdmin);
          var gr = h("select", {}, STATE.toolGroups.map(function(q){ return h("option", {value: q.id, text: q[lang] || q.en}); })); gr.value = x.group; gr.addEventListener("change", function(){ x.group = gr.value; markDirty(); rerenderKeepAdmin(); });
          var out = [h("div", {}, [h("div", {class: "lbl2", text: L("Level","المستوى") + ": " + x.level}), lv]), h("div", {}, [h("div", {class: "lbl2", text: L("Group","المجموعة")}), gr]), h("div", {}, [h("div", {class: "lbl2", text: L("Display name","الاسم الظاهر")}), txt(x, "name", {ph: toolName(x)})])];
          if (!ICONS[x.id] && !LOGOS[x.id]) out.push(h("div", {class: "pair"}, [h("div", {}, [h("div", {class: "lbl2", text: L("Icon letter","حرف الأيقونة")}), txt(x, "letter")]), h("div", {}, [h("div", {class: "lbl2", text: L("Color (hex)","اللون")}), txt(x, "hex")])]));
          return out;
        }, {kind: "tool", del: true, icon: x}));
      });
      if (gl.childNodes.length) main.appendChild(card(g[lang] || g.en, null, [gl]));
    });
  }
  if (adminTab === "experience") {
    head(L("Experience","الخبرات"), null, addBtn(L("Add entry","إضافة"), function(){ var id = uid("e"); STATE.experience.push({id: id, show: true, org: "Company", logo: "", when: {en: "", ar: ""}, role: {en: "Role", ar: "المنصب"}, text: {en: "", ar: ""}}); openEd["ex" + id] = true; markDirty(); render(); }));
    var el = list(); STATE.experience.forEach(function(e, i){
      el.appendChild(itemRow(STATE.experience, i, t(e.role) + " · " + e.org, e.show, function(v){ e.show = v; }, function(){
        return [h("div", {}, [h("div", {class: "lbl2", text: L("Company / school","الشركة أو الجامعة")}), txt(e, "org")]), bi(e, "role", false, L("Role","المنصب")), bi(e, "when", false, L("Period","الفترة")), bi(e, "text", true, L("Description","الوصف")), imagePicker(e.logo, function(k){ e.logo = k; }, L("Logo","اللوجو"))];
      }, {kind: "ex", del: true}));
    }); main.appendChild(el);
  }
  if (adminTab === "accounts") {
    head(L("Accounts","الأكونتات"), L("Links in the contact section. Sheko uses them too.","اللينكات اللي في قسم التواصل، وشيكو بيستخدمها كمان."), addBtn(L("Add account","إضافة أكونت"), function(){ var id = "x_" + Date.now().toString(36); STATE.accounts.push({id: id, show: true, label: "New account", url: "https://", letter: "@", hex: "4C86FF"}); openEd["acc" + id] = true; markDirty(); render(); }));
    var al = list(); STATE.accounts.forEach(function(a, i){
      al.appendChild(itemRow(STATE.accounts, i, a.label, a.show, function(v){ a.show = v; }, function(){
        var out = [h("div", {}, [h("div", {class: "lbl2", text: L("Label","الاسم")}), txt(a, "label")]), h("div", {}, [h("div", {class: "lbl2", text: L("Link","اللينك")}), txt(a, "url", {type: "url", dir: "ltr"})]), h("div", {}, [h("div", {class: "lbl2", text: L("Short text under the name","النص الصغير تحت الاسم")}), txt(a, "handle", {dir: "ltr"})])];
        if (!ICONS[a.id] && !LOGOS[a.id] && !a.img) out.push(h("div", {class: "pair"}, [h("div", {}, [h("div", {class: "lbl2", text: L("Icon letter","حرف الأيقونة")}), txt(a, "letter")]), h("div", {}, [h("div", {class: "lbl2", text: L("Color (hex)","اللون")}), txt(a, "hex")])]));
        return out;
      }, {kind: "acc", del: true, icon: a}));
    }); main.appendChild(al);
  }
  if (adminTab === "sheko") {
    var C = shekoCfg();
    head(L("Sheko assistant","المساعد شيكو"), L("Sheko answers visitors from the data in this dashboard. Add anything else he should know below.","شيكو بيرد على الزوار من البيانات اللي في اللوحة دي. ضيف تحت أي معلومة زيادة عايزه يعرفها."), h("a", {class: "btn sm", href: "#sheko", text: L("Try Sheko","جرّب شيكو")}));
    main.appendChild(card(null, null, [toggleRow(L("Show Sheko on the site","إظهار شيكو في الموقع"), null, C.enabled, function(v){ C.enabled = v; })]));
    main.appendChild(card(L("Greeting","رسالة الترحيب"), null, [bi(C, "greeting", true)]));
    main.appendChild(card(L("Extra knowledge","معلومات إضافية"), L("Plain notes in any language: availability, working hours, rates policy, anything public.","ملاحظات بأي لغة: مواعيد الشغل، سياسة الأسعار، أي حاجة عامة."), [txt(C, "notes", {area: true, ph: L("Example: I reply on WhatsApp within a few hours.","مثال: برد على الواتساب خلال ساعات.")})]));
    var V = voiceCfg();
    var eng = h("select", {}, [h("option", {value: "gemini", text: L("Gemini voice (natural, Egyptian Arabic)","صوت Gemini (طبيعي، مصري)")}), h("option", {value: "browser", text: L("Browser voice (free, robotic)","صوت المتصفح (مجاني، آلي)")})]); eng.value = V.engine;
    eng.addEventListener("change", function(){ V.engine = eng.value; markDirty(); });
    var vn = h("select", {}, GEM_VOICES.map(function(n){ return h("option", {value: n, text: n}); })); vn.value = V.name;
    vn.addEventListener("change", function(){ V.name = vn.value; markDirty(); });
    var tres = h("span", {class: "lbl2"});
    var tbtn = h("button", {class: "btn sm primary", type: "button", text: L("▶ Test voice","▶ جرّب الصوت")});
    tbtn.addEventListener("click", function(){
      if (!SB || !SB_CFG.shekoFunction) { tres.textContent = L("Works on the live site only.","بيشتغل على الموقع الأساسي بس."); return; }
      tres.textContent = L("Generating…","جاري التوليد…"); stopSpeak();
      geminiSpeak("أهلاً بيك! أنا شيكو، المساعد الشخصي بتاع محمود. تحب أقولك على مشاريعه ولا إزاي تكلّمه على الواتساب؟", {voice: vn.value, style: V.styleAr}).then(function(src){ shekoAudio = new Audio(src); shekoAudio.play(); tres.textContent = L("Playing ","شغّال ") + vn.value; }, function(){ tres.textContent = L("No audio. Check that GEMINI_API_KEY is added in Supabase secrets.","مفيش صوت. اتأكد إن GEMINI_API_KEY متضاف في Secrets في Supabase."); });
    });
    main.appendChild(card(L("Sheko's voice","صوت شيكو"), L("When a visitor turns on the speaker icon, Sheko reads his replies aloud. If the Gemini voice fails, the browser voice is used.","لما الزائر يشغّل أيقونة السماعة، شيكو بيقرا ردوده بصوت. لو صوت Gemini وقع، بيستخدم صوت المتصفح."), [
      h("div", {class: "pair"}, [h("div", {}, [h("div", {class: "lbl2", text: L("Engine","المحرك")}), eng]), h("div", {}, [h("div", {class: "lbl2", text: L("Gemini voice","صوت Gemini")}), vn])]),
      h("div", {}, [h("div", {class: "lbl2", text: L("How he should sound in Arabic (English works best)","طريقة الكلام بالعربي (اكتبها بالإنجليزي أفضل)")}), txt(V, "styleAr", {area: true, dir: "ltr"})]),
      h("div", {}, [h("div", {class: "lbl2", text: L("How he should sound in English","طريقة الكلام بالإنجليزي")}), txt(V, "styleEn", {area: true, dir: "ltr"})]),
      h("div", {class: "dlinks"}, [tbtn, tres])
    ]));
    main.appendChild(card(L("Suggested questions","أسئلة مقترحة"), L("One per line, shown as buttons.","سؤال في كل سطر، بيظهروا كأزرار."), [bi(C, "suggest", true)]));
  }

  if (adminTab === "testimonials") {
    head(L("Testimonials","آراء العملاء"), L("Real quotes only, from people who agreed to be shown. The section stays hidden while this list is empty.","آراء حقيقية بس، من ناس وافقوا إنها تتعرض. القسم مش هيظهر طول ما القايمة فاضية."), addBtn(L("Add testimonial","إضافة رأي"), function(){ var id = uid("q"); STATE.testimonials.push({id: id, show: true, name: "", role: {en: "", ar: ""}, quote: {en: "", ar: ""}, link: "", photo: ""}); openEd["tq" + id] = true; markDirty(); render(); }));
    var ql = list(); STATE.testimonials.forEach(function(x, i){
      ql.appendChild(itemRow(STATE.testimonials, i, (x.name || L("(no name)","(من غير اسم)")) + (t(x.quote) ? " · " + t(x.quote).slice(0, 40) + "…" : ""), x.show, function(v){ x.show = v; }, function(){
        return [h("div", {}, [h("div", {class: "lbl2", text: L("Name","الاسم")}), txt(x, "name")]), bi(x, "role", false, L("Role / company","المنصب أو الشركة")), bi(x, "quote", true, L("What they said","الرأي")), h("div", {}, [h("div", {class: "lbl2", text: L("Source link (optional): LinkedIn, Mostaql review…","لينك المصدر (اختياري): لينكدإن، تقييم مستقل…")}), txt(x, "link", {type: "url", dir: "ltr", ph: "https://"})]), imagePicker(x.photo, function(k){ x.photo = k; }, L("Photo (optional)","صورة (اختياري)"))];
      }, {kind: "tq", del: true}));
    });
    if (!STATE.testimonials.length) ql.appendChild(h("p", {class: "lbl2", text: L("No testimonials yet. Ask a client or a manager for two lines and add them here.","لسه مفيش آراء. اطلب من عميل أو مدير سطرين وضيفهم هنا.")}));
    main.appendChild(ql);
  }
  if (adminTab === "analytics") { main.appendChild(renderAnalytics()); }
  if (adminTab === "inbox") {
    head(L("Inbox","الوارد"), L("Requests from the contact form and from Sheko, plus every Sheko conversation.","الطلبات اللي جت من فورم التواصل ومن شيكو، وكل محادثات شيكو."));
    main.appendChild(renderInbox());
  }
  if (adminTab === "live") {
    head(L("Live message","رسالة مباشرة"), L("Send a message that pops up in the middle of the screen for everyone who has the site open right now. It is not saved and people who open the site later will not see it.","ابعت رسالة تظهر في نص الشاشة لكل اللي فاتحين الموقع دلوقتي. الرسالة مش بتتحفظ، واللي هيفتح الموقع بعدين مش هيشوفها."));
    main.appendChild(h("div", {class: "dstats"}, [h("div", {class: "dstat"}, [h("span", {class: "lbl2", text: L("On the site now","فاتحين الموقع دلوقتي")}), h("b", {id: "livecount", text: String(liveViewers())})]), h("div", {class: "dstat"}, [h("span", {class: "lbl2", text: L("Connection","الاتصال")}), h("b", {style: "font-size:16px", text: (ROOM || SB) ? L("Ready","جاهز") : L("Not available","مش متاح")})])]));
    var ta = h("textarea", {id: "livetext", maxlength: "300", placeholder: L("Write your message…","اكتب رسالتك…")}); ta.value = liveDraft.text;
    ta.addEventListener("input", function(){ liveDraft.text = ta.value; });
    var frames = h("div", {class: "frames"}, Object.keys(FRAMES).map(function(k){
      var f = FRAMES[k];
      return h("button", {class: "frame-opt fr-" + k, type: "button", "aria-pressed": String(liveDraft.frame === k), onclick: function(){ liveDraft.frame = k; rerenderKeepAdmin(); }}, [h("span", {class: "fe", text: f.emoji.slice(0, 2).join("")}), h("span", {text: t(f.name)})]);
    }));
    var secs = h("select", {id: "livesecs"}, [[10, "10s"], [20, "20s"], [45, "45s"], [0, L("Until closed","لحد ما يقفلها")]].map(function(o){ return h("option", {value: String(o[0]), text: o[1]}); })); secs.value = String(liveDraft.secs);
    secs.addEventListener("change", function(){ liveDraft.secs = Number(secs.value); });
    var res = h("p", {class: "lbl2", id: "liveres"});
    var tgt = h("input", {type: "text", id: "livetarget", dir: "ltr", placeholder: L("Empty = everyone","فاضي = الكل"), maxlength: "30"}); tgt.value = liveDraft.target || "";
    tgt.addEventListener("input", function(){ tgt.value = tgt.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""); liveDraft.target = tgt.value; });
    if (SB) {
      var nm = h("input", {type: "text", dir: "ltr", placeholder: "ahmed", maxlength: "30"}), out = h("code", {class: "plink"}), cp = h("button", {class: "btn sm", type: "button", text: L("Copy link","انسخ اللينك")});
      function upd(){ nm.value = nm.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""); out.textContent = location.origin + location.pathname + (nm.value ? "?to=" + nm.value : ""); }
      nm.addEventListener("input", upd); upd();
      cp.addEventListener("click", function(){ try { navigator.clipboard.writeText(out.textContent).then(function(){ cp.textContent = L("Copied ✓","اتنسخ ✓"); }); } catch (e) {} });
      main.appendChild(card(L("Personal link","لينك شخصي"), L("Send someone a link with their name. Then you can send a message that only they will see, and Analytics shows when they opened it.","ابعت لحد لينك فيه اسمه. بعدها تقدر تبعتله رسالة هو بس اللي يشوفها، والإحصائيات هتوريك فتح امتى."), [h("div", {class: "pair"}, [h("div", {}, [h("div", {class: "lbl2", text: L("Name (English letters, no spaces)","الاسم (حروف إنجليزي من غير مسافات)")}), nm]), h("div", {class: "dlinks", style: "align-items:flex-end"}, [cp])]), out]));
      main.appendChild(card(L("Who is on the site now","مين فاتح الموقع دلوقتي"), null, [onlineList()]));
    }
    main.appendChild(card(L("Message","الرسالة"), null, [ta, h("div", {class: "lbl2", text: L("Frame","الإطار")}), frames, h("div", {class: "pair"}, [h("div", {}, [h("div", {class: "lbl2", text: L("Show for","مدة الظهور")}), secs]), SB ? h("div", {}, [h("div", {class: "lbl2", text: L("Only for (personal link name)","لشخص معيّن (الاسم في اللينك)")}), tgt]) : h("div")]),
      h("div", {class: "dlinks"}, [
        h("button", {class: "btn sm", type: "button", onclick: function(){ if (!liveDraft.text.trim()) { res.textContent = L("Write a message first.","اكتب الرسالة الأول."); return; } showLive({text: liveDraft.text, frame: liveDraft.frame, secs: liveDraft.secs}); }, text: L("Preview","معاينة")}),
        h("button", {class: "btn sm primary", type: "button", disabled: (ROOM || SB) ? null : true, onclick: function(){
          var txtv = liveDraft.text.trim(); if (!txtv) { res.textContent = L("Write a message first.","اكتب الرسالة الأول."); return; }
          if (SB) { var tg = (liveDraft.target || "").trim(); var n = tg ? PEERS.filter(function(x){ return !x.isMe && x.kind === "viewer" && x.to === tg; }).length : liveViewers(); SB.from("live_messages").insert({text: txtv.slice(0, 300), frame: liveDraft.frame, secs: liveDraft.secs, target: tg || null}).then(function(r){ res.textContent = r.error ? L("Could not send: ","ما اتبعتتش: ") + r.error.message : (tg ? L("Sent to “" + tg + "”. Open now: ","اتبعتت لـ «" + tg + "». فاتحين دلوقتي: ") + n : L("Sent to ","اتبعتت لـ ") + n + L(" people on the site."," شخص فاتحين الموقع.")); }); return; }
          if (!ROOM || !ROOM.connected()) { res.textContent = L("Not connected right now. Try again in a moment.","مش متصل دلوقتي. جرّب كمان شوية."); return; }
          ROOM.emit("live", {text: txtv.slice(0, 300), frame: liveDraft.frame, secs: liveDraft.secs, ts: Date.now()}).then(function(){ res.textContent = L("Sent to ","اتبعتت لـ ") + liveViewers() + L(" people on the site."," شخص فاتحين الموقع."); }, function(err){ res.textContent = (err && err.code === "not_permitted") ? L("Only the owner can send.","الإرسال للمالك بس.") : L("Could not send. Try again.","ما اتبعتتش. جرّب تاني."); });
        }, text: L("Send now","ابعت دلوقتي")})
      ]), res]));
  }
  var status = h("span", {class: "dstatus" + (dirty ? " warn" : ""), id: "admmsg", text: dirty ? L("Unsaved changes","فيه تعديلات لسه ما اتحفظتش") : L("All changes saved","كل التعديلات محفوظة")});
  var top = h("header", {class: "dtop"}, [
    h("a", {class: "dbrand", href: "#top"}, [img(P.avatar) ? h("img", {src: img(P.avatar), alt: ""}) : null, h("span", {}, [h("b", {text: L("Portfolio Dashboard","لوحة تحكم البورتفوليو")}), h("small", {text: t(P.name)})])]),
    status,
    h("div", {class: "dact"}, [
      h("button", {class: "btn sm ghost", onclick: function(){ lang = lang === "en" ? "ar" : "en"; try { localStorage.setItem("ms_lang", lang); } catch(e){} render(); }, text: lang === "en" ? "عربي" : "English"}),
      h("a", {class: "btn sm", href: "#top", text: L("View site","عرض الموقع")}),
      DOWNLOADS ? h("button", {class: "btn sm", onclick: exportHtml, text: L("Download HTML","تحميل HTML")}) : null,
      SB_USER ? h("button", {class: "btn sm ghost", onclick: sbSignOut, text: L("Sign out","خروج")}) : null,
      h("button", {class: "btn sm primary", onclick: save, disabled: (ARTIFACT || (SB && CAN_EDIT)) ? null : true, text: L("Save & publish","احفظ وانشر")})
    ])
  ]);
  return h("div", {class: "dash"}, [top, h("div", {class: "dbody"}, [nav, main])]);
}

/* ---------- live message ---------- */
var FRAMES = {
  hearts: {name: {en: "Hearts", ar: "قلوب"}, emoji: ["❤️","💖","💕","💗","💞"]},
  laugh: {name: {en: "Make me laugh", ar: "اضحكني"}, emoji: ["😂","🤣","😆","😜","😹"]},
  party: {name: {en: "Celebration", ar: "احتفال"}, emoji: ["🎉","🎊","✨","🥳","🎈"]},
  stars: {name: {en: "Stars", ar: "نجوم"}, emoji: ["⭐","🌟","✨","💫","⭐"]},
  classic: {name: {en: "Professional", ar: "رسمي"}, emoji: ["✦","✦"]}
};
function liveViewers(){ return PEERS.filter(function(p){ return !p.isMe && p.kind === "viewer"; }).length; }
function showLive(d){
  if (!d || typeof d.text !== "string") return;
  var f = FRAMES[d.frame] ? d.frame : "classic", F = FRAMES[f];
  var old = document.querySelector(".live"); if (old) old.remove();
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var rain = h("div", {class: "live-rain", "aria-hidden": "true"});
  if (f !== "classic" && !reduce) for (var i = 0; i < 26; i++) { var e = h("span", {text: F.emoji[i % F.emoji.length]}); e.style.left = (Math.random() * 100) + "%"; e.style.animationDelay = (Math.random() * 3) + "s"; e.style.fontSize = (18 + Math.random() * 22) + "px"; e.style.animationDuration = (4 + Math.random() * 4) + "s"; rain.appendChild(e); }
  var box = h("div", {class: "live-card fr-" + f, role: "alertdialog", "aria-label": L("Message from Mahmoud","رسالة من محمود")}, [
    h("div", {class: "live-from"}, [img(STATE.profile.avatar) ? h("img", {src: img(STATE.profile.avatar), alt: ""}) : null, h("span", {text: L("Message from ","رسالة من ") + t(STATE.profile.name)})]),
    h("p", {class: "live-text", text: d.text.slice(0, 300), dir: "auto"}),
    h("button", {class: "btn primary", onclick: function(){ close(); }, text: L("Close","إغلاق")})
  ]);
  var wrap = h("div", {class: "live", onclick: function(e){ if (e.target === wrap) close(); }}, [rain, box]);
  function close(){ wrap.classList.add("out"); setTimeout(function(){ wrap.remove(); }, 250); }
  document.body.appendChild(wrap);
  var secs = Number(d.secs); if (secs > 0) setTimeout(close, Math.min(secs, 120) * 1000);
}

/* ---------- Sheko: personal assistant ---------- */
var shekoTurns = [], shekoBusy = false, shekoPanel = false, shekoAbort = null;
function shekoCfg(){
  if (!STATE.sheko) STATE.sheko = {enabled: true, greeting: {en: "", ar: ""}, notes: "", suggest: {en: "", ar: ""}};
  return STATE.sheko;
}
function shekoOn(){ return shekoCfg().enabled !== false; }
var shekoLang = (function(){ var v = lsGet("ms_slang"); return v === "ar" || v === "en" ? v : ""; })();
function sLang(){ return shekoLang || lang; }
function isAr(x){ return /[\u0600-\u06FF]/.test(x || ""); }
function replyLang(q){ return shekoLang || (isAr(q) ? "ar" : (/[a-z]/i.test(q || "") ? "en" : lang)); }
function SL(en, ar){ return sLang() === "ar" ? ar : en; }
function shekoLangSwitch(){
  return h("div", {class: "slang", role: "group", "aria-label": "Sheko language / لغة شيكو"}, [["ar", "ع"], ["en", "EN"]].map(function(o){
    return h("button", {type: "button", "aria-pressed": String(sLang() === o[0]), title: o[0] === "ar" ? "يرد بالعربي" : "Reply in English", onclick: function(){
      if (sLang() === o[0]) return; shekoLang = o[0]; lsSet("ms_slang", o[0]);
      if (route === "sheko") { render(); return; }
      var w = document.querySelector(".swidget"); if (w) w.replaceWith(renderShekoWidget()); var i = document.getElementById("sheko-q"); if (i) i.focus();
    }, text: o[1]});
  }));
}
function shekoGreeting(){ var gg = shekoCfg().greeting, g = gg && typeof gg === "object" ? (gg[sLang()] || "") : (gg || ""); return g || SL("Hi, I'm Sheko 👋 Mahmoud's assistant. Ask me about his projects, tools, services or how to reach him.", "أهلاً، أنا شيكو 👋 مساعد محمود. اسألني عن مشاريعه، أو البرامج اللي بيشتغل عليها، أو خدماته، أو إزاي توصله."); }
function shekoSuggestions(){
  var sg = shekoCfg().suggest, s = sg && typeof sg === "object" ? (sg[sLang()] || "") : (sg || ""); var arr = s ? s.split(/\n+/).map(function(x){ return x.trim(); }).filter(Boolean) : [];
  return arr.length ? arr.slice(0, 5) : [SL("What systems has he built?","بنى سيستمز إيه؟"), SL("Which tools does he use?","بيشتغل على أنهي برامج؟"), SL("What services does he offer?","بيقدّم خدمات إيه؟"), SL("How can I contact him?","أتواصل معاه إزاي؟")];
}
function knowledge(){
  var S = STATE, P = S.profile, o = [];
  o.push("NAME: " + P.name.en + " (" + P.name.ar + ")");
  o.push("TITLES: " + P.roles.filter(function(r){ return r.show; }).map(function(r){ return r.title.en + " at " + r.org; }).join("; "));
  o.push("HEADLINE: " + P.headline.en); o.push("INTRO: " + P.sub.en); o.push("LOCATION: " + P.location.en);
  o.push("AVAILABLE FOR FREELANCE: " + (S.settings.available ? "yes" : "not right now"));
  o.push("ABOUT: " + P.about.en);
  o.push("FACTS: " + P.facts.map(function(f){ return f.k.en + ": " + f.v.en; }).join("; "));
  o.push("PROJECTS:"); S.projects.filter(function(p){ return p.show; }).forEach(function(p){ o.push("- " + p.title.en + " [" + p.status.en + "; " + (p.tags || []).join(", ") + "] Problem: " + p.problem.en + " Built: " + p.solution.en + (p.result && p.result.en ? " Result: " + p.result.en : "") + ((p.stats || []).filter(function(x){ return x && x.v && x.v.en; }).length ? " Numbers: " + p.stats.filter(function(x){ return x && x.v && x.v.en; }).map(function(x){ return x.v.en + " " + (x.l && x.l.en || ""); }).join("; ") : "")); });
  o.push("SERVICES: " + S.services.filter(function(x){ return x.show; }).map(function(x){ return x.title.en + " (" + x.text.en + ")"; }).join("; "));
  o.push("SKILLS: " + S.skills.filter(function(x){ return x.show; }).map(function(x){ return x.group.en + ": " + x.items.join(", "); }).join(" | "));
  o.push("TOOLS (level 1-5): " + S.tools.filter(function(x){ return x.show; }).map(function(x){ return toolName(x) + " " + x.level; }).join(", "));
  o.push("EXPERIENCE: " + S.experience.filter(function(x){ return x.show; }).map(function(x){ return x.role.en + " at " + x.org + " (" + x.when.en + "): " + x.text.en; }).join(" | "));
  o.push("CONTACT: " + S.accounts.filter(function(x){ return x.show; }).map(function(x){ return x.label + ": " + (x.url || x.text); }).join("; "));
  if (shekoCfg().notes) o.push("EXTRA NOTES FROM MAHMOUD: " + shekoCfg().notes);
  return o.join("\n");
}
var SHEKO_RULES = "You are Sheko, the friendly personal assistant on Mahmoud Shahab's portfolio website. You talk to visitors (recruiters, companies, freelance clients). Answer ONLY from the profile data below. If something is not in the data, say you don't know and suggest contacting Mahmoud on WhatsApp. Never invent numbers, prices, dates, clients, certificates or experience. Prices: every project is quoted individually after understanding the scope. Keep answers SHORT: 2 to 3 sentences, under 60 words. When listing projects, name at most 3 and offer to tell more. When you mention a project, describe it ONLY with its own Problem/Built text from the data (HUDERA AI the company is an AI automation studio for Gulf companies that builds AI employees and smart systems working inside WhatsApp on the client's own data; the project 'HUDERA AI: company website' is only the company's own website, so never describe the company as building websites); never guess what a project does. No bullet lists. Tool levels are internal (5 = expert, 4 = advanced, 3 = good): describe them in words like 'expert' or 'شاطر جداً فيه', never say the number. Warm and professional. Reply in the visitor's language: Egyptian Arabic if they write Arabic, English otherwise. Use plain text, no markdown headings. Speak about Mahmoud in the third person. LEADS: if the visitor wants to hire Mahmoud, asks for a price or quote, or describes a project for their company, say Mahmoud prices each project after understanding it and ask for their name and their WhatsApp number or email so he can contact them (ask once, politely; never insist). Only when the visitor has actually written BOTH a name AND a phone number or email in this chat, thank them, say Mahmoud will contact them soon, and add at the very end exactly: [[LEAD|their name|their phone or email|one short English line on what they need]]. Never invent these details and never write that tag in any other case.\n\nPROFILE DATA:\n";
function localAnswer(q){
  var ar = replyLang(q) === "ar", s = q.toLowerCase(), S = STATE;
  function A(en, a){ return ar ? a : en; }
  var projs = S.projects.filter(function(p){ return p.show; });
  var accs = S.accounts.filter(function(x){ return x.show; });
  var wa = accs.filter(function(x){ return x.id === "whatsapp"; })[0];
  if (/contact|reach|whatsapp|email|phone|hire|تواصل|اكلم|أكلم|واتس|رقم|ايميل|إيميل|توصل/.test(s)) return A("The fastest way is WhatsApp: " + (wa ? wa.text || wa.url : "") + ". You can also find him on " + accs.filter(function(x){ return x.id !== "whatsapp"; }).map(function(x){ return x.label; }).join(", ") + ".", "أسرع طريقة الواتساب: " + (wa ? "\u2066" + (wa.text || wa.url) + "\u2069" : "") + ". وموجود كمان على " + accs.filter(function(x){ return x.id !== "whatsapp"; }).map(function(x){ return x.label; }).join("، ") + ".");
  if (/price|cost|rate|budget|سعر|تكلفة|بكام|ميزانية/.test(s)) return A("Every project is priced on its scope. Send the details on WhatsApp and Mahmoud will reply with a clear quote.", "كل مشروع بيتسعّر حسب حجمه. ابعت التفاصيل على الواتساب، ومحمود هيرد عليك بعرض واضح.");
  if (/tool|software|program|stack|برنامج|برامج|أدوات|ادوات/.test(s)) return A("He works mostly with " + S.tools.filter(function(x){ return x.show && x.level >= 4; }).map(toolName).join(", ") + ".", "بيشتغل أكتر على " + S.tools.filter(function(x){ return x.show && x.level >= 4; }).map(toolName).join("، ") + ".");
  if (/service|offer|freelance|خدم|فريلانس|بتعمل/.test(s)) return A("He offers: " + S.services.filter(function(x){ return x.show; }).map(function(x){ return x.title.en; }).join(", ") + ".", "بيقدّم: " + S.services.filter(function(x){ return x.show; }).map(function(x){ return x.title.ar; }).join("، ") + ".");
  if (/experience|work at|job|company|خبر|بيشتغل فين|شركة|وظيف/.test(s)) return A(S.experience.filter(function(x){ return x.show; }).slice(0, 3).map(function(x){ return x.role.en + " at " + x.org; }).join("; ") + ".", S.experience.filter(function(x){ return x.show; }).slice(0, 3).map(function(x){ return x.role.ar + " في " + x.org; }).join("، ") + ".");
  if (/skill|good at|مهار/.test(s)) return A("His main skill areas: " + S.skills.filter(function(x){ return x.show; }).map(function(x){ return x.group.en; }).join(", ") + ".", "أهم مهاراته في: " + S.skills.filter(function(x){ return x.show; }).map(function(x){ return x.group.ar; }).join("، ") + ".");
  var hit = projs.filter(function(p){ return s.length > 3 && (p.title.en.toLowerCase().indexOf(s) >= 0 || (p.tags || []).some(function(tg){ return s.indexOf(tg.toLowerCase()) >= 0; })); })[0];
  if (hit) return A(hit.title.en + ": " + hit.solution.en, hit.title.ar + ": " + hit.solution.ar);
  if (/project|system|built|build|مشروع|مشاريع|سيستم|بنى|عمل ايه|عمل إيه/.test(s)) return A("Some of his projects: " + projs.slice(0, 5).map(function(p){ return p.title.en; }).join("; ") + ". Ask me about any of them.", "من مشاريعه: " + projs.slice(0, 5).map(function(p){ return p.title.ar; }).join("، ") + ". اسألني عن أي واحد فيهم.");
  if (/who|about|mahmoud|مين|محمود|عن/.test(s)) return A(STATE.profile.sub.en, STATE.profile.sub.ar);
  return A("I can tell you about Mahmoud's projects, tools, services, experience or how to contact him. For anything else, WhatsApp him directly.", "أقدر أقولك عن مشاريع محمود، والبرامج، والخدمات، والخبرات، أو إزاي توصله. لأي حاجة تانية كلمه واتساب على طول.");
}
var SHEKO_SID = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
function stripLead(x){ return String(x || "").replace(/\[\[LEAD\|[^\]]*\]\]/g, "").trim(); }
function shekoAsk(q, logEl, onDone){
  q = (q || "").trim(); if (!q || shekoBusy) return;
  shekoTurns.push({role: "user", content: q});
  var bubble = h("div", {class: "msg bot", dir: "auto", text: "…"});
  drawTurns(logEl); logEl.appendChild(bubble); logEl.scrollTop = logEl.scrollHeight;
  var chipsEl = logEl.parentNode && logEl.parentNode.querySelector(".schips"); if (chipsEl) chipsEl.remove();
  shekoBusy = true;
  track("sheko", q.slice(0, 80));
  function finish(text){ text = stripLead(text); shekoTurns.push({role: "assistant", content: text}); shekoBusy = false; bubble.textContent = text; logEl.scrollTop = logEl.scrollHeight; speak(text); if (onDone) onDone(); }
  var msgs = [{role: "user", content: SHEKO_RULES.replace("Reply in the visitor's language: Egyptian Arabic if they write Arabic, English otherwise.", replyLang(q) === "ar" ? "Reply in Egyptian Arabic (عامية مصرية) for this message." : "Reply in English for this message.") + knowledge()}, {role: "assistant", content: "Understood. I'm Sheko and I'll answer only from this data."}].concat(shekoTurns.slice(-10));
  if (SB && SB_CFG.shekoFunction) {
    SB.functions.invoke(SB_CFG.shekoFunction, {body: {messages: msgs, session: SHEKO_SID, visitor: VISITOR.slice(0, 24), lang: replyLang(q), owner: !!(CAN_EDIT || IS_OWNER_DEVICE)}}).then(function(r){ var tx = r && r.data && r.data.text; if (r && r.data && r.data.lead) track("contact", "sheko-lead"); finish(tx || localAnswer(q)); }, function(){ finish(localAnswer(q)); });
    return;
  }
  if (!SAMPLE) { setTimeout(function(){ finish(localAnswer(q)); }, 350); return; }
  shekoAbort = new AbortController();
  SAMPLE(msgs, {modelTier: "quick", cache: false, signal: shekoAbort.signal, onText: function(u){ bubble.textContent = u.text || "…"; logEl.scrollTop = logEl.scrollHeight; }})
    .then(function(r){ finish((r && r.text) || localAnswer(q)); }, function(err){ if (err && (err.code === "not_granted" || err.code === "unavailable")) SAMPLE = null; finish(localAnswer(q)); });
}
var speakOn = lsGet("ms_speak") === "1";
var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
function canSpeak(){ return "speechSynthesis" in window; }
var shekoAudio = null, speakSeq = 0;
var GEM_VOICES = ["Achird","Sadaltager","Charon","Orus","Iapetus","Puck","Algieba","Schedar","Umbriel","Zubenelgenubi","Rasalgethi","Gacrux","Alnilam","Enceladus","Fenrir","Kore","Aoede","Leda","Sulafat","Vindemiatrix","Despina","Achernar","Callirrhoe","Autonoe","Erinome","Laomedeia","Pulcherrima","Sadachbia","Zephyr","Algenib"];
function voiceCfg(){ var c = shekoCfg(); if (!c.voice || typeof c.voice !== "object") c.voice = {}; var v = c.voice; if (!v.engine) v.engine = "gemini"; if (!v.name) v.name = "Achird"; if (v.styleAr == null) v.styleAr = "Warm, friendly and relaxed, like a helpful Egyptian friend from Cairo. Natural conversational pace."; if (v.styleEn == null) v.styleEn = "Warm, friendly and professional. Natural conversational pace."; return v; }
function stopSpeak(){ speakSeq++; try { if (shekoAudio) { shekoAudio.pause(); shekoAudio = null; } } catch (e) {} try { speechSynthesis.cancel(); } catch (e) {} }
function browserSpeak(text){
  if (!canSpeak()) return;
  try {
    var ar = /[\u0600-\u06FF]/.test(text), u = new SpeechSynthesisUtterance(text);
    u.lang = ar ? "ar-EG" : "en-US"; u.rate = ar ? .95 : 1;
    var vs = speechSynthesis.getVoices(), want = ar ? /^ar/i : /^en/i;
    var v = vs.filter(function(x){ return x.lang === u.lang; })[0] || vs.filter(function(x){ return want.test(x.lang); })[0]; if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}
function geminiSpeak(text, opts){
  var V = voiceCfg(); opts = opts || {};
  var ar = /[\u0600-\u06FF]/.test(text);
  return SB.functions.invoke(SB_CFG.shekoFunction, {body: {action: "tts", text: text, voice: opts.voice || V.name, style: opts.style != null ? opts.style : (ar ? V.styleAr : V.styleEn)}}).then(function(r){
    var d = r && r.data; if (!d || !d.audio) throw new Error("no audio");
    return "data:" + (d.mime || "audio/wav") + ";base64," + d.audio;
  });
}
function splitSpeech(t){
  var parts = t.match(/[^.!?؟\n]+[.!?؟]*\s*/g) || [t], out = [], cur = "";
  parts.forEach(function(p){ if (!out.length && (cur + p).length > 140 && cur) { out.push(cur.trim()); cur = p; } else cur += p; });
  if (cur.trim()) out.push(cur.trim());
  if (out.length > 2) out = [out[0], out.slice(1).join(" ")];
  return out.map(function(x){ return x.slice(0, 700); });
}
function speak(text, force){
  if ((!speakOn && !force) || !text) return Promise.resolve(false);
  stopSpeak(); var my = speakSeq;
  var clean = text.replace(/https?:\/\/\S+/g, "").replace(/[\u2066-\u2069]/g, "").trim();
  if (voiceCfg().engine === "gemini" && SB && SB_CFG && SB_CFG.shekoFunction) {
    var chunks = splitSpeech(clean), reqs = chunks.map(function(c){ return geminiSpeak(c); });
    var i = 0;
    return new Promise(function(done){
      function next(){
        if (my !== speakSeq || i >= reqs.length) { done(true); return; }
        var k = i++;
        reqs[k].then(function(src){
          if (my !== speakSeq) { done(true); return; }
          shekoAudio = new Audio(src); shekoAudio.onended = next;
          shekoAudio.play().catch(function(){ if (k === 0) { browserSpeak(clean); done(false); } else next(); });
        }, function(){ if (my !== speakSeq) { done(true); return; } if (k === 0) { browserSpeak(clean); done(false); } else next(); });
      }
      next();
    });
  }
  browserSpeak(clean); return Promise.resolve(false);
}
function speakBtn(){
  if (!canSpeak()) return null;
  var b = h("button", {class: "ib" + (speakOn ? " on" : ""), "aria-pressed": String(speakOn), title: speakOn ? SL("Voice replies on","الرد بالصوت شغّال") : SL("Voice replies off","الرد بالصوت مقفول"), "aria-label": SL("Voice replies","الرد بالصوت"), html: speakOn ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/></svg>'});
  b.addEventListener("click", function(){ speakOn = !speakOn; lsSet("ms_speak", speakOn ? "1" : "0"); if (!speakOn) stopSpeak(); b.replaceWith(speakBtn()); });
  return b;
}
function micBtn(input, onText){
  if (!SR) return null;
  var rec = null, b = h("button", {class: "btn mic", type: "button", "aria-label": SL("Speak your question","اسأل بصوتك"), title: SL("Speak your question","اسأل بصوتك"), html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>'});
  b.addEventListener("click", function(){
    if (rec) { try { rec.stop(); } catch (e) {} return; }
    try { rec = new SR(); } catch (e) { return; }
    rec.lang = sLang() === "ar" ? "ar-EG" : "en-US"; rec.interimResults = true; rec.maxAlternatives = 1;
    var final = "";
    rec.onresult = function(ev){ var tx = ""; for (var i = 0; i < ev.results.length; i++) { tx += ev.results[i][0].transcript; if (ev.results[i].isFinal) final = tx; } input.value = tx; };
    rec.onend = function(){ b.classList.remove("rec"); rec = null; var v = (final || input.value).trim(); if (v) { input.value = ""; onText(v); } };
    rec.onerror = function(){ b.classList.remove("rec"); };
    b.classList.add("rec"); rec.start();
  });
  return b;
}
function drawTurns(logEl){
  logEl.innerHTML = "";
  logEl.appendChild(h("div", {class: "msg bot", text: shekoGreeting()}));
  shekoTurns.forEach(function(m){ logEl.appendChild(h("div", {class: "msg " + (m.role === "user" ? "me" : "bot"), dir: "auto", text: m.content})); });
}
function shekoChat(full){
  var log = h("div", {class: "slog", "aria-live": "polite"}); drawTurns(log);
  var input = h("input", {type: "text", id: full ? "sheko-q-full" : "sheko-q", placeholder: SL("Ask about projects, tools, services…","اسأل عن المشاريع، البرامج، الخدمات…"), autocomplete: "off", "aria-label": SL("Your question","سؤالك")});
  var chips = shekoTurns.length ? null : h("div", {class: "schips"}, shekoSuggestions().map(function(x){ return h("button", {class: "chip", type: "button", text: x, onclick: function(){ shekoAsk(x, log); }}); }));
  var form = h("form", {class: "sform", onsubmit: function(e){ e.preventDefault(); var v = input.value; input.value = ""; shekoAsk(v, log); }}, [input, micBtn(input, function(v){ shekoAsk(v, log); }), h("button", {class: "btn primary", type: "submit", text: SL("Send","إرسال")})]);
  return h("div", {class: "schat", dir: sLang() === "ar" ? "rtl" : "ltr", lang: sLang()}, [log, chips, form]);
}
function shekoHead(extra){
  var P = STATE.profile;
  return h("div", {class: "shead", dir: sLang() === "ar" ? "rtl" : "ltr"}, [img(P.avatar) ? h("img", {src: img(P.avatar), alt: ""}) : null, h("div", {style: "min-width:0;flex:1"}, [h("b", {text: SL("Sheko","شيكو")}), h("small", {text: SL("Mahmoud's personal assistant","المساعد الشخصي لمحمود")})])].concat(extra || []));
}
function renderShekoWidget(){
  var wrap = h("div", {class: "swidget"});
  if (shekoPanel) {
    wrap.appendChild(h("div", {class: "spanel", role: "dialog", "aria-label": SL("Chat with Sheko","كلّم شيكو")}, [
      shekoHead([shekoLangSwitch(), speakBtn(), h("a", {class: "ib", href: "#sheko", title: SL("Open full page","افتح صفحة كاملة"), "aria-label": SL("Open full page","افتح صفحة كاملة"), text: "⤢"}), h("button", {class: "ib", "aria-label": SL("Close","إغلاق"), onclick: function(){ shekoPanel = false; var w = document.querySelector(".swidget"); w.replaceWith(renderShekoWidget()); }, text: "✕"})]),
      shekoChat(false)
    ]));
  }
  wrap.appendChild(h("button", {class: "sfab", "aria-expanded": String(shekoPanel), onclick: function(){ shekoPanel = !shekoPanel; var w = document.querySelector(".swidget"); w.replaceWith(renderShekoWidget()); var i = document.getElementById("sheko-q"); if (i) i.focus(); }}, [img(STATE.profile.avatar) ? h("img", {src: img(STATE.profile.avatar), alt: ""}) : null, h("span", {text: L("Ask Sheko","اسأل شيكو")})]));
  return wrap;
}
function renderShekoPage(){
  return h("div", {class: "spage"}, [
    h("header", {class: "spage-top"}, [h("a", {class: "btn sm ghost", href: "#top", text: L("← Portfolio","→ البورتفوليو")}), h("button", {class: "btn sm ghost", onclick: function(){ lang = lang === "en" ? "ar" : "en"; try { localStorage.setItem("ms_lang", lang); } catch(e){} render(); }, text: lang === "en" ? "عربي" : "English"})]),
    h("div", {class: "spage-box"}, [shekoHead([shekoLangSwitch(), speakBtn()]), shekoChat(true)])
  ]);
}

/* ---------- save: rebuild the document from state ---------- */
function usedImages(){
  var used = {}, P = STATE.profile;
  [P.photo, P.avatar, P.aboutPhoto].forEach(function(k){ if (k) used[k] = 1; });
  P.roles.forEach(function(r){ if (r.logo) used[r.logo] = 1; });
  STATE.projects.forEach(function(p){ if (p.img) used[p.img] = 1; (p.gallery || []).forEach(function(k){ used[k] = 1; }); });
  (STATE.testimonials || []).forEach(function(x){ if (x.photo) used[x.photo] = 1; });
  STATE.experience.forEach(function(e){ if (e.logo) used[e.logo] = 1; });
  STATE.accounts.forEach(function(a){ if (a.img) used[a.img] = 1; });
  STATE.tools.forEach(function(x){ if (x.img) used[x.img] = 1; });
  var out = {}; Object.keys(used).forEach(function(k){ if (IMG[k]) out[k] = IMG[k]; }); return out;
}
function buildDoc(){
  var snap = JSON.parse(JSON.stringify(STATE)); snap.images = usedImages(); snap.__icons = ICONS; snap.__logos = LOGOS;
  var json = JSON.stringify(snap).replace(/</g, "\\u003c");
  var headStyle = document.head.querySelector("style");
  var reset = headStyle ? headStyle.textContent : "";
  var css = document.getElementById("site-css").textContent;
  var js = document.getElementById("app-js").textContent;
  var title = esc(t(snap.profile.name) + " Portfolio");
  return "<!doctype html><html><head><meta charset=utf8><meta name=viewport content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><style>" + reset + "</style></head><body>" +
    "<title>" + title + "</title>" +
    "<meta name=\"claude:viewport-fit-sides\" content=\"cover\">" +
    "<meta name=\"description\" content=\"" + esc(t(snap.profile.sub)) + "\">" +
    "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>" +
    "<link rel=\"stylesheet\" href=\"" + document.getElementById("fontlink").getAttribute("href").replace(/&/g, "&amp;") + "\" id=\"fontlink\">" +
    "<style id=\"site-css\">" + css + "</style>" +
    "<div id=\"root\"></div>" +
    "<script src=\"https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js\"><\/script>" +
    "<script type=\"application/json\" id=\"state\">" + json + "<\/script>" +
    "<script id=\"app-js\">" + js + "<\/script></body></html>";
}
function setMsg(text, cls){ var m = document.getElementById("admmsg"); if (m) { m.textContent = text; m.className = "dstatus " + (cls || ""); } }
function sbSnapshot(){ var snap = JSON.parse(JSON.stringify(STATE)); delete snap.__icons; delete snap.__logos; snap.images = usedImages(); Object.keys(snap.images).forEach(function(k){ if (/^data:/.test(snap.images[k])) delete snap.images[k]; }); return snap; }
function save(){
  if (SB) {
    if (!CAN_EDIT) return;
    setMsg(L("Saving…","جاري الحفظ…"));
    SB.from("site_content").upsert({id: 1, data: sbSnapshot(), updated_at: new Date().toISOString()}).then(function(r){
      if (r.error) { setMsg(L("Could not save: ","ما اتحفظش: ") + r.error.message, "err"); return; }
      dirty = false; setMsg(L("Saved. Visitors see the changes now.","اتحفظ. الزوار بيشوفوا التعديلات دلوقتي."), "ok");
    });
    return;
  }
  if (!ARTIFACT) return;
  setMsg(L("Publishing…","جاري النشر…"));
  var html = buildDoc();
  ARTIFACT.publish(html).then(function(){ dirty = false; setMsg(L("Published. The page reloads with your changes.","اتنشر. الصفحة هتتحدّث بالتعديلات."), "ok"); }, function(err){
    var c = err && err.code;
    var map = {conflict: L("Someone else saved a newer version. The page reloads to it; make the change again.","فيه نسخة أحدث اتحفظت. الصفحة هتتحدّث، اعمل التعديل تاني."), not_writer: L("Only the owner can publish.","النشر للمالك بس."), not_granted: L("Publishing was not allowed. Allow it from the page permissions.","النشر مش مسموح. اسمح بيه من صلاحيات الصفحة."), too_large: L("The page is too large. Remove some images.","الصفحة كبيرة. شيل كام صورة."), rate_limited: L("Too many saves. Wait a minute and try again.","حفظت كتير. استنى دقيقة وجرّب.")};
    setMsg(map[c] || (L("Could not publish: ","ما اتنشرش: ") + (err && err.message || c || "error")), "err");
  });
}
function exportHtml(){
  if (!DOWNLOADS) return;
  DOWNLOADS.save({filename: "index.html", data: buildDoc()}).then(function(){ setMsg(L("File ready.","الملف جاهز."), "ok"); }, function(){ setMsg(L("Download cancelled.","التحميل اتلغى.")); });
}

/* ---------- owner inbox ---------- */
var INBOX = {leads: null, chats: null, newCount: 0, open: {}, view: "leads"};
function inboxLoad(force){
  if (!SB || !CAN_EDIT) return;
  if (INBOX.leads && !force) return;
  Promise.all([
    SB.from("leads").select("*").order("created_at", {ascending: false}).limit(300),
    SB.from("sheko_chats").select("session,created_at,updated_at,lang,turns,has_lead,messages").order("updated_at", {ascending: false}).limit(100)
  ]).then(function(r){
    INBOX.leads = r[0].error ? [] : (r[0].data || []); INBOX.chats = r[1].error ? [] : (r[1].data || []);
    INBOX.newCount = INBOX.leads.filter(function(x){ return x.status === "new"; }).length;
    if (route === "dashboard") render();
  });
}
function fmtWhen(iso){ try { return new Date(iso).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"}); } catch (e) { return iso; } }
function contactHref(c){ var d = c.replace(/[^\d+]/g, ""); if (/@/.test(c)) return "mailto:" + c; if (d.replace(/\D/g, "").length >= 8) return "https://wa.me/" + d.replace(/\D/g, ""); return null; }
function renderInbox(){
  var wrap = h("div", {class: "inbox"});
  if (INBOX.leads === null) { inboxLoad(); wrap.appendChild(h("p", {class: "lbl2", text: L("Loading…","بيحمّل…")})); return wrap; }
  var tabs = h("div", {class: "ibtabs", role: "tablist"}, [["leads", L("Requests","الطلبات") + " (" + INBOX.leads.length + ")"], ["chats", L("Sheko chats","محادثات شيكو") + " (" + INBOX.chats.length + ")"]].map(function(x){
    return h("button", {class: "btn sm" + (INBOX.view === x[0] ? " primary" : ""), role: "tab", "aria-selected": String(INBOX.view === x[0]), onclick: function(){ INBOX.view = x[0]; render(); }, text: x[1]});
  }).concat([h("button", {class: "btn sm ghost", onclick: function(){ inboxLoad(true); }, text: "↻ " + L("Refresh","تحديث")})]));
  wrap.appendChild(tabs);
  if (INBOX.view === "leads") {
    if (!INBOX.leads.length) wrap.appendChild(card(null, null, [h("p", {class: "lbl2", text: L("No requests yet. They appear here when someone uses the contact form or leaves their details with Sheko, and you also get an email.","لسه مفيش طلبات. هتظهر هنا لما حد يستخدم فورم التواصل أو يسيب بياناته لشيكو، وهيوصلك إيميل كمان.")})]));
    INBOX.leads.forEach(function(x){
      var href = contactHref(x.contact);
      wrap.appendChild(h("article", {class: "lead" + (x.status === "done" ? " done" : "")}, [
        h("div", {class: "lhead"}, [h("b", {text: x.name}), h("span", {class: "cmtag" + (x.source === "sheko" ? " au" : ""), text: x.source === "sheko" ? L("Sheko","شيكو") : L("Contact form","فورم التواصل")}), x.status === "new" ? h("span", {class: "cmtag new", text: L("New","جديد")}) : null, h("small", {class: "lbl2", text: fmtWhen(x.created_at)})]),
        h("div", {class: "lmeta"}, [href ? h("a", {href: href, target: "_blank", rel: "noopener", dir: "ltr", text: x.contact}) : h("span", {dir: "ltr", text: x.contact}), x.budget ? h("span", {class: "lbl2", text: L("Budget: ","الميزانية: ") + x.budget}) : null]),
        x.message ? h("p", {dir: "auto", class: "lmsg", text: x.message}) : null,
        h("div", {class: "lact"}, [
          h("button", {class: "btn sm", onclick: function(){ var nu = x.status === "new" ? "done" : "new"; SB.from("leads").update({status: nu}).eq("id", x.id).then(function(r){ if (!r.error) { x.status = nu; INBOX.newCount = INBOX.leads.filter(function(y){ return y.status === "new"; }).length; render(); } }); }, text: x.status === "new" ? L("Mark as done","خلص") : L("Mark as new","رجّعه جديد")}),
          h("button", {class: "btn sm ghost", onclick: function(){ if (!window.confirm(L("Delete this request?","تمسح الطلب ده؟"))) return; SB.from("leads").delete().eq("id", x.id).then(function(r){ if (!r.error) { INBOX.leads = INBOX.leads.filter(function(y){ return y.id !== x.id; }); INBOX.newCount = INBOX.leads.filter(function(y){ return y.status === "new"; }).length; render(); } }); }, text: L("Delete","مسح")})
        ])
      ]));
    });
  } else {
    if (!INBOX.chats.length) wrap.appendChild(card(null, null, [h("p", {class: "lbl2", text: L("No conversations yet. Every visitor chat with Sheko is saved here (your own tests are not).","لسه مفيش محادثات. كل محادثة زائر مع شيكو بتتحفظ هنا (تجاربك انت مش بتتحفظ).")})]));
    INBOX.chats.forEach(function(c){
      var msgs = Array.isArray(c.messages) ? c.messages : [], firstQ = (msgs.filter(function(m){ return m.r === "u"; })[0] || {}).t || "";
      var open = !!INBOX.open[c.session];
      wrap.appendChild(h("article", {class: "chat"}, [
        h("button", {class: "chead", "aria-expanded": String(open), onclick: function(){ INBOX.open[c.session] = !open; render(); }}, [
          h("span", {class: "cq", dir: "auto", text: firstQ.slice(0, 90) || "—"}),
          c.has_lead ? h("span", {class: "cmtag au", text: L("Left details","ساب بياناته")}) : null,
          h("small", {class: "lbl2", text: c.turns + " " + L("questions","سؤال") + " · " + fmtWhen(c.updated_at)})
        ]),
        open ? h("div", {class: "cbody"}, msgs.map(function(m){ return h("div", {class: "msg " + (m.r === "u" ? "me" : "bot"), dir: "auto", text: m.t}); }).concat([
          h("button", {class: "btn sm ghost", onclick: function(){ if (!window.confirm(L("Delete this conversation?","تمسح المحادثة دي؟"))) return; SB.from("sheko_chats").delete().eq("session", c.session).then(function(r){ if (!r.error) { INBOX.chats = INBOX.chats.filter(function(y){ return y.session !== c.session; }); render(); } }); }, text: L("Delete","مسح")})
        ])) : null
      ]));
    });
  }
  return wrap;
}

/* ---------- visitor comments (Google sign-in) ---------- */
var COMMENTS = null, CM_BUSY = false, CM_ERR = "", CM_PICK = null, CM_REPLY = null, CM_RBUSY = false;
var CM_COLS = "id,created_at,user_id,name,avatar,body,hidden,owner_reaction,owner_reply,owner_reply_at";
var CM_REACT = {like: "👍", love: "❤️", haha: "😂", thanks: "🙏", fire: "🔥"};
function cmUpd(c, patch, done){
  SB.from("comments").update(patch).eq("id", c.id).select(CM_COLS).single().then(function(r){ if (!r.error && r.data) Object.assign(c, r.data); if (done) done(r.error); cmRefresh(); });
}
var CM_MAIL = {};
function cmNotify(c){
  if (!SB_CFG || !SB_CFG.shekoFunction) return;
  CM_MAIL[c.id] = "…"; cmRefresh();
  SB.functions.invoke(SB_CFG.shekoFunction, {body: {action: "notify", id: c.id}}).then(function(r){
    var d = (r && r.data) || {};
    CM_MAIL[c.id] = d.sent ? L("Email sent to the commenter.","اتبعت إيميل لصاحب التعليق.") : d.error === "mail_not_configured" ? L("Email not set up yet (Gmail App Password missing).","الإيميل لسه مش متظبط (ناقص App Password بتاع جيميل).") : d.error === "send_failed" ? L("Email couldn't be sent.","الإيميل ما اتبعتش.") : d.reason === "own_comment" ? "" : d.skipped ? L("Already emailed before.","اتبعتله إيميل قبل كده.") : L("Email couldn't be sent.","الإيميل ما اتبعتش.");
    cmRefresh();
  }, function(){ CM_MAIL[c.id] = L("Email couldn't be sent.","الإيميل ما اتبعتش."); cmRefresh(); });
}
function cmReact(c, k){ CM_PICK = null; var nu = c.owner_reaction === k ? null : k; cmUpd(c, {owner_reaction: nu}, function(err){ if (!err && nu) cmNotify(c); }); }
function cmSaveReply(c){
  var ta = document.getElementById("cmr" + c.id); if (!ta || CM_RBUSY) return; var v = ta.value.trim();
  CM_RBUSY = true; cmRefresh();
  cmUpd(c, {owner_reply: v || null, owner_reply_at: v ? new Date().toISOString() : null}, function(err){ CM_RBUSY = false; if (!err) { CM_REPLY = null; if (v) cmNotify(c); } });
}
function cmOwnerAv(){ var a = img(STATE.profile.avatar); return a ? h("img", {class: "cmav sm", src: a, alt: ""}) : h("span", {class: "cmav sm av", text: t(STATE.profile.name).charAt(0)}); }
function cmLoad(){
  if (!SB) return;
  SB.from("comments").select(CM_COLS).order("created_at", {ascending: false}).limit(200).then(function(r){
    if (r.error) { COMMENTS = COMMENTS || []; } else COMMENTS = r.data || [];
    cmRefresh();
    if (location.hash === "#comments" && !cmLoad.done) { cmLoad.done = true; var el = document.getElementById("comments"); if (el) setTimeout(function(){ el.scrollIntoView({block: "start"}); }, 60); }
  });
}
function cmRefresh(){ var old = document.getElementById("comments"); if (!old) return; var nu = renderComments(); if (nu) { old.replaceWith(nu); nu.classList.add("in"); nu.querySelectorAll(".rv").forEach(function(x){ x.classList.add("in"); }); } }
function cmSignIn(){
  var ta = document.getElementById("cmtext"); lsSet("ms_cm_draft", ta ? ta.value : ""); lsSet("ms_go_cm", "1");
  SB.auth.signInWithOAuth({provider: "google", options: {redirectTo: location.origin + location.pathname, queryParams: {prompt: "select_account"}}});
}
function cmAgo(iso){
  var d = (Date.now() - new Date(iso).getTime()) / 1000, f;
  try { f = new Intl.RelativeTimeFormat(lang === "ar" ? "ar-EG" : "en", {numeric: "auto"}); } catch (e) { return new Date(iso).toLocaleDateString(); }
  if (d < 60) return f.format(0, "minute"); if (d < 3600) return f.format(-Math.floor(d / 60), "minute");
  if (d < 86400) return f.format(-Math.floor(d / 3600), "hour"); if (d < 2592000) return f.format(-Math.floor(d / 86400), "day");
  return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", {day: "numeric", month: "short", year: "numeric"});
}
function cmPost(){
  var ta = document.getElementById("cmtext"); if (!ta || CM_BUSY) return; var body = ta.value.trim();
  if (body.length < 2) { CM_ERR = L("Write a few words first.","اكتب كلمتين الأول."); cmRefresh(); return; }
  CM_BUSY = true; CM_ERR = ""; cmRefresh();
  SB.from("comments").insert({body: body}).select(CM_COLS).single().then(function(r){
    CM_BUSY = false;
    if (r.error) { CM_ERR = /rate_limited/.test(r.error.message || "") ? L("You've posted a lot in the last hour. Try again later.","علّقت كتير في آخر ساعة. جرّب كمان شوية.") : L("Couldn't post. Try again.","التعليق ما اتنشرش. جرّب تاني."); lsSet("ms_cm_draft", body); }
    else { (COMMENTS = COMMENTS || []).unshift(r.data); lsSet("ms_cm_draft", ""); if (SB_CFG && SB_CFG.shekoFunction && !CAN_EDIT) SB.functions.invoke(SB_CFG.shekoFunction, {body: {action: "comment_alert", id: r.data.id}}).catch(function(){}); }
    cmRefresh();
  });
}
function cmDel(c){
  if (!window.confirm(L("Delete this comment?","تمسح التعليق ده؟"))) return;
  SB.from("comments").delete().eq("id", c.id).then(function(r){ if (!r.error) COMMENTS = COMMENTS.filter(function(x){ return x.id !== c.id; }); cmRefresh(); });
}
function cmHide(c){ cmUpd(c, {hidden: !c.hidden}); }
function cmToTestimonial(c){
  var T = STATE.testimonials = STATE.testimonials || [];
  if (T.some(function(x){ return x.fromComment === c.id; })) { CM_MAIL[c.id] = L("Already in testimonials.","موجود في الآراء بالفعل."); cmRefresh(); return; }
  if (!window.confirm(L("Show this comment as a testimonial? Only do this if the person is OK with it. You can edit or hide it from the dashboard.","تعرض التعليق ده في آراء العملاء؟ اعمل كده بس لو صاحبه موافق. تقدر تعدّله أو تخفيه من لوحة التحكم."))) return;
  T.push({id: uid("q"), show: true, name: c.name || "", role: {en: "", ar: ""}, quote: {en: c.body, ar: c.body}, link: "", photo: "", photoUrl: c.avatar || "", fromComment: c.id});
  markDirty(); save();
  CM_MAIL[c.id] = L("Added to testimonials. Add their job title from the dashboard.","اتضاف للآراء. ضيف وظيفته من لوحة التحكم."); render();
}
function cmAvatar(c){ return c.avatar ? h("img", {class: "cmav", src: c.avatar, alt: "", referrerpolicy: "no-referrer", loading: "lazy"}) : h("span", {class: "cmav av", text: (c.name || "?").charAt(0)}); }
function renderComments(){
  if (MODE !== "supabase") return null;
  if (COMMENTS === null) setTimeout(cmLoad, 0);
  var meta = SB_USER ? (SB_USER.user_metadata || {}) : {}, me = SB_USER ? {name: meta.full_name || meta.name || SB_USER.email, avatar: meta.avatar_url || meta.picture || ""} : null;
  var draft = ""; try { draft = localStorage.getItem("ms_cm_draft") || ""; } catch (e) {}
  var form = SB_USER ? h("div", {class: "cmform"}, [
    h("div", {class: "cmme"}, [cmAvatar(me), h("b", {text: me.name}), h("button", {class: "lnk", onclick: sbSignOut, text: L("Sign out","خروج")})]),
    h("textarea", {id: "cmtext", dir: "auto", maxlength: "1000", rows: "3", placeholder: L("Write your comment…","اكتب تعليقك…"), oninput: function(e){ var c = document.getElementById("cmcount"); if (c) c.textContent = e.target.value.length + "/1000"; }}, []),
    h("div", {class: "cmbar"}, [h("small", {id: "cmcount", class: "lbl2", text: draft.length + "/1000"}), CM_ERR ? h("small", {class: "cmerr", text: CM_ERR}) : null, h("button", {class: "btn primary sm", disabled: CM_BUSY, onclick: cmPost, text: CM_BUSY ? L("Posting…","بينشر…") : L("Post comment","انشر التعليق")})])
  ]) : h("div", {class: "cmform cmgate"}, [
    h("p", {text: L("Sign in with your Google account to leave a comment. Your name and photo appear next to it.","سجّل دخول بحساب جوجل بتاعك وسيب تعليقك. اسمك وصورتك هيظهروا جنبه.")}),
    h("button", {class: "btn gbtn", onclick: cmSignIn, html: '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg><span>' + L("Sign in with Google","سجّل بجوجل") + '</span>'})
  ]);
  var list = COMMENTS === null ? [h("p", {class: "lbl2", text: L("Loading comments…","بيحمّل التعليقات…")})]
    : !COMMENTS.length ? [h("p", {class: "lbl2 cmempty", text: L("No comments yet. Be the first.","لسه مفيش تعليقات. كن أول واحد.")})]
    : COMMENTS.map(function(c){
      var mine = SB_USER && c.user_id === SB_USER.id;
      return h("article", {class: "cm" + (c.hidden ? " hid" : "")}, [cmAvatar(c), h("div", {class: "cmb"}, [
        h("div", {class: "cmh"}, [h("b", {text: c.name || L("Visitor","زائر")}), h("small", {class: "lbl2", text: cmAgo(c.created_at)}), c.hidden ? h("small", {class: "cmtag", text: L("Hidden","مخفي")}) : null,
          h("span", {class: "cmact"}, [CAN_EDIT ? h("button", {class: "lnk", onclick: function(){ cmHide(c); }, text: c.hidden ? L("Show","إظهار") : L("Hide","إخفاء")}) : null, CAN_EDIT ? h("button", {class: "lnk", onclick: function(){ cmToTestimonial(c); }, text: L("Add to testimonials","انقله للآراء")}) : null, (mine || CAN_EDIT) ? h("button", {class: "lnk", onclick: function(){ cmDel(c); }, text: L("Delete","مسح")}) : null])]),
        h("p", {dir: "auto", text: c.body}),
        (c.owner_reaction && CM_REACT[c.owner_reaction]) || CAN_EDIT ? h("div", {class: "cmfoot"}, [
          c.owner_reaction && CM_REACT[c.owner_reaction] ? h("span", {class: "cmrx", title: L("Reaction from ","تفاعل من ") + t(STATE.profile.name)}, [cmOwnerAv(), h("span", {text: CM_REACT[c.owner_reaction]})]) : null,
          CAN_EDIT ? h("button", {class: "lnk", onclick: function(){ CM_PICK = CM_PICK === c.id ? null : c.id; cmRefresh(); }, text: c.owner_reaction ? L("Change reaction","غيّر التفاعل") : L("React","تفاعل")}) : null,
          CAN_EDIT ? h("button", {class: "lnk", onclick: function(){ CM_REPLY = CM_REPLY === c.id ? null : c.id; cmRefresh(); var r = document.getElementById("cmr" + c.id); if (r) r.focus(); }, text: c.owner_reply ? L("Edit reply","عدّل الرد") : L("Reply","رد")}) : null
        ]) : null,
        CAN_EDIT && CM_MAIL[c.id] ? h("small", {class: "lbl2 cmmail", text: "✉ " + CM_MAIL[c.id]}) : null,
        CAN_EDIT && CM_PICK === c.id ? h("div", {class: "cmpick", role: "group", "aria-label": L("Choose a reaction","اختار تفاعل")}, Object.keys(CM_REACT).map(function(k){ return h("button", {class: "cmemo" + (c.owner_reaction === k ? " on" : ""), "aria-pressed": String(c.owner_reaction === k), onclick: function(){ cmReact(c, k); }, text: CM_REACT[k]}); })) : null,
        c.owner_reply && CM_REPLY !== c.id ? h("div", {class: "cmreply"}, [cmOwnerAv(), h("div", {class: "cmb"}, [
          h("div", {class: "cmh"}, [h("b", {text: t(STATE.profile.name)}), h("small", {class: "cmtag au", text: L("Author","صاحب الموقع")}), c.owner_reply_at ? h("small", {class: "lbl2", text: cmAgo(c.owner_reply_at)}) : null]),
          h("p", {dir: "auto", text: c.owner_reply})
        ])]) : null,
        CAN_EDIT && CM_REPLY === c.id ? h("div", {class: "cmreply ed"}, [cmOwnerAv(), h("div", {class: "cmb"}, [
          h("textarea", {id: "cmr" + c.id, dir: "auto", maxlength: "1000", rows: "2", placeholder: L("Write your reply…","اكتب ردك…")}, []),
          h("div", {class: "cmbar"}, [c.owner_reply ? h("button", {class: "lnk", onclick: function(){ var r = document.getElementById("cmr" + c.id); if (r) r.value = ""; cmSaveReply(c); }, text: L("Remove reply","امسح الرد")}) : null,
            h("button", {class: "btn ghost sm", onclick: function(){ CM_REPLY = null; cmRefresh(); }, text: L("Cancel","إلغاء")}),
            h("button", {class: "btn primary sm", disabled: CM_RBUSY, onclick: function(){ cmSaveReply(c); }, text: CM_RBUSY ? L("Saving…","بيحفظ…") : L("Send reply","ابعت الرد")})])
        ])]) : null
      ])]);
    });
  var sec = h("section", {class: "sec", id: "comments"}, [h("div", {class: "wrap"}, [
    secHead("comments", L("Comments","التعليقات"), L("Say hi, ask a question or leave feedback.","سلّم، اسأل، أو سيب رأيك.")),
    h("div", {class: "cmwrap"}, [form, h("div", {class: "cmlist"}, list)])
  ])]);
  var ta = sec.querySelector("#cmtext"); if (ta && draft) ta.value = draft;
  if (CM_REPLY !== null) { var rc = (COMMENTS || []).filter(function(x){ return x.id === CM_REPLY; })[0], rt = sec.querySelector("#cmr" + CM_REPLY); if (rc && rt) rt.value = rc.owner_reply || ""; }
  return sec;
}

/* ---------- Supabase backend ---------- */
function sbRedirect(){ return location.origin + location.pathname + "#dashboard"; }
function sbSignIn(){ try { localStorage.setItem("ms_go_dash", "1"); } catch (e) {} SB.auth.signInWithOAuth({provider: "google", options: {redirectTo: sbRedirect(), queryParams: {prompt: "select_account"}}}); }
function sbSignOut(){ var y = window.scrollY; SB.auth.signOut().then(function(){ SB_USER = null; CAN_EDIT = false; render(); window.scrollTo(0, y); }); }
function sbUpload(key, blob){
  var path = "uploads/" + key + ".webp";
  return SB.storage.from("media").upload(path, blob, {contentType: "image/webp", upsert: true}).then(function(r){ if (r.error) throw r.error; return SB.storage.from("media").getPublicUrl(path).data.publicUrl; });
}
function sbCheckOwner(){
  var wantDash = false; try { wantDash = localStorage.getItem("ms_go_dash") === "1"; if (SB_USER) localStorage.removeItem("ms_go_dash"); } catch (e) {}
  if (SB_USER && wantDash && route !== "dashboard") { route = "dashboard"; history.replaceState(null, "", location.pathname + "#dashboard"); }
  var wantCm = false; try { wantCm = localStorage.getItem("ms_go_cm") === "1"; if (SB_USER) localStorage.removeItem("ms_go_cm"); } catch (e) {}
  var toCm = function(){ if (!wantCm || !SB_USER || route !== "site") return; setTimeout(function(){ var el = document.getElementById("comments"); if (el) el.scrollIntoView({block: "start"}); var ta = document.getElementById("cmtext"); if (ta) ta.focus({preventScroll: true}); }, 120); };
  if (!SB_USER) { CAN_EDIT = false; AUTH_READY = true; render(); return; }
  SB.rpc("is_owner").then(function(r){ CAN_EDIT = !r.error && r.data === true; AUTH_READY = true; if (CAN_EDIT) { IS_OWNER_DEVICE = true; lsSet("ms_owner", "1"); trackPresence(); } if (CAN_EDIT) { COMMENTS = null; inboxLoad(); } render(); toCm(); });
}
var LIVE_CH = null;
function trackPresence(){ if (LIVE_CH) try { LIVE_CH.track({at: Date.now(), to: TO, page: route, mobile: IS_MOBILE, owner: CAN_EDIT || IS_OWNER_DEVICE}); } catch (e) {} }
function sbBoot(){
  SB = window.supabase.createClient(SB_CFG.supabaseUrl, SB_CFG.supabaseAnonKey, {auth: {flowType: "pkce", detectSessionInUrl: true, persistSession: true}});
  SB.from("site_content").select("data").eq("id", 1).maybeSingle().then(function(r){
    if (r && r.data && r.data.data && r.data.data.profile) {
      var d = r.data.data, icons = ICONS, logos = LOGOS, imgs = IMG;
      if (d.profile && d.profile.cutout === undefined) d.profile.cutout = STATE.profile.cutout;
      migrate(d); STATE = d; STATE.__icons = icons; STATE.__logos = logos;
      IMG = Object.assign({}, imgs, d.images || {}); Object.keys(imgs).forEach(function(k){ if (/^assets\//.test(String(IMG[k]))) IMG[k] = imgs[k]; }); STATE.images = IMG;
      render();
    }
  });
  SB.auth.getSession().then(function(r){ SB_USER = r.data && r.data.session ? r.data.session.user : null; sbCheckOwner(); });
  SB.auth.onAuthStateChange(function(ev, session){ var u = session ? session.user : null; if ((u && u.id) !== (SB_USER && SB_USER.id)) { SB_USER = u; sbCheckOwner(); } });
  var me = Math.random().toString(36).slice(2);
  var live = SB.channel("site-live", {config: {presence: {key: me}}});
  live.on("postgres_changes", {event: "INSERT", schema: "public", table: "live_messages"}, function(p){
    var m = p && p.new; if (!m) return;
    if (m.target && m.target !== TO) return;
    if (CAN_EDIT && route === "dashboard") return;
    showLive(m);
  });
  live.on("presence", {event: "sync"}, function(){
    var st = live.presenceState();
    PEERS = Object.keys(st).map(function(k){ var meta = (st[k] && st[k][0]) || {}; return {isMe: k === me, kind: meta.owner ? "owner" : "viewer", to: meta.to || "", page: meta.page || "", mobile: !!meta.mobile}; });
    var c = document.getElementById("livecount"); if (c) c.textContent = String(liveViewers());
    var ol = document.getElementById("liveonline"); if (ol) ol.replaceWith(onlineList());
  });
  LIVE_CH = live;
  live.subscribe(function(status){ if (status === "SUBSCRIBED") trackPresence(); });
  track("view");
}

/* ---------- boot ---------- */
render();
if (MODE === "supabase") { sbBoot(); }
else if (window.claude && typeof window.claude.use === "function") {
  window.claude.use("sample").then(function(x){ SAMPLE = x || null; }, function(){});
  window.claude.use("room").then(function(r){
    ROOM = r || null; if (!ROOM) return;
    ROOM.on("live", function(m){ if (!m || m.kind !== "viewer") return; showLive(m.data); });
    ROOM.onPeers(function(ch){ PEERS = (ch && ch.peers) ? ch.peers.slice() : ROOM.peers().slice(); var c = document.getElementById("livecount"); if (c) c.textContent = String(liveViewers()); });
    try { PEERS = ROOM.peers().slice(); } catch (e) {}
    ROOM.presence({page: route}).catch(function(){});
    if (route === "dashboard") render();
  }, function(){});
  Promise.all([window.claude.use("artifact"), window.claude.use("user"), window.claude.use("downloads")]).then(function(r){
    ARTIFACT = r[0]; USER = r[1]; DOWNLOADS = r[2];
    if (!USER || !ARTIFACT) { AUTH_READY = true; if (route === "dashboard") render(); return; }
    return USER.canEdit().then(function(ok){ CAN_EDIT = !!ok; AUTH_READY = true; render(); });
  }).catch(function(){ AUTH_READY = true; if (route === "dashboard") render(); });
} else { AUTH_READY = true; if (location.search.indexOf("admin") >= 0) CAN_EDIT = true; render(); }
})();
