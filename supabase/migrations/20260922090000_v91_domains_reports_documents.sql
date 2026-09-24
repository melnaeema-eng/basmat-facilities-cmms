begin;
-- ============================================================
-- BASMAT FACILITIES CMMS V9.1
-- Isolated Maintenance Domains + Unified Reports/Documents Center
-- Shared company/owner/project/site/building context and dual branding.
-- ============================================================

insert into public.bf_permissions(code,description) values
 ('reports.center.view','View unified reports and documents center'),
 ('reports.center.manage','Manage unified reports and documents center'),
 ('branding.manage','Manage company/owner/project report branding'),
 ('projects.context.view','View operational project contexts'),
 ('projects.context.manage','Manage operational project contexts')
on conflict(code) do nothing;
insert into public.bf_role_permissions(role_id,permission_id)
select r.id,p.id
from public.bf_roles r cross join public.bf_permissions p
where r.code='company_admin'
  and p.code in(
    'reports.center.view','reports.center.manage','branding.manage',
    'projects.context.view','projects.context.manage'
  )
on conflict do nothing;
-- ------------------------------------------------------------
-- 1) Company / Owner / Project context
-- Supports different companies, owners, project types, sites, branches and buildings.
-- ------------------------------------------------------------

create table if not exists public.bf_project_contexts(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 client_id uuid references public.bf_clients(id),
 site_id uuid references public.bf_sites(id),
 contract_id uuid references public.bf_contracts(id),
 project_code text not null,
 project_name_ar text not null,
 project_name_en text,
 project_type text not null default 'other'
   check(project_type in(
     'hospital','medical_center','dispensary','clinic_center',
     'office','commercial','residential','industrial',
     'data_center','campus','warehouse','school','mixed','other'
   )),
 maintenance_scope text not null default 'facilities'
   check(maintenance_scope in('facilities','medical','both')),
 owner_name_override text,
 company_name_override text,
 consultant_name text,
 status text not null default 'active' check(status in('active','inactive','archived')),
 metadata jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,project_code)
);
create index if not exists bf_project_contexts_org_scope
on public.bf_project_contexts(organization_id,maintenance_scope,status);
alter table public.bf_project_contexts enable row level security;
drop policy if exists bf_project_contexts_read on public.bf_project_contexts;
create policy bf_project_contexts_read on public.bf_project_contexts
for select to authenticated
using(
  public.bf_can(organization_id,'projects.context.view')
  or public.bf_can(organization_id,'reports.center.view')
  or public.bf_can(organization_id,'medical.view')
  or public.bf_can(organization_id,'assets.view')
);
drop policy if exists bf_project_contexts_write on public.bf_project_contexts;
create policy bf_project_contexts_write on public.bf_project_contexts
for all to authenticated
using(
  public.bf_can(organization_id,'projects.context.manage')
  or public.bf_can(organization_id,'organizations.manage')
)
with check(
  public.bf_can(organization_id,'projects.context.manage')
  or public.bf_can(organization_id,'organizations.manage')
);
-- ------------------------------------------------------------
-- 2) Domain access
-- One platform, operationally isolated Facilities / Medical.
-- ------------------------------------------------------------

