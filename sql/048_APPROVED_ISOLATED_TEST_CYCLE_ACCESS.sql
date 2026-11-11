-- USER APPROVED 2026-11-11: PRJ-000021 only, seven days, existing assigned roles.
-- No finance, inventory, purchasing, statements, new roles or organization-wide grants.
-- The existing authorization expressions remain the exact fallback for every other project.
begin;
create schema if not exists private;
create table if not exists private.bf48_test_cycle_access(
 project_id uuid primary key references public.bf35_projects(id),
 organization_id uuid not null references public.bf_organizations(id),
 client_id uuid not null references public.bf_clients(id),
 contract_id uuid not null references public.bf_contracts(id),
 authorized_by uuid not null references public.bf_profiles(id),
 authorized_at timestamptz not null default now(),
 expires_at timestamptz not null,
 permission_keys text[] not null
);
alter table private.bf48_test_cycle_access enable row level security;
revoke all on private.bf48_test_cycle_access from public,anon,authenticated;

create or replace function private.bf48_test_member(p_user uuid,p_project uuid,p_site uuid,p_org uuid)
returns boolean language sql stable security definer set search_path='' as $member$
 select exists(
 select 1 from private.bf48_test_cycle_access g
 join public.bf35_projects pr on pr.id=g.project_id and pr.organization_id=g.organization_id and pr.client_id=g.client_id and pr.contract_id=g.contract_id and pr.status='active'
 join public.bf_profiles u on u.id=p_user and u.status='active'
 join public.bf_acl_user_organizations uo on uo.user_id=u.id and uo.organization_id=g.organization_id and uo.is_active
 join public.bf_acl_user_projects up on up.user_id=u.id and up.organization_id=g.organization_id and up.project_id=pr.id and up.is_active
 where g.project_id=p_project and (p_org is null or g.organization_id=p_org) and g.expires_at>now()
 and pr.project_code='PRJ-000021' and pr.name='TEST ONLY — دورة وقائية وتصحيحية لجهاز مرافق'
 and up.module_code in('shared','facilities') and up.discipline_code is null and (up.site_id is null or up.site_id=p_site)
 and (up.valid_from is null or up.valid_from<=current_date) and (up.valid_until is null or up.valid_until>=current_date)
 and (p_site is null or exists(select 1 from public.bf35_project_sites ps where ps.project_id=pr.id and ps.organization_id=g.organization_id and ps.client_id=g.client_id and ps.site_id=p_site))
 and (not exists(select 1 from public.bf_acl_organization_modules om where om.organization_id=g.organization_id and om.module_code in('shared','facilities')) or exists(select 1 from public.bf_acl_organization_modules om where om.organization_id=g.organization_id and om.module_code in('shared','facilities') and om.is_enabled and (om.valid_from is null or om.valid_from<=current_date) and (om.valid_until is null or om.valid_until>=current_date)))
 and not exists(select 1 from public.bf_acl_organization_modules om where om.organization_id=g.organization_id and om.module_code in('shared','facilities') and not om.is_enabled)
 and (not exists(select 1 from public.bf_acl_project_organizations po where po.project_id=pr.id and po.organization_id=g.organization_id and po.module_code in('shared','facilities'))
  or exists(select 1 from public.bf_acl_project_organizations po where po.project_id=pr.id and po.organization_id=g.organization_id and po.module_code in('shared','facilities') and po.is_active and po.discipline_code is null and (po.site_id is null or po.site_id=p_site) and (po.valid_from is null or po.valid_from<=current_date) and (po.valid_until is null or po.valid_until>=current_date)))
 );
$member$;
create or replace function private.bf48_test_can(p_user uuid,p_project uuid,p_permission text,p_site uuid)
returns boolean language plpgsql stable security definer set search_path='' as $can$
declare org uuid; keys text[];
begin
 select organization_id into org from private.bf48_test_cycle_access where project_id=p_project and expires_at>now();
 if org is null or not private.bf48_test_member(p_user,p_project,p_site,org) then return false;end if;
 keys:=case p_permission
 when 'corrective.view' then array['corrective.view','facilities.work_orders.view']
 when 'corrective.request' then array['corrective.request','facilities.work_orders.manage']
 when 'corrective.manage' then array['corrective.manage','facilities.work_orders.manage']
 when 'corrective.execute' then array['corrective.execute','facilities.work_orders.execute']
 when 'corrective.approve' then array['corrective.approve','facilities.work_orders.review']
 when 'ppm.view' then array['ppm.view','facilities.ppm.view']
 when 'ppm.manage' then array['ppm.manage','facilities.ppm.manage']
 when 'ppm.execute' then array['ppm.execute','facilities.ppm.execute']
 when 'ppm.approve' then array['ppm.approve','facilities.ppm.review']
 when 'contracts.manage' then array['contracts.manage','projects.manage']
 when 'documents.generate' then array['documents.generate','reports.export']
 when 'approvals.request' then array['approvals.request','facilities.work_orders.manage']
 else array[]::text[] end;
 return exists(select 1 from public.bf_acl_user_roles ur
 join public.bf_acl_roles r on r.id=ur.role_id and r.is_active and (r.organization_id is null or r.organization_id=ur.organization_id)
 join public.bf_acl_role_permissions rp on rp.role_id=r.id and rp.is_allowed
 join public.bf_acl_permissions pe on pe.permission_key=rp.permission_key and pe.is_active and pe.module_code in('shared','facilities')
 join private.bf48_test_cycle_access g on g.project_id=p_project and g.organization_id=ur.organization_id and g.expires_at>now() and pe.permission_key=any(g.permission_keys)
 left join public.bf_acl_organization_permissions op on op.organization_id=ur.organization_id and op.permission_key=pe.permission_key
 where ur.user_id=p_user and ur.organization_id=org and ur.is_active and pe.permission_key=any(keys)
 and (ur.valid_from is null or ur.valid_from<=current_date) and (ur.valid_until is null or ur.valid_until>=current_date)
 and (op.permission_key is null or op.is_allowed));
