begin;
-- ============================================================
-- BASMAT UNIFIED CMMS V10
-- One product for Facilities + Medical Equipment Maintenance
-- Clean unified operational model. Legacy data remains untouched.
-- ============================================================

insert into public.bf_permissions(code,description) values
 ('v10.view','View Unified CMMS V10'),
 ('v10.assets.manage','Manage unified assets'),
 ('v10.maintenance.manage','Manage corrective and preventive maintenance'),
 ('v10.medical.manage','Manage medical safety and calibration'),
 ('v10.reports.view','View unified reports and documents'),
 ('v10.reports.manage','Manage unified reports and documents'),
 ('v10.admin','Administer Unified CMMS V10')
on conflict(code) do nothing;
insert into public.bf_role_permissions(role_id,permission_id)
select r.id,p.id
from public.bf_roles r cross join public.bf_permissions p
where
 (r.code='company_admin' and p.code like 'v10.%')
 or (r.code in('facility_manager','maintenance_manager') and p.code in(
   'v10.view','v10.assets.manage','v10.maintenance.manage','v10.reports.view','v10.reports.manage'
 ))
 or (r.code='supervisor' and p.code in('v10.view','v10.maintenance.manage','v10.reports.view'))
 or (r.code='technician' and p.code in('v10.view','v10.reports.view'))
