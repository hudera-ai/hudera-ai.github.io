// E-mail templates. Each one renders an Arabic + English message (Arabic first, right-to-left),
// as HTML and as plain text. Only data stored in email_messages.data is used — never secrets.

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nl2br = (s) => esc(s).replace(/\r?\n/g, "<br>");

function layout({ site, siteUrl, ar, en, footerAr, footerEn }) {
  const block = (dir, lang, html) => `<div dir="${dir}" lang="${lang}" style="text-align:${dir === "rtl" ? "right" : "left"};font-family:${lang === "ar" ? "'IBM Plex Sans Arabic',Tahoma,Arial" : "Arial,Helvetica"},sans-serif;font-size:15px;line-height:1.7;color:#1F2637">${html}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(site)}</title></head>
<body style="margin:0;background:#F6F7FB;padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E3E7F0;border-radius:14px">
<tr><td style="padding:22px 28px;border-bottom:1px solid #E3E7F0;font-family:Arial,sans-serif;font-size:20px;font-weight:700;color:#0B1220">
<span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background:#3D5AFE;color:#fff;font-size:17px;margin-right:8px">h</span>${esc(site)}</td></tr>
<tr><td style="padding:24px 28px">${block("rtl", "ar", ar)}<hr style="border:0;border-top:1px solid #E3E7F0;margin:22px 0">${block("ltr", "en", en)}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #E3E7F0;font-family:Arial,sans-serif;font-size:12px;color:#8A93A6">
${footerAr ? `<div dir="rtl" style="text-align:right">${footerAr}</div>` : ""}${footerEn ? `<div>${footerEn}</div>` : ""}
<div style="margin-top:6px"><a href="${esc(siteUrl)}" style="color:#3D5AFE">${esc(siteUrl.replace(/^https?:\/\//, ""))}</a></div></td></tr>
</table></td></tr></table></body></html>`;
}

const btn = (href, label) => `<p><a href="${esc(href)}" style="display:inline-block;background:#3D5AFE;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:9px">${esc(label)}</a></p>`;

