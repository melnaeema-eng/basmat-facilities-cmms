-- Basmat Facilities CMMS V12.9.5
-- Report Distribution & History
begin;

alter table public.bf_owner_report_runs
 add column if not exists distribution_status text not null default 'final',
 add column if not exists print_count integer not null default 0,
 add column if not exists last_printed_at timestamptz,
 add column if not exists sent_at timestamptz,
 add column if not exists sent_to text,
 add column if not exists acknowledged_at timestamptz;

do $$
begin
 if not exists (
  select 1 from pg_constraint
  where conname='bf_owner_report_runs_distribution_status_check'
 ) then
  alter table public.bf_owner_report_runs
   add constraint bf_owner_report_runs_distribution_status_check
   check(distribution_status in('final','printed','sent','acknowledged'));
 end if;
end $$;

create table if not exists public.bf_owner_report_events(
 id uuid primary key default gen_random_uuid(),
 report_run_id uuid not null references public.bf_owner_report_runs(id) on delete cascade,
 action text not null check(action in('printed','sent','acknowledged')),
 recipient text,
 notes text,
 actor_id uuid default auth.uid(),
 created_at timestamptz not null default now()
);

create index if not exists bf_owner_report_events_run_created
 on public.bf_owner_report_events(report_run_id,created_at desc);

alter table public.bf_owner_report_events enable row level security;

drop policy if exists bf_owner_report_events_read on public.bf_owner_report_events;
create policy bf_owner_report_events_read on public.bf_owner_report_events
 for select to authenticated
 using (
  exists(
   select 1
   from public.bf_owner_report_runs r
   where r.id=report_run_id
   and public.bf4_staff(r.organization_id,'reports.view')
  )
 );

drop policy if exists bf_owner_report_events_write on public.bf_owner_report_events;
create policy bf_owner_report_events_write on public.bf_owner_report_events
 for insert to authenticated
 with check (
  exists(
   select 1
   from public.bf_owner_report_runs r
   where r.id=report_run_id
   and public.bf4_staff(r.organization_id,'reports.view')
  )
 );

-- Existing report policy in V12.9 allowed INSERT only. Add controlled UPDATE for distribution tracking.
drop policy if exists bf_owner_report_runs_update on public.bf_owner_report_runs;
create policy bf_owner_report_runs_update on public.bf_owner_report_runs
 for update to authenticated
 using (public.bf4_staff(organization_id,'reports.view'))
 with check (public.bf4_staff(organization_id,'reports.view'));

grant select,insert on public.bf_owner_report_events to authenticated;
grant update on public.bf_owner_report_runs to authenticated;

notify pgrst,'reload schema';
commit;

select
 count(*) as archived_reports,
 count(*) filter(where distribution_status='printed') as printed,
 count(*) filter(where distribution_status='sent') as sent,
 count(*) filter(where distribution_status='acknowledged') as acknowledged
from public.bf_owner_report_runs;
