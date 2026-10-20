# Browser end-to-end checks (Playwright). Needs: npm run db:reset, local stack (npm run dev), and the local build served on :3301
# (python3 portfolio2/build.py --local localsite && python3 -m http.server 3301 -d localsite).
import time, json, subprocess
from playwright.sync_api import sync_playwright
def q(sql):
    return subprocess.run(["psql","-d","hudera_test","-At","-c",sql],capture_output=True,text=True).stdout.strip()
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1440,"height":900}, user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"); pg=ctx.new_page(); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: m.type=="error" and errs.append(m.text))
    pg.goto("http://localhost:3301/"); time.sleep(3)
    if pg.evaluate("document.documentElement.lang")=="ar": pg.click("#lang"); time.sleep(.5)
    pg.screenshot(path="01_consent.png")
    print("consent visible", pg.is_visible("#consent"), "events before consent", q("select count(*) from app.events"))
    pg.click("[data-consent='1']"); time.sleep(3)
    print("events after consent", q("select string_agg(name, ',' order by id) from app.events"))
    pg.evaluate("location.hash='#s-workforce'"); time.sleep(2); pg.evaluate("location.hash='#value'"); time.sleep(1.5)
    pg.evaluate("const r=document.querySelector('#r-req');r.value=200;r.dispatchEvent(new Event('input',{bubbles:true}))"); time.sleep(4.5)
    print("events now", q("select string_agg(name||coalesce(':'||feature_key,''), ',' order by id) from app.events"))
    # sign in from the contact section
    pg.evaluate("location.hash='#contact'"); time.sleep(1.2); pg.screenshot(path="02_contact_signedout.png")
    pg.click("#req-signin"); pg.wait_for_url("**/auth/v1/authorize**"); pg.click("#pick-saraclient"); pg.wait_for_load_state("networkidle"); time.sleep(3)
    print("url after login", pg.url)
    pg.screenshot(path="03_after_login.png")
    print("acct signed", pg.is_visible("#acct-btn.signed"), "phone prompt", pg.is_visible("#phone-prompt"))
    print("profile", q("select email||' '||coalesce(phone,'-')||' '||login_count from app.profiles"))
    pg.click("#pp-later") if pg.is_visible("#phone-prompt") else None
    pg.evaluate("document.querySelector('#contact').scrollIntoView({behavior:'instant'})"); time.sleep(.6); pg.screenshot(path="04_form.png")
    pg.select_option("#r-reason","ai_employee"); pg.fill("#r-subject","AI HR officer"); pg.fill("#r-msg","short")
    pg.check("[name=r-method][value=whatsapp]"); pg.click("#r-send"); time.sleep(.5)
    print("err1", pg.inner_text("#r-err"))
    pg.fill("#r-msg","We have 300 employees and want leave and payslip questions answered on WhatsApp."); pg.click("#r-send"); time.sleep(.5)
    print("err2", pg.inner_text("#r-err"))
    pg.fill("#r-phone","0551234567"); pg.click("#r-send"); time.sleep(.5); print("err3", pg.inner_text("#r-err"))
    pg.check("#r-consent"); pg.click("#r-send"); time.sleep(2.5)
    pg.screenshot(path="05_done.png")
    print("done text", pg.inner_text("#req-host")[:160].replace("\n"," | "))
    print("db request", q("select ref||' '||status||' '||preferred_method||' '||coalesce(phone,'') from app.contact_requests"))
    pg.click("#acct-btn"); time.sleep(1); pg.screenshot(path="06_panel.png")
    print("panel reqs", pg.inner_text(".acct-reqs")[:120].replace("\n"," | "))
    pg.click("#acct-close"); time.sleep(.3); pg.click("#lang"); time.sleep(1); pg.click("#acct-btn"); time.sleep(.8); pg.screenshot(path="07_panel_ar.png"); pg.click("#acct-close"); time.sleep(.4)
    pg.evaluate("document.querySelector('#contact').scrollIntoView({behavior:'instant'})"); time.sleep(.6); pg.screenshot(path="08_done_ar.png")
    pg.click("#acct-btn"); time.sleep(.6); pg.click("#acct-out"); time.sleep(2)
    print("after logout signed?", pg.is_visible("#acct-btn.signed"), "| last events", q("select string_agg(name, ',' order by id) from (select * from app.events order by id desc limit 6) t"))
    print("users with events", q("select count(distinct user_id) from app.events where source='client'"))
    m=b.new_context(viewport={"width":390,"height":844},device_scale_factor=2,user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1").new_page(); m.goto("http://localhost:3301/"); time.sleep(3); m.screenshot(path="09_mobile_consent.png")
    print("overflow", m.evaluate("document.documentElement.scrollWidth"))
    print("errors", errs)