end $can$;
revoke all on function private.bf48_test_member(uuid,uuid,uuid,uuid),private.bf48_test_can(uuid,uuid,text,uuid) from public,anon,authenticated;

-- Wrap the existing expressions without editing them. Only the one registered test
-- project enters the new branch; expired grants deny instead of falling through.
do $scope$
declare definition text;
begin
 select pg_get_functiondef('public.bf44_project_member(uuid,uuid,uuid,uuid)'::regprocedure) into definition;
 if definition like '%bf48_test_cycle_access%' then raise exception 'Already installed; no extension or duplicate wrapping allowed';end if;
 execute replace(definition,'FUNCTION public.bf44_project_member(', 'FUNCTION private.bf48_original_project_member(');
 select pg_get_functiondef('public.bf44_user_can(uuid,uuid,text,uuid)'::regprocedure) into definition;
 execute replace(definition,'FUNCTION public.bf44_user_can(', 'FUNCTION private.bf48_original_user_can(');
end $scope$;
revoke all on function private.bf48_original_project_member(uuid,uuid,uuid,uuid),private.bf48_original_user_can(uuid,uuid,text,uuid) from public,anon,authenticated;
create or replace function public.bf44_project_member(p_user uuid,p_project uuid,p_site uuid default null,p_org uuid default null)
returns boolean language sql stable security definer set search_path='' as $wrapper$
 select case when exists(select 1 from private.bf48_test_cycle_access where project_id=p_project)
 then private.bf48_test_member(p_user,p_project,p_site,p_org)
 else private.bf48_original_project_member(p_user,p_project,p_site,p_org) end;
$wrapper$;
create or replace function public.bf44_user_can(p_user uuid,p_project uuid,p_permission text,p_site uuid default null)
returns boolean language sql stable security definer set search_path='' as $wrapper$
 select case when exists(select 1 from private.bf48_test_cycle_access where project_id=p_project)
 then private.bf48_test_can(p_user,p_project,p_permission,p_site)
 else private.bf48_original_user_can(p_user,p_project,p_permission,p_site) end;
$wrapper$;

-- Caller-only discovery for the existing Facilities UI; no other project appears.
create or replace function public.bf44_my_project_access()
returns jsonb language sql stable security definer set search_path='' as $discovery$
 select coalesce(jsonb_agg(distinct jsonb_build_object('organization_id',up.organization_id,'project_id',up.project_id,'site_id',up.site_id,'discipline_code',up.discipline_code,'permission_key',k)),'[]'::jsonb)
 from private.bf48_test_cycle_access g join public.bf_acl_user_projects up on up.project_id=g.project_id and up.organization_id=g.organization_id
 cross join unnest(array['corrective.view','corrective.request','corrective.manage','corrective.execute','corrective.approve','ppm.view','ppm.manage','ppm.execute','ppm.approve','contracts.manage','documents.generate','approvals.request']) k
 where auth.uid() is not null and up.user_id=auth.uid() and private.bf48_test_can(auth.uid(),g.project_id,k,up.site_id);
$discovery$;
revoke all on function public.bf44_my_project_access() from public,anon,authenticated;
grant execute on function public.bf44_my_project_access() to authenticated;

do $grant$
declare pr public.bf35_projects; author uuid; keys text[];
begin
 select * into strict pr from public.bf35_projects where project_code='PRJ-000021' and name='TEST ONLY — دورة وقائية وتصحيحية لجهاز مرافق';
 if not exists(select 1 from public.bf_clients where id=pr.client_id and organization_id=pr.organization_id and name='TEST ONLY — مالك منشأة التدريب')
 or not exists(select 1 from public.bf_contracts where id=pr.contract_id and organization_id=pr.organization_id and client_id=pr.client_id and contract_number='TEST-FM-20261108-01' and coalesce((to_jsonb(bf_contracts)->>'contract_value')::numeric,0)=0) then raise exception 'Exact zero-value training identity required';end if;
 if exists(select 1 from public.bf35_project_sites ps join public.bf_assets a on a.site_id=ps.site_id where ps.project_id=pr.id and coalesce(a.name_en,a.name_ar,'') not like 'TEST ONLY%') then raise exception 'Non-test asset found';end if;
 select p.id into strict author from public.bf_profiles p where p.full_name='melnaeema' and p.is_super_admin and p.status='active' and exists(select 1 from public.bf_acl_user_projects up where up.user_id=p.id and up.project_id=pr.id and up.organization_id=pr.organization_id and up.is_active and up.site_id is null and up.discipline_code is null);
 select array_agg(permission_key) into keys from public.bf_acl_permissions where is_active and module_code in('shared','facilities') and permission_key=any(array['corrective.view','corrective.request','corrective.manage','corrective.execute','corrective.approve','facilities.work_orders.view','facilities.work_orders.manage','facilities.work_orders.execute','facilities.work_orders.review','ppm.view','ppm.manage','ppm.execute','ppm.approve','facilities.ppm.view','facilities.ppm.manage','facilities.ppm.execute','facilities.ppm.review','contracts.manage','projects.manage','documents.generate','reports.export','approvals.request']);
 insert into private.bf48_test_cycle_access(project_id,organization_id,client_id,contract_id,authorized_by,expires_at,permission_keys) values(pr.id,pr.organization_id,pr.client_id,pr.contract_id,author,now()+interval '7 days',keys);
end $grant$;
notify pgrst,'reload schema';
commit;
