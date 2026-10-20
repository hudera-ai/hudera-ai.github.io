-- LOCAL TESTING ONLY: fills the local test database with synthetic traffic over the last 30 days so the
-- dashboard can be checked visually. Never run on the real project (it would pollute real analytics).
do $$
declare v uuid; s uuid; d integer; n integer; k integer; paths text[] := array['/', '/#s-workforce', '/#s-contractor-os', '/#p-connect', '/#p-hesabo', '/#p-sitelog'];
  refs text[] := array[null, null, 'www.google.com', 'www.linkedin.com', 'l.facebook.com', 'github.com', null];
  uas text[] := array['desktop|Chrome|Windows', 'mobile|Safari|iOS', 'mobile|Chrome|Android', 'desktop|Safari|macOS', 'desktop|Edge|Windows'];
  ua text[]; st timestamptz; r text;
begin
  for n in 1..140 loop
    v := gen_random_uuid(); ua := string_to_array(uas[1 + (n % 5)], '|');
    d := (random() * 29)::int; st := now() - make_interval(days => d, hours => (random() * 10)::int);
    r := refs[1 + (n % 7)];
    insert into app.visitors (id, first_seen_at, last_seen_at, first_referrer_domain, device_type, browser, os) values (v, st, st, r, ua[1], ua[2], ua[3]);
    for k in 0..(case when n % 4 = 0 then 2 else 0 end) loop
      s := gen_random_uuid(); st := st + make_interval(days => k * 3);
      if st > now() then st := now() - interval '1 hour'; end if;
      insert into app.sessions (id, visitor_id, started_at, last_seen_at, landing_path, referrer_domain, source, device_type, browser, os, is_returning, page_views, event_count)
      values (s, v, st, st + make_interval(secs => 30 + (random() * 400)::int), '/', r, app.classify_source(r, null, null), ua[1], ua[2], ua[3], k > 0, 0, 0);
      insert into app.events (event_id, name, occurred_at, visitor_id, session_id, path, props)
      select gen_random_uuid(), 'page_view', st + make_interval(secs => i * 20), v, s, paths[1 + ((n + i) % 6)], '{}'::jsonb from generate_series(0, 1 + n % 4) i;
      if n % 3 = 0 then insert into app.events (event_id, name, occurred_at, visitor_id, session_id, path, feature_key, props) values (gen_random_uuid(), 'platform_opened', st + interval '40 seconds', v, s, '/#s-workforce', 'workforce_demo', '{"platform":"workforce","mode":"page"}'); end if;
      if n % 5 = 0 then insert into app.events (event_id, name, occurred_at, visitor_id, session_id, path, feature_key, props) values (gen_random_uuid(), 'platform_opened', st + interval '50 seconds', v, s, '/#s-contractor-os', 'contractor_demo', '{"platform":"contractor-os","mode":"page"}'); end if;
      if n % 4 = 1 then insert into app.events (event_id, name, occurred_at, visitor_id, session_id, path, feature_key, props) values (gen_random_uuid(), 'roi_calculated', st + interval '70 seconds', v, s, '/', 'roi_calculator', '{"requests":120}'); end if;
      if n % 6 = 2 then insert into app.events (event_id, name, occurred_at, visitor_id, session_id, path, feature_key, props) values (gen_random_uuid(), 'whatsapp_clicked', st + interval '90 seconds', v, s, '/', 'whatsapp', '{"placement":"float"}'); end if;
      if n % 7 = 3 then insert into app.events (event_id, name, occurred_at, visitor_id, session_id, path, feature_key, props) values (gen_random_uuid(), 'faq_opened', st + interval '80 seconds', v, s, '/', 'faq', '{"question":"2"}'); end if;
      update app.sessions x set page_views = (select count(*) from app.events e where e.session_id = s and e.name = 'page_view'), event_count = (select count(*) from app.events e where e.session_id = s) where x.id = s;
    end loop;
  end loop;
end $$;
