update mvl.games
set starts_at = case id
  when 'g1' then '2026-08-29T21:00:00+08:00'::timestamptz
  when 'g2' then '2026-08-29T22:00:00+08:00'::timestamptz
  when 'g3' then '2026-08-29T23:00:00+08:00'::timestamptz
  when 'g4' then '2026-08-30T21:00:00+08:00'::timestamptz
  when 'g5' then '2026-08-30T22:00:00+08:00'::timestamptz
  when 'g6' then '2026-08-31T21:00:00+08:00'::timestamptz
  when 'g7' then '2026-09-05T21:00:00+08:00'::timestamptz
  when 'g8' then '2026-09-06T21:00:00+08:00'::timestamptz
  else starts_at
end
where id in ('g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8');
