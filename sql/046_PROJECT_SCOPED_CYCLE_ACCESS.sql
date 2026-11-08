-- MANUAL ONLY: Facilities database. Does not enable an organization globally.
-- Adds an explicit, expiring project entitlement. Existing organization denies,
-- user roles, project/site assignments and independent approvals remain binding.
begin;
create table if not exists public.bf44_project_grants(
 project_id uuid primary key references public.bf35_projects(id),
 organization_id uuid not null references public.bf_organizations(id),
 client_id uuid not null references public.bf_clients(id),
 contract_id uuid not null references public.bf_contracts(id),
 permission_keys text[] not null,
 authorized_by uuid not null references public.bf_profiles(id),
 authorized_at timestamptz not null default now(),
 valid_until date not null,
 is_active boolean not null default true
);

create or replace function public.bf44_project_grant(p_project uuid,p_org uuid,p_permission text default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bf44_project_grants g join public.bf35_projects pr on pr.id=g.project_id
 where g.project_id=p_project and g.organization_id=p_org and g.is_active and g.valid_until>=current_date
 and pr.status='active' and pr.organization_id=g.organization_id and pr.client_id=g.client_id and pr.contract_id=g.contract_id
 and (p_permission is null or p_permission=any(g.permission_keys)))
$$;
create or replace function public.bf44_project_module(p_project uuid,p_org uuid,p_module text default 'facilities')
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bf_acl_organization_modules m where m.organization_id=p_org
  and m.module_code in('shared',p_module) and m.is_enabled
  and (m.valid_from is null or m.valid_from<=current_date) and (m.valid_until is null or m.valid_until>=current_date))
 or (public.bf44_project_grant(p_project,p_org) and not exists(
  select 1 from public.bf_acl_organization_modules m where m.organization_id=p_org and m.module_code in('shared',p_module)))
$$;
create or replace function public.bf44_project_member(p_user uuid,p_project uuid,p_site uuid default null,p_org uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bf_profiles u
 join public.bf_acl_user_organizations uo on uo.user_id=u.id and uo.is_active
 join public.bf_acl_user_projects up on up.user_id=u.id and up.organization_id=uo.organization_id and up.project_id=p_project
 where u.id=p_user and u.status='active' and (p_org is null or uo.organization_id=p_org)
 and up.is_active and up.module_code in('shared','facilities')
 and (up.valid_from is null or up.valid_from<=current_date) and (up.valid_until is null or up.valid_until>=current_date)
 and (up.site_id is null or up.site_id=p_site) and up.discipline_code is null
 and public.bf44_project_module(p_project,uo.organization_id)
 and (exists(select 1 from public.bf_acl_project_organizations po where po.project_id=up.project_id and po.organization_id=up.organization_id
  and po.is_active and po.module_code in('shared','facilities')
  and (po.valid_from is null or po.valid_from<=current_date) and (po.valid_until is null or po.valid_until>=current_date)
  and (po.site_id is null or po.site_id=p_site) and po.discipline_code is null)
 or (public.bf44_project_grant(p_project,uo.organization_id) and not exists(
  select 1 from public.bf_acl_project_organizations po where po.project_id=up.project_id and po.organization_id=up.organization_id
  and po.module_code in('shared','facilities')))))
$$;
create or replace function public.bf44_permission_keys(p_permission text)
returns text[] language sql immutable set search_path='' as $$
 select case p_permission
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
 when 'costing.manage' then array['costing.manage','facilities.statements.manage','finance.manage']
 when 'inventory.request' then array['inventory.request','facilities.inventory.request','facilities.inventory.manage']
 when 'inventory.manage' then array['inventory.manage','facilities.inventory.manage']
 when 'inventory.approve' then array['inventory.approve','facilities.inventory.approve']
 else array[p_permission] end
$$;
create or replace function public.bf44_user_can(p_user uuid,p_project uuid,p_permission text,p_site uuid default null)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare org uuid;
begin
 select organization_id into org from public.bf35_projects where id=p_project;
 -- Reject unassigned users before planning permission joins for every list row.
 if org is null or not public.bf44_project_member(p_user,p_project,p_site,org) then return false;end if;
 return exists(select 1 from public.bf_acl_user_organizations uo
 join public.bf_profiles u on u.id=uo.user_id and u.status='active'
 join public.bf_acl_user_roles ur on ur.user_id=u.id and ur.organization_id=uo.organization_id and ur.is_active
 join public.bf_acl_roles r on r.id=ur.role_id and r.is_active and (r.organization_id is null or r.organization_id=ur.organization_id)
 join public.bf_acl_role_permissions rp on rp.role_id=r.id and rp.is_allowed
 join public.bf_acl_permissions pe on pe.permission_key=rp.permission_key and pe.is_active
 left join public.bf_acl_organization_permissions op on op.organization_id=ur.organization_id and op.permission_key=pe.permission_key
 where uo.organization_id=org and uo.user_id=p_user and uo.is_active
 and pe.permission_key=any(public.bf44_permission_keys(p_permission)) and pe.module_code in('shared','facilities')
 and (ur.valid_from is null or ur.valid_from<=current_date) and (ur.valid_until is null or ur.valid_until>=current_date)
 and (op.is_allowed or (op.permission_key is null and public.bf44_project_grant(p_project,org,pe.permission_key)))
 and public.bf44_project_module(p_project,org,pe.module_code));