export function renderEmail(msg, cfg) {
  const d = msg.data || {};
  const site = msg.site_name || cfg.siteName || "HUDERA AI";
  const siteUrl = cfg.siteUrl || "https://hudera-ai.github.io";
  const name = d.name ? String(d.name).split(/\s+/)[0] : "";
  const hiAr = name ? `أهلاً ${esc(name)}،` : "أهلاً،";
  const hiEn = name ? `Hi ${esc(name)},` : "Hi,";
  const txtHiAr = name ? `أهلاً ${name}،` : "أهلاً،";
  const txtHiEn = name ? `Hi ${name},` : "Hi,";
  const why = { footerAr: "وصلتك هذه الرسالة لأن لديك حساباً على موقعنا أو تواصلت معنا.", footerEn: "You are receiving this because you have an account on our site or contacted us." };
  let subject, ar, en, text;

  switch (msg.template) {
    case "welcome":
      subject = `أهلاً بك في ${site} · Welcome to ${site}`;
      ar = `<p>${hiAr}</p><p>تم إنشاء حسابك بنجاح عن طريق جوجل. يمكنك الآن تجربة العروض الحيّة وإرسال طلب تواصل ومتابعة حالته من حسابك.</p>${btn(siteUrl + "/#systems", "جرّب المنصّات")}<p>إذا رغبت أن نتواصل معك عبر واتساب أو الهاتف فأضف رقمك من صفحة الحساب، وإلا سنتواصل معك على هذا البريد.</p>`;
      en = `<p>${hiEn}</p><p>Your account was created with Google. You can now try the live demos, send us a request and follow its status from your account.</p>${btn(siteUrl + "/#systems", "Try the platforms")}<p>If you would like us to reach you on WhatsApp or by phone, add your number in your account. If you don't, we will reply to this e-mail address.</p>`;
      text = `${txtHiAr}\nتم إنشاء حسابك في ${site} عن طريق جوجل.\n${siteUrl}\n\n${txtHiEn}\nYour ${site} account was created with Google.\n${siteUrl}`;
      break;
    case "contact_confirmation":
      subject = `استلمنا طلبك ${d.ref} · We received your request ${d.ref}`;
      ar = `<p>${hiAr}</p><p>استلمنا طلبك بعنوان «${esc(d.subject)}». رقم الطلب: <b dir="ltr">${esc(d.ref)}</b>.</p><p>سيتواصل معك أحد أعضاء الفريق قريباً بالطريقة التي اخترتها، ويمكنك متابعة حالة الطلب من حسابك على الموقع.</p>`;
      en = `<p>${hiEn}</p><p>We received your request “${esc(d.subject)}”. Reference: <b>${esc(d.ref)}</b>.</p><p>Someone from the team will get back to you soon using the method you chose. You can follow the status from your account on the site.</p>`;
      text = `${txtHiAr}\nاستلمنا طلبك «${d.subject}». رقم الطلب: ${d.ref}\n\n${txtHiEn}\nWe received your request "${d.subject}". Reference: ${d.ref}\n${siteUrl}`;
      break;
    case "admin_new_contact": {
      const link = `${siteUrl}/admin/#/leads/${encodeURIComponent(d.request_id || "")}`;
      subject = `طلب تواصل جديد ${d.ref} · New contact request: ${d.subject}`;
      const rows = [["الاسم · Name", d.name], ["الإيميل · E-mail", d.email], ["الجوال · Phone", d.phone || "—"], ["طريقة التواصل · Method", d.method], ["السبب · Reason", d.reason], ["الموضوع · Subject", d.subject]]
        .map(([k, v]) => `<tr><td style="padding:4px 10px 4px 0;color:#5B6478;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join("");
      ar = `<p>وصل طلب تواصل جديد <b dir="ltr">${esc(d.ref)}</b>.</p>${btn(link, "افتح الطلب في لوحة التحكم")}`;
      en = `<table role="presentation" style="font-size:14px">${rows}</table>${btn(link, "Open in the dashboard")}<p style="color:#8A93A6;font-size:12px">The message itself is only shown in the dashboard.</p>`;
      text = `New contact request ${d.ref}\n${d.name} <${d.email}> ${d.phone || ""}\n${d.subject}\n${link}`;
      return { subject, html: layout({ site, siteUrl, ar, en }), text };
    }
    case "follow_up":
    case "account_notice":
    case "announcement": {
      subject = msg.subject || site;
      const body = msg.body_text || "";
      const isAr = /[؀-ۿ]/.test(body);
      const ref = d.ref ? `<p style="color:#8A93A6;font-size:13px">${isAr ? "بخصوص الطلب" : "About request"} <span dir="ltr">${esc(d.ref)}</span></p>` : "";
      const content = `<p>${isAr ? hiAr : hiEn}</p><p>${nl2br(body)}</p>${ref}`;
      const optOut = msg.template === "announcement"
        ? { footerAr: "وصلتك هذه الرسالة لأنك وافقت على استلام أخبارنا. يمكنك إلغاء الموافقة من صفحة حسابك.", footerEn: "You agreed to receive our news. You can turn this off in your account." } : why;
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#F6F7FB;padding:24px 12px">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border:1px solid #E3E7F0;border-radius:14px">
<tr><td style="padding:22px 28px;border-bottom:1px solid #E3E7F0;font-family:Arial,sans-serif;font-size:20px;font-weight:700;color:#0B1220">${esc(site)}</td></tr>
<tr><td dir="${isAr ? "rtl" : "ltr"}" style="padding:24px 28px;text-align:${isAr ? "right" : "left"};font-family:${isAr ? "Tahoma," : ""}Arial,sans-serif;font-size:15px;line-height:1.7;color:#1F2637">${content}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #E3E7F0;font-family:Arial,sans-serif;font-size:12px;color:#8A93A6">${isAr ? optOut.footerAr : optOut.footerEn}<br><a href="${esc(siteUrl)}" style="color:#3D5AFE">${esc(siteUrl.replace(/^https?:\/\//, ""))}</a></td></tr>
</table></td></tr></table></body></html>`;
      text = `${isAr ? txtHiAr : txtHiEn}\n\n${body}\n${d.ref ? `\n(${d.ref})` : ""}\n\n— ${site}\n${siteUrl}`;
      return { subject, html, text };
    }
    default:
      throw Object.assign(new Error(`unknown template ${msg.template}`), { permanent: true });
  }
  return { subject, html: layout({ site, siteUrl, ar, en, ...why }), text };
}
