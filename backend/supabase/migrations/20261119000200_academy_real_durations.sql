-- Academy: real video lengths and no live-meeting promises in the package text.
-- Lengths in minutes: S1–S3 from the published videos; S4–S8 from the prepared scripts
-- (to be corrected again once each video is rendered and uploaded).
update app.ac_lessons l set mins = v.m
from (values (1, 27), (2, 26), (3, 23), (4, 17), (5, 11), (6, 12), (7, 10), (8, 9)) v(n, m), app.ac_sessions s, app.ac_courses c
where l.session_id = s.id and s.course_id = c.id and c.slug = 'ai-foundations' and s.n = v.n and l.n = 1;

update app.settings set value = replace(replace(value::text,
    '"8 فيديوهات شرح، نحو نصف ساعة لكل منها، بثلاث لغات للشرح"', '"8 فيديوهات شرح مقسّمة إلى فصول، بثلاث لغات للشرح"'),
    '"8 لقاءات مباشرة (ساعة ونصف) في مجموعة صغيرة", ', '')::jsonb
where key = 'academy';

select (select jsonb_agg(l.mins order by s.n) from app.ac_lessons l join app.ac_sessions s on s.id = l.session_id join app.ac_courses c on c.id = s.course_id where c.slug = 'ai-foundations') as mins,
       (select value -> 'packages' -> 0 -> 'features' from app.settings where key = 'academy') as features;