on conflict do nothing;
create sequence if not exists public.bf10_asset_seq;
create sequence if not exists public.bf10_wo_seq;
create sequence if not exists public.bf10_report_seq;
-- ---------------- ORGANIZATIONAL / PROJECT CONTEXT ----------------
create table if not exists public.bf10_projects(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 client_id uuid references public.bf_clients(id),
 site_id uuid references public.bf_sites(id),
 contract_id uuid references public.bf_contracts(id),
 project_code text not null,
 name_ar text not null,
 name_en text,
 project_type text not null default 'other',
 maintenance_scope text not null default 'both' check(maintenance_scope in('facilities','medical','both')),
 owner_name text,
 company_name text,
 consultant_name text,
 status text not null default 'active' check(status in('active','inactive','archived')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,project_code)
);
create table if not exists public.bf10_locations(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 project_id uuid references public.bf10_projects(id) on delete cascade,
 parent_id uuid references public.bf10_locations(id) on delete restrict,
 node_type text not null check(node_type in(
  'branch','facility','building','floor','department','clinic','unit','room','zone'
 )),
 code text not null,
 name_ar text not null,
 name_en text,
 status text not null default 'active' check(status in('active','inactive','archived')),
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 unique(organization_id,project_id,code)
);
-- ---------------- UNIFIED ASSET REGISTER ----------------
create table if not exists public.bf10_assets(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 project_id uuid references public.bf10_projects(id),
 location_id uuid references public.bf10_locations(id),
 domain text not null check(domain in('facilities','medical')),
 asset_tag text not null,
 passport_code text not null unique,
 qr_token uuid not null default gen_random_uuid() unique,
 master_source text,
 master_source_id uuid,
 category text,
 asset_type text not null,
 manufacturer text,
 model text,
 serial_number text,
 criticality text not null default 'medium' check(criticality in('low','medium','high','critical')),
 operational_status text not null default 'in_service' check(operational_status in(
   'in_service','under_maintenance','out_of_service','quarantined','retired','disposed'
 )),
 lifecycle_status text not null default 'active' check(lifecycle_status in(
   'planned','received','commissioning','active','quarantined','retired','disposed'
 )),
 installation_date date,
 commissioning_date date,
 warranty_start_date date,
 warranty_end_date date,
 supplier_name text,
 firmware_version text,
 software_version text,
 purchase_cost numeric(18,2),
 replacement_cost numeric(18,2),
 notes text,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,asset_tag)
);
create index if not exists bf10_assets_scope on public.bf10_assets(organization_id,project_id,domain,operational_status);
create index if not exists bf10_assets_location on public.bf10_assets(location_id);
create table if not exists public.bf10_asset_events(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_id uuid not null references public.bf10_assets(id) on delete cascade,
 event_type text not null,
 title text not null,
 status text,
 occurred_at timestamptz not null default now(),
 reference_type text,
 reference_id uuid,
 details jsonb not null default '{}'::jsonb,
 actor_id uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists bf10_asset_events_asset on public.bf10_asset_events(asset_id,occurred_at desc);
-- ---------------- PM / PPM ----------------
create table if not exists public.bf10_pm_templates(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.bf_organizations(id),
 domain text not null check(domain in('facilities','medical')),
 asset_type text not null,
 manufacturer text,
 model_family text,
 name text not null,
 source_type text not null default 'generic' check(source_type in('oem','vendor','contract','internal','generic','regulatory')),
 source_reference text,
 revision text,
 interval_months integer not null default 12 check(interval_months between 1 and 60),
 estimated_minutes integer,
 required_skill text,
 tools text,
 test_equipment text,
 ppe text,
 prerequisites text,
 requires_shutdown boolean not null default false,
 requires_loto boolean not null default false,
 requires_permit boolean not null default false,
 verified boolean not null default false,
 status text not null default 'active' check(status in('active','archived')),
 created_at timestamptz not null default now()
);
create table if not exists public.bf10_pm_steps(
 id uuid primary key default gen_random_uuid(),
 template_id uuid not null references public.bf10_pm_templates(id) on delete cascade,
 step_no integer not null,
 instruction text not null,
 response_type text not null default 'pass_fail' check(response_type in('pass_fail','number','text','choice')),
 required boolean not null default true,
 min_value numeric,
 max_value numeric,
 unit text,
 acceptance_criteria text,
 evidence_required boolean not null default false,
 failure_action text,
 unique(template_id,step_no)
);
create table if not exists public.bf10_pm_plans(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_id uuid not null references public.bf10_assets(id) on delete cascade,
 template_id uuid references public.bf10_pm_templates(id),
 plan_code text not null,
 start_date date not null,
 next_due_date date not null,
 interval_months integer not null default 12,
 assigned_to uuid references auth.users(id),
 status text not null default 'active' check(status in('active','paused','closed')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(organization_id,plan_code)
);
-- ---------------- CORRECTIVE / PREVENTIVE WORK ORDERS ----------------
create table if not exists public.bf10_work_orders(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 project_id uuid references public.bf10_projects(id),
 asset_id uuid references public.bf10_assets(id),
 pm_plan_id uuid references public.bf10_pm_plans(id),
 work_order_number text not null,
 domain text not null check(domain in('facilities','medical')),
 work_type text not null check(work_type in('corrective','preventive','inspection','calibration','safety')),
 title text not null,
 description text,
 priority text not null default 'medium' check(priority in('low','medium','high','critical')),
 status text not null default 'open' check(status in(
  'open','assigned','in_progress','awaiting_parts','awaiting_vendor','awaiting_owner',
  'ready_for_release','completed','closed','cancelled'
 )),
 assigned_to uuid references auth.users(id),
 due_date date,
 started_at timestamptz,
 completed_at timestamptz,
 downtime_started_at timestamptz,
 downtime_ended_at timestamptz,
 failure_mode text,
 root_cause text,
 resolution text,
 actual_minutes integer,
 safety_hold boolean not null default false,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,work_order_number)
);
create index if not exists bf10_wo_scope on public.bf10_work_orders(organization_id,domain,status,priority,created_at desc);
create table if not exists public.bf10_work_results(
 id uuid primary key default gen_random_uuid(),
 work_order_id uuid not null references public.bf10_work_orders(id) on delete cascade,
 pm_step_id uuid references public.bf10_pm_steps(id),
 result_text text,
 numeric_value numeric,
 passed boolean,
 notes text,
 performed_by uuid references auth.users(id),
 performed_at timestamptz not null default now(),
 unique(work_order_id,pm_step_id)
);
-- ---------------- MEDICAL-SPECIFIC SAFETY / QUALITY ----------------
create table if not exists public.bf10_calibrations(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_id uuid not null references public.bf10_assets(id) on delete cascade,
 work_order_id uuid references public.bf10_work_orders(id),
 calibration_date date not null,
 next_due_date date,
 certificate_number text,
 provider text,
 traceability_reference text,
 result text not null check(result in('pass','fail','limited')),
 as_found jsonb not null default '{}'::jsonb,
 as_left jsonb not null default '{}'::jsonb,
 certificate_document_id uuid,
 performed_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.bf10_safety_events(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 project_id uuid references public.bf10_projects(id),
 asset_id uuid references public.bf10_assets(id),
 work_order_id uuid references public.bf10_work_orders(id),
 domain text not null check(domain in('facilities','medical')),
 event_type text not null,
 severity text not null check(severity in('low','medium','high','critical')),
 title text not null,
 description text not null,
 immediate_action text,
 quarantined boolean not null default false,
 status text not null default 'open' check(status in('open','investigating','action_required','closed')),
 reported_by uuid references auth.users(id),
 occurred_at timestamptz not null default now(),
 closed_at timestamptz
);
create table if not exists public.bf10_capa(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 safety_event_id uuid references public.bf10_safety_events(id),
 asset_id uuid references public.bf10_assets(id),
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
 unique(organization_id,capa_number)
);
create table if not exists public.bf10_recalls(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_id uuid references public.bf10_assets(id),
 recall_number text not null,
 source_type text not null default 'manufacturer',
 title text not null,
 description text not null,
 action_required text,
 published_date date,
 due_date date,
 status text not null default 'open' check(status in('open','in_progress','closed')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(organization_id,recall_number)
);
create table if not exists public.bf10_return_to_service(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 asset_id uuid not null references public.bf10_assets(id),
 work_order_id uuid references public.bf10_work_orders(id),
 safety_passed boolean not null,
 functional_passed boolean not null,
 calibration_passed boolean,
 infection_control_passed boolean,
 released boolean not null default false,
 notes text,
 released_by uuid references auth.users(id),
 released_at timestamptz
);
-- ---------------- PARTS / INVENTORY ----------------
create table if not exists public.bf10_parts(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 sku text not null,
 name text not null,
 unit text not null default 'ea',
 on_hand numeric(18,3) not null default 0,
 min_stock numeric(18,3) not null default 0,
 unit_cost numeric(18,2) not null default 0,
 status text not null default 'active' check(status in('active','inactive')),
 unique(organization_id,sku)
);
create table if not exists public.bf10_part_usage(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 work_order_id uuid not null references public.bf10_work_orders(id),
 part_id uuid not null references public.bf10_parts(id),
 quantity numeric(18,3) not null check(quantity>0),
 responsibility text not null default 'maintenance_company' check(responsibility in('maintenance_company','owner','warranty_vendor')),
 replacement_type text not null default 'replacement' check(replacement_type in('new','replacement','exchange','warranty')),
 old_serial text,
 new_serial text,
 old_part_disposition text,
 issued_by uuid references auth.users(id),
 issued_at timestamptz not null default now()
);
-- ---------------- DOCUMENTS / REPORTS / BRANDING ----------------
create table if not exists public.bf10_branding(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 project_id uuid references public.bf10_projects(id) on delete cascade,
 company_name text,
 company_logo_path text,
 owner_name text,
 owner_logo_path text,
 consultant_name text,
 consultant_logo_path text,
 report_prefix text not null default 'RPT',
 footer_note text,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(organization_id,project_id)
);
create table if not exists public.bf10_documents(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 project_id uuid references public.bf10_projects(id),
 asset_id uuid references public.bf10_assets(id),
 work_order_id uuid references public.bf10_work_orders(id),
 domain text not null check(domain in('facilities','medical','shared')),
 document_type text not null,
 title text not null,
 document_number text,
 revision text,
 bucket_id text not null default 'bf10-documents',
 object_path text not null,
 file_name text not null,
 mime_type text,
 size_bytes bigint,
 status text not null default 'active' check(status in('active','superseded','archived')),
 uploaded_by uuid references auth.users(id),
 uploaded_at timestamptz not null default now(),
 unique(bucket_id,object_path)
);
create table if not exists public.bf10_reports(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 project_id uuid references public.bf10_projects(id),
 domain text not null check(domain in('facilities','medical','combined')),
 report_number text not null,
 report_type text not null,
 title text not null,
 period_from date,
 period_to date,
 snapshot jsonb not null default '{}'::jsonb,
 branding_snapshot jsonb not null default '{}'::jsonb,
 status text not null default 'draft' check(status in('draft','final','archived')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(organization_id,report_number)
);
insert into storage.buckets(id,name,public,file_size_limit)
values
 ('bf10-documents','bf10-documents',false,104857600),
 ('bf10-branding','bf10-branding',false,10485760)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;
-- ---------------- RLS ----------------
do $$
declare t text;
begin
 foreach t in array array[
  'bf10_projects','bf10_locations','bf10_assets','bf10_asset_events',
  'bf10_pm_templates','bf10_pm_steps','bf10_pm_plans','bf10_work_orders','bf10_work_results',
  'bf10_calibrations','bf10_safety_events','bf10_capa','bf10_recalls','bf10_return_to_service',
  'bf10_parts','bf10_part_usage','bf10_branding','bf10_documents','bf10_reports'
 ] loop
   execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;
-- Direct-org tables
do $$
declare t text;
begin
 foreach t in array array[
  'bf10_projects','bf10_locations','bf10_assets','bf10_asset_events','bf10_pm_plans',
  'bf10_work_orders','bf10_calibrations','bf10_safety_events','bf10_capa','bf10_recalls',
  'bf10_return_to_service','bf10_parts','bf10_part_usage','bf10_branding','bf10_documents','bf10_reports'
 ] loop
   execute format('drop policy if exists %I on public.%I',t||'_read',t);
   execute format(
     'create policy %I on public.%I for select to authenticated using(public.bf_can(organization_id,''v10.view'') or public.bf_is_super_admin())',
     t||'_read',t
   );
   execute format('drop policy if exists %I on public.%I',t||'_write',t);
   execute format(
     'create policy %I on public.%I for all to authenticated using(public.bf_can(organization_id,''v10.admin'') or public.bf_can(organization_id,''v10.assets.manage'') or public.bf_can(organization_id,''v10.maintenance.manage'') or public.bf_can(organization_id,''v10.medical.manage'') or public.bf_can(organization_id,''v10.reports.manage'') or public.bf_is_super_admin()) with check(public.bf_can(organization_id,''v10.admin'') or public.bf_can(organization_id,''v10.assets.manage'') or public.bf_can(organization_id,''v10.maintenance.manage'') or public.bf_can(organization_id,''v10.medical.manage'') or public.bf_can(organization_id,''v10.reports.manage'') or public.bf_is_super_admin())',
     t||'_write',t
   );
 end loop;
end $$;
-- Template tables may be global (organization_id null)
drop policy if exists bf10_pm_templates_read on public.bf10_pm_templates;
create policy bf10_pm_templates_read on public.bf10_pm_templates for select to authenticated
using(organization_id is null or public.bf_can(organization_id,'v10.view') or public.bf_is_super_admin());
drop policy if exists bf10_pm_templates_write on public.bf10_pm_templates;
create policy bf10_pm_templates_write on public.bf10_pm_templates for all to authenticated
using(organization_id is null and public.bf_is_super_admin() or public.bf_can(organization_id,'v10.admin'))
with check(organization_id is null and public.bf_is_super_admin() or public.bf_can(organization_id,'v10.admin'));
drop policy if exists bf10_pm_steps_read on public.bf10_pm_steps;
create policy bf10_pm_steps_read on public.bf10_pm_steps for select to authenticated
using(exists(
 select 1 from public.bf10_pm_templates t
 where t.id=template_id and (t.organization_id is null or public.bf_can(t.organization_id,'v10.view') or public.bf_is_super_admin())
));
drop policy if exists bf10_pm_steps_write on public.bf10_pm_steps;
create policy bf10_pm_steps_write on public.bf10_pm_steps for all to authenticated
using(exists(
 select 1 from public.bf10_pm_templates t
 where t.id=template_id and (public.bf_is_super_admin() or public.bf_can(t.organization_id,'v10.admin'))
))
with check(exists(
 select 1 from public.bf10_pm_templates t
 where t.id=template_id and (public.bf_is_super_admin() or public.bf_can(t.organization_id,'v10.admin'))
));
-- Work results derive access through WO
drop policy if exists bf10_work_results_read on public.bf10_work_results;
create policy bf10_work_results_read on public.bf10_work_results for select to authenticated
using(exists(
 select 1 from public.bf10_work_orders w where w.id=work_order_id
 and (public.bf_can(w.organization_id,'v10.view') or public.bf_is_super_admin())
));
drop policy if exists bf10_work_results_write on public.bf10_work_results;
create policy bf10_work_results_write on public.bf10_work_results for all to authenticated
using(exists(
 select 1 from public.bf10_work_orders w where w.id=work_order_id
 and (public.bf_can(w.organization_id,'v10.maintenance.manage') or public.bf_can(w.organization_id,'v10.medical.manage') or public.bf_is_super_admin())
))
with check(exists(
 select 1 from public.bf10_work_orders w where w.id=work_order_id
 and (public.bf_can(w.organization_id,'v10.maintenance.manage') or public.bf_can(w.organization_id,'v10.medical.manage') or public.bf_is_super_admin())
));
-- Storage policies
drop policy if exists bf10_storage_select on storage.objects;
create policy bf10_storage_select on storage.objects for select to authenticated
using(
 bucket_id in('bf10-documents','bf10-branding')
 and array_length(storage.foldername(name),1)>=1
 and exists(select 1 from public.bf_organizations o
   where o.id::text=(storage.foldername(name))[1]
   and (public.bf_can(o.id,'v10.view') or public.bf_is_super_admin()))
);
drop policy if exists bf10_storage_insert on storage.objects;
create policy bf10_storage_insert on storage.objects for insert to authenticated
with check(
 bucket_id in('bf10-documents','bf10-branding')
 and array_length(storage.foldername(name),1)>=1
 and exists(select 1 from public.bf_organizations o
   where o.id::text=(storage.foldername(name))[1]
   and (public.bf_can(o.id,'v10.reports.manage') or public.bf_can(o.id,'v10.admin') or public.bf_is_super_admin()))
);
drop policy if exists bf10_storage_delete on storage.objects;
create policy bf10_storage_delete on storage.objects for delete to authenticated
using(
 bucket_id in('bf10-documents','bf10-branding')
 and array_length(storage.foldername(name),1)>=1
 and exists(select 1 from public.bf_organizations o
   where o.id::text=(storage.foldername(name))[1]
   and (public.bf_can(o.id,'v10.reports.manage') or public.bf_can(o.id,'v10.admin') or public.bf_is_super_admin()))
);
-- ---------------- RPCs ----------------
create or replace function public.bf10_register_asset(
 p_org uuid,p_project uuid,p_location uuid,p_domain text,
 p_master_source text,p_master_source_id uuid,
 p_category text,p_asset_type text,p_manufacturer text,p_model text,p_serial text,
 p_criticality text,p_installation date,p_warranty_start date,p_warranty_end date,
 p_supplier text,p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 n bigint; v_id uuid; tag text; pass text; typ text; tmpl uuid; interval_m integer;
begin
 if not(public.bf_can(p_org,'v10.assets.manage') or public.bf_can(p_org,'v10.admin') or public.bf_is_super_admin()) then
   raise exception 'Permission denied' using errcode='42501';
 end if;
 if p_domain not in('facilities','medical') then raise exception 'Invalid asset domain'; end if;
 if nullif(btrim(coalesce(p_asset_type,'')),'') is null then raise exception 'Asset type required'; end if;
 if nullif(btrim(coalesce(p_serial,'')),'') is null then raise exception 'Serial number required'; end if;

 n:=nextval('public.bf10_asset_seq');
 typ:=upper(left(regexp_replace(p_asset_type,'[^A-Za-z0-9]','','g'),8));
 if typ='' then typ:=case when p_domain='medical' then 'MED' else 'FAC' end; end if;
 tag:=upper(case when p_domain='medical' then 'MED' else 'FAC' end)||'-'||typ||'-'||lpad(n::text,6,'0');
 pass:='BAS-'||upper(case when p_domain='medical' then 'MED' else 'FAC' end)||'-'||to_char(current_date,'YYYY')||'-'||lpad(n::text,8,'0');

 insert into public.bf10_assets(
  organization_id,project_id,location_id,domain,asset_tag,passport_code,
  master_source,master_source_id,category,asset_type,manufacturer,model,serial_number,
  criticality,installation_date,warranty_start_date,warranty_end_date,supplier_name,notes,
  created_by
 ) values(
  p_org,p_project,p_location,p_domain,tag,pass,
  p_master_source,p_master_source_id,p_category,p_asset_type,p_manufacturer,p_model,btrim(p_serial),
  coalesce(nullif(p_criticality,''),'medium'),p_installation,p_warranty_start,p_warranty_end,
  nullif(p_supplier,''),nullif(p_notes,''),auth.uid()
 ) returning id into v_id;

 insert into public.bf10_asset_events(
  organization_id,asset_id,event_type,title,status,details,actor_id
 ) values(
  p_org,v_id,'registration','Asset registered','active',
  jsonb_build_object('asset_tag',tag,'passport_code',pass,'domain',p_domain),auth.uid()
 );

 select t.id,t.interval_months into tmpl,interval_m
 from public.bf10_pm_templates t
 where t.status='active'
   and t.domain=p_domain
   and lower(t.asset_type)=lower(p_asset_type)
   and (t.organization_id is null or t.organization_id=p_org)
   and (t.manufacturer is null or lower(t.manufacturer)=lower(coalesce(p_manufacturer,'')))
   and (t.model_family is null or lower(coalesce(p_model,'')) like '%'||lower(t.model_family)||'%')
 order by
   (t.model_family is not null) desc,
   (t.manufacturer is not null) desc,
   t.verified desc,
   case t.source_type when 'oem' then 1 when 'vendor' then 2 when 'contract' then 3 when 'internal' then 4 else 5 end
 limit 1;

 if tmpl is not null then
   insert into public.bf10_pm_plans(
    organization_id,asset_id,template_id,plan_code,start_date,next_due_date,interval_months,created_by
   ) values(
    p_org,v_id,tmpl,'PM-'||replace(tag,'-',''),coalesce(p_installation,current_date),
    (coalesce(p_installation,current_date)+make_interval(months=>coalesce(interval_m,12)))::date,
    coalesce(interval_m,12),auth.uid()
   );
 end if;

 return jsonb_build_object('asset_id',v_id,'asset_tag',tag,'passport_code',pass,'pm_plan_created',tmpl is not null);
end $$;
create or replace function public.bf10_create_work_order(
 p_asset uuid,p_type text,p_title text,p_description text,p_priority text,p_due date
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare a public.bf10_assets; n bigint; wo_no text; wid uuid;
begin
 select * into a from public.bf10_assets where id=p_asset;
 if not found then raise exception 'Asset not found'; end if;
 if not(public.bf_can(a.organization_id,'v10.maintenance.manage') or public.bf_can(a.organization_id,'v10.medical.manage') or public.bf_is_super_admin()) then
   raise exception 'Permission denied' using errcode='42501';
 end if;
 n:=nextval('public.bf10_wo_seq');
 wo_no:='WO-'||to_char(current_date,'YYYYMM')||'-'||lpad(n::text,6,'0');
 insert into public.bf10_work_orders(
  organization_id,project_id,asset_id,work_order_number,domain,work_type,title,description,
  priority,due_date,created_by
 ) values(
  a.organization_id,a.project_id,a.id,wo_no,a.domain,p_type,p_title,p_description,
  coalesce(nullif(p_priority,''),'medium'),p_due,auth.uid()
 ) returning id into wid;
 insert into public.bf10_asset_events(
  organization_id,asset_id,event_type,title,status,reference_type,reference_id,details,actor_id
 ) values(
  a.organization_id,a.id,case when p_type='preventive' then 'preventive_maintenance' else 'corrective_maintenance' end,
  'Work order created: '||wo_no,'open','work_order',wid,
  jsonb_build_object('type',p_type,'priority',p_priority,'title',p_title),auth.uid()
 );
 return jsonb_build_object('work_order_id',wid,'work_order_number',wo_no);
end $$;
create or replace function public.bf10_generate_due_pm(p_through date default current_date)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare r record; cnt integer:=0; x jsonb;
begin
 for r in
  select p.*,a.domain,a.project_id,a.asset_tag,a.organization_id
  from public.bf10_pm_plans p join public.bf10_assets a on a.id=p.asset_id
  where p.status='active' and p.next_due_date<=p_through
 loop
  if not(public.bf_can(r.organization_id,'v10.maintenance.manage') or public.bf_can(r.organization_id,'v10.medical.manage') or public.bf_is_super_admin()) then
    continue;
  end if;
  if not exists(
   select 1 from public.bf10_work_orders w where w.pm_plan_id=r.id and w.due_date=r.next_due_date and w.status<>'cancelled'
  ) then
   insert into public.bf10_work_orders(
    organization_id,project_id,asset_id,pm_plan_id,work_order_number,domain,work_type,title,description,
    priority,status,assigned_to,due_date,created_by
   ) values(
    r.organization_id,r.project_id,r.asset_id,r.id,
    'PM-'||to_char(r.next_due_date,'YYYYMMDD')||'-'||right(r.id::text,6),
    r.domain,'preventive','Scheduled PPM - '||r.asset_tag,
    'Automatically generated from PM plan '||r.plan_code,'medium',
    case when r.assigned_to is null then 'open' else 'assigned' end,
    r.assigned_to,r.next_due_date,auth.uid()
   );
   cnt:=cnt+1;
  end if;
  update public.bf10_pm_plans
  set next_due_date=(r.next_due_date+make_interval(months=>r.interval_months))::date
  where id=r.id;
 end loop;
 return cnt;
end $$;
create or replace function public.bf10_set_asset_status(p_asset uuid,p_status text,p_note text default null)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare a public.bf10_assets;
begin
 select * into a from public.bf10_assets where id=p_asset;
 if not found then raise exception 'Asset not found'; end if;
 if not(public.bf_can(a.organization_id,'v10.assets.manage') or public.bf_can(a.organization_id,'v10.medical.manage') or public.bf_is_super_admin()) then
  raise exception 'Permission denied' using errcode='42501';
 end if;
 update public.bf10_assets set
  operational_status=p_status,
  lifecycle_status=case when p_status='quarantined' then 'quarantined' when p_status='retired' then 'retired' when p_status='disposed' then 'disposed' else lifecycle_status end,
  updated_at=now()
 where id=p_asset;
 insert into public.bf10_asset_events(organization_id,asset_id,event_type,title,status,details,actor_id)
 values(a.organization_id,p_asset,'status_change','Asset status changed',p_status,jsonb_build_object('note',p_note),auth.uid());
end $$;
create or replace function public.bf10_return_to_service(
 p_asset uuid,p_work_order uuid,p_safety boolean,p_functional boolean,p_calibration boolean,p_infection boolean,p_notes text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare a public.bf10_assets; rid uuid;
begin
 select * into a from public.bf10_assets where id=p_asset;
 if not found or a.domain<>'medical' then raise exception 'Medical asset not found'; end if;
 if not(public.bf_can(a.organization_id,'v10.medical.manage') or public.bf_is_super_admin()) then
  raise exception 'Permission denied' using errcode='42501';
 end if;
 if not coalesce(p_safety,false) or not coalesce(p_functional,false) then
  raise exception 'Safety and functional checks must pass';
 end if;
 if p_calibration is false then raise exception 'Calibration check failed'; end if;
 if p_infection is false then raise exception 'Infection control check failed'; end if;

 insert into public.bf10_return_to_service(
  organization_id,asset_id,work_order_id,safety_passed,functional_passed,calibration_passed,
  infection_control_passed,released,notes,released_by,released_at
 ) values(
  a.organization_id,a.id,p_work_order,p_safety,p_functional,p_calibration,p_infection,true,p_notes,auth.uid(),now()
 ) returning id into rid;

 update public.bf10_assets set operational_status='in_service',lifecycle_status='active',updated_at=now() where id=a.id;
 if p_work_order is not null then update public.bf10_work_orders set safety_hold=false,status='completed',completed_at=now(),updated_at=now() where id=p_work_order; end if;
 insert into public.bf10_asset_events(organization_id,asset_id,event_type,title,status,reference_type,reference_id,details,actor_id)
 values(a.organization_id,a.id,'return_to_service','Medical asset returned to service','released','return_to_service',rid,jsonb_build_object('notes',p_notes),auth.uid());
 return rid;
end $$;
create or replace function public.bf10_next_report_number(p_org uuid,p_prefix text default 'RPT')
returns text
language plpgsql
security definer
set search_path=''
as $$
declare n bigint;
begin
 if not(public.bf_can(p_org,'v10.reports.manage') or public.bf_is_super_admin()) then raise exception 'Permission denied' using errcode='42501'; end if;
 n:=nextval('public.bf10_report_seq');
 return upper(regexp_replace(coalesce(p_prefix,'RPT'),'[^A-Za-z0-9-]','','g'))||'-'||to_char(current_date,'YYYYMM')||'-'||lpad(n::text,6,'0');
end $$;
-- ---------------- STARTER GENERIC TEMPLATES ----------------
insert into public.bf10_pm_templates(
 organization_id,domain,asset_type,name,source_type,revision,interval_months,estimated_minutes,
 required_skill,tools,test_equipment,ppe,prerequisites,requires_shutdown,requires_loto,verified
) values
 (null,'facilities','Split AC','Generic Split AC Preventive Maintenance','generic','1.0',3,60,'HVAC Technician','Hand tools; coil brush','Clamp meter; thermometer','Gloves; eye protection','Confirm safe access',true,true,false),
 (null,'facilities','UPS','Generic UPS Preventive Maintenance','generic','1.0',6,90,'Electrical Technician','Insulated hand tools','Multimeter; battery tester','Electrical PPE','Review load and bypass procedure',false,false,false),
 (null,'facilities','Pump','Generic Pump Preventive Maintenance','generic','1.0',3,60,'Mechanical Technician','Hand tools','Vibration meter; clamp meter','Gloves; eye protection','Isolate if intrusive work required',true,true,false),
 (null,'medical','Patient Monitor','Generic Biomedical Baseline - Patient Monitor','generic','1.0',6,60,'Biomedical Technician','Basic hand tools','Electrical safety analyzer; simulator','Clinical engineering PPE','Follow hospital infection-control procedure',false,false,false),
 (null,'medical','Infusion Pump','Generic Biomedical Baseline - Infusion Pump','generic','1.0',6,60,'Biomedical Technician','Basic hand tools','Infusion device analyzer; electrical safety analyzer','Clinical engineering PPE','Decontaminate before service',false,false,false),
 (null,'medical','Ventilator','Generic Biomedical Baseline - Ventilator','generic','1.0',3,90,'Qualified Biomedical Engineer','Manufacturer-compatible service tools','Ventilator analyzer; electrical safety analyzer','Clinical engineering PPE','Use verified OEM procedure for clinical release',false,false,false),
 (null,'medical','Defibrillator','Generic Biomedical Baseline - Defibrillator','generic','1.0',6,75,'Qualified Biomedical Engineer','Basic service tools','Defibrillator analyzer; electrical safety analyzer','Clinical engineering PPE','Use verified OEM procedure for energy accuracy limits',false,false,false)
on conflict do nothing;
-- Simple generic baseline steps only; not represented as OEM instructions.
insert into public.bf10_pm_steps(template_id,step_no,instruction,response_type,required,acceptance_criteria,evidence_required,failure_action)
select t.id,s.no,s.inst,'pass_fail',true,s.acc,false,s.fail
from public.bf10_pm_templates t
cross join (values
 (1,'Verify asset identity, label, serial number and current service status.','Identity matches asset register.','Stop and correct asset identity before proceeding.'),
 (2,'Perform visual and mechanical inspection for damage, contamination, loose parts or unsafe condition.','No condition preventing safe operation.','Quarantine asset and raise corrective work order.'),
 (3,'Perform applicable power/electrical safety inspection using approved test equipment.','Pass organization/OEM applicable limits.','Quarantine asset and escalate.'),
 (4,'Perform functional performance test appropriate to the equipment type.','All required functions operate correctly.','Create corrective work order and do not release.'),
 (5,'Review calibration status and measurement verification where applicable.','Calibration is current and results acceptable.','Send for calibration / hold from service.'),
 (6,'Document results, parts changed and final service decision.','Required evidence and closeout are complete.','Keep work order open until documentation is complete.')
) as s(no,inst,acc,fail)
where not exists(select 1 from public.bf10_pm_steps x where x.template_id=t.id);
-- ---------------- GRANTS ----------------
grant select,insert,update,delete on
 public.bf10_projects,public.bf10_locations,public.bf10_assets,public.bf10_asset_events,
 public.bf10_pm_templates,public.bf10_pm_steps,public.bf10_pm_plans,public.bf10_work_orders,
 public.bf10_work_results,public.bf10_calibrations,public.bf10_safety_events,public.bf10_capa,
 public.bf10_recalls,public.bf10_return_to_service,public.bf10_parts,public.bf10_part_usage,
 public.bf10_branding,public.bf10_documents,public.bf10_reports
to authenticated;
grant usage,select on sequence public.bf10_asset_seq,public.bf10_wo_seq,public.bf10_report_seq to authenticated;
revoke all on function public.bf10_register_asset(uuid,uuid,uuid,text,text,uuid,text,text,text,text,text,text,date,date,date,text,text) from public,anon;
grant execute on function public.bf10_register_asset(uuid,uuid,uuid,text,text,uuid,text,text,text,text,text,text,date,date,date,text,text) to authenticated;
revoke all on function public.bf10_create_work_order(uuid,text,text,text,text,date) from public,anon;
grant execute on function public.bf10_create_work_order(uuid,text,text,text,text,date) to authenticated;
revoke all on function public.bf10_generate_due_pm(date) from public,anon;
grant execute on function public.bf10_generate_due_pm(date) to authenticated;
revoke all on function public.bf10_set_asset_status(uuid,text,text) from public,anon;
grant execute on function public.bf10_set_asset_status(uuid,text,text) to authenticated;
revoke all on function public.bf10_return_to_service(uuid,uuid,boolean,boolean,boolean,boolean,text) from public,anon;
grant execute on function public.bf10_return_to_service(uuid,uuid,boolean,boolean,boolean,boolean,text) to authenticated;
revoke all on function public.bf10_next_report_number(uuid,text) from public,anon;
grant execute on function public.bf10_next_report_number(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
