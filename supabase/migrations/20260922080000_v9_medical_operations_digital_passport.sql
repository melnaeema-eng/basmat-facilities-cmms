begin;
-- ============================================================
-- BASMAT FACILITIES CMMS V9
-- Medical Operations + Universal Asset Digital Passport
-- Facilities + Medical
-- ============================================================

insert into public.bf_permissions(code,description) values
 ('medical.safety','Manage medical equipment safety and quarantine'),
 ('medical.quality','Manage medical quality / CAPA'),
 ('medical.reports','View medical engineering reports'),
 ('asset.passport.view','View asset digital passports'),
 ('asset.passport.manage','Manage asset lifecycle passport events'),
 ('locations.manage','Manage facilities / healthcare location hierarchy')
on conflict(code) do nothing;
insert into public.bf_role_permissions(role_id,permission_id)
select r.id,p.id
from public.bf_roles r cross join public.bf_permissions p
where r.code='company_admin'
  and p.code in('medical.safety','medical.quality','medical.reports','asset.passport.view','asset.passport.manage','locations.manage')
on conflict do nothing;
-- ============================================================
-- 1. UNIVERSAL LOCATION HIERARCHY
-- Organization -> Facility -> Branch -> Building -> Floor ->
-- Department -> Clinic/Unit -> Room/Zone
-- Works for hospitals, medical centers, dispensaries and
-- ordinary facilities.
-- ============================================================

create table if not exists public.bf_location_nodes(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 parent_id uuid references public.bf_location_nodes(id) on delete restrict,
 facility_kind text not null default 'other'
   check(facility_kind in(
    'hospital','medical_center','dispensary','clinic_center',
    'office','commercial','residential','industrial',
    'data_center','campus','warehouse','school','other'
   )),
 node_type text not null
   check(node_type in('facility','branch','building','floor','department','clinic','unit','room','zone')),
 code text not null,
 name_ar text not null,
 name_en text,
 address_text text,
 capacity integer,
 status text not null default 'active' check(status in('active','inactive','archived')),
 metadata jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,code)
);
create index if not exists bf_location_nodes_org_parent
on public.bf_location_nodes(organization_id,parent_id,node_type,status);
alter table public.bf_location_nodes enable row level security;
drop policy if exists bf_location_nodes_read on public.bf_location_nodes;
create policy bf_location_nodes_read on public.bf_location_nodes
for select to authenticated
using(
 public.bf_can(organization_id,'medical.view')
 or public.bf_can(organization_id,'assets.view')
 or public.bf_can(organization_id,'locations.manage')
);
drop policy if exists bf_location_nodes_write on public.bf_location_nodes;
create policy bf_location_nodes_write on public.bf_location_nodes
for all to authenticated
using(
 public.bf_can(organization_id,'locations.manage')
 or public.bf_can(organization_id,'medical.manage')
)
with check(
 public.bf_can(organization_id,'locations.manage')
 or public.bf_can(organization_id,'medical.manage')
);
alter table public.bf_med_assets
 add column if not exists location_node_id uuid references public.bf_location_nodes(id),
 add column if not exists commissioning_date date,
 add column if not exists lifecycle_status text not null default 'active'
   check(lifecycle_status in('planned','received','commissioning','active','quarantined','out_of_service','retired','disposed')),
 add column if not exists replacement_due_date date,
 add column if not exists firmware_version text,
 add column if not exists software_version text;
do $$
begin
 if to_regclass('public.bf_assets') is not null then
   execute 'alter table public.bf_assets add column if not exists location_node_id uuid references public.bf_location_nodes(id)';
 end if;
end $$;
-- ============================================================
-- 2. UNIVERSAL DIGITAL ASSET PASSPORT
-- Stable passport code survives movement, rename and upgrades.
-- ============================================================

