-- HUDERA Kids Academy: session 8 «أعرض مشروعي» (final session) — new title/goal/objectives for the own-project track,
-- chapters, task «أعرض مشروعي» (rubric 35/25/25/15) and 3 picture questions, same shape as sessions 6 and 7.
-- Approved by Mahmoud 27 Nov 2026 19:53 («موافق كمل»).
-- Touches only kids-ai session 8. Video fields (video_path, video_url, audio_tracks, mins) are not touched.
-- Idempotent: chapters are written only while no chapter has a time yet; task and quiz only if missing.
do $kids$
declare v_s uuid;
begin
  select s.id into v_s from app.ac_sessions s join app.ac_courses c on c.id = s.course_id where c.slug = 'kids-ai' and s.n = 8;
  if v_s is null then raise exception 'kids-ai session 8 not found'; end if;
  update app.ac_sessions set
    title = $t$أعرض مشروعي$t$,
    title_en = $t$Presenting my project$t$,
    goal = $t$يتحقق مما يراه على الإنترنت، ويعرض مشروعه على أهله: المشكلة والحل وما تعلّمه، ويختم رحلته في الكورس.$t$,
    objectives = $j$["يميّز الصور والفيديوهات المصنوعة بالذكاء الاصطناعي بثلاث علامات: شيء مستحيل، تفاصيل خاطئة، بلا مصدر.", "يطبّق القاعدة الذهبية: لا يصدّق فورًا، لا يرسل لأحد، يسأل ولي الأمر.", "يعرض مشروعه على أهله في ثلاثة أجزاء: المشكلة والحل وماذا تعلّم، ويذكر بأمانة فيمَ ساعده الذكاء الاصطناعي.", "يراجع رحلته في الكورس ويكتب فكرة لمشروعه القادم."]$j$::jsonb
  where id = v_s;
  update app.ac_lessons set title = $t$أعرض مشروعي$t$, title_en = $t$Presenting my project$t$
  where session_id = v_s and n = 1 and (title ilike '%scratch%' or title like '%لعب%' or title like '%الأمان والحقيقة%');
  update app.ac_lessons set chapters = $j$[
    {"t": null, "title": "البداية: يوم العرض", "en": "Presentation day", "points": ["روبي يستعد لعرض مشروعه على أسرته.", "نونو ترى صورة قطة تطير… هل هي حقيقية؟", "اليوم: نتحقق قبل أن نصدّق، ونعرض مشروعنا."]},
    {"t": null, "title": "حقيقي أم مصنوع؟", "en": "Real or made?", "points": ["ثلاث علامات: شيء مستحيل، تفاصيل خاطئة، بلا مصدر.", "القاعدة الذهبية: لا تصدّق فورًا، لا ترسل لأحد، اسأل ولي الأمر.", "بياناتك كنز، والخيال جميل مع الأمانة."]},
    {"t": null, "title": "أجهّز عرضي", "en": "Preparing my presentation", "points": ["العرض في 3 أجزاء: المشكلة، الحل، ماذا تعلّمت.", "نقول بأمانة فيمَ ساعدنا الذكاء الاصطناعي.", "صوت واضح، عرض قصير، وتمرين قبله."]},
    {"t": null, "title": "أعرض وأسمع", "en": "Presenting and listening", "points": ["نعرض والمشروع في أيدينا، وندع الأهل يجرّبونه.", "نستمع للأسئلة ونشكر ونكتب الملاحظات.", "العرض للبيت، لا للإنترنت."]},
    {"t": null, "title": "الخلاصة: رحلتي وماذا بعد؟", "en": "My journey and what's next", "points": ["رحلة 8 جلسات وشهادة الإتمام.", "دفتر أفكاري ومشروعي القادم.", "3 أسئلة بالصور، والمهمة: أعرض مشروعي."]}
  ]$j$::jsonb
  where session_id = v_s and n = 1
    and not exists (select 1 from jsonb_array_elements(chapters) ch where ch ? 't' and ch->'t' <> 'null'::jsonb);
  if not exists (select 1 from app.ac_tasks where session_id = v_s) then
    insert into app.ac_tasks (session_id, title, brief, steps, deliverables, rubric) values (v_s,
      $t$أعرض مشروعي$t$,
      $t$اعرض مشروعك على أهلك: المشكلة والحل وماذا تعلّمت، ثم اكتب ورقة «رحلتي» في الكورس.$t$,
      $j$["اكتب ورقة العرض: المشكلة، والحل، وماذا تعلّمت، وجملة بأمانة عن مساعدة الذكاء الاصطناعي.", "تدرّب على العرض مرة واحدة على الأقل بصوت عالٍ.", "اعرض مشروعك على أهلك، ودعهم يجرّبوه، واستمع لأسئلتهم.", "اكتب ملاحظاتهم.", "اكتب ورقة «رحلتي»: أكثر ما أحببته في الكورس، وأصعب شيء، وفكرة لمشروعك القادم.", "يصوّر ولي الأمر المشروع وورقة العرض وورقة «رحلتي» ويرفعها على المنصة."]$j$::jsonb,
      $j$["صور المشروع وورقة العرض وورقة «رحلتي»، بدون صور للطفل وبدون بيانات شخصية."]$j$::jsonb,
      $j$[{"c": "ورقة العرض واضحة بالأجزاء الثلاثة وفيها جملة الأمانة", "pts": 35}, {"c": "عرض مشروعه على أهله وكتب ملاحظاتهم", "pts": 25}, {"c": "ورقة «رحلتي» صادقة وبكلماته وفيها فكرة مشروع قادم", "pts": 25}, {"c": "الصور واضحة وبلا بيانات شخصية", "pts": 15}]$j$::jsonb);
  end if;
  if not exists (select 1 from app.ac_quiz where session_id = v_s) then
    insert into app.ac_quiz (session_id, n, q, options, answer, why) values
    (v_s, 1, $t$صورة لقطة بجناحين تطير فوق البيوت. هذه الصورة…$t$, $j$["📸 حقيقية أكيدًا", "🎨 غالبًا مصنوعة بالذكاء الاصطناعي لأنها مستحيلة", "📰 خبر أرسله لكل أصدقائي"]$j$::jsonb, 1, $t$العلامة الأولى: شيء مستحيل أن يحدث في الحقيقة.$t$),
    (v_s, 2, $t$رأيت فيديو غريبًا يخيفك. ماذا تفعل؟$t$, $j$["📤 أرسله لأصدقائي بسرعة", "🛑 لا أصدّقه فورًا ولا أرسله، وأسأل ولي الأمر", "🗄️ أخفيه ولا أخبر أحدًا"]$j$::jsonb, 1, $t$القاعدة الذهبية: لا تصدّق فورًا، لا ترسل لأحد، اسأل ولي الأمر.$t$),
    (v_s, 3, $t$ما أجزاء العرض الجيد لمشروعك؟$t$, $j$["🧩 المشكلة والحل وماذا تعلّمت", "⏱️ أتكلم أطول وقت ممكن", "📦 أعرضه دون أن أشرح شيئًا"]$j$::jsonb, 0, $t$العرض الجيد قصير ومرتّب: المشكلة، ثم الحل، ثم ماذا تعلّمت.$t$);
  end if;
end
$kids$;

-- Check (read-only)
select s.n, s.title, s.title_en, l.title as lesson_title, jsonb_array_length(s.objectives) as objectives,
       jsonb_array_length(l.chapters) as chapters,
       (select t.title from app.ac_tasks t where t.session_id = s.id) as task,
       (select count(*) from app.ac_quiz q where q.session_id = s.id) as quiz
from app.ac_sessions s join app.ac_courses c on c.id = s.course_id
left join app.ac_lessons l on l.session_id = s.id and l.n = 1
where c.slug = 'kids-ai' and s.n = 8;
