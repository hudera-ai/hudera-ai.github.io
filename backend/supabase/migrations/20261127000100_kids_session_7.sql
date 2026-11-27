-- HUDERA Kids Academy: session 7 «أصنع النسخة الأولى» — chapters, task «النسخة الأولى» (rubric 35/25/25/15)
-- and 3 picture questions, same shape as session 6 (20261126000100_kids_session_6_and_titles.sql).
-- Approved by Mahmoud 27 Nov 2026 14:42 («موافق كمل»).
-- Touches only kids-ai session 7. Titles/goal/objectives are already set; video fields are not touched.
-- Idempotent: chapters are written only while no chapter has a time yet; task and quiz only if missing.
do $kids$
declare v_s uuid;
begin
  select s.id into v_s from app.ac_sessions s join app.ac_courses c on c.id = s.course_id where c.slug = 'kids-ai' and s.n = 7;
  if v_s is null then raise exception 'kids-ai session 7 not found'; end if;
  update app.ac_lessons set chapters = $j$[
    {"t": null, "title": "البداية: من الورقة إلى الحائط", "en": "From paper to the wall", "points": ["روبي يحوّل فكرته إلى ملصق حقيقي.", "النسخة الأولى ليست مثالية، نصنعها لنجرّبها ونحسّنها.", "دائرة الصانع: نخطّط، نصنع، نجرّب، نحسّن."]},
    {"t": null, "title": "نخطط للنسخة الأولى", "en": "Planning the first version", "points": ["مسودة سريعة بقلم رصاص قبل الورقة الكبيرة.", "عنوان واضح وصورة وكلام قليل.", "المساعد يقترح عنوانًا قصيرًا مع ولي الأمر، ونحن نختار."]},
    {"t": null, "title": "أصنع بإيدي", "en": "Making it by hand", "points": ["رصاص خفيف، ثم الخطوط المهمة، ثم الألوان.", "كلام كبير ومسافات فارغة وألوان قليلة.", "نصنع بالموجود في البيت وبأمان."]},
    {"t": null, "title": "أجرّب وأحسّن", "en": "Testing and improving", "points": ["نعرض المشروع على من سيستفيد ونلاحظ.", "نسأل: ما الذي أعجبك؟ ما الذي يحتاج تحسينًا؟", "الملاحظة هدية، ونعدّل تعديلًا واحدًا على الأقل."]},
    {"t": null, "title": "الخلاصة والمهمة", "en": "Wrap-up and mission", "points": ["النسخة الأولى بداية لا نهاية.", "3 أسئلة بالصور على المنصة.", "المهمة: النسخة الأولى وتعديل واحد."]}
  ]$j$::jsonb
  where session_id = v_s and n = 1
    and not exists (select 1 from jsonb_array_elements(chapters) ch where ch ? 't' and ch->'t' <> 'null'::jsonb);
  if not exists (select 1 from app.ac_tasks where session_id = v_s) then
    insert into app.ac_tasks (session_id, title, brief, steps, deliverables, rubric) values (v_s,
      $t$النسخة الأولى$t$,
      $t$اصنع النسخة الأولى من مشروعك بيدك، وجرّبها مع من سيستفيد، ثم حسّنها بتعديل واحد على الأقل.$t$,
      $j$["ارسم مسودة سريعة بقلم رصاص لشكل مشروعك: العنوان والصورة والكلام.", "اصنع النسخة الأولى بيدك: ملصق أو كتيّب أو قصة مصوّرة أو دليل صغير، بما عندك في البيت.", "يمكنك مع ولي أمرك وعلى حسابه أن تطلب من الذكاء الاصطناعي اقتراح عنوان قصير أو مراجعة الإملاء فقط.", "جرّب مشروعك مع من سيستفيد، واكتب ملاحظتين.", "عدّل تعديلًا واحدًا على الأقل بيدك، واكتب ماذا عدّلت ولماذا.", "يصوّر ولي الأمر المشروع بعد التعديل وورقة الملاحظات ويرفعهما على المنصة."]$j$::jsonb,
      $j$["صورة المشروع بعد التعديل وصورة ورقة الملاحظات، بدون صور للطفل وبدون بيانات شخصية."]$j$::jsonb,
      $j$[{"c": "المشروع مصنوع بيد الطفل ويطابق ورقة «فكرتي»", "pts": 35}, {"c": "جرّبه مع من سيستفيد وكتب ملاحظتين", "pts": 25}, {"c": "عدّل تعديلًا واحدًا على الأقل بنفسه وشرح السبب", "pts": 25}, {"c": "الذكاء الاصطناعي في جزء صغير فقط، والصور واضحة", "pts": 15}]$j$::jsonb);
  end if;
  if not exists (select 1 from app.ac_quiz where session_id = v_s) then
    insert into app.ac_quiz (session_id, n, q, options, answer, why) values
    (v_s, 1, $t$النسخة الأولى من مشروعك…$t$, $j$["🏆 يجب أن تكون مثالية من أول مرة", "✏️ نصنعها ثم نجرّبها ونحسّنها", "🗑️ نرميها إذا كان فيها خطأ"]$j$::jsonb, 1, $t$لا أحد يصيب من أول مرة، والتجربة تخبرنا ماذا نحسّن.$t$),
    (v_s, 2, $t$من أهم شخص يقول لك رأيه في مشروعك؟$t$, $j$["🏠 الشخص الذي سيستفيد منه", "💻 الذكاء الاصطناعي وحده", "🚫 لا أحد"]$j$::jsonb, 0, $t$من سيستفيد جرّب المشروع فعلًا ويعرف ما ينقصه.$t$),
    (v_s, 3, $t$أختك الصغيرة لا تستطيع قراءة الكلام الصغير على الملصق. ماذا تفعل؟$t$, $j$["🔍 أكبّر الكلام وأضيف ألوانًا ورموزًا", "📄 أكتب كلامًا أكثر", "⏳ أتركه كما هو"]$j$::jsonb, 0, $t$نحسّن المشروع ليناسب من سيستفيد منه.$t$);
  end if;
end
$kids$;

-- Check (read-only)
select s.n, s.title, jsonb_array_length(l.chapters) as chapters,
       (select t.title from app.ac_tasks t where t.session_id = s.id) as task,
       (select count(*) from app.ac_quiz q where q.session_id = s.id) as quiz
from app.ac_sessions s join app.ac_courses c on c.id = s.course_id
left join app.ac_lessons l on l.session_id = s.id and l.n = 1
where c.slug = 'kids-ai' and s.n = 7;
