-- Populate playoff participants automatically from preliminary standings
-- and the winners/losers of the preceding playoff round.

drop function if exists public.mvl_admin_update_game_schedule(
  text, integer, integer, timestamptz, text, text, text, text
);

create or replace function mvl.sync_playoff_bracket_after_result()
returns trigger
language plpgsql
security definer
set search_path = mvl, public
as $$
declare
  v_seed_1 text;
  v_seed_2 text;
  v_seed_3 text;
  v_seed_4 text;
  v_seed_5 text;
  v_seed_6 text;
  v_seed_7 text;
  v_seed_8 text;
  v_qf1 mvl.games;
  v_qf2 mvl.games;
  v_qf3 mvl.games;
  v_qf4 mvl.games;
  v_sf1 mvl.games;
  v_sf2 mvl.games;
begin
  if new.status <> 'final' then
    return new;
  end if;

  -- Seed the Quarter-Finals once all 28 preliminary games are final.
  if (select count(*) from mvl.games where id like 'pre-%' and status = 'final') = 28
     and not exists (
       select 1 from mvl.games where id in ('qf1','qf2','qf3','qf4') and status = 'final'
     ) then
    select
      max(team_id) filter (where rank = 1),
      max(team_id) filter (where rank = 2),
      max(team_id) filter (where rank = 3),
      max(team_id) filter (where rank = 4),
      max(team_id) filter (where rank = 5),
      max(team_id) filter (where rank = 6),
      max(team_id) filter (where rank = 7),
      max(team_id) filter (where rank = 8)
    into v_seed_1, v_seed_2, v_seed_3, v_seed_4,
         v_seed_5, v_seed_6, v_seed_7, v_seed_8
    from public.mvl_get_standings();

    update mvl.games set team_a_id=v_seed_3, team_b_id=v_seed_6, team_a_label=null, team_b_label=null where id='qf1' and status='pending';
    update mvl.games set team_a_id=v_seed_4, team_b_id=v_seed_5, team_a_label=null, team_b_label=null where id='qf2' and status='pending';
    update mvl.games set team_a_id=v_seed_2, team_b_id=v_seed_7, team_a_label=null, team_b_label=null where id='qf3' and status='pending';
    update mvl.games set team_a_id=v_seed_1, team_b_id=v_seed_8, team_a_label=null, team_b_label=null where id='qf4' and status='pending';
  end if;

  -- Populate the Semi-Finals from the four Quarter-Final winners.
  if (select count(*) from mvl.games where id in ('qf1','qf2','qf3','qf4') and status='final') = 4 then
    select * into v_qf1 from mvl.games where id='qf1';
    select * into v_qf2 from mvl.games where id='qf2';
    select * into v_qf3 from mvl.games where id='qf3';
    select * into v_qf4 from mvl.games where id='qf4';
    update mvl.games set team_a_id=v_qf1.winner_team_id, team_b_id=v_qf4.winner_team_id, team_a_label=null, team_b_label=null where id='sf1' and status='pending';
    update mvl.games set team_a_id=v_qf2.winner_team_id, team_b_id=v_qf3.winner_team_id, team_a_label=null, team_b_label=null where id='sf2' and status='pending';
  end if;

  -- Populate the bronze match and Final from the Semi-Final results.
  if (select count(*) from mvl.games where id in ('sf1','sf2') and status='final') = 2 then
    select * into v_sf1 from mvl.games where id='sf1';
    select * into v_sf2 from mvl.games where id='sf2';
    update mvl.games set
      team_a_id=case when v_sf1.winner_team_id=v_sf1.team_a_id then v_sf1.team_b_id else v_sf1.team_a_id end,
      team_b_id=case when v_sf2.winner_team_id=v_sf2.team_a_id then v_sf2.team_b_id else v_sf2.team_a_id end,
      team_a_label=null, team_b_label=null
    where id='bronze' and status='pending';
    update mvl.games set
      team_a_id=v_sf1.winner_team_id, team_b_id=v_sf2.winner_team_id,
      team_a_label=null, team_b_label=null
    where id='final' and status='pending';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_playoff_bracket_after_result on mvl.games;
create trigger sync_playoff_bracket_after_result
after update of status, winner_team_id on mvl.games
for each row
when (new.status = 'final' and (
  old.status is distinct from new.status or
  old.winner_team_id is distinct from new.winner_team_id
))
execute function mvl.sync_playoff_bracket_after_result();
