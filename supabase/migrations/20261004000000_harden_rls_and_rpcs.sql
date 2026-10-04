-- NOT applied automatically. Review, then run in the Supabase SQL editor.
-- All writes go through the Vercel API (service role, which bypasses RLS).
-- The browser only needs read access plus the user's own watchlist.

alter table public.users enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.bids enable row level security;
alter table public.auction_session enable row level security;
alter table public.watchlist enable row level security;
alter table public.announcements enable row level security;

create policy "read teams" on public.teams for select using (true);
create policy "read players" on public.players for select using (true);
create policy "read bids" on public.bids for select using (true);
create policy "read session" on public.auction_session for select using (true);
create policy "read announcements" on public.announcements for select using (true);
-- users holds emails: signed-in users only
create policy "read users" on public.users for select to authenticated using (true);
create policy "own watchlist" on public.watchlist for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The legacy RPCs are unused by the API, reference columns that no longer exist
-- (auction_session.player_id, players.last_bid_price) and are callable by anyone.
-- Lock every public function down to the service role.
revoke execute on all functions in schema public from anon, authenticated, public;
grant execute on all functions in schema public to service_role;
alter function public.handle_new_user() set search_path = public;
