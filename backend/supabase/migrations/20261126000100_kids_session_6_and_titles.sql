-- HUDERA Kids Academy: new own-project track after Ahmed's feedback (approved by Mahmoud, 26 Nov 2026 19:06).
-- * Session 6 «من فكرة إلى مشروع»: chapters, task «فكرتي» (rubric 30/30/25/15) and 3 picture questions,
--   same shape as sessions 2-5 (20261119000300_kids_sessions_2_5.sql).
-- * Renames sessions 6 and 7 (were Scratch games) to «من فكرة إلى مشروع» and «أصنع النسخة الأولى».
-- Touches only kids-ai sessions 6 and 7. Video fields (video_path, video_url, audio_tracks, mins) are not touched.
-- Idempotent: chapters are written only while no chapter has a time yet; task and quiz only if missing.
-- Apply by pasting the whole file into the Supabase SQL editor and pressing Run.
do $kids$
declare v_s uuid;
begin
  -- S6 · from idea to project
  select s.id into v_s from app.ac_sessions s join app.ac_courses c on c.id = s.course_id where c.slug = 'kids-ai' and s.n = 6;
  if v_s is null then raise exception 'kids-ai session 6 not found'; end if;
  update app.ac_sessions set
    title = $t$من فكرة إلى مشروع$t$,
    title_en = $t$From idea to project$t$,
    goal = $t$يلاحظ مشكلة صغيرة حوله، ويكتب أفكاره أولًا، ثم يوسّعها مع ولي أمره بالذكاء الاصطناعي، ويختار فكرة مشروعه.$t$
  where id = v_s;
  update app.ac_lessons set title = $t$من فكرة إلى مشروع$t$, title_en = $t$From idea to project$t$
  where session_id = v_s and n = 1 and (title ilike '%scratch%' or title like '%لعب%');
  update app.ac_lessons set chapters = $j$[
    {"t": null, "title": "البداية: النعناع العطشان", "en": "The thirsty mint", "points": ["نعناع نونو ذبل لأن أحدًا لم يتذكّر سقيه.", "المشروع شيء نصنعه بأيدينا ليحلّ مشكلة أو يساعد أحدًا.", "سر اليوم: المشروع يبدأ من مشكلة صغيرة نلاحظها."]},
    {"t": null, "title": "نلاحظ المشكلة", "en": "Noticing the problem", "points": ["نبحث في البيت والمدرسة عن مشكلات صغيرة.", "نختار مشكلة حقيقية وقريبة وآمنة نستطيع أن نفعل لها شيئًا.", "من سيستفيد؟ نسأله عن رأيه."]},
    {"t": null, "title": "أفكاري أولًا", "en": "My ideas first", "points": ["نكتب 3 أفكار على الأقل قبل أي جهاز.", "لا توجد فكرة سخيفة، ونجرّب «ماذا لو؟».", "أشكال المشروع: ملصق، كتيّب، قصة مصوّرة، دليل صغير."]},
    {"t": null, "title": "نوسّع الأفكار ونختار", "en": "Growing ideas and choosing", "points": ["طلب واضح فيه مشكلتنا وأفكارنا، مع ولي الأمر وعلى حسابه.", "مصفاة الأفكار: بيدي، في أسبوع، تحلّ المشكلة، آمنة وبلا شراء.", "نختار فكرة واحدة، والقرار قرارنا."]},
    {"t": null, "title": "الخلاصة والمهمة", "en": "Wrap-up and mission", "points": ["المشكلة الصغيرة بداية المشروع.", "3 أسئلة بالصور على المنصة.", "المهمة: ورقة «فكرتي»."]}
  ]$j$::jsonb
  where session_id = v_s and n = 1
    and not exists (select 1 from jsonb_array_elements(chapters) ch where ch ? 't' and ch->'t' <> 'null'::jsonb);
  if not exists (select 1 from app.ac_tasks where session_id = v_s) then
    insert into app.ac_tasks (session_id, title, brief, steps, deliverables, rubric) values (v_s,
      $t$فكرتي$t$,
      $t$لاحظ مشكلة صغيرة حولك، واكتب أفكارك لحلّها، ثم وسّعها مع ولي أمرك بالذكاء الاصطناعي، واختر فكرة واحدة لمشروعك.$t$,
      $j$["ابحث في البيت أو المدرسة عن مشكلة صغيرة حقيقية وآمنة، واكتبها في جملة واحدة.", "اكتب من سيستفيد إذا حُلّت المشكلة، واسأله عن رأيه.", "اكتب 3 أفكار على الأقل من عندك قبل استخدام أي جهاز.", "مع ولي أمرك وعلى حسابه، اطلب من الذكاء الاصطناعي أفكارًا إضافية بطلب واضح فيه مشكلتك وأفكارك.", "اختر فكرة واحدة، واكتب ماذا ستصنع: ملصق أو كتيّب أو قصة مصوّرة أو دليل صغير، ولماذا اخترتها.", "يصوّر ولي الأمر الورقة ويرفعها على المنصة."]$j$::jsonb,
      $j$["صورة ورقة «فكرتي» بدون صور للطفل وبدون بيانات شخصية."]$j$::jsonb,
      $j$[{"c": "المشكلة حقيقية وواضحة ومحدّد من سيستفيد", "pts": 30}, {"c": "3 أفكار على الأقل من الطفل نفسه", "pts": 30}, {"c": "اختار فكرة واحدة وشرح السبب، والذكاء الاصطناعي مساعد لا بديل", "pts": 25}, {"c": "الورقة واضحة ومرتّبة", "pts": 15}]$j$::jsonb);
  end if;
  if not exists (select 1 from app.ac_quiz where session_id = v_s) then
    insert into app.ac_quiz (session_id, n, q, options, answer, why) values
    (v_s, 1, $t$أيّ مشكلة تصلح لمشروعك؟$t$, $j$["🌍 أنهي كل مشكلات العالم مرة واحدة", "🪴 زرع البيت يعطش لأن لا أحد يتذكّر سقيه", "🚀 أبني صاروخًا إلى المريخ"]$j$::jsonb, 1, $t$نبدأ بمشكلة صغيرة حقيقية وقريبة نستطيع أن نفعل لها شيئًا بأيدينا.$t$),
    (v_s, 2, $t$وجدتَ المشكلة. ما الخطوة التالية؟$t$, $j$["✏️ أكتب أفكاري أنا أولًا", "💻 أطلب من الذكاء الاصطناعي أن يختار مشروعي", "🗑️ أتجاهل المشكلة"]$j$::jsonb, 0, $t$أفكارك أولًا، ثم يساعدك المساعد على توسيعها.$t$),
    (v_s, 3, $t$اقترح الذكاء الاصطناعي فكرة تحتاج كهرباء وشراء أجهزة. ماذا تفعل؟$t$, $j$["🔌 أنفّذها وحدي فورًا", "🧠 لا أختارها، وأختار فكرة آمنة أصنعها بيدي", "🛒 أطلب شراء كل شيء"]$j$::jsonb, 1, $t$نختار ما نصنعه بأيدينا بأمان وبلا شراء.$t$);
  end if;

  -- S7 · making the first version (title only; chapters, task and quiz come with its script)
  select s.id into v_s from app.ac_sessions s join app.ac_courses c on c.id = s.course_id where c.slug = 'kids-ai' and s.n = 7;
  if v_s is null then raise exception 'kids-ai session 7 not found'; end if;
  update app.ac_sessions set
    title = $t$أصنع النسخة الأولى$t$,
    title_en = $t$Making the first version$t$,
    goal = $t$يصنع مشروعه بيده: ملصقًا أو كتيّبًا أو قصة مصوّرة أو دليلًا صغيرًا، ويتعلّم كيف يراجعه ويحسّنه.$t$
  where id = v_s;
  update app.ac_lessons set title = $t$أصنع النسخة الأولى$t$, title_en = $t$Making the first version$t$
  where session_id = v_s and n = 1 and (title ilike '%scratch%' or title like '%لعب%');
end
$kids$;

-- Check (read-only): titles, chapter count, task, quiz count, and any Scratch/game wording left in objectives.
select s.n, s.title, s.title_en, l.title as lesson_title, jsonb_array_length(l.chapters) as chapters,
       (select t.title from app.ac_tasks t where t.session_id = s.id) as task,
       (select count(*) from app.ac_quiz q where q.session_id = s.id) as quiz,
       s.objectives::text ~* 'scratch|لعب' as objectives_mention_games
from app.ac_sessions s join app.ac_courses c on c.id = s.course_id
left join app.ac_lessons l on l.session_id = s.id and l.n = 1
where c.slug = 'kids-ai' and s.n in (6, 7) order by s.n;
