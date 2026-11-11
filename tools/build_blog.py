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
  "product": ("connect", "HUDERA Connect: مساعد واتساب ذكي يرد على العملاء ويحجز المواعيد", "HUDERA Connect: a WhatsApp AI assistant that answers customers and books appointments"),
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
 {
  "pair": "collections-whatsapp",
  "date": "2026-11-10",
  "product": ("hesabo", "Hesabo: مساعد واتساب لكشوف الحساب وتأكيد المدفوعات", "Hesabo: a WhatsApp assistant for statements and payment confirmations"),
  "ar": {
   "slug": "collections-automation-whatsapp",
   "title": "أتمتة التحصيل على واتساب: كيف تقلل المتأخرات بدون ضغط على فريق الحسابات؟",
   "desc": "كيف يساعد موظف الذكاء الاصطناعي على واتساب في التحصيل: تذكير قبل الاستحقاق وبعده، كشف حساب ونسخة فاتورة عند الطلب، واستلام إثبات التحويل ليعتمده المحاسب. دليل عملي للشركات في السعودية والخليج ومصر.",
   "lead": "جزء كبير من وقت فريق الحسابات يضيع في رسائل متكررة: تذكير عميل بمستحقاته، إرسال كشف حساب، البحث عن نسخة فاتورة، ومطابقة صورة تحويل وصلت على واتساب. هذه المهام مهمة، لكنها لا تحتاج محاسباً في كل مرة.",
   "sections": [
    ("أين يضيع الوقت في التحصيل؟",
     ["<ul><li><b>التذكير اليدوي:</b> قائمة طويلة من العملاء، ورسائل تُكتب واحدة واحدة، وتذكير يتأخر أو يُنسى.</li><li><b>طلبات المستندات:</b> «أرسل لي الكشف»، «أحتاج نسخة الفاتورة»، وكل طلب يعني البحث في النظام ثم الإرسال.</li><li><b>إثباتات التحويل:</b> صور تصل على واتساب بدون رقم فاتورة، وتحتاج مطابقة وتسجيل.</li></ul>"]),
    ("ما الذي يتولاه موظف التحصيل الذكي؟",
     ["<ul><li><b>تذكير في الوقت المناسب:</b> قبل تاريخ الاستحقاق وبعده، بصيغة محترمة تناسب كل عميل، وبالعربي أو الإنجليزي.</li><li><b>المستندات عند الطلب:</b> كشف الحساب ونسخة الفاتورة من نظامك مباشرة، في ثوانٍ.</li><li><b>استلام إثبات التحويل:</b> يطلب من العميل البيانات الناقصة، ويجهز الدفعة لتظهر عند المحاسب للمراجعة.</li><li><b>تقرير يومي:</b> من دفع، ومن وعد بالدفع ومتى، ومن يحتاج متابعة من شخص.</li></ul>",
      "يمكنك تجربة نموذج حي لهذه المهمة على <a href=\"/\">الصفحة الرئيسية</a>، يعمل على بيانات تجريبية."]),
    ("ما الذي يبقى عند فريقك؟",
     ["الموظف الذكي لا يعتمد أي دفعة بنفسه. اعتماد الدفعات، والخصومات، وجدولة الأقساط، والتعامل مع العملاء المتعثرين، كلها قرارات تبقى عند فريقك. الموظف الذكي يجهز المعلومة ويرفعها لهم، وكل خطوة لها سجل واضح."]),
    ("كيف تبدأ؟",
     ["<ol><li><b>ابدأ بالمستندات:</b> كشف الحساب ونسخة الفاتورة هي أسهل نقطة بداية وأسرعها أثراً.</li><li><b>أضف التذكير:</b> حدد متى يُرسل التذكير، وبأي صيغة، ومتى يتوقف ويحوّل لشخص.</li><li><b>اربط مصدر البيانات:</b> النظام المحاسبي الذي تستخدمه، أو ملف Excel منظم في البداية.</li><li><b>قِس:</b> عدد الطلبات التي انتهت بدون تدخل، ومتوسط أيام التحصيل قبل وبعد.</li></ol>"]),
   ],
   "faq": [
    ("هل تزعج التذكيرات العملاء؟","لا، إذا كانت في وقتها وبصيغة محترمة. أنت تحدد عدد التذكيرات وتوقيتها، وتقدر تستثني عملاء معينين."),
    ("هل يرتبط بنظامنا المحاسبي؟","يرتبط بالأنظمة التي تستخدمها قدر الإمكان، ويمكن البدء بملف Excel منظم إذا كان الربط المباشر يحتاج وقتاً."),
    ("هل يعتمد الدفعات تلقائياً؟","لا. يستلم إثبات التحويل ويجهزه، والمحاسب هو من يعتمد."),
    ("هل يعمل مع العملاء الذين يتكلمون الإنجليزية؟","نعم، يرد بالعربي أو الإنجليزي حسب لغة العميل."),
    ("كيف نعرف أنه نجح؟","نقيس عدد الطلبات التي انتهت بدون تدخل، والوقت الذي وفّره فريق الحسابات، ومتوسط أيام التحصيل."),
   ],
   "cta": "تود أن ترى كيف يعمل التحصيل الذكي على بياناتك؟",
   "cta_btn": "تواصل معنا على واتساب",
   "wa_text": "مرحباً، قرأت مقال أتمتة التحصيل على واتساب وأحب أعرف أكثر",
   "crumb": "المدونة", "home": "الرئيسية", "faq_h": "أسئلة شائعة", "by": "فريق HUDERA AI",
  },
  "en": {
   "slug": "collections-automation-whatsapp",
   "title": "Automating Collections on WhatsApp: Fewer Overdue Invoices Without Overloading Your Finance Team",
   "desc": "How an AI employee on WhatsApp helps with collections: reminders before and after due dates, statements and invoice copies on request, and transfer confirmations queued for an accountant to approve. A practical guide for businesses in Saudi Arabia, the Gulf and Egypt.",
   "lead": "A large share of a finance team's time goes into repetitive messages: reminding customers about dues, sending statements, finding invoice copies and matching transfer screenshots that arrive on WhatsApp. These tasks matter, but they don't need an accountant every time.",
   "sections": [
    ("Where does collections time go?",
     ["<ul><li><b>Manual reminders:</b> long customer lists, messages typed one by one, and reminders that go out late or not at all.</li><li><b>Document requests:</b> \"Send me my statement\", \"I need a copy of the invoice\", and every request means searching the system and sending.</li><li><b>Transfer confirmations:</b> screenshots arrive on WhatsApp without an invoice number and need matching and recording.</li></ul>"]),
    ("What does an AI collections employee handle?",
     ["<ul><li><b>Timely reminders:</b> before and after the due date, in a respectful tone suited to each customer, in Arabic or English.</li><li><b>Documents on request:</b> statements and invoice copies straight from your system, in seconds.</li><li><b>Transfer confirmations:</b> it asks the customer for any missing details and queues the payment for an accountant to review.</li><li><b>A daily report:</b> who paid, who promised to pay and when, and who needs a person to follow up.</li></ul>",
      "You can try a live demo of this task on the <a href=\"/en/\">home page</a>. It runs on sample data."]),
    ("What stays with your team?",
     ["The AI employee never approves a payment on its own. Approving payments, discounts, instalment plans and handling customers in difficulty all stay with your team. The AI employee prepares the information and passes it on, and every step is logged."]),
    ("How to start",
     ["<ol><li><b>Start with documents:</b> statements and invoice copies are the easiest place to begin and show results fastest.</li><li><b>Add reminders:</b> decide when reminders go out, in what wording, and when to stop and hand over to a person.</li><li><b>Connect the data:</b> your accounting system, or a well-structured Excel file to begin with.</li><li><b>Measure:</b> how many requests finished without a person, and your average collection days before and after.</li></ol>"]),
   ],
   "faq": [
    ("Will reminders annoy customers?","Not if they are timely and respectful. You decide how many reminders go out and when, and you can exclude specific customers."),
    ("Does it connect to our accounting system?","It connects to the systems you use where possible, and you can start with a structured Excel file if a direct connection takes time."),
    ("Does it approve payments automatically?","No. It receives and prepares the transfer confirmation, and an accountant approves it."),
    ("Does it work with English-speaking customers?","Yes, it replies in Arabic or English depending on the customer."),
    ("How do we know it's working?","We measure requests that finished without a person, time saved by the finance team, and average collection days."),
   ],
   "cta": "Want to see AI collections running on your own data?",
   "cta_btn": "Message us on WhatsApp",
   "wa_text": "Hi, I read your article about automating collections on WhatsApp and would like to know more",
   "crumb": "Blog", "home": "Home", "faq_h": "Frequently asked questions", "by": "HUDERA AI team",
  },
 },
 {
  "pair": "van-sales-gps",
  "product": ("vansales", "VanSales: برنامج مندوبي المبيعات بتتبع GPS وحسابات سحابية", "VanSales: van sales software with GPS tracking and cloud accounting"),
  "date": "2026-11-10",
  "ar": {
   "slug": "van-sales-app-gps",
   "title": "برنامج مندوبين مبيعات بالـ GPS: تابع فريق التوزيع والفواتير والتحصيل من مكان واحد",
   "desc": "ماذا يقدم برنامج المندوبين (Van Sales) لشركات التوزيع: زيارات موثقة بالموقع، فاتورة في مكان العميل، مخزون السيارة، تحصيل ومطابقة نقدية آخر اليوم، ولوحة متابعة للمدير.",
   "lead": "في شركات التوزيع، يحدث جزء كبير من البيع خارج المكتب: مندوب في سيارة، يزور عشرات العملاء، ويكتب فواتير ويستلم مبالغ. وعندما يكون كل هذا على الورق أو في رسائل متفرقة، يصعب أن تعرف ماذا حدث فعلاً اليوم.",
   "sections": [
    ("أين المشكلة في المتابعة الورقية؟",
     ["<ul><li><b>لا رؤية للمسار:</b> لا تعرف أي العملاء زارهم المندوب فعلاً، ومتى.</li><li><b>فواتير متأخرة:</b> الفاتورة الورقية تصل للمكتب بعد يوم أو أكثر، وتُدخل يدوياً.</li><li><b>فروقات في النقدية والمخزون:</b> مطابقة ما خرج في السيارة مع ما بيع وما رجع وما تم تحصيله تأخذ وقتاً وتسبب خلافات.</li></ul>"]),
    ("ماذا يقدم برنامج المندوبين؟",
     ["<ul><li><b>زيارات موثقة بالموقع (GPS):</b> كل زيارة مسجلة بالمكان والوقت، ومسار اليوم واضح للمدير.</li><li><b>فاتورة في مكان العميل:</b> بالأصناف والأسعار المعتمدة، وتُرسل للعميل مباشرة.</li><li><b>مخزون السيارة:</b> ما تم تحميله، وما بيع، وما رجع، لحظة بلحظة.</li><li><b>التحصيل:</b> تسجيل المبالغ المستلمة، ومطابقة النقدية آخر اليوم.</li><li><b>لوحة متابعة للمدير:</b> المبيعات حسب المندوب والمنطقة والعميل، والمتأخرات.</li></ul>",
      "يمكنك تجربة نموذج حي لبرنامج المندوبين على <a href=\"/\">الصفحة الرئيسية</a>، يعمل على بيانات تجريبية."]),
    ("الربط مع الحسابات وواتساب",
     ["يرتبط البرنامج بالنظام المحاسبي حتى لا تُدخل الفواتير مرتين، ويمكن ربطه بموظف ذكاء اصطناعي على واتساب ليستقبل طلبات العملاء ويحولها لطلبات مرتبة تظهر للمندوب. وتبقى الأسعار الاستثنائية والخصومات بموافقة المدير."]),
    ("كيف تبدأ؟",
     ["<ol><li><b>ابدأ بمندوب أو منطقة واحدة</b> لفترة تجربة محددة.</li><li><b>جهز البيانات الأساسية:</b> العملاء، والأصناف، والأسعار.</li><li><b>درّب الفريق:</b> البرنامج على الموبايل وبسيط في الاستخدام.</li><li><b>قِس:</b> وقت إدخال الفواتير، والفروقات في النقدية والمخزون، قبل وبعد. ثم وسّع على باقي الفريق.</li></ol>"]),
   ],
   "faq": [
    ("هل يعمل على موبايل المندوب؟","نعم، صُمم ليُستخدم من الموبايل أثناء الزيارة."),
    ("هل يتتبع المندوب طوال الوقت؟","يسجل الموقع عند الزيارات وأثناء ساعات العمل حسب السياسة التي تحددها الشركة."),
    ("هل يرتبط بنظامنا المحاسبي؟","يرتبط بالأنظمة التي تستخدمها قدر الإمكان، ونحدد طريقة الربط في أول جلسة."),
    ("هل يناسب الشركات الصغيرة؟","نعم، يمكن البدء بعدد قليل من المندوبين ثم التوسع."),
    ("هل يمكن تخصيص الفاتورة؟","نعم، تُصمم الفاتورة ببيانات شركتك، ومتطلبات الفاتورة الضريبية في بلدك تُراجع مع محاسبك قبل التفعيل."),
   ],
   "cta": "تود أن ترى برنامج المندوبين على أصنافك وعملائك؟",
   "cta_btn": "تواصل معنا على واتساب",
   "wa_text": "مرحباً، قرأت مقال برنامج المندوبين بالـ GPS وأحب أعرف أكثر",
   "crumb": "المدونة", "home": "الرئيسية", "faq_h": "أسئلة شائعة", "by": "فريق HUDERA AI",
  },
  "en": {
   "slug": "van-sales-app-gps",
   "title": "Van Sales App with GPS: Track Routes, Invoices and Collections for Your Distribution Team",
   "desc": "What a van sales app gives distribution companies: GPS-verified visits, invoices at the customer's door, van stock, end-of-day cash reconciliation and a manager dashboard.",
   "lead": "In distribution companies, much of the selling happens outside the office: a rep in a van visits dozens of customers, writes invoices and collects cash. When all of that lives on paper or in scattered messages, it is hard to know what actually happened today.",
   "sections": [
    ("What goes wrong with paper tracking?",
     ["<ul><li><b>No route visibility:</b> you can't tell which customers the rep actually visited, or when.</li><li><b>Late invoices:</b> paper invoices reach the office a day or more later and are typed in by hand.</li><li><b>Cash and stock gaps:</b> reconciling what left in the van with what was sold, returned and collected takes time and causes disputes.</li></ul>"]),
    ("What does a van sales app provide?",
     ["<ul><li><b>GPS-verified visits:</b> every visit is logged with place and time, and the day's route is clear to the manager.</li><li><b>Invoices at the customer's door:</b> with approved items and prices, sent to the customer directly.</li><li><b>Van stock:</b> what was loaded, sold and returned, in real time.</li><li><b>Collections:</b> amounts received are recorded and cash is reconciled at the end of the day.</li><li><b>Manager dashboard:</b> sales by rep, area and customer, plus overdue balances.</li></ul>",
      "You can try a live demo of the van sales app on the <a href=\"/en/\">home page</a>. It runs on sample data."]),
    ("Connecting accounting and WhatsApp",
     ["The app connects to your accounting system so invoices are not entered twice, and it can work with an AI employee on WhatsApp that takes customer orders and turns them into clean orders for the rep. Special prices and discounts still need a manager's approval."]),
    ("How to start",
     ["<ol><li><b>Start with one rep or one area</b> for a fixed pilot period.</li><li><b>Prepare the basics:</b> customers, items and prices.</li><li><b>Train the team:</b> the app runs on a phone and is simple to use.</li><li><b>Measure</b> invoice entry time and cash and stock gaps before and after, then roll out to the rest of the team.</li></ol>"]),
   ],
   "faq": [
    ("Does it run on the rep's phone?","Yes, it is designed to be used on a phone during the visit."),
    ("Does it track the rep all the time?","It records location at visits and during working hours, according to the policy your company sets."),
    ("Does it connect to our accounting system?","It connects to the systems you use where possible, and we agree on the connection in the first session."),
    ("Is it suitable for small companies?","Yes, you can start with a few reps and expand."),
    ("Can the invoice be customised?","Yes, it carries your company details, and your country's tax-invoice requirements are reviewed with your accountant before go-live."),
   ],
   "cta": "Want to see the van sales app with your items and customers?",
   "cta_btn": "Message us on WhatsApp",
   "wa_text": "Hi, I read your article about the van sales app with GPS and would like to know more",
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
.logo{white-space:nowrap;flex:none}.bar nav a{white-space:nowrap}
@media (max-width:560px){.bar{padding:12px 16px;gap:10px}.logo{font-size:17px}.logo img{width:26px;height:26px}.bar nav{gap:11px;font-size:13.5px}footer .bar{flex-wrap:wrap}}
@media (max-width:380px){.bar nav{gap:9px;font-size:12.5px}.logo{font-size:16px}}
@media (max-width:350px){.logo{font-size:0;gap:0}}
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

# Visit counting for blog pages: same consent choice, visitor id and endpoint as the home page.
# Nothing is sent unless the visitor has allowed analytics (here or on the home page).
SB_URL, SB_KEY = "https://aetdmyxpbxlkywkvltae.supabase.co", "sb_publishable_5pt8cZlsoOgmX9QQoGWvvA_K8Ri4roW"
CONSENT = {
    "ar": ("هل تسمح لنا بإحصاء زيارتك؟", "نستخدم إحصاءات خاصة بنا لمعرفة العروض المفيدة. لا ملفات إعلانية ولا نبيع أي بيانات.", "إشعار الخصوصية", "الضروري فقط", "السماح بالإحصاءات"),
    "en": ("Can we count your visit?", "We use our own analytics to see which demos are useful. No advertising cookies, nothing sold.", "Privacy notice", "Only essential", "Allow analytics"),
}
TRACK_CSS = """<style>.consent{position:fixed;z-index:70;inset-inline-start:16px;bottom:16px;max-width:560px;width:calc(100% - 32px);background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 18px 40px -18px rgba(11,18,32,.35);padding:16px;display:grid;gap:12px}
.consent p{font-size:14px;margin:0;color:var(--ink)}.consent .row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.consent button{font:inherit;font-size:14px;font-weight:600;border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:10px;padding:8px 14px;cursor:pointer}.consent button.p{background:var(--brand);border-color:var(--brand);color:#fff}</style>"""
TRACK_JS = """<script>(function(){var U="__U__",K="__K__",T=__T__;
function g(k){try{return localStorage.getItem(k)}catch(e){return null}}function s(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function id(){return crypto.randomUUID?crypto.randomUUID():"10000000-1000-4000-8000-100000000000".replace(/[018]/g,function(c){return(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)})}
function consent(){try{return JSON.parse(g("hudera.consent")||"null")}catch(e){return null}}
function ids(){var vid=g("hudera.vid");if(!vid){vid=id();s("hudera.vid",vid)}var x=null;try{x=JSON.parse(g("hudera.sid")||"null")}catch(e){}var now=Date.now();
if(!x||now-x.last>18e5){var q=new URLSearchParams(location.search),ref="";try{var r=document.referrer&&new URL(document.referrer);ref=r&&r.host!==location.host?r.hostname:""}catch(e){}
x={id:id(),last:now,ctx:{referrer:ref,utm_source:q.get("utm_source"),utm_medium:q.get("utm_medium"),utm_campaign:q.get("utm_campaign"),path:location.pathname}}}
x.last=now;s("hudera.sid",JSON.stringify(x));return{vid:vid,sid:x.id,ctx:x.ctx}}
function send(name,props,keep){var c=consent();if(!c||c.analytics!==true)return;try{var i=ids();fetch(U+"/rest/v1/rpc/track",{method:"POST",keepalive:!!keep,headers:{apikey:K,"content-type":"application/json"},
body:JSON.stringify({p_visitor:i.vid,p_session:i.sid,p_context:i.ctx,p_events:[{id:id(),name:name,at:new Date().toISOString(),path:location.pathname,props:props||{}}]})}).catch(function(){})}catch(e){}}
function pv(){send("page_view",{title:document.title.slice(0,120),lang:document.documentElement.lang})}
document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest('a[href^="https://wa.me/"]');if(a)send("whatsapp_clicked",{placement:/\\/products\\//.test(location.pathname)?"product":"blog"},true)});
if(consent())pv();else{var d=document.createElement("div");d.className="consent";d.setAttribute("role","dialog");d.setAttribute("aria-label",T[2]);
d.innerHTML="<p><b>"+T[0]+"</b> "+T[1]+' <a href="/privacy.html">'+T[2]+'</a></p><div class="row"><button type="button" data-c="0">'+T[3]+'</button><button type="button" class="p" data-c="1">'+T[4]+"</button></div>";
d.addEventListener("click",function(e){var b=e.target.closest("[data-c]");if(!b)return;s("hudera.consent",JSON.stringify({v:"2026-10",analytics:b.getAttribute("data-c")==="1",at:new Date().toISOString()}));d.remove();pv()});
document.body.appendChild(d)}})();</script>"""

def tracker(lang):
    import json as _j
    return TRACK_CSS + TRACK_JS.replace("__U__", SB_URL).replace("__K__", SB_KEY).replace("__T__", _j.dumps(list(CONSENT[lang]), ensure_ascii=False))

def chrome(lang, body, alt=None):
    if lang == "ar":
        nav = f'<a href="/">الرئيسية</a><a href="/blog/">المدونة</a><a href="/academy/">الأكاديمية</a><a href="{alt or "/en/blog/"}" lang="en">English</a>'
        foot = '<span>© 2026 HUDERA AI (هوديرا)</span><span><a href="/products/">المنتجات</a> · <a href="/blog/">المدونة</a> · <a href="mailto:info@hudera.ai">info@hudera.ai</a></span>'
        home = "/"
    else:
        nav = f'<a href="/en/">Home</a><a href="/en/blog/">Blog</a><a href="/academy/">Academy</a><a href="{alt or "/blog/"}" lang="ar">عربي</a>'
        foot = '<span>© 2026 HUDERA AI (هوديرا)</span><span><a href="/en/products/">Products</a> · <a href="/en/blog/">Blog</a> · <a href="mailto:info@hudera.ai">info@hudera.ai</a></span>'
        home = "/en/"
    return f"""<body>
<header><div class="bar"><a class="logo" href="{home}"><img src="/favicon-96x96.png" alt="HUDERA AI">HUDERA AI</a><nav>{nav}</nav></div></header>
<main>{body}</main>
<footer><div class="bar">{foot}</div></footer>
{tracker(lang)}
</body></html>"""

def article(a, lang, other_url, date, product=None):
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
    prod = ""
    if product:
        pid, t_ar, t_en = product
        prod = (f'<p class="lead" style="font-size:17px;margin-top:22px"><b>المنتج المرتبط:</b> <a href="/products/{pid}/">{e(t_ar)}</a></p>' if lang == "ar"
                else f'<p class="lead" style="font-size:17px;margin-top:22px"><b>Related product:</b> <a href="/en/products/{pid}/">{e(t_en)}</a></p>')
    body = f"""<div class="crumbs"><a href="{homeu}">{e(a['home'])}</a> › <a href="{blog}">{e(a['crumb'])}</a></div>
<article><h1>{e(a['title'])}</h1><div class="meta">{e(a['by'])} · <time datetime="{date}">{date}</time></div>
<p class="lead">{e(a['lead'])}</p>{secs}
<section class="faq"><h2>{e(a['faq_h'])}</h2>{faq}</section>{prod}
<div class="cta"><p>{e(a['cta'])}</p><a class="btn" href="{wa}" target="_blank" rel="noopener">{e(a['cta_btn'])}</a><a class="btn alt" href="{demos}">{demo_lbl}</a></div></article>"""
    other_lang = "en" if lang == "ar" else "ar"
    return url, head(lang, a["title"] + " | HUDERA AI", a["desc"], url, other_lang, other_url, ld) + chrome(lang, body)

def index(lang, items):
    url = f"{SITE}/blog/" if lang == "ar" else f"{SITE}/en/blog/"
    alt = f"{SITE}/en/blog/" if lang == "ar" else f"{SITE}/blog/"
    t = "مدونة HUDERA AI: الذكاء الاصطناعي للشركات" if lang == "ar" else "HUDERA AI Blog: AI for Businesses"
    d = ("مقالات عملية عن موظفي الذكاء الاصطناعي، وأتمتة واتساب، والتحصيل والموارد البشرية للشركات في السعودية والخليج ومصر."
         if lang == "ar" else "Practical articles on AI employees, WhatsApp automation, collections and HR for businesses in Saudi Arabia, the Gulf and Egypt.")
    cards = "".join(f'<a class="card" href="{u}"><b>{e(ti)}</b><span>{e(de)}</span></a>' for u, ti, de in reversed(items))
    h1 = "المدونة" if lang == "ar" else "Blog"
    ld = {"@context": "https://schema.org", "@type": "Blog", "name": t, "url": url, "inLanguage": lang,
          "publisher": {"@type": "Organization", "name": "HUDERA AI", "url": SITE + "/"}}
    return head(lang, t, d, url, "en" if lang == "ar" else "ar", alt, ld) + chrome(lang, f"<h1>{h1}</h1><p class='lead'>{e(d)}</p><div class='cards'>{cards}</div>")

def main():
    ar_items, en_items, urls = [], [], []
    for A in ARTICLES:
        ar, en, date = A["ar"], A["en"], A["date"]
        ar_url, en_url = f"{SITE}/blog/{ar['slug']}/", f"{SITE}/en/blog/{en['slug']}/"
        _, page = article(ar, "ar", en_url, date, A.get("product"))
        p = root / "blog" / ar["slug"]; p.mkdir(parents=True, exist_ok=True); (p / "index.html").write_text(page, encoding="utf-8")
        _, page = article(en, "en", ar_url, date, A.get("product"))
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


if __name__ == "__main__":
    main()
