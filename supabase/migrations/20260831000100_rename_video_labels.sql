-- The library carries two kinds of video and the label on each card is the only
-- thing separating them. "Livestream"/"Recording" did not say what the
-- difference was; "Live Replay"/"Local Recording" does.
--
-- Apply individually, NOT with `supabase db push`.

update mvl.game_videos set label = 'Live Replay'     where label = 'Livestream';
update mvl.game_videos set label = 'Local Recording' where label = 'Recording';
