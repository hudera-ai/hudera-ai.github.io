-- HUDERA Kids Academy: chapters, tasks and 3 picture questions for sessions 2–5 (same shape as session 1).
-- Chapter times stay null until each video is uploaded. Sessions 6–8 wait for the agreed "own project" script.
do $kids$
declare v_s uuid;
begin
  -- S2 · how computers learn
  select s.id into v_s from app.ac_sessions s join app.ac_courses c on c.id = s.course_id where c.slug = 'kids-ai' and s.n = 2;
  update app.ac_lessons set chapters = $j$[
    {"t": null, "title": "البداية: هل يمكن أن نعلّم الكمبيوتر؟", "en": "Can we teach a computer?", "points": ["روبي يريد أن يعرف التفاحة من الموزة.", "الكمبيوتر لا يعرف شيئًا قبل أن نعلّمه.", "سر اليوم: أمثلة كثيرة ← تعلّم."]},
    {"t": null, "title": "نجمع الأمثلة", "en": "Collecting examples", "points": ["صنفان: تفاحة وموزة.", "صور كثيرة لكل صنف، من زوايا مختلفة.", "كلما زادت الأمثلة تعلّم أفضل."]},
    {"t": null, "title": "ندرّب Teachable Machine", "en": "Training Teachable Machine", "points": ["نفتح الموقع مع ولي الأمر.", "نصوّر كل صنف بالكاميرا.", "نضغط «تدريب» وننتظر قليلًا."]},
    {"t": null, "title": "نختبر النموذج", "en": "Testing the model", "points": ["نُري الكاميرا تفاحة ثم موزة.", "نقرأ النسبة التي يخمّنها.", "ماذا يحدث مع برتقالة؟"]},
    {"t": null, "title": "الخلاصة والمهمة", "en": "Wrap-up and mission", "points": ["الكمبيوتر تعلّم من أمثلتنا نحن.", "3 أسئلة بالصور على المنصة.", "المهمة: صورة شاشة النموذج وهو يعرف الصنفين."]}
  ]$j$::jsonb where session_id = v_s and n = 1;
  if not exists (select 1 from app.ac_tasks where session_id = v_s) then
    insert into app.ac_tasks (session_id, title, brief, steps, deliverables, rubric) values (v_s,
      $t$أعلّم الكمبيوتر: تفاحة أم موزة؟$t$,
      $t$مع شخص كبير في البيت، درّب نموذجًا في Teachable Machine يفرّق بين صنفين من اختيارك، واختبره.$t$,
      $j$["اختر صنفين من البيت (مثل تفاحة وموزة، أو قلم وممحاة).", "صوّر كل صنف 20 مرة على الأقل من زوايا مختلفة.", "اضغط «تدريب» ثم اختبر النموذج بالصنفين.", "يصوّر ولي الأمر الشاشة والنموذج يعرف الصنف ويرفعها على المنصة."]$j$::jsonb,
      $j$["صورة شاشة للنموذج وهو يخمّن الصنف (بدون صور لوجه الطفل)."]$j$::jsonb,
      $j$[{"c": "اختار صنفين وجمع أمثلة كافية", "pts": 40}, {"c": "درّب النموذج واختبره", "pts": 40}, {"c": "الصورة واضحة", "pts": 20}]$j$::jsonb);
  end if;
  if not exists (select 1 from app.ac_quiz where session_id = v_s) then
    insert into app.ac_quiz (session_id, n, q, options, answer, why) values
    (v_s, 1, $t$كيف تعلّم الكمبيوتر أن يعرف التفاحة؟$t$, $j$["👀 رآها مرة واحدة فقط", "🍎 أريناه صورًا كثيرة لتفاح", "🪄 عرفها وحده بالسحر"]$j$::jsonb, 1, $t$يتعلّم الكمبيوتر من أمثلة كثيرة نعطيه إياها.$t$),
    (v_s, 2, $t$أي الأمثلة أفضل لتعليم الكمبيوتر؟$t$, $j$["📷 صورة واحدة من زاوية واحدة", "📸 صور كثيرة من زوايا وأماكن مختلفة", "🌑 صور مظلمة لا يظهر فيها شيء"]$j$::jsonb, 1, $t$الأمثلة الكثيرة والمتنوعة تجعل النموذج يتعلّم أفضل.$t$),
    (v_s, 3, $t$أريتَ النموذج برتقالة ولم تعلّمه البرتقال. ماذا سيحدث غالبًا؟$t$, $j$["🍊 سيعرف أنها برتقالة", "🤔 سيخمّن أنها تفاحة أو موزة", "💥 سيتوقف الكمبيوتر"]$j$::jsonb, 1, $t$النموذج يعرف فقط ما تعلّمه، فيختار أقرب صنف يعرفه.$t$);
  end if;

  -- S3 · when the computer is wrong
  select s.id into v_s from app.ac_sessions s join app.ac_courses c on c.id = s.course_id where c.slug = 'kids-ai' and s.n = 3;
  update app.ac_lessons set chapters = $j$[
    {"t": null, "title": "البداية: روبي أخطأ!", "en": "Ruby made a mistake!", "points": ["روبي ظنّ الليمونة موزة.", "لماذا يخطئ الكمبيوتر؟", "سر اليوم: الأمثلة تصنع الفرق."]},
    {"t": null, "title": "نكتشف الأخطاء", "en": "Finding mistakes", "points": ["نختبر نموذج الجلسة الماضية بأشياء جديدة.", "نسجّل متى أصاب ومتى أخطأ.", "الخطأ معلومة مفيدة، لا مشكلة."]},
    {"t": null, "title": "لماذا أخطأ؟", "en": "Why was it wrong?", "points": ["أمثلة قليلة.", "أمثلة متشابهة جدًا (نفس المكان ونفس الضوء).", "شيء لم يره من قبل."]},
    {"t": null, "title": "نصحّحه بأمثلة أفضل", "en": "Fixing it with better examples", "points": ["نضيف أمثلة متنوعة: ضوء وزوايا وخلفيات مختلفة.", "ندرّب مرة أخرى ونختبر.", "نقارن النتيجة قبل وبعد."]},
    {"t": null, "title": "الخلاصة والمهمة", "en": "Wrap-up and mission", "points": ["الذكاء الاصطناعي يخطئ، ونحن نتحقق.", "3 أسئلة بالصور على المنصة.", "المهمة: جدول قبل وبعد التحسين."]}
  ]$j$::jsonb where session_id = v_s and n = 1;
  if not exists (select 1 from app.ac_tasks where session_id = v_s) then
    insert into app.ac_tasks (session_id, title, brief, steps, deliverables, rubric) values (v_s,
      $t$مخبر الأخطاء: قبل وبعد$t$,
      $t$اختبر نموذجك بـ 5 أشياء، وسجّل أخطاءه، ثم حسّنه بأمثلة متنوعة واختبره مرة أخرى.$t$,
      $j$["ارسم جدولًا من 3 أعمدة: «الشيء» و«قبل التحسين» و«بعد التحسين».", "اختبر النموذج بـ 5 أشياء وسجّل: أصاب أم أخطأ؟", "أضف أمثلة متنوعة (ضوء وزوايا وخلفيات مختلفة) ودرّب مرة أخرى.", "اختبر الأشياء نفسها وسجّل النتيجة في عمود «بعد التحسين».", "يصوّر ولي الأمر الجدول ويرفعه على المنصة."]$j$::jsonb,
      $j$["صورة واضحة لجدول «قبل وبعد» (بدون صور للطفل)."]$j$::jsonb,
      $j$[{"c": "اختبر 5 أشياء وسجّل النتيجة", "pts": 40}, {"c": "حسّن النموذج بأمثلة متنوعة", "pts": 40}, {"c": "الجدول واضح ومرتب", "pts": 20}]$j$::jsonb);
  end if;
  if not exists (select 1 from app.ac_quiz where session_id = v_s) then
    insert into app.ac_quiz (session_id, n, q, options, answer, why) values
    (v_s, 1, $t$لماذا يخطئ الكمبيوتر أحيانًا؟$t$, $j$["😠 لأنه يريد أن يزعجنا", "📉 لأن أمثلته قليلة أو متشابهة", "😴 لأنه متعب"]$j$::jsonb, 1, $t$الكمبيوتر ليس له مشاعر، يخطئ عندما لا تكفيه الأمثلة.$t$),
    (v_s, 2, $t$كيف نصحّح خطأ النموذج؟$t$, $j$["🔁 نضيف أمثلة متنوعة وندرّبه مرة أخرى", "🙈 نتجاهل الخطأ", "🔨 نضرب الجهاز"]$j$::jsonb, 0, $t$أمثلة أكثر وأكثر تنوعًا تجعله يتعلّم أفضل.$t$),
    (v_s, 3, $t$أجابك الكمبيوتر إجابة. ماذا تفعل؟$t$, $j$["✅ أصدّقها دائمًا", "🔍 أتحقق منها، فقد يخطئ", "🗑️ لا أقرأها"]$j$::jsonb, 1, $t$الذكاء الاصطناعي قد يخطئ، فنتحقق دائمًا.$t$);
  end if;

  -- S4 · talking to AI the right way
  select s.id into v_s from app.ac_sessions s join app.ac_courses c on c.id = s.course_id where c.slug = 'kids-ai' and s.n = 4;
  update app.ac_lessons set chapters = $j$[
    {"t": null, "title": "البداية: طلب غامض", "en": "A fuzzy request", "points": ["روبي طلب «ارسم حيوانًا» فجاءه شيء غريب.", "الكمبيوتر لا يعرف ما في رأسك.", "سر اليوم: الطلب الواضح يعطي نتيجة أفضل."]},
    {"t": null, "title": "مكوّنات الطلب الواضح", "en": "What makes a clear request", "points": ["ماذا أريد؟", "عن ماذا؟ ولمن؟", "كيف يكون الشكل أو الطول؟"]},
    {"t": null, "title": "غامض أم واضح؟", "en": "Fuzzy or clear?", "points": ["نقارن طلبين لنفس الشيء.", "نحوّل طلبًا غامضًا إلى واضح.", "نجرّبه مع ولي الأمر وعلى حسابه."]},
    {"t": null, "title": "نراجع الإجابة", "en": "Checking the answer", "points": ["هل أجاب عن سؤالي؟", "هل فيه شيء غير صحيح؟", "لا نكتب أسماءنا أو عنواننا أبدًا."]},
    {"t": null, "title": "الخلاصة والمهمة", "en": "Wrap-up and mission", "points": ["طلب واضح + مراجعة = نتيجة جيدة.", "3 أسئلة بالصور على المنصة.", "المهمة: طلب غامض وطلب واضح ونتيجتهما."]}
  ]$j$::jsonb where session_id = v_s and n = 1;
  if not exists (select 1 from app.ac_tasks where session_id = v_s) then
    insert into app.ac_tasks (session_id, title, brief, steps, deliverables, rubric) values (v_s,
      $t$من طلب غامض إلى طلب واضح$t$,
      $t$مع ولي أمرك وعلى حسابه، جرّب طلبًا غامضًا ثم حوّله إلى طلب واضح، وقارن النتيجتين.$t$,
      $j$["اكتب طلبًا غامضًا في ورقة (مثل: «اكتب عن القطط»).", "حوّله إلى طلب واضح: ماذا أريد؟ عن ماذا؟ لمن؟ كم الطول؟", "جرّب الطلبين مع ولي الأمر واكتب: أيّ النتيجتين أفضل؟ ولماذا؟", "يصوّر ولي الأمر الورقة ويرفعها على المنصة."]$j$::jsonb,
      $j$["صورة الورقة فيها الطلبان والمقارنة (بدون أي بيانات شخصية)."]$j$::jsonb,
      $j$[{"c": "كتب طلبًا غامضًا وطلبًا واضحًا", "pts": 40}, {"c": "قارن النتيجتين وشرح السبب", "pts": 40}, {"c": "الورقة واضحة ومرتبة", "pts": 20}]$j$::jsonb);
  end if;
  if not exists (select 1 from app.ac_quiz where session_id = v_s) then
    insert into app.ac_quiz (session_id, n, q, options, answer, why) values
    (v_s, 1, $t$أي طلب أوضح؟$t$, $j$["🐱 «اكتب عن القطط»", "📝 «اكتب 3 جمل عن قطة تحب النوم، لطفل عمره 9 سنوات»", "❓ «قطط»"]$j$::jsonb, 1, $t$الطلب الواضح يقول ماذا أريد وعن ماذا ولمن وكم الطول.$t$),
    (v_s, 2, $t$أي معلومة لا نكتبها للذكاء الاصطناعي أبدًا؟$t$, $j$["🎨 لوني المفضّل", "🏠 عنوان بيتي ورقم هاتفي", "🚀 سؤال عن الفضاء"]$j$::jsonb, 1, $t$لا نكتب بياناتنا الشخصية أبدًا.$t$),
    (v_s, 3, $t$مع من نستخدم أدوات الذكاء الاصطناعي؟$t$, $j$["👨‍👩‍👧 مع ولي الأمر وعلى حسابه", "🙋 وحدي على حساب جديد", "👫 على حساب صديقي"]$j$::jsonb, 0, $t$الطفل لا ينشئ حسابات، ويستخدم الأدوات مع ولي أمره.$t$);
  end if;

  -- S5 · a story with AI
  select s.id into v_s from app.ac_sessions s join app.ac_courses c on c.id = s.course_id where c.slug = 'kids-ai' and s.n = 5;
  update app.ac_lessons set chapters = $j$[
    {"t": null, "title": "البداية: قصة روبي", "en": "Ruby's story", "points": ["روبي يريد قصة، لكن من يفكّر؟", "أنت المؤلف، والذكاء الاصطناعي مساعد.", "سر اليوم: الفكرة منك أولًا."]},
    {"t": null, "title": "نخطط لقصتنا", "en": "Planning our story", "points": ["البطل: من هو؟", "المكان والمشكلة.", "كيف تنتهي القصة؟"]},
    {"t": null, "title": "نستعين بالذكاء الاصطناعي", "en": "Getting help from AI", "points": ["طلب واضح فيه أفكارنا نحن.", "نختار ما يعجبنا ونغيّر ما لا يعجبنا.", "مع ولي الأمر وعلى حسابه."]},
    {"t": null, "title": "نرسم الشخصيات", "en": "Drawing the characters", "points": ["نرسم البطل بأيدينا.", "نضيف ألوانًا وتفاصيل من خيالنا.", "القصة بأسمائنا وأفكارنا."]},
    {"t": null, "title": "الخلاصة والمهمة", "en": "Wrap-up and mission", "points": ["أنا أفكّر، والذكاء الاصطناعي يساعد.", "3 أسئلة بالصور على المنصة.", "المهمة: قصة من 5 جمل ورسمة للبطل."]}
  ]$j$::jsonb where session_id = v_s and n = 1;
  if not exists (select 1 from app.ac_tasks where session_id = v_s) then
    insert into app.ac_tasks (session_id, title, brief, steps, deliverables, rubric) values (v_s,
      $t$قصتي أنا$t$,
      $t$اكتب قصة قصيرة من أفكارك، واستعن بالذكاء الاصطناعي مع ولي أمرك لتحسينها، وارسم بطلها بيدك.$t$,
      $j$["اكتب في ورقة: البطل، والمكان، والمشكلة، والنهاية.", "اطلب مع ولي أمرك من الذكاء الاصطناعي اقتراحًا لتحسين قصتك (طلب واضح فيه أفكارك).", "اكتب قصتك النهائية في 5 جمل على الأقل بكلماتك.", "ارسم بطل القصة بيدك.", "يصوّر ولي الأمر القصة والرسمة ويرفعهما على المنصة."]$j$::jsonb,
      $j$["صورة القصة المكتوبة وصورة رسمة البطل (بدون صور للطفل)."]$j$::jsonb,
      $j$[{"c": "القصة من أفكار الطفل (بطل ومكان ومشكلة ونهاية)", "pts": 40}, {"c": "استخدم الذكاء الاصطناعي مساعدًا لا بديلًا", "pts": 30}, {"c": "رسم البطل بيده", "pts": 30}]$j$::jsonb);
  end if;
  if not exists (select 1 from app.ac_quiz where session_id = v_s) then
    insert into app.ac_quiz (session_id, n, q, options, answer, why) values
    (v_s, 1, $t$من مؤلف القصة؟$t$, $j$["🤖 الذكاء الاصطناعي وحده", "🧒 أنا، والذكاء الاصطناعي يساعدني", "📺 التلفاز"]$j$::jsonb, 1, $t$الفكرة منك أولًا، والذكاء الاصطناعي مساعد.$t$),
    (v_s, 2, $t$ما أول خطوة في كتابة القصة؟$t$, $j$["💭 أفكّر في البطل والمكان والمشكلة", "⌨️ أطلب من الذكاء الاصطناعي أن يكتب كل شيء", "😶 لا أفعل شيئًا"]$j$::jsonb, 0, $t$نخطط أولًا بأنفسنا، ثم نستعين بالذكاء الاصطناعي.$t$),
    (v_s, 3, $t$اقترح الذكاء الاصطناعي نهاية لا تعجبك. ماذا تفعل؟$t$, $j$["✏️ أغيّرها بأفكاري", "😔 أتركها كما هي", "🗑️ أمزّق القصة"]$j$::jsonb, 0, $t$أنت صاحب القصة، فتختار ما يعجبك وتغيّر ما لا يعجبك.$t$);
  end if;
end $kids$;

select s.n, jsonb_array_length(l.chapters) as chapters, (select count(*) from app.ac_tasks t where t.session_id = s.id) as tasks,
       (select count(*) from app.ac_quiz q where q.session_id = s.id) as quiz
from app.ac_sessions s join app.ac_courses c on c.id = s.course_id join app.ac_lessons l on l.session_id = s.id and l.n = 1
where c.slug = 'kids-ai' order by s.n;
