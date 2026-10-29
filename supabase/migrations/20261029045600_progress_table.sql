-- B2B Exam Prep accounts (Supabase project 51C, ref efnoeusptnedvlaiomaa). Applied 29 October 2026.
-- One row per account: that reader's progress (the app's state object), so they can pick up on any device.
create table public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  constraint progress_state_size check (pg_column_size(state) < 2000000)
);

alter table public.progress enable row level security;

-- Each reader can see and change only their own row.
create policy "read own progress" on public.progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "add own progress" on public.progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "change own progress" on public.progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "remove own progress" on public.progress
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Nobody signed out can touch it.
revoke all on public.progress from anon;
grant select, insert, update, delete on public.progress to authenticated;

-- updated_at always reflects the latest save.
create or replace function public.touch_progress() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger progress_touch before insert or update on public.progress
  for each row execute function public.touch_progress();