end $$;

-- UI discovery is derived on the server for the authenticated caller only.
create or replace function public.bf44_my_project_access()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(distinct jsonb_build_object('organization_id',up.organization_id,'project_id',up.project_id,
  'site_id',up.site_id,'discipline_code',up.discipline_code,'permission_key',key)),'[]'::jsonb)
 from public.bf_acl_user_projects up join public.bf44_project_grants g on g.project_id=up.project_id and g.organization_id=up.organization_id
 cross join unnest(array['corrective.view','corrective.request','corrective.manage','corrective.execute','corrective.approve',
  'ppm.view','ppm.manage','ppm.execute','ppm.approve','contracts.manage','documents.generate','approvals.request','costing.manage',
  'inventory.request','inventory.manage','inventory.approve']) key
 where auth.uid() is not null and up.user_id=auth.uid() and up.is_active
 and (up.valid_from is null or up.valid_from<=current_date) and (up.valid_until is null or up.valid_until>=current_date)
 and public.bf44_user_can(auth.uid(),up.project_id,key,up.site_id)
$$;
revoke all on function public.bf44_my_project_access() from public,anon,authenticated;
grant execute on function public.bf44_my_project_access() to authenticated;

alter table public.bf44_project_grants enable row level security;
revoke all on table public.bf44_project_grants from public,anon,authenticated;
grant select on table public.bf44_project_grants to authenticated;
drop policy if exists bf44_project_grant_read on public.bf44_project_grants;
create policy bf44_project_grant_read on public.bf44_project_grants for select to authenticated using(public.bf44_view(project_id));
revoke all on function public.bf44_project_grant(uuid,uuid,text),public.bf44_project_module(uuid,uuid,text),public.bf44_project_member(uuid,uuid,uuid,uuid),public.bf44_permission_keys(text),public.bf44_user_can(uuid,uuid,text,uuid) from public,anon,authenticated;

-- APPROVED TEST PROVISIONING: only the already-created PRJ-000021.
-- No role assignments, organization-wide licensing or financial rows are changed.
do $$
declare pr public.bf35_projects;reviewer uuid;keys text[];
begin
 select * into pr from public.bf35_projects where to_jsonb(bf35_projects)->>'project_code'='PRJ-000021';
 if pr.id is null or pr.name<>'TEST ONLY — دورة وقائية وتصحيحية لجهاز مرافق' then
  raise exception 'Expected TEST ONLY project PRJ-000021 is missing; no access was enabled';end if;
 if not exists(select 1 from public.bf_clients where id=pr.client_id and name='TEST ONLY — مالك منشأة التدريب')
 or not exists(select 1 from public.bf_contracts c where c.id=pr.contract_id and c.organization_id=pr.organization_id and c.client_id=pr.client_id
  and c.contract_number='TEST-FM-20261108-01' and coalesce((to_jsonb(c)->>'contract_value')::numeric,0)=0) then
  raise exception 'The exact test owner and zero-value test contract are required';end if;
 if exists(select 1 from public.bf35_project_sites ps join public.bf_assets a on a.site_id=ps.site_id
  where ps.project_id=pr.id and coalesce(a.name_en,a.name_ar,'') not like 'TEST ONLY%') then
  raise exception 'Test project contains a non-test asset; no access was enabled';end if;
 select p.id into reviewer from public.bf_profiles p where p.full_name='melnaeema' and p.status='active' and p.is_super_admin
 and exists(select 1 from public.bf_acl_user_projects up where up.user_id=p.id and up.project_id=pr.id and up.organization_id=pr.organization_id
  and up.is_active and up.site_id is null and up.discipline_code is null
  and (up.valid_from is null or up.valid_from<=current_date) and (up.valid_until is null or up.valid_until>=current_date));
 if reviewer is null then raise exception 'The approved administrator must already be assigned to the test project';end if;
 select array_agg(permission_key) into keys from public.bf_acl_permissions where is_active and module_code in('shared','facilities') and permission_key=any(array[
  'corrective.view','corrective.request','corrective.manage','corrective.execute','corrective.approve',
  'ppm.view','ppm.manage','ppm.execute','ppm.approve',
  'facilities.work_orders.view','facilities.work_orders.manage','facilities.work_orders.assign','facilities.work_orders.execute','facilities.work_orders.review',
  'facilities.ppm.view','facilities.ppm.manage','facilities.ppm.execute','facilities.ppm.review',
  'contracts.manage','projects.manage','documents.generate','reports.export','approvals.request','costing.manage','finance.manage','facilities.statements.manage',
  'inventory.request','inventory.manage','inventory.approve','facilities.inventory.request','facilities.inventory.manage','facilities.inventory.approve']);
 if keys is null then raise exception 'No existing Facilities/shared operational permissions found';end if;
 insert into public.bf44_project_grants(project_id,organization_id,client_id,contract_id,permission_keys,authorized_by,valid_until)
 values(pr.id,pr.organization_id,pr.client_id,pr.contract_id,keys,reviewer,current_date+7)
 on conflict(project_id) do nothing; -- Reruns never extend or reactivate access.
end $$;
notify pgrst,'reload schema';
commit;