create table if not exists public.bf_user_maintenance_domains(
 organization_id uuid not null references public.bf_organizations(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 domain text not null check(domain in('facilities','medical')),
 project_context_id uuid references public.bf_project_contexts(id) on delete cascade,
 access_level text not null default 'user' check(access_level in('view','user','manager','admin')),
 created_at timestamptz not null default now(),
 primary key(organization_id,user_id,domain,project_context_id)
);
alter table public.bf_user_maintenance_domains enable row level security;
drop policy if exists bf_user_domains_read on public.bf_user_maintenance_domains;
create policy bf_user_domains_read on public.bf_user_maintenance_domains
for select to authenticated
using(
 user_id=auth.uid()
 or public.bf_is_super_admin()
 or public.bf_can(organization_id,'organizations.manage')
);
drop policy if exists bf_user_domains_manage on public.bf_user_maintenance_domains;
create policy bf_user_domains_manage on public.bf_user_maintenance_domains
for all to authenticated
using(public.bf_is_super_admin() or public.bf_can(organization_id,'organizations.manage'))
with check(public.bf_is_super_admin() or public.bf_can(organization_id,'organizations.manage'));
create or replace function public.bf_has_maintenance_domain(
 p_org uuid,p_domain text,p_project uuid default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select
   public.bf_is_super_admin()
   or public.bf_can(p_org,'organizations.manage')
   or exists(
      select 1
      from public.bf_user_maintenance_domains d
      where d.organization_id=p_org
        and d.user_id=auth.uid()
        and d.domain=p_domain
        and (d.project_context_id is null or p_project is null or d.project_context_id=p_project)
   )
$$;
revoke all on function public.bf_has_maintenance_domain(uuid,text,uuid) from public,anon;
grant execute on function public.bf_has_maintenance_domain(uuid,text,uuid) to authenticated;
-- ------------------------------------------------------------
-- 3) Unified dual-branding profiles
-- Logos stored privately in Supabase Storage.
-- ------------------------------------------------------------

create table if not exists public.bf_report_branding(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 project_context_id uuid references public.bf_project_contexts(id) on delete cascade,
 company_name text,
 company_logo_path text,
 owner_name text,
 owner_logo_path text,
 consultant_name text,
 consultant_logo_path text,
 header_note text,
 footer_note text,
 report_prefix text,
 is_default boolean not null default false,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(organization_id,project_context_id)
);
alter table public.bf_report_branding enable row level security;
drop policy if exists bf_report_branding_read on public.bf_report_branding;
create policy bf_report_branding_read on public.bf_report_branding
for select to authenticated
using(
 public.bf_can(organization_id,'reports.center.view')
 or public.bf_can(organization_id,'medical.reports')
);
drop policy if exists bf_report_branding_write on public.bf_report_branding;
create policy bf_report_branding_write on public.bf_report_branding
for all to authenticated
using(public.bf_can(organization_id,'branding.manage'))
with check(public.bf_can(organization_id,'branding.manage'));
-- ------------------------------------------------------------
-- 4) Unified documents center
-- ------------------------------------------------------------

create table if not exists public.bf_unified_documents(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 project_context_id uuid references public.bf_project_contexts(id) on delete cascade,
 maintenance_domain text not null check(maintenance_domain in('facilities','medical','shared')),
 document_type text not null check(document_type in(
   'work_order','ppm','calibration','safety','capa','recall',
   'warranty','contract','manual','certificate','service_report',
   'inspection','asset_history','parts','cost','drawing','photo',
   'report','other'
 )),
 title text not null,
 document_number text,
 asset_domain text check(asset_domain in('facility','medical')),
 asset_id uuid,
 reference_type text,
 reference_id uuid,
 bucket_id text not null default 'cmms-documents',
 object_path text not null,
 file_name text not null,
 mime_type text,
 size_bytes bigint check(size_bytes is null or size_bytes>=0),
 revision text,
 status text not null default 'active' check(status in('active','superseded','archived')),
 uploaded_by uuid not null references auth.users(id),
 uploaded_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb,
 unique(bucket_id,object_path)
);
create index if not exists bf_unified_documents_scope
on public.bf_unified_documents(organization_id,project_context_id,maintenance_domain,document_type,uploaded_at desc);
alter table public.bf_unified_documents enable row level security;
drop policy if exists bf_unified_docs_read on public.bf_unified_documents;
create policy bf_unified_docs_read on public.bf_unified_documents
for select to authenticated
using(
 public.bf_can(organization_id,'reports.center.view')
 and (
   maintenance_domain='shared'
   or public.bf_has_maintenance_domain(organization_id,maintenance_domain,project_context_id)
   or public.bf_is_super_admin()
 )
);
drop policy if exists bf_unified_docs_write on public.bf_unified_documents;
create policy bf_unified_docs_write on public.bf_unified_documents
for all to authenticated
using(
 public.bf_can(organization_id,'reports.center.manage')
 and (
   maintenance_domain='shared'
   or public.bf_has_maintenance_domain(organization_id,maintenance_domain,project_context_id)
   or public.bf_is_super_admin()
 )
)
with check(
 public.bf_can(organization_id,'reports.center.manage')
 and (
   maintenance_domain='shared'
   or public.bf_has_maintenance_domain(organization_id,maintenance_domain,project_context_id)
   or public.bf_is_super_admin()
 )
);
-- ------------------------------------------------------------
-- 5) Generated report register
-- ------------------------------------------------------------

