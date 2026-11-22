-- Academy (ai-foundations): real video lengths in minutes for sessions 4-8, after rendering and upload.
-- Applied manually in the Supabase SQL editor on 2026-11-22 (5 rows updated).
update app.ac_lessons l set mins = v.m
from (values (4, 19), (5, 13), (6, 13), (7, 11), (8, 10)) v(n, m), app.ac_sessions s, app.ac_courses c
where l.session_id = s.id and s.course_id = c.id and c.slug = 'ai-foundations' and s.n = v.n and l.n = 1;