create sequence if not exists public.bf_asset_passport_seq;
create table if not exists public.bf_asset_passports(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_domain text not null check(asset_domain in('facility','medical')),
 asset_id uuid not null,
 passport_code text not null unique,
 qr_token uuid not null default gen_random_uuid() unique,
 status text not null default 'active' check(status in('active','retired','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(asset_domain,asset_id)
);
create index if not exists bf_asset_passports_org on public.bf_asset_passports(organization_id,asset_domain,status);
create table if not exists public.bf_asset_lifecycle_events(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_domain text not null check(asset_domain in('facility','medical')),
 asset_id uuid not null,
 passport_id uuid references public.bf_asset_passports(id) on delete cascade,
 event_type text not null check(event_type in(
   'registration','commissioning','movement','preventive_maintenance',
   'corrective_maintenance','calibration','safety','quarantine',
   'return_to_service','warranty','part_replacement','upgrade',
   'recall','inspection','failure','retirement','disposal','document','other'
 )),
 event_title text not null,
 event_status text,
 occurred_at timestamptz not null default now(),
 reference_type text,
 reference_id uuid,
 details jsonb not null default '{}'::jsonb,
 performed_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists bf_asset_lifecycle_events_asset
on public.bf_asset_lifecycle_events(asset_domain,asset_id,occurred_at desc);
alter table public.bf_asset_passports enable row level security;
alter table public.bf_asset_lifecycle_events enable row level security;
drop policy if exists bf_passport_read on public.bf_asset_passports;
create policy bf_passport_read on public.bf_asset_passports
for select to authenticated
using(
 public.bf_can(organization_id,'asset.passport.view')
 or public.bf_can(organization_id,'medical.view')
 or public.bf_can(organization_id,'assets.view')
);
drop policy if exists bf_passport_manage on public.bf_asset_passports;
create policy bf_passport_manage on public.bf_asset_passports
for all to authenticated
using(
 public.bf_can(organization_id,'asset.passport.manage')
 or public.bf_can(organization_id,'medical.manage')
)
with check(
 public.bf_can(organization_id,'asset.passport.manage')
 or public.bf_can(organization_id,'medical.manage')
);
drop policy if exists bf_lifecycle_read on public.bf_asset_lifecycle_events;
create policy bf_lifecycle_read on public.bf_asset_lifecycle_events
for select to authenticated
using(
 public.bf_can(organization_id,'asset.passport.view')
 or public.bf_can(organization_id,'medical.view')
 or public.bf_can(organization_id,'assets.view')
);
drop policy if exists bf_lifecycle_manage on public.bf_asset_lifecycle_events;
create policy bf_lifecycle_manage on public.bf_asset_lifecycle_events
for all to authenticated
using(
 public.bf_can(organization_id,'asset.passport.manage')
 or public.bf_can(organization_id,'medical.manage')
)
with check(
 public.bf_can(organization_id,'asset.passport.manage')
 or public.bf_can(organization_id,'medical.manage')
);
create or replace function public.bf_make_passport_code(p_domain text)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
 n bigint;
 prefix text;
begin
 n:=nextval('public.bf_asset_passport_seq');
 prefix:=case when p_domain='medical' then 'MED' else 'FAC' end;
 return 'BAS-'||prefix||'-'||to_char(current_date,'YYYY')||'-'||lpad(n::text,8,'0');
end $$;
create or replace function public.bf_ensure_asset_passport(
 p_org uuid,p_domain text,p_asset uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v uuid;
begin
 select id into v
 from public.bf_asset_passports
 where asset_domain=p_domain and asset_id=p_asset;

 if v is null then
   insert into public.bf_asset_passports(
     organization_id,asset_domain,asset_id,passport_code
   )
   values(
     p_org,p_domain,p_asset,public.bf_make_passport_code(p_domain)
   )
   returning id into v;

   insert into public.bf_asset_lifecycle_events(
     organization_id,asset_domain,asset_id,passport_id,event_type,event_title,event_status
   )
   values(p_org,p_domain,p_asset,v,'registration','Asset registered in digital passport','active');
 end if;
 return v;
end $$;
create or replace function public.bf_med_asset_passport_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 perform public.bf_ensure_asset_passport(new.organization_id,'medical',new.id);
 return new;
end $$;
drop trigger if exists bf_med_asset_passport_ai on public.bf_med_assets;
create trigger bf_med_asset_passport_ai
after insert on public.bf_med_assets
for each row execute function public.bf_med_asset_passport_trigger();
do $$
begin
 if to_regclass('public.bf_assets') is not null then
   execute $x$
     create or replace function public.bf_fac_asset_passport_trigger()
     returns trigger language plpgsql security definer set search_path=''
     as $f$
     begin
       perform public.bf_ensure_asset_passport(new.organization_id,'facility',new.id);
       return new;
     end
     $f$
   $x$;
   execute 'drop trigger if exists bf_fac_asset_passport_ai on public.bf_assets';
   execute 'create trigger bf_fac_asset_passport_ai after insert on public.bf_assets for each row execute function public.bf_fac_asset_passport_trigger()';
 end if;
end $$;
-- Backfill existing passports.
insert into public.bf_asset_passports(organization_id,asset_domain,asset_id,passport_code)
select a.organization_id,'medical',a.id,public.bf_make_passport_code('medical')
from public.bf_med_assets a
where not exists(
 select 1 from public.bf_asset_passports p
 where p.asset_domain='medical' and p.asset_id=a.id
);
do $$
begin
 if to_regclass('public.bf_assets') is not null then
   execute $x$
     insert into public.bf_asset_passports(organization_id,asset_domain,asset_id,passport_code)
     select a.organization_id,'facility',a.id,public.bf_make_passport_code('facility')
     from public.bf_assets a
     where not exists(
       select 1 from public.bf_asset_passports p
       where p.asset_domain='facility' and p.asset_id=a.id
     )
   $x$;
 end if;
end $$;
-- ============================================================
-- 3. MEDICAL CORRECTIVE + PERIODIC MAINTENANCE
-- ============================================================

alter table public.bf_med_work_orders
 add column if not exists failure_code text,
 add column if not exists failure_mode text,
 add column if not exists root_cause text,
 add column if not exists downtime_started_at timestamptz,
 add column if not exists downtime_ended_at timestamptz,
 add column if not exists service_state text not null default 'normal'
   check(service_state in('normal','quarantined','out_of_service','awaiting_parts','awaiting_vendor','awaiting_owner','under_calibration','ready_for_release')),
 add column if not exists safety_hold boolean not null default false,
 add column if not exists return_to_service_required boolean not null default false,
 add column if not exists ppm_plan_id uuid,
 add column if not exists scheduled_for date,
 add column if not exists vendor_reference text,
 add column if not exists actual_minutes integer,
 add column if not exists downtime_minutes integer;
create table if not exists public.bf_med_ppm_plans(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_id uuid not null references public.bf_med_assets(id) on delete cascade,
 template_id uuid references public.bf_med_master_pm_templates(id),
 plan_code text not null,
 interval_months integer not null check(interval_months between 1 and 60),
 start_date date not null,
 next_due_date date not null,
 priority text not null default 'normal' check(priority in('low','normal','high','critical')),
 auto_create_work_order boolean not null default true,
 assigned_to uuid references auth.users(id),
 status text not null default 'active' check(status in('active','paused','closed')),
 source_type text not null default 'generic',
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,plan_code),
 unique(asset_id,status)
);
create index if not exists bf_med_ppm_plans_due
on public.bf_med_ppm_plans(organization_id,next_due_date,status);
alter table public.bf_med_ppm_plans enable row level security;
drop policy if exists bf_med_ppm_plans_r on public.bf_med_ppm_plans;
create policy bf_med_ppm_plans_r on public.bf_med_ppm_plans
for select to authenticated using(public.bf_can(organization_id,'medical.view'));
drop policy if exists bf_med_ppm_plans_w on public.bf_med_ppm_plans;
create policy bf_med_ppm_plans_w on public.bf_med_ppm_plans
for all to authenticated
using(public.bf_can(organization_id,'medical.manage'))
with check(public.bf_can(organization_id,'medical.manage'));
create or replace function public.bf_med_generate_due_ppm(p_through date default current_date)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
 r record;
 created_count integer:=0;
 v_wo uuid;
begin
 for r in
   select p.*,a.asset_tag
   from public.bf_med_ppm_plans p
   join public.bf_med_assets a on a.id=p.asset_id
   where p.status='active'
     and p.auto_create_work_order
     and p.next_due_date<=p_through
 loop
   if auth.uid() is not null and not public.bf_can(r.organization_id,'medical.manage') then
     continue;
   end if;

   if not exists(
     select 1 from public.bf_med_work_orders w
     where w.ppm_plan_id=r.id
       and w.scheduled_for=r.next_due_date
       and w.status not in('cancelled')
   ) then
     insert into public.bf_med_work_orders(
       organization_id,asset_id,work_order_number,work_type,title,description,
       priority,status,assigned_to,opened_by,due_date,ppm_plan_id,scheduled_for,
       return_to_service_required
     ) values(
       r.organization_id,r.asset_id,'','preventive',
       'Scheduled Medical PPM - '||r.asset_tag,
       'Automatically generated from medical PPM plan '||r.plan_code,
       r.priority,
       case when r.assigned_to is null then 'open' else 'assigned' end,
       r.assigned_to,auth.uid(),r.next_due_date,r.id,r.next_due_date,true
     ) returning id into v_wo;
     created_count:=created_count+1;
   end if;

   update public.bf_med_ppm_plans
   set next_due_date=(r.next_due_date + make_interval(months=>r.interval_months))::date,
       updated_at=now()
   where id=r.id;
 end loop;

 return created_count;
end $$;
-- ============================================================
-- 4. MEDICAL SAFETY, QUALITY, CALIBRATION, RECALL, RTS
-- ============================================================

create table if not exists public.bf_med_calibration_records(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_id uuid not null references public.bf_med_assets(id) on delete cascade,
 work_order_id uuid references public.bf_med_work_orders(id) on delete set null,
 calibration_date date not null default current_date,
 due_date date,
 certificate_number text,
 laboratory_name text,
 traceability_reference text,
 result text not null check(result in('pass','fail','limited')),
 as_found jsonb not null default '{}'::jsonb,
 as_left jsonb not null default '{}'::jsonb,
 certificate_path text,
 notes text,
 performed_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.bf_med_return_to_service(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_id uuid not null references public.bf_med_assets(id) on delete cascade,
 work_order_id uuid references public.bf_med_work_orders(id) on delete set null,
 safety_check_passed boolean not null default false,
 functional_check_passed boolean not null default false,
 calibration_check_passed boolean,
 infection_control_check_passed boolean,
 released boolean not null default false,
 release_notes text,
 released_by uuid references auth.users(id),
 released_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.bf_med_safety_events(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_id uuid references public.bf_med_assets(id) on delete set null,
 work_order_id uuid references public.bf_med_work_orders(id) on delete set null,
 severity text not null check(severity in('low','medium','high','critical')),
 event_type text not null check(event_type in('incident','near_miss','electrical_safety','mechanical_safety','performance_failure','infection_control','other')),
 title text not null,
 description text not null,
 immediate_action text,
 device_quarantined boolean not null default false,
 status text not null default 'open' check(status in('open','investigating','action_required','closed')),
 occurred_at timestamptz not null default now(),
 reported_by uuid references auth.users(id),
 closed_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.bf_med_capa(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_id uuid references public.bf_med_assets(id) on delete set null,
 safety_event_id uuid references public.bf_med_safety_events(id) on delete set null,
 work_order_id uuid references public.bf_med_work_orders(id) on delete set null,
 capa_number text not null,
 nonconformity text not null,
 root_cause text,
 corrective_action text,
 preventive_action text,
 owner_id uuid references auth.users(id),
 target_date date,
 effectiveness_check text,
 status text not null default 'open' check(status in('open','in_progress','verification','effective','closed')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 closed_at timestamptz,
 unique(organization_id,capa_number)
);
create table if not exists public.bf_med_recalls(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 manufacturer_id uuid references public.bf_med_manufacturers(id),
 recall_number text not null,
 source_type text not null default 'manufacturer' check(source_type in('manufacturer','regulatory','vendor','internal')),
 title text not null,
 description text not null,
 affected_model text,
 affected_serial_range text,
 action_required text,
 published_date date,
 due_date date,
 status text not null default 'open' check(status in('open','in_progress','closed')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(organization_id,recall_number)
);
create table if not exists public.bf_med_recall_assets(
 recall_id uuid not null references public.bf_med_recalls(id) on delete cascade,
 asset_id uuid not null references public.bf_med_assets(id) on delete cascade,
 action_status text not null default 'pending' check(action_status in('pending','quarantined','inspected','corrected','not_affected','closed')),
 action_notes text,
 action_at timestamptz,
 action_by uuid references auth.users(id),
 primary key(recall_id,asset_id)
);
create table if not exists public.bf_med_asset_movements(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_id uuid not null references public.bf_med_assets(id) on delete cascade,
 from_location_id uuid references public.bf_location_nodes(id),
 to_location_id uuid references public.bf_location_nodes(id),
 movement_reason text,
 moved_by uuid references auth.users(id),
 moved_at timestamptz not null default now()
);
create table if not exists public.bf_med_asset_upgrades(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_id uuid not null references public.bf_med_assets(id) on delete cascade,
 upgrade_type text not null check(upgrade_type in('software','firmware','hardware','component','accessory','configuration','other')),
 old_version text,
 new_version text,
 description text not null,
 vendor_reference text,
 performed_by uuid references auth.users(id),
 performed_at timestamptz not null default now()
);
create table if not exists public.bf_med_warranties(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_id uuid not null references public.bf_med_assets(id) on delete cascade,
 provider_name text,
 warranty_number text,
 start_date date,
 end_date date,
 coverage_text text,
 status text not null default 'active' check(status in('active','expired','cancelled')),
 created_at timestamptz not null default now()
);
-- RLS for medical operations tables.
do $$
declare t text;
begin
 foreach t in array array[
  'bf_med_calibration_records','bf_med_return_to_service','bf_med_safety_events',
  'bf_med_capa','bf_med_recalls','bf_med_recall_assets',
  'bf_med_asset_movements','bf_med_asset_upgrades','bf_med_warranties'
 ]
 loop
   execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;
drop policy if exists bf_med_cal_r on public.bf_med_calibration_records;
create policy bf_med_cal_r on public.bf_med_calibration_records for select to authenticated
using(public.bf_can(organization_id,'medical.view'));
drop policy if exists bf_med_cal_w on public.bf_med_calibration_records;
create policy bf_med_cal_w on public.bf_med_calibration_records for all to authenticated
using(public.bf_can(organization_id,'medical.calibration') or public.bf_can(organization_id,'medical.manage'))
with check(public.bf_can(organization_id,'medical.calibration') or public.bf_can(organization_id,'medical.manage'));
drop policy if exists bf_med_rts_r on public.bf_med_return_to_service;
create policy bf_med_rts_r on public.bf_med_return_to_service for select to authenticated
using(public.bf_can(organization_id,'medical.view'));
drop policy if exists bf_med_rts_w on public.bf_med_return_to_service;
create policy bf_med_rts_w on public.bf_med_return_to_service for all to authenticated
using(public.bf_can(organization_id,'medical.safety') or public.bf_can(organization_id,'medical.manage'))
with check(public.bf_can(organization_id,'medical.safety') or public.bf_can(organization_id,'medical.manage'));
drop policy if exists bf_med_safety_r on public.bf_med_safety_events;
create policy bf_med_safety_r on public.bf_med_safety_events for select to authenticated
using(public.bf_can(organization_id,'medical.view'));
drop policy if exists bf_med_safety_w on public.bf_med_safety_events;
create policy bf_med_safety_w on public.bf_med_safety_events for all to authenticated
using(public.bf_can(organization_id,'medical.safety') or public.bf_can(organization_id,'medical.manage'))
with check(public.bf_can(organization_id,'medical.safety') or public.bf_can(organization_id,'medical.manage'));
drop policy if exists bf_med_capa_r on public.bf_med_capa;
create policy bf_med_capa_r on public.bf_med_capa for select to authenticated
using(public.bf_can(organization_id,'medical.view'));
drop policy if exists bf_med_capa_w on public.bf_med_capa;
create policy bf_med_capa_w on public.bf_med_capa for all to authenticated
using(public.bf_can(organization_id,'medical.quality') or public.bf_can(organization_id,'medical.manage'))
with check(public.bf_can(organization_id,'medical.quality') or public.bf_can(organization_id,'medical.manage'));
drop policy if exists bf_med_recalls_r on public.bf_med_recalls;
create policy bf_med_recalls_r on public.bf_med_recalls for select to authenticated
using(public.bf_can(organization_id,'medical.view'));
drop policy if exists bf_med_recalls_w on public.bf_med_recalls;
create policy bf_med_recalls_w on public.bf_med_recalls for all to authenticated
using(public.bf_can(organization_id,'medical.safety') or public.bf_can(organization_id,'medical.manage'))
with check(public.bf_can(organization_id,'medical.safety') or public.bf_can(organization_id,'medical.manage'));
drop policy if exists bf_med_recall_assets_r on public.bf_med_recall_assets;
create policy bf_med_recall_assets_r on public.bf_med_recall_assets for select to authenticated
using(exists(
 select 1 from public.bf_med_recalls r
 where r.id=recall_id and public.bf_can(r.organization_id,'medical.view')
));
drop policy if exists bf_med_recall_assets_w on public.bf_med_recall_assets;
create policy bf_med_recall_assets_w on public.bf_med_recall_assets for all to authenticated
using(exists(
 select 1 from public.bf_med_recalls r
 where r.id=recall_id and (public.bf_can(r.organization_id,'medical.safety') or public.bf_can(r.organization_id,'medical.manage'))
))
with check(exists(
 select 1 from public.bf_med_recalls r
 where r.id=recall_id and (public.bf_can(r.organization_id,'medical.safety') or public.bf_can(r.organization_id,'medical.manage'))
));
drop policy if exists bf_med_moves_r on public.bf_med_asset_movements;
create policy bf_med_moves_r on public.bf_med_asset_movements for select to authenticated
using(public.bf_can(organization_id,'medical.view'));
drop policy if exists bf_med_moves_w on public.bf_med_asset_movements;
create policy bf_med_moves_w on public.bf_med_asset_movements for all to authenticated
using(public.bf_can(organization_id,'medical.manage'))
with check(public.bf_can(organization_id,'medical.manage'));
drop policy if exists bf_med_upgrades_r on public.bf_med_asset_upgrades;
create policy bf_med_upgrades_r on public.bf_med_asset_upgrades for select to authenticated
using(public.bf_can(organization_id,'medical.view'));
drop policy if exists bf_med_upgrades_w on public.bf_med_asset_upgrades;
create policy bf_med_upgrades_w on public.bf_med_asset_upgrades for all to authenticated
using(public.bf_can(organization_id,'medical.manage'))
with check(public.bf_can(organization_id,'medical.manage'));
drop policy if exists bf_med_warranties_r on public.bf_med_warranties;
create policy bf_med_warranties_r on public.bf_med_warranties for select to authenticated
using(public.bf_can(organization_id,'medical.view'));
drop policy if exists bf_med_warranties_w on public.bf_med_warranties;
create policy bf_med_warranties_w on public.bf_med_warranties for all to authenticated
using(public.bf_can(organization_id,'medical.manage'))
with check(public.bf_can(organization_id,'medical.manage'));
-- ============================================================
-- 5. SAFETY GATE + MOVEMENT + PASSPORT EVENTS
-- ============================================================

create or replace function public.bf_med_set_quarantine(
 p_asset uuid,p_reason text,p_work_order uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare a public.bf_med_assets; e uuid; p uuid;
begin
 select * into a from public.bf_med_assets where id=p_asset;
 if not found then raise exception 'Medical asset not found'; end if;
 if not(public.bf_can(a.organization_id,'medical.safety') or public.bf_can(a.organization_id,'medical.manage')) then
   raise exception 'Permission denied' using errcode='42501';
 end if;

 update public.bf_med_assets
 set lifecycle_status='quarantined',operational_status='out_of_service',updated_at=now()
 where id=a.id;

 p:=public.bf_ensure_asset_passport(a.organization_id,'medical',a.id);
 insert into public.bf_asset_lifecycle_events(
   organization_id,asset_domain,asset_id,passport_id,event_type,event_title,event_status,
   reference_type,reference_id,details,performed_by
 )
 values(
   a.organization_id,'medical',a.id,p,'quarantine','Device quarantined','quarantined',
   'medical_work_order',p_work_order,jsonb_build_object('reason',p_reason),auth.uid()
 ) returning id into e;
 return e;
end $$;
create or replace function public.bf_med_release_to_service(
 p_asset uuid,p_work_order uuid,
 p_safety boolean,p_functional boolean,p_calibration boolean,p_infection boolean,
 p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare a public.bf_med_assets; r uuid; p uuid;
begin
 select * into a from public.bf_med_assets where id=p_asset;
 if not found then raise exception 'Medical asset not found'; end if;
 if not(public.bf_can(a.organization_id,'medical.safety') or public.bf_can(a.organization_id,'medical.manage')) then
   raise exception 'Permission denied' using errcode='42501';
 end if;

 if not coalesce(p_safety,false) or not coalesce(p_functional,false) then
   raise exception 'Safety and functional checks must pass before return to service';
 end if;
 if p_calibration is false then
   raise exception 'Calibration check failed';
 end if;
 if p_infection is false then
   raise exception 'Infection control check failed';
 end if;

 insert into public.bf_med_return_to_service(
   organization_id,asset_id,work_order_id,
   safety_check_passed,functional_check_passed,calibration_check_passed,
   infection_control_check_passed,released,release_notes,released_by,released_at
 )
 values(
   a.organization_id,a.id,p_work_order,
   p_safety,p_functional,p_calibration,p_infection,true,p_notes,auth.uid(),now()
 ) returning id into r;

 update public.bf_med_assets
 set lifecycle_status='active',operational_status='in_service',updated_at=now()
 where id=a.id;

 if p_work_order is not null then
   update public.bf_med_work_orders
   set safety_hold=false,service_state='normal',updated_at=now()
   where id=p_work_order;
 end if;

 p:=public.bf_ensure_asset_passport(a.organization_id,'medical',a.id);
 insert into public.bf_asset_lifecycle_events(
  organization_id,asset_domain,asset_id,passport_id,event_type,event_title,event_status,
  reference_type,reference_id,details,performed_by
 )
 values(
  a.organization_id,'medical',a.id,p,'return_to_service',
  'Device released to clinical service','released',
  'medical_return_to_service',r,
  jsonb_build_object('work_order_id',p_work_order,'notes',p_notes),
  auth.uid()
 );

 return r;
end $$;
create or replace function public.bf_med_move_asset(
 p_asset uuid,p_to_location uuid,p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare a public.bf_med_assets; l public.bf_location_nodes; m uuid; p uuid;
begin
 select * into a from public.bf_med_assets where id=p_asset for update;
 if not found then raise exception 'Medical asset not found'; end if;
 if not public.bf_can(a.organization_id,'medical.manage') then
   raise exception 'Permission denied' using errcode='42501';
 end if;
 select * into l from public.bf_location_nodes where id=p_to_location and organization_id=a.organization_id;
 if not found then raise exception 'Target location not found in organization'; end if;

 insert into public.bf_med_asset_movements(
   organization_id,asset_id,from_location_id,to_location_id,movement_reason,moved_by
 ) values(a.organization_id,a.id,a.location_node_id,l.id,p_reason,auth.uid())
 returning id into m;

 update public.bf_med_assets set location_node_id=l.id,updated_at=now() where id=a.id;

 p:=public.bf_ensure_asset_passport(a.organization_id,'medical',a.id);
 insert into public.bf_asset_lifecycle_events(
   organization_id,asset_domain,asset_id,passport_id,event_type,event_title,event_status,
   reference_type,reference_id,details,performed_by
 )
 values(
   a.organization_id,'medical',a.id,p,'movement','Asset moved','completed',
   'medical_asset_movement',m,
   jsonb_build_object('from_location_id',a.location_node_id,'to_location_id',l.id,'reason',p_reason),
   auth.uid()
 );

 return m;
end $$;
-- Auto-log medical maintenance history to passport.
create or replace function public.bf_med_history_passport_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$
declare p uuid; et text;
begin
 p:=public.bf_ensure_asset_passport(new.organization_id,'medical',new.asset_id);
 et:=case
   when new.activity_type='preventive' then 'preventive_maintenance'
   when new.activity_type='calibration' then 'calibration'
   else 'inspection'
 end;
 insert into public.bf_asset_lifecycle_events(
   organization_id,asset_domain,asset_id,passport_id,event_type,event_title,event_status,
   reference_type,reference_id,details,performed_by,occurred_at
 )
 values(
   new.organization_id,'medical',new.asset_id,p,et,
   'Medical maintenance activity: '||new.activity_type,new.result,
   'bf_med_pm_history',new.id,
   jsonb_build_object('certificate_number',new.certificate_number,'service_provider',new.service_provider,'notes',new.notes),
   new.performed_by,new.performed_at
 );
 return new;
end $$;
drop trigger if exists bf_med_history_passport_ai on public.bf_med_pm_history;
create trigger bf_med_history_passport_ai
after insert on public.bf_med_pm_history
for each row execute function public.bf_med_history_passport_trigger();
-- Facility corrective work orders are logged into the same passport where possible.
do $$
begin
 if to_regclass('public.bf_work_orders') is not null then
   execute $x$
     create or replace function public.bf_fac_wo_passport_trigger()
     returns trigger language plpgsql security definer set search_path=''
     as $f$
     declare p uuid;
     begin
       if new.asset_id is null then return new; end if;
       p:=public.bf_ensure_asset_passport(new.organization_id,'facility',new.asset_id);
       if tg_op='INSERT' then
         insert into public.bf_asset_lifecycle_events(
          organization_id,asset_domain,asset_id,passport_id,event_type,event_title,event_status,
          reference_type,reference_id,details,performed_by
         ) values(
          new.organization_id,'facility',new.asset_id,p,'corrective_maintenance',
          'Work order '||coalesce(new.work_order_number,''),new.status,
          'bf_work_orders',new.id,
          jsonb_build_object('title',new.title,'priority',new.priority,'status',new.status),
          new.created_by
         );
       elsif old.status is distinct from new.status then
         insert into public.bf_asset_lifecycle_events(
          organization_id,asset_domain,asset_id,passport_id,event_type,event_title,event_status,
          reference_type,reference_id,details,performed_by
         ) values(
          new.organization_id,'facility',new.asset_id,p,'corrective_maintenance',
          'Work order status changed',new.status,'bf_work_orders',new.id,
          jsonb_build_object('work_order_number',new.work_order_number,'from',old.status,'to',new.status),
          auth.uid()
         );
       end if;
       return new;
     end
     $f$
   $x$;
   execute 'drop trigger if exists bf_fac_wo_passport_aiu on public.bf_work_orders';
   execute 'create trigger bf_fac_wo_passport_aiu after insert or update on public.bf_work_orders for each row execute function public.bf_fac_wo_passport_trigger()';
 end if;
end $$;
-- ============================================================
-- 6. DIGITAL PASSPORT SNAPSHOT RPC
-- ============================================================

create or replace function public.bf_asset_passport_snapshot(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
 p public.bf_asset_passports;
 asset_json jsonb;
 loc_json jsonb;
begin
 select * into p
 from public.bf_asset_passports
 where passport_code=p_code or qr_token::text=p_code;

 if not found then raise exception 'Asset passport not found'; end if;

 if not(
   public.bf_can(p.organization_id,'asset.passport.view')
   or public.bf_can(p.organization_id,'medical.view')
   or public.bf_can(p.organization_id,'assets.view')
 ) then
   raise exception 'Permission denied' using errcode='42501';
 end if;

 if p.asset_domain='medical' then
   select jsonb_build_object(
    'id',a.id,'asset_tag',a.asset_tag,'model',a.model,'serial_number',a.serial_number,
    'department',a.department,'site_name',a.site_name,'location_text',a.location_text,
    'criticality',a.criticality,'operational_status',a.operational_status,
    'lifecycle_status',a.lifecycle_status,'installation_date',a.installation_date,
    'commissioning_date',a.commissioning_date,'warranty_end_date',a.warranty_end_date,
    'next_pm_date',a.next_pm_date,'next_calibration_date',a.next_calibration_date,
    'firmware_version',a.firmware_version,'software_version',a.software_version,
    'manufacturer',m.name,'device_type_ar',t.name_ar,'device_type_en',t.name_en,
    'icon',t.icon_text,'location_node_id',a.location_node_id
   )
   into asset_json
   from public.bf_med_assets a
   left join public.bf_med_manufacturers m on m.id=a.manufacturer_id
   left join public.bf_med_master_types t on t.id=a.master_type_id
   where a.id=p.asset_id;
 else
   execute 'select to_jsonb(a) from public.bf_assets a where a.id=$1'
   into asset_json using p.asset_id;
 end if;

 if (asset_json->>'location_node_id') is not null then
   select jsonb_build_object(
    'id',l.id,'code',l.code,'name_ar',l.name_ar,'name_en',l.name_en,
    'node_type',l.node_type,'facility_kind',l.facility_kind,'address',l.address_text
   )
   into loc_json
   from public.bf_location_nodes l
   where l.id=(asset_json->>'location_node_id')::uuid;
 end if;

 return jsonb_build_object(
   'passport',jsonb_build_object(
     'id',p.id,'code',p.passport_code,'qr_token',p.qr_token,
     'domain',p.asset_domain,'status',p.status,'created_at',p.created_at
   ),
   'asset',asset_json,
   'location',loc_json,
   'timeline',coalesce((
     select jsonb_agg(to_jsonb(e) order by e.occurred_at desc)
     from public.bf_asset_lifecycle_events e
     where e.asset_domain=p.asset_domain and e.asset_id=p.asset_id
   ),'[]'::jsonb),
   'warranties',case when p.asset_domain='medical' then coalesce((
     select jsonb_agg(to_jsonb(w) order by w.end_date desc)
     from public.bf_med_warranties w where w.asset_id=p.asset_id
   ),'[]'::jsonb) else '[]'::jsonb end,
   'medical_work_orders',case when p.asset_domain='medical' then coalesce((
     select jsonb_agg(to_jsonb(w) order by w.opened_at desc)
     from public.bf_med_work_orders w where w.asset_id=p.asset_id
   ),'[]'::jsonb) else '[]'::jsonb end
 );
end $$;
revoke all on function public.bf_asset_passport_snapshot(text) from public,anon;
grant execute on function public.bf_asset_passport_snapshot(text) to authenticated;
revoke all on function public.bf_med_set_quarantine(uuid,text,uuid) from public,anon;
grant execute on function public.bf_med_set_quarantine(uuid,text,uuid) to authenticated;
revoke all on function public.bf_med_release_to_service(uuid,uuid,boolean,boolean,boolean,boolean,text) from public,anon;
grant execute on function public.bf_med_release_to_service(uuid,uuid,boolean,boolean,boolean,boolean,text) to authenticated;
revoke all on function public.bf_med_move_asset(uuid,uuid,text) from public,anon;
grant execute on function public.bf_med_move_asset(uuid,uuid,text) to authenticated;
revoke all on function public.bf_med_generate_due_ppm(date) from public,anon;
grant execute on function public.bf_med_generate_due_ppm(date) to authenticated;
-- ============================================================
-- 7. REPORTING VIEWS
-- ============================================================

drop view if exists public.bf_medical_operations_dashboard;
create view public.bf_medical_operations_dashboard
with (security_invoker=true)
as
select
 a.organization_id,
 count(*) as total_assets,
 count(*) filter(where a.lifecycle_status='active') as active_assets,
 count(*) filter(where a.lifecycle_status='quarantined') as quarantined_assets,
 count(*) filter(where a.operational_status='out_of_service') as out_of_service_assets,
 count(*) filter(where a.next_pm_date<current_date) as ppm_overdue_assets,
 count(*) filter(where a.next_calibration_date<current_date) as calibration_overdue_assets,
 count(*) filter(where a.warranty_end_date between current_date and current_date+interval '90 days') as warranty_expiring_90d
from public.bf_med_assets a
group by a.organization_id;
grant select on public.bf_medical_operations_dashboard to authenticated;
drop view if exists public.bf_medical_quality_dashboard;
create view public.bf_medical_quality_dashboard
with (security_invoker=true)
as
select o.id organization_id,
 (select count(*) from public.bf_med_safety_events s where s.organization_id=o.id and s.status<>'closed') open_safety_events,
 (select count(*) from public.bf_med_capa c where c.organization_id=o.id and c.status<>'closed') open_capa,
 (select count(*) from public.bf_med_recalls r where r.organization_id=o.id and r.status<>'closed') open_recalls,
 (select count(*) from public.bf_med_work_orders w where w.organization_id=o.id and w.priority='critical' and w.status not in('completed','closed','cancelled')) critical_open_work_orders
from public.bf_organizations o;
grant select on public.bf_medical_quality_dashboard to authenticated;
notify pgrst,'reload schema';
commit;