create sequence if not exists public.bf_unified_report_seq;
create table if not exists public.bf_unified_reports(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.bf_organizations(id),
 project_context_id uuid references public.bf_project_contexts(id) on delete cascade,
 maintenance_domain text not null check(maintenance_domain in('facilities','medical','combined')),
 report_number text not null,
 report_type text not null check(report_type in(
   'executive','work_orders','ppm','asset_history','calibration',
   'safety','quality','capa','recall','downtime','cost','spares',
   'warranty','technician','vendor','custom'
 )),
 title text not null,
 period_from date,
 period_to date,
 filters jsonb not null default '{}'::jsonb,
 snapshot jsonb not null default '{}'::jsonb,
 branding_snapshot jsonb not null default '{}'::jsonb,
 output_pdf_path text,
 output_excel_path text,
 status text not null default 'draft' check(status in('draft','final','archived')),
 generated_by uuid not null references auth.users(id),
 generated_at timestamptz not null default now(),
 finalized_at timestamptz,
 unique(organization_id,report_number)
);
create index if not exists bf_unified_reports_scope
on public.bf_unified_reports(organization_id,project_context_id,maintenance_domain,report_type,generated_at desc);
alter table public.bf_unified_reports enable row level security;
drop policy if exists bf_unified_reports_read on public.bf_unified_reports;
create policy bf_unified_reports_read on public.bf_unified_reports
for select to authenticated
using(
 public.bf_can(organization_id,'reports.center.view')
 and (
   maintenance_domain='combined'
   or public.bf_has_maintenance_domain(organization_id,maintenance_domain,project_context_id)
   or public.bf_is_super_admin()
 )
);
drop policy if exists bf_unified_reports_write on public.bf_unified_reports;
create policy bf_unified_reports_write on public.bf_unified_reports
for all to authenticated
using(public.bf_can(organization_id,'reports.center.manage'))
with check(public.bf_can(organization_id,'reports.center.manage'));
-- ------------------------------------------------------------
-- 6) Private Storage buckets
-- ------------------------------------------------------------

insert into storage.buckets(id,name,public,file_size_limit)
values
 ('cmms-documents','cmms-documents',false,104857600),
 ('cmms-branding','cmms-branding',false,10485760)
on conflict(id) do update
set public=false,file_size_limit=excluded.file_size_limit;
drop policy if exists bf_cmms_docs_select on storage.objects;
create policy bf_cmms_docs_select on storage.objects
for select to authenticated
using(
 bucket_id in('cmms-documents','cmms-branding')
 and array_length(storage.foldername(name),1)>=1
 and exists(
   select 1 from public.bf_organizations o
   where o.id::text=(storage.foldername(name))[1]
     and (
       public.bf_can(o.id,'reports.center.view')
       or public.bf_can(o.id,'medical.reports')
       or public.bf_is_super_admin()
     )
 )
);
drop policy if exists bf_cmms_docs_insert on storage.objects;
create policy bf_cmms_docs_insert on storage.objects
for insert to authenticated
with check(
 bucket_id in('cmms-documents','cmms-branding')
 and array_length(storage.foldername(name),1)>=1
 and exists(
   select 1 from public.bf_organizations o
   where o.id::text=(storage.foldername(name))[1]
     and (
       public.bf_can(o.id,'reports.center.manage')
       or public.bf_can(o.id,'branding.manage')
       or public.bf_is_super_admin()
     )
 )
);
drop policy if exists bf_cmms_docs_delete on storage.objects;
create policy bf_cmms_docs_delete on storage.objects
for delete to authenticated
using(
 bucket_id in('cmms-documents','cmms-branding')
 and array_length(storage.foldername(name),1)>=1
 and exists(
   select 1 from public.bf_organizations o
   where o.id::text=(storage.foldername(name))[1]
     and (
       public.bf_can(o.id,'reports.center.manage')
       or public.bf_can(o.id,'branding.manage')
       or public.bf_is_super_admin()
     )
 )
);
-- ------------------------------------------------------------
-- 7) RPCs
-- ------------------------------------------------------------

create or replace function public.bf_create_project_context(
 p_org uuid,
 p_client uuid,
 p_site uuid,
 p_contract uuid,
 p_code text,
 p_name_ar text,
 p_name_en text,
 p_project_type text,
 p_scope text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v uuid;
begin
 if not(public.bf_is_super_admin() or public.bf_can(p_org,'projects.context.manage')) then
   raise exception 'Permission denied' using errcode='42501';
 end if;
 insert into public.bf_project_contexts(
   organization_id,client_id,site_id,contract_id,project_code,
   project_name_ar,project_name_en,project_type,maintenance_scope,created_by
 )
 values(
   p_org,p_client,p_site,p_contract,btrim(p_code),
   btrim(p_name_ar),nullif(btrim(p_name_en),''),
   p_project_type,p_scope,auth.uid()
 )
 returning id into v;
 return v;
end $$;
create or replace function public.bf_next_unified_report_number(
 p_org uuid,p_prefix text default 'RPT'
)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare n bigint;
begin
 if not(public.bf_can(p_org,'reports.center.manage') or public.bf_is_super_admin()) then
   raise exception 'Permission denied' using errcode='42501';
 end if;
 n:=nextval('public.bf_unified_report_seq');
 return upper(regexp_replace(coalesce(p_prefix,'RPT'),'[^A-Za-z0-9-]','','g'))
   ||'-'||to_char(current_date,'YYYYMM')||'-'||lpad(n::text,6,'0');
end $$;
create or replace function public.bf_unified_report_branding_snapshot(
 p_org uuid,p_project uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare b public.bf_report_branding; p public.bf_project_contexts; o public.bf_organizations; c public.bf_clients;
begin
 select * into o from public.bf_organizations where id=p_org;
 if p_project is not null then
   select * into p from public.bf_project_contexts where id=p_project and organization_id=p_org;
   if p.client_id is not null then select * into c from public.bf_clients where id=p.client_id; end if;
 end if;

 select * into b
 from public.bf_report_branding
 where organization_id=p_org and (
   project_context_id=p_project
   or (p_project is null and project_context_id is null)
 )
 order by (project_context_id is not null) desc
 limit 1;

 if b.id is null then
   select * into b
   from public.bf_report_branding
   where organization_id=p_org and is_default
   order by updated_at desc limit 1;
 end if;

 return jsonb_build_object(
  'company_name',coalesce(b.company_name,p.company_name_override,o.name),
  'company_logo_path',b.company_logo_path,
  'owner_name',coalesce(b.owner_name,p.owner_name_override,c.name),
  'owner_logo_path',b.owner_logo_path,
  'consultant_name',coalesce(b.consultant_name,p.consultant_name),
  'consultant_logo_path',b.consultant_logo_path,
  'project_code',p.project_code,
  'project_name_ar',p.project_name_ar,
  'project_name_en',p.project_name_en,
  'project_type',p.project_type,
  'maintenance_scope',p.maintenance_scope,
  'header_note',b.header_note,
  'footer_note',b.footer_note,
  'report_prefix',b.report_prefix
 );
end $$;
revoke all on function public.bf_create_project_context(uuid,uuid,uuid,uuid,text,text,text,text,text) from public,anon;
grant execute on function public.bf_create_project_context(uuid,uuid,uuid,uuid,text,text,text,text,text) to authenticated;
revoke all on function public.bf_next_unified_report_number(uuid,text) from public,anon;
grant execute on function public.bf_next_unified_report_number(uuid,text) to authenticated;
revoke all on function public.bf_unified_report_branding_snapshot(uuid,uuid) from public,anon;
grant execute on function public.bf_unified_report_branding_snapshot(uuid,uuid) to authenticated;
-- ------------------------------------------------------------
-- 8) Unified center summary
-- ------------------------------------------------------------

drop view if exists public.bf_unified_reports_documents_summary;
create view public.bf_unified_reports_documents_summary
with (security_invoker=true)
as
select
 o.id organization_id,
 (select count(*) from public.bf_project_contexts p where p.organization_id=o.id and p.status='active') active_projects,
 (select count(*) from public.bf_unified_documents d where d.organization_id=o.id and d.status='active') active_documents,
 (select count(*) from public.bf_unified_reports r where r.organization_id=o.id and r.status='final') final_reports,
 (select count(*) from public.bf_unified_documents d where d.organization_id=o.id and d.maintenance_domain='medical' and d.status='active') medical_documents,
 (select count(*) from public.bf_unified_documents d where d.organization_id=o.id and d.maintenance_domain='facilities' and d.status='active') facilities_documents
from public.bf_organizations o;
grant select on public.bf_unified_reports_documents_summary to authenticated;
notify pgrst,'reload schema';
commit;
