-- MANUAL INSTALL ONLY. Additive, transactional, rerunnable. Never auto-run by the app.
-- One asset / one work order / approved report / completion certificate / payment statement.
begin;
-- Compatibility revision 044.2: deployed bf_acl_* permissions, no legacy consultant table.
do $$ declare missing text[];missing_functions text[];
begin
 select array_agg(name order by name) into missing from unnest(array['bf35_projects','bf35_project_sites','bf_work_orders','bf_service_requests','bf_ppm_jobs','bf_ppm_plans','bf_ppm_results','bf11_approvals','bf11_events','bf13_documents','bf13_document_seq','bf8_material_requests','bf8_material_lines','bf9_evidence','bf9_visits','bf9_labor','bf_inv_requests','bf_profiles','bf_ppm_events','bf_ppm_procedures','bf_assets','bf_inv_parts','bf_corrective_events','bf_work_order_assignments','bf_buildings','bf_floors','bf_zones','bf_rooms','bf_acl_user_organizations','bf_acl_user_projects','bf_acl_project_organizations','bf_acl_user_roles','bf_acl_roles','bf_acl_role_permissions','bf_acl_permissions','bf_acl_organization_permissions','bf_acl_organization_modules']) name
 where to_regclass('public.'||name) is null;
 select array_agg(name order by name) into missing_functions from unnest(array[
 'public.bf_acl_user_is_owner(uuid,uuid,uuid)',
 'public.bf4_action(text,uuid,text,jsonb)',
 'public.bf5_assign_job_work_order(uuid,uuid)']) name where to_regprocedure(name) is null;
 if missing is not null or missing_functions is not null then
  raise exception '044 prerequisites missing. Objects: % ; functions: %',coalesce(array_to_string(missing,', '),'none'),coalesce(array_to_string(missing_functions,', '),'none');
 end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='bf_ppm_jobs' and column_name='work_order_id') then raise exception 'Install 043_PPM_WORK_ORDER_LINK.sql first'; end if;
end $$;
alter table public.bf_work_orders add column if not exists project_id uuid references public.bf35_projects(id);
alter table public.bf_service_requests add column if not exists project_id uuid references public.bf35_projects(id);
alter table public.bf_ppm_plans add column if not exists project_id uuid references public.bf35_projects(id);
-- Existing unscoped historical requests are untouched. New integrated requests get one WO.
create unique index if not exists bf44_request_one_work_order on public.bf_work_orders(request_id) where request_id is not null and project_id is not null;
create table if not exists public.bf44_policies(
 project_id uuid primary key references public.bf35_projects(id),
 contract_id uuid not null references public.bf_contracts(id),
 owner_reviewer uuid not null references public.bf_profiles(id),
 consultant_reviewer uuid references public.bf_profiles(id),
 currency text not null default 'SAR' check(currency ~ '^[A-Z]{3}$'),
 status text not null default 'draft' check(status in('draft','active')),
 prepared_by uuid not null references auth.users(id),prepared_at timestamptz not null default now(),
 activated_by uuid references auth.users(id),activated_at timestamptz,
 check(consultant_reviewer is null or consultant_reviewer<>owner_reviewer)
);
create table if not exists public.bf44_workflows(
 work_order_id uuid primary key references public.bf_work_orders(id),
 project_id uuid not null references public.bf44_policies(project_id),
 revision integer not null default 1 check(revision>0),
 report_id uuid references public.bf13_documents(id),
 enrolled_by uuid references auth.users(id),enrolled_at timestamptz not null default now()
);
create table if not exists public.bf44_review_links(
 approval_id uuid primary key references public.bf11_approvals(id),
 work_order_id uuid not null references public.bf44_workflows(work_order_id),revision integer not null
);
create table if not exists public.bf44_certificates(
 id uuid primary key default gen_random_uuid(),work_order_id uuid not null unique references public.bf44_workflows(work_order_id),
 certificate_number text not null unique,report_id uuid not null references public.bf13_documents(id),
 snapshot jsonb not null,snapshot_hash text not null,issued_by uuid not null references auth.users(id),issued_at timestamptz not null default now()
);
create table if not exists public.bf44_statements(
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.bf44_policies(project_id),
 statement_number text not null unique,period_start date not null,period_end date not null,
 status text not null default 'draft' check(status in('draft','consultant_review','owner_review','approved','rejected')),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 submitted_by uuid references auth.users(id),submitted_at timestamptz,
 consultant_by uuid references auth.users(id),consultant_at timestamptz,
 approved_by uuid references auth.users(id),approved_at timestamptz,comment text,
 check(period_end>=period_start)
);
create table if not exists public.bf44_statement_lines(
 certificate_id uuid primary key references public.bf44_certificates(id),
 statement_id uuid not null references public.bf44_statements(id),
 coverage text not null check(coverage in('billable','included','warranty')),
 labor numeric(18,2) not null default 0 check(labor>=0),parts numeric(18,2) not null default 0 check(parts>=0),
 plant numeric(18,2) not null default 0 check(plant>=0),other numeric(18,2) not null default 0 check(other>=0),
 net_amount numeric(18,2) generated always as(labor+parts+plant+other) stored,
 basis text not null check(length(btrim(basis)) between 5 and 2000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 check(coverage='billable' or labor+parts+plant+other=0)
);
create table if not exists public.bf44_events(
 id bigint generated always as identity primary key,work_order_id uuid references public.bf_work_orders(id),
 project_id uuid not null references public.bf35_projects(id),statement_id uuid references public.bf44_statements(id),
 actor_id uuid not null references auth.users(id),action text not null,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create index if not exists bf44_events_project on public.bf44_events(project_id,id);
create sequence if not exists public.bf44_certificate_seq;
create sequence if not exists public.bf44_statement_seq;

-- Match the deployed bf_acl_* model. Explicit membership, module, role and project
-- scope are required. No global/super-user bypass and no legacy consultant table.
create or replace function public.bf44_project_member(p_user uuid,p_project uuid,p_site uuid default null,p_org uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bf_profiles u
 join public.bf_acl_user_organizations uo on uo.user_id=u.id and uo.is_active
 join public.bf_acl_user_projects up on up.user_id=u.id and up.organization_id=uo.organization_id and up.project_id=p_project
 join public.bf_acl_project_organizations po on po.project_id=up.project_id and po.organization_id=up.organization_id
 where u.id=p_user and u.status='active' and (p_org is null or uo.organization_id=p_org)
 and up.is_active and po.is_active and up.module_code in('shared','facilities') and po.module_code in('shared','facilities')
 and (up.valid_from is null or up.valid_from<=current_date) and (up.valid_until is null or up.valid_until>=current_date)
 and (po.valid_from is null or po.valid_from<=current_date) and (po.valid_until is null or po.valid_until>=current_date)
 and (up.site_id is null or up.site_id=p_site) and (po.site_id is null or po.site_id=p_site)
 and up.discipline_code is null and po.discipline_code is null
 and exists(select 1 from public.bf_acl_organization_modules om where om.organization_id=uo.organization_id
  and om.module_code in('shared','facilities') and om.is_enabled
  and (om.valid_from is null or om.valid_from<=current_date) and (om.valid_until is null or om.valid_until>=current_date)))
$$;
create or replace function public.bf44_permission_keys(p_permission text)
returns text[] language sql immutable set search_path='' as $$
 select case p_permission
 when 'corrective.view' then array['corrective.view','facilities.work_orders.view']
 when 'corrective.request' then array['corrective.request','facilities.work_orders.manage']
 when 'corrective.manage' then array['corrective.manage','facilities.work_orders.manage']
 when 'corrective.execute' then array['corrective.execute','facilities.work_orders.manage']
 when 'corrective.approve' then array['corrective.approve','facilities.work_orders.approve']
 when 'ppm.view' then array['ppm.view','facilities.ppm.view']
 when 'ppm.manage' then array['ppm.manage','facilities.ppm.manage']
 when 'ppm.execute' then array['ppm.execute','facilities.ppm.manage']
 when 'ppm.approve' then array['ppm.approve','facilities.ppm.manage']
 when 'contracts.manage' then array['contracts.manage','projects.manage']
 when 'documents.generate' then array['documents.generate','reports.export']
 when 'approvals.request' then array['approvals.request','facilities.work_orders.manage']
 when 'costing.manage' then array['costing.manage','facilities.statements.manage']
 when 'inventory.request' then array['inventory.request','facilities.inventory.request','facilities.inventory.manage']
 when 'inventory.manage' then array['inventory.manage','facilities.inventory.manage']
 when 'inventory.approve' then array['inventory.approve','facilities.inventory.approve']
 else array[p_permission] end
$$;
create or replace function public.bf44_user_can(p_user uuid,p_project uuid,p_permission text,p_site uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bf35_projects pr
 join public.bf_acl_user_organizations uo on uo.organization_id=pr.organization_id and uo.user_id=p_user and uo.is_active
 join public.bf_profiles u on u.id=uo.user_id and u.status='active'
 join public.bf_acl_user_roles ur on ur.user_id=u.id and ur.organization_id=uo.organization_id and ur.is_active
 join public.bf_acl_roles r on r.id=ur.role_id and r.is_active and (r.organization_id is null or r.organization_id=ur.organization_id)
 join public.bf_acl_role_permissions rp on rp.role_id=r.id and rp.is_allowed
 join public.bf_acl_permissions pe on pe.permission_key=rp.permission_key and pe.is_active
 join public.bf_acl_organization_permissions op on op.organization_id=ur.organization_id and op.permission_key=pe.permission_key and op.is_allowed
 where pr.id=p_project and pe.permission_key=any(public.bf44_permission_keys(p_permission))
 and pe.module_code in('shared','facilities')
 and (ur.valid_from is null or ur.valid_from<=current_date) and (ur.valid_until is null or ur.valid_until>=current_date)
 and public.bf44_project_member(p_user,pr.id,p_site,pr.organization_id)
 and exists(select 1 from public.bf_acl_organization_modules om where om.organization_id=pr.organization_id
  and om.module_code in('shared',pe.module_code) and om.is_enabled
  and (om.valid_from is null or om.valid_from<=current_date) and (om.valid_until is null or om.valid_until>=current_date)))
$$;
create or replace function public.bf44_staff(p_project uuid,p_permission text,p_site uuid default null)
returns boolean language sql stable security definer set search_path='' as $$select public.bf44_user_can(auth.uid(),p_project,p_permission,p_site)$$;
create or replace function public.bf44_reviewer_eligible(p_user uuid,p_project uuid,p_kind text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bf35_projects pr where pr.id=p_project and
 ((p_kind='owner' and public.bf44_project_member(p_user,pr.id,null,pr.organization_id)
   and public.bf_acl_user_is_owner(p_user,pr.organization_id,pr.client_id))
 or (p_kind='consultant' and exists(
  select 1 from public.bf_acl_user_organizations uo
  join public.bf_acl_user_roles ur on ur.user_id=uo.user_id and ur.organization_id=uo.organization_id and ur.is_active
  join public.bf_acl_roles r on r.id=ur.role_id and r.is_active and (r.organization_id is null or r.organization_id=ur.organization_id)
  where uo.user_id=p_user and uo.is_active and r.module_code in('shared','facilities')
   and (ur.valid_from is null or ur.valid_from<=current_date) and (ur.valid_until is null or ur.valid_until>=current_date)
   and public.bf44_project_member(p_user,pr.id,null,uo.organization_id)
   and (r.role_code in('consultant','consultant_rep','consultant_engineer','consultant_manager')
    or exists(select 1 from public.bf_acl_project_organizations po where po.project_id=pr.id and po.organization_id=uo.organization_id
     and po.relationship_type='consultant' and po.is_active and po.module_code in('shared','facilities')
     and po.site_id is null and po.discipline_code is null
     and (po.valid_from is null or po.valid_from<=current_date) and (po.valid_until is null or po.valid_until>=current_date)))
 ))))
$$;
create or replace function public.bf44_reviewer(p_project uuid,p_kind text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bf44_policies po where po.project_id=p_project
 and ((p_kind='owner' and po.owner_reviewer=auth.uid()) or(p_kind='consultant' and po.consultant_reviewer=auth.uid()))
 and public.bf44_reviewer_eligible(auth.uid(),po.project_id,p_kind))
$$;

create or replace function public.bf44_view(p_project uuid,p_site uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select public.bf44_staff(p_project,'corrective.view',p_site) or public.bf44_staff(p_project,'ppm.view',p_site)
 or public.bf44_staff(p_project,'contracts.manage',p_site) or public.bf44_staff(p_project,'costing.manage',p_site)
 or public.bf44_reviewer(p_project,'owner') or public.bf44_reviewer(p_project,'consultant')
$$;
create or replace function public.bf44_policy_save(p_project uuid,p_owner uuid,p_consultant uuid default null,p_currency text default 'SAR')
returns void language plpgsql security definer set search_path='' as $$
declare pr public.bf35_projects;
begin
 select * into pr from public.bf35_projects where id=p_project for update;
 if not found or pr.contract_id is null then raise exception 'Project must have a contract';end if;
 if not(public.bf44_staff(pr.id,'contracts.manage') or public.bf44_reviewer(pr.id,'owner')) then raise exception 'Contract management permission required' using errcode='42501';end if;
 if exists(select 1 from public.bf44_policies where project_id=pr.id and status='active') then raise exception 'Active approval chain is frozen; use a controlled contract amendment';end if;
 if not public.bf44_reviewer_eligible(p_owner,pr.id,'owner') then raise exception 'Owner reviewer must have active owner_rep role, organization membership and this project assignment';end if;
 if p_consultant is not null and not public.bf44_reviewer_eligible(p_consultant,pr.id,'consultant') then raise exception 'Consultant requires an active consultant role/relationship, organization membership and this project assignment';end if;
 insert into public.bf44_policies(project_id,contract_id,owner_reviewer,consultant_reviewer,currency,prepared_by)
 values(pr.id,pr.contract_id,p_owner,p_consultant,upper(p_currency),auth.uid())
 on conflict(project_id) do update set owner_reviewer=excluded.owner_reviewer,consultant_reviewer=excluded.consultant_reviewer,currency=excluded.currency,prepared_by=excluded.prepared_by,prepared_at=now();
 insert into public.bf44_events(project_id,actor_id,action) values(pr.id,auth.uid(),'policy_prepared');
end $$;
create or replace function public.bf44_policy_activate(p_project uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.bf44_policies where project_id=p_project for update;
 if not public.bf44_reviewer(p_project,'owner') then raise exception 'Selected owner representative must activate the workflow' using errcode='42501';end if;
 update public.bf44_policies set status='active',activated_by=auth.uid(),activated_at=now() where project_id=p_project and status='draft';
 if found then insert into public.bf44_events(project_id,actor_id,action) values(p_project,auth.uid(),'policy_activated');end if;
end $$;

-- Bind existing records explicitly; no bulk backfill and no historical data resets.
create or replace function public.bf44_enroll(p_work_order uuid,p_project uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare w public.bf_work_orders;pr public.bf35_projects;po public.bf44_policies;
begin
 select * into w from public.bf_work_orders where id=p_work_order for update;
 if not found then raise exception 'Work order not found';end if;
 if not public.bf44_staff(p_project,'corrective.manage',w.site_id) then raise exception 'Project maintenance management permission required' using errcode='42501';end if;
 select * into pr from public.bf35_projects where id=p_project;
 select * into po from public.bf44_policies where project_id=p_project and status='active';
 if po.project_id is null or w.organization_id<>pr.organization_id or w.client_id<>pr.client_id or w.contract_id is distinct from pr.contract_id
 or w.asset_id is null or w.status in('closed','cancelled')
 or not exists(select 1 from public.bf35_project_sites ps where ps.project_id=pr.id and ps.site_id=w.site_id and ps.organization_id=w.organization_id and ps.client_id=w.client_id)
 or not exists(select 1 from public.bf_assets a where a.id=w.asset_id and a.organization_id=w.organization_id and a.client_id=w.client_id and a.site_id=w.site_id)
 then raise exception 'Asset, owner, provider, contract, project and site must share one valid scope';end if;
 if exists(select 1 from public.bf44_workflows where work_order_id=w.id and project_id<>pr.id) then raise exception 'Work order already belongs to another project';end if;
 update public.bf_work_orders set project_id=pr.id where id=w.id;
 insert into public.bf44_workflows(work_order_id,project_id,enrolled_by) values(w.id,pr.id,auth.uid()) on conflict(work_order_id) do nothing;
 if found then insert into public.bf44_events(project_id,work_order_id,actor_id,action) values(pr.id,w.id,auth.uid(),'enrolled');end if;
 return w.id;
end $$;
create or replace function public.bf44_bind_new_order()
returns trigger language plpgsql security definer set search_path='' as $$
declare ids uuid[];pr public.bf35_projects;
begin
 if new.project_id is null and new.request_id is not null then select project_id into new.project_id from public.bf_service_requests where id=new.request_id;end if;
 if new.project_id is null then new.project_id:=nullif(current_setting('basmat.workflow_project',true),'')::uuid;end if;
 if new.project_id is null and new.contract_id is not null then
  select array_agg(p.project_id) into ids from public.bf44_policies p join public.bf35_project_sites ps on ps.project_id=p.project_id
   where p.status='active' and p.contract_id=new.contract_id and ps.site_id=new.site_id and ps.organization_id=new.organization_id and ps.client_id=new.client_id;
  if cardinality(ids)>1 then raise exception 'Multiple projects match: create from an explicitly selected project';end if;
  if cardinality(ids)=1 then new.project_id:=ids[1];end if;
 end if;
 if new.project_id is not null and exists(select 1 from public.bf44_policies where project_id=new.project_id and status='active') then
  if not(public.bf44_staff(new.project_id,'corrective.manage',new.site_id) or public.bf44_staff(new.project_id,'ppm.manage',new.site_id)) then raise exception 'Project work order creation permission required' using errcode='42501';end if;
  select * into pr from public.bf35_projects where id=new.project_id;
  if new.organization_id<>pr.organization_id or new.client_id<>pr.client_id or new.contract_id is distinct from pr.contract_id or new.asset_id is null
  or not exists(select 1 from public.bf35_project_sites where project_id=pr.id and site_id=new.site_id and organization_id=new.organization_id and client_id=new.client_id)
  or not exists(select 1 from public.bf_assets where id=new.asset_id and organization_id=new.organization_id and client_id=new.client_id and site_id=new.site_id)
  then raise exception 'Integrated order scope mismatch';end if;
 end if;
 return new;
end $$;
drop trigger if exists bf44_bind_new_order on public.bf_work_orders;
create trigger bf44_bind_new_order before insert on public.bf_work_orders for each row execute function public.bf44_bind_new_order();
create or replace function public.bf44_enroll_new_order()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.bf44_policies where project_id=new.project_id and status='active') then
  insert into public.bf44_workflows(work_order_id,project_id,enrolled_by) values(new.id,new.project_id,auth.uid());
 end if;return new;
end $$;
drop trigger if exists bf44_enroll_new_order on public.bf_work_orders;
create trigger bf44_enroll_new_order after insert on public.bf_work_orders for each row execute function public.bf44_enroll_new_order();
create or replace function public.bf44_report_fault(p_project uuid,p_asset uuid,p_title text,p_description text default '',p_priority text default 'P3')
returns uuid language plpgsql security definer set search_path='' as $$
declare pr public.bf35_projects;a public.bf_assets;rid uuid;
begin
 select * into pr from public.bf35_projects where id=p_project and status='active';
 select * into a from public.bf_assets where id=p_asset and status='active';
 if pr.id is null or a.id is null or a.organization_id<>pr.organization_id or a.client_id<>pr.client_id
 or not exists(select 1 from public.bf35_project_sites where project_id=pr.id and site_id=a.site_id)
 or not exists(select 1 from public.bf44_policies where project_id=pr.id and status='active') then raise exception 'Active project asset and approved workflow required';end if;
 if not(public.bf44_staff(pr.id,'corrective.request',a.site_id) or public.bf44_reviewer(pr.id,'owner')) then raise exception 'Project reporting permission required' using errcode='42501';end if;
 rid:=public.bf4_action('request',null,'create',jsonb_build_object('organization_id',pr.organization_id,'client_id',pr.client_id,'contract_id',pr.contract_id,'site_id',a.site_id,'asset_id',a.id,'title',p_title,'description',p_description,'priority',p_priority));
 update public.bf_service_requests set project_id=pr.id where id=rid;return rid;
end $$;
create or replace function public.bf44_convert_request(p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.bf_service_requests;wo uuid;
begin
 select * into r from public.bf_service_requests where id=p_request for update;
 if not found then raise exception 'Request not found';end if;
 if r.project_id is null then raise exception 'Link the request to an integrated project first';end if;
 if not public.bf44_staff(r.project_id,'corrective.manage',r.site_id) then raise exception 'Project maintenance management permission required' using errcode='42501';end if;
 select id into wo from public.bf_work_orders where request_id=r.id;
 if wo is not null then return wo;end if;
 return public.bf4_action('request',r.id,'convert','{}'::jsonb);
end $$;

-- Stock must be completely reconciled. Units are read from the one existing stock ledger.
create or replace function public.bf44_assert_materials(p_work_order uuid)
returns void language plpgsql stable security definer set search_path='' as $$
begin
 if exists(select 1 from public.bf_inv_requests where work_order_id=p_work_order and status not in('consumed','rejected','cancelled')) then raise exception 'Reconcile historical material requests first';end if;
 if exists(select 1 from public.bf8_material_requests r left join public.bf8_material_lines l on l.request_id=r.id
 where r.work_order_id=p_work_order and (r.status not in('closed','rejected','cancelled') or coalesce(l.reserved_qty,0)>0
 or coalesce(l.issued_qty-l.received_qty-l.returned_unreceived_qty,0)>0
 or coalesce(l.received_qty-l.consumed_qty-l.returned_received_qty,0)>0))
 then raise exception 'Reconcile all material reservations, issues, receipts, consumption and returns; close material requests first';end if;
end $$;
create or replace function public.bf44_review_ok(p_work_order uuid,p_kind text)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select a.status='approved' from public.bf11_approvals a
 join public.bf44_review_links l on l.approval_id=a.id join public.bf44_workflows f on f.work_order_id=l.work_order_id and f.revision=l.revision
 where l.work_order_id=p_work_order and a.reviewer_type=p_kind order by a.round desc limit 1),false)
$$;
create or replace function public.bf44_snapshot(p_work_order uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare snap jsonb;
begin
 select jsonb_build_object('source','work_order','id',w.id,'number',w.work_order_number,'title',w.title,'revision',f.revision,
 'maintenance_type',case when j.id is null then 'corrective' else 'preventive' end,
 'owner',c.name,'client_name',c.name,'service_provider',o.name,'project',pr.name,'contract',co.contract_number,
 'site_name',s.name,'building',b.name,'floor',fl.name,'area',z.name,'room',ro.name,
 'asset',coalesce(a.name_en,a.name_ar),'asset_ar',a.name_ar,'asset_tag',a.asset_tag,'serial_number',a.serial_number,
 'manufacturer',a.manufacturer,'model',a.model,'status',w.status,'priority',w.priority,
 'description',w.description,'diagnosis',w.diagnosis,'root_cause',w.root_cause,'work_performed',w.work_performed,'tests_performed',w.tests_performed,'recommendations',w.recommendations,
 'created_at',w.created_at,'started_at',w.started_at,'completed_at',w.completed_at,
 'request_number',(select request_number from public.bf_service_requests where id=w.request_id),
 'technicians',coalesce((select jsonb_agg(jsonb_build_object('name',p.full_name,'assigned_at',x.assigned_at)) from public.bf_work_order_assignments x join public.bf_profiles p on p.id=x.user_id where x.work_order_id=w.id),'[]'::jsonb),
 'internal_approval',coalesce((select jsonb_agg(jsonb_build_object('reviewer',p.full_name,'action',e.action,'date',e.created_at)) from public.bf_corrective_events e left join public.bf_profiles p on p.id=e.actor_id where e.work_order_id=w.id and e.action='approve'),'[]'::jsonb),
 'ppm_internal_approval',coalesce((select jsonb_agg(jsonb_build_object('reviewer',p.full_name,'action',e.action,'date',e.created_at)) from public.bf_ppm_events e left join public.bf_profiles p on p.id=e.actor_id where e.job_id=j.id and e.action='approve'),'[]'::jsonb),
 'ppm',case when j.id is null then null else jsonb_build_object('number',j.job_number,'due_date',j.due_date,'status',j.status,'procedure',j.procedure_snapshot,
 'results',coalesce((select jsonb_agg(to_jsonb(r)-'updated_by') from public.bf_ppm_results r where r.job_id=j.id),'[]'::jsonb)) end,
 'materials',coalesce((select jsonb_agg(jsonb_build_object('request_number',mr.number,'request_status',mr.status,'part',coalesce(pa.name_en,pa.name_ar),'part_ar',pa.name_ar,'sku',pa.sku,'stock_owner',coalesce(oc.name,o.name),'requested',ml.quantity,'issued',ml.issued_qty,'received',ml.received_qty,'consumed',ml.consumed_qty,'returned',ml.returned_received_qty+ml.returned_unreceived_qty))
 from public.bf8_material_requests mr join public.bf8_material_lines ml on ml.request_id=mr.id join public.bf_inv_parts pa on pa.id=ml.part_id left join public.bf_clients oc on oc.id=ml.owner_client_id where mr.work_order_id=w.id),'[]'::jsonb)||coalesce((select jsonb_agg(jsonb_build_object('request_number',lr.request_number,'part',coalesce(lp.name_en,lp.name_ar),'part_ar',lp.name_ar,'sku',lp.sku,'stock_owner',coalesce(lc.name,o.name),'issued',lr.quantity,'received',lr.quantity,'consumed',lr.quantity,'returned',0)) from public.bf_inv_requests lr join public.bf_inv_parts lp on lp.id=lr.part_id left join public.bf_clients lc on lc.id=lr.owner_client_id where lr.work_order_id=w.id and lr.status='consumed'),'[]'::jsonb),
 'visits',coalesce((select jsonb_agg(jsonb_build_object('technician',p.full_name,'number',v.visit_number,'started_at',v.started_at,'finished_at',v.finished_at,'status',v.status,'work_performed',v.work_performed,'tests_performed',v.tests_performed)) from public.bf9_visits v join public.bf_profiles p on p.id=v.technician_id where v.work_order_id=w.id),'[]'::jsonb),
 'labor_minutes',coalesce((select sum(l.minutes) from public.bf9_labor l join public.bf9_visits v on v.id=l.visit_id where v.work_order_id=w.id),0),
 'evidence',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'file_name',e.file_name,'caption',e.caption,'verified_at',e.verified_at)) from public.bf9_evidence e where e.work_order_id=w.id and e.status='ready'),'[]'::jsonb),
 'approvals',coalesce((select jsonb_agg(jsonb_build_object('role',ap.reviewer_type,'status',ap.status,'reviewer',p.full_name,'date',ap.decided_at,'comment',ap.decision_comment,'round',ap.round)) from public.bf11_approvals ap join public.bf44_review_links l on l.approval_id=ap.id and l.revision=f.revision left join public.bf_profiles p on p.id=ap.decided_by where l.work_order_id=w.id),'[]'::jsonb)) into snap
 from public.bf_work_orders w join public.bf44_workflows f on f.work_order_id=w.id
 join public.bf35_projects pr on pr.id=f.project_id join public.bf_clients c on c.id=w.client_id
 join public.bf_organizations o on o.id=w.organization_id join public.bf_contracts co on co.id=w.contract_id
 join public.bf_sites s on s.id=w.site_id join public.bf_assets a on a.id=w.asset_id
 left join public.bf_buildings b on b.id=a.building_id left join public.bf_floors fl on fl.id=a.floor_id
 left join public.bf_zones z on z.id=a.zone_id left join public.bf_rooms ro on ro.id=a.room_id
 left join public.bf_ppm_jobs j on j.work_order_id=w.id where w.id=p_work_order;
 return snap;
end $$;
create or replace function public.bf44_assert_execution(p_work_order uuid)
returns void language plpgsql stable security definer set search_path='' as $$
declare j public.bf_ppm_jobs;
begin
 select * into j from public.bf_ppm_jobs where work_order_id=p_work_order;
 if j.id is not null then
  if j.status not in('approved','closed') or not exists(select 1 from public.bf_ppm_procedures p where p.id=j.procedure_id and p.status in('approved','archived') and p.version=(j.procedure_snapshot->>'version')::integer and p.id::text=j.procedure_snapshot->>'procedure_id')
   or jsonb_array_length(coalesce(j.procedure_snapshot->'steps','[]'::jsonb))=0
   or exists(select 1 from jsonb_array_elements(j.procedure_snapshot->'steps') step where not exists(select 1 from public.bf_ppm_results r where r.job_id=j.id and r.step_id=(step->>'id')::uuid and r.result in('pass','na')))
  then raise exception 'Approved procedure snapshot and approved complete PPM results required';end if;
 else
  if not exists(select 1 from public.bf_work_orders where id=p_work_order and completed_at is not null)
   or not exists(select 1 from public.bf9_visits v where v.work_order_id=p_work_order and v.status='finished' and exists(select 1 from public.bf9_labor l where l.visit_id=v.id and l.minutes>0))
   or not exists(select 1 from public.bf9_evidence where work_order_id=p_work_order and status='ready')
  then raise exception 'Finished technician visit, actual labor and verified execution evidence required';end if;
 end if;
end $$;
-- Integrated decisions reuse bf11_approvals/events, with the deployed ACL engine.
-- Legacy bf11_* authorization functions are left unchanged for other workflows.
create or replace function public.bf44_approval_action(p_action text,p_id uuid default null,p_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare w public.bf_work_orders;f public.bf44_workflows;a public.bf11_approvals;kind text;next_round integer;wo uuid;eligible boolean;
begin
 if auth.uid() is null or not exists(select 1 from public.bf_profiles where id=auth.uid() and status='active') then raise exception 'Authentication required' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or pg_column_size(p_data)>32768 then raise exception 'Invalid payload';end if;
 if p_action='create' then
  if p_data->>'entity_type' is distinct from 'work_order' then raise exception 'Unified work order required';end if;
  wo:=nullif(p_data->>'entity_id','')::uuid;
 else select entity_id into wo from public.bf11_approvals where id=p_id and entity_type='work_order';end if;
 select * into w from public.bf_work_orders where id=wo for update;
 select * into f from public.bf44_workflows where work_order_id=w.id for update;
 if f.work_order_id is null then raise exception 'Integrated work order required';end if;
 if p_action='create' then
  if not public.bf44_staff(f.project_id,'approvals.request',w.site_id) then raise exception 'Project approval request permission required' using errcode='42501';end if;
  kind:=p_data->>'reviewer_type';
  if kind is null or kind not in('owner','consultant') then raise exception 'Invalid reviewer type';end if;
  select public.bf44_reviewer_eligible(case when kind='owner' then po.owner_reviewer else po.consultant_reviewer end,f.project_id,kind) into eligible from public.bf44_policies po where po.project_id=f.project_id;
  if not coalesce(eligible,false) then
   raise exception 'Appointed reviewer no longer has active project access';end if;
  select ap.* into a from public.bf11_approvals ap join public.bf44_review_links l on l.approval_id=ap.id
   where l.work_order_id=w.id and l.revision=f.revision and ap.reviewer_type=kind and ap.status='pending';
  if a.id is not null then return a.id;end if;
  select coalesce(max(round),0)+1 into next_round from public.bf11_approvals where entity_type='work_order' and entity_id=w.id and reviewer_type=kind;
  insert into public.bf11_approvals(organization_id,client_id,site_id,entity_type,entity_id,reviewer_type,round,subject,request_comment,requested_by)
   values(w.organization_id,w.client_id,w.site_id,'work_order',w.id,kind,next_round,left('Maintenance acceptance '||w.work_order_number,250),coalesce(p_data->>'request_comment',''),auth.uid()) returning * into a;
 elsif p_action in('approve','reject') then
  select * into a from public.bf11_approvals where id=p_id for update;
  if a.status<>'pending' then raise exception 'Approval is not pending';end if;
  if a.requested_by=auth.uid() then raise exception 'Independent approval required';end if;
  if not public.bf44_reviewer(f.project_id,a.reviewer_type) then raise exception 'Appointed project reviewer required' using errcode='42501';end if;
  if p_action='reject' and length(btrim(coalesce(p_data->>'comment','')))<5 then raise exception 'Rejection comment is required';end if;
  if length(coalesce(p_data->>'comment',''))>4000 then raise exception 'Comment too long';end if;
  update public.bf11_approvals set status=case when p_action='approve' then 'approved' else 'rejected' end,
   decided_by=auth.uid(),decided_at=now(),decision_comment=nullif(btrim(coalesce(p_data->>'comment','')),'') where id=a.id;
 else raise exception 'Invalid integrated approval action';end if;
 insert into public.bf11_events(organization_id,approval_id,actor_id,action,details)
 values(w.organization_id,a.id,auth.uid(),p_action,jsonb_build_object('workflow','integrated_maintenance','revision',f.revision,'comment',p_data->>'comment'));
 return a.id;
end $$;

create or replace function public.bf44_closeout_action(p_work_order uuid,p_action text)
returns uuid language plpgsql security definer set search_path='' as $$
declare w public.bf_work_orders;f public.bf44_workflows;po public.bf44_policies;doc uuid;snap jsonb;target text;cert uuid;
begin
 select * into w from public.bf_work_orders where id=p_work_order for update;
 select * into f from public.bf44_workflows where work_order_id=w.id for update;
 if f.work_order_id is null then raise exception 'Integrated work order required';end if;
 select * into po from public.bf44_policies where project_id=f.project_id;
 if not(public.bf44_staff(f.project_id,case when p_action='submit_external' then 'approvals.request' else 'documents.generate' end,w.site_id)
 or(p_action='issue_certificate' and public.bf44_reviewer(f.project_id,'owner'))) then raise exception 'Project closeout permission required' using errcode='42501';end if;
 if w.status<>'approved' then raise exception 'Independent internal approval is required first';end if;
 perform public.bf44_assert_materials(w.id);
 perform public.bf44_assert_execution(w.id);
 if exists(select 1 from public.bf9_visits where work_order_id=w.id and status='open') then raise exception 'Finish open technician visits first';end if;
 if p_action='generate_report' then
  if f.report_id is not null then return f.report_id;end if;
  snap:=public.bf44_snapshot(w.id);
  if snap is null then raise exception 'Incomplete asset trace';end if;
  insert into public.bf13_documents(organization_id,client_id,site_id,document_number,document_type,entity_type,entity_id,title,snapshot,snapshot_hash,generated_by)
  values(w.organization_id,w.client_id,w.site_id,'DOC-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.bf13_document_seq')::text,6,'0'),'technical_report','work_order',w.id,left('Maintenance report '||w.work_order_number,250),snap,encode(sha256(convert_to(snap::text,'UTF8')),'hex'),auth.uid()) returning id into doc;
  update public.bf44_workflows set report_id=doc where work_order_id=w.id;
 elsif p_action='submit_external' then
  if f.report_id is null then raise exception 'Generate the immutable technical report first';end if;
  target:=case when po.consultant_reviewer is not null and not public.bf44_review_ok(w.id,'consultant') then 'consultant' else 'owner' end;
  if public.bf44_review_ok(w.id,target) then return w.id;end if;
  select a.id into doc from public.bf11_approvals a join public.bf44_review_links l on l.approval_id=a.id where l.work_order_id=w.id and l.revision=f.revision and a.reviewer_type=target and a.status='pending';
  if doc is not null then return doc;end if;
  doc:=public.bf44_approval_action('create',null,jsonb_build_object('organization_id',w.organization_id,'client_id',w.client_id,'site_id',w.site_id,'entity_type','work_order','entity_id',w.id,'reviewer_type',target,'subject','Maintenance acceptance '||w.work_order_number));
 elsif p_action='issue_certificate' then
  select id into cert from public.bf44_certificates where work_order_id=w.id;if cert is not null then return cert;end if;
  if not public.bf44_review_ok(w.id,'owner') or (po.consultant_reviewer is not null and not public.bf44_review_ok(w.id,'consultant')) then raise exception 'Owner acceptance and configured consultant review required';end if;
  if not exists(select 1 from public.bf13_documents where id=f.report_id and status='final') then raise exception 'Final report required';end if;
  snap:=public.bf44_snapshot(w.id)||jsonb_build_object('report_id',f.report_id,'owner_acceptance_at',(select max(a.decided_at) from public.bf11_approvals a join public.bf44_review_links l on l.approval_id=a.id where l.work_order_id=w.id and l.revision=f.revision and a.reviewer_type='owner' and a.status='approved'));
  insert into public.bf44_certificates(work_order_id,certificate_number,report_id,snapshot,snapshot_hash,issued_by)
  values(w.id,'CC-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.bf44_certificate_seq')::text,6,'0'),f.report_id,snap,encode(sha256(convert_to(snap::text,'UTF8')),'hex'),auth.uid()) returning id into doc;
 else raise exception 'Invalid closeout action';end if;
 insert into public.bf44_events(project_id,work_order_id,actor_id,action,details) values(f.project_id,w.id,auth.uid(),p_action,jsonb_build_object('document_id',doc,'revision',f.revision));return doc;
end $$;
-- Direct legacy approval endpoints are subject to the same project/sequence rules.
create or replace function public.bf44_approval_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare f public.bf44_workflows;po public.bf44_policies;wo uuid;
begin
 wo:=new.entity_id;
 if new.entity_type='ppm_job' then
  select work_order_id into wo from public.bf_ppm_jobs where id=new.entity_id;
  if exists(select 1 from public.bf44_workflows where work_order_id=wo) then raise exception 'Use the unified work order approval';end if;return new;
 end if;
 select * into f from public.bf44_workflows where work_order_id=wo;
 if f.work_order_id is null then return new;end if;
 perform 1 from public.bf_work_orders where id=wo for update;
 select * into po from public.bf44_policies where project_id=f.project_id;
 if tg_op='INSERT' then
  if f.report_id is null or not exists(select 1 from public.bf_work_orders where id=wo and status='approved') then raise exception 'Approved work and final report required before external review';end if;
  if not public.bf44_staff(f.project_id,'approvals.request',(select site_id from public.bf_work_orders where id=wo)) then raise exception 'Project approval request permission required' using errcode='42501';end if;
  if new.reviewer_type='consultant' and po.consultant_reviewer is null then raise exception 'No consultant appointed';end if;
  if new.reviewer_type='owner' and po.consultant_reviewer is not null and not public.bf44_review_ok(wo,'consultant') then raise exception 'Consultant review must precede owner acceptance';end if;
 elsif new.status is distinct from old.status and new.status in('approved','rejected') then
  if auth.uid()=new.requested_by then raise exception 'Requester cannot approve own work';end if;
  if not exists(select 1 from public.bf44_review_links where approval_id=new.id and revision=f.revision) then raise exception 'Approval belongs to an earlier revision';end if;
  if not public.bf44_reviewer(f.project_id,new.reviewer_type) then raise exception 'Appointed project reviewer required' using errcode='42501';end if;
  if new.reviewer_type='owner' and po.consultant_reviewer is not null and not public.bf44_review_ok(wo,'consultant') then raise exception 'Consultant approval required';end if;
 end if;return new;
end $$;
drop trigger if exists bf44_approval_guard on public.bf11_approvals;
create trigger bf44_approval_guard before insert or update on public.bf11_approvals for each row execute function public.bf44_approval_guard();
create or replace function public.bf44_approval_log()
returns trigger language plpgsql security definer set search_path='' as $$
declare f public.bf44_workflows;
begin
 select * into f from public.bf44_workflows where work_order_id=new.entity_id and new.entity_type='work_order';
 if f.work_order_id is not null then
  if tg_op='INSERT' then insert into public.bf44_review_links values(new.id,f.work_order_id,f.revision);end if;
  insert into public.bf44_events(project_id,work_order_id,actor_id,action,details) values(f.project_id,f.work_order_id,auth.uid(),'external_'||new.status,jsonb_build_object('reviewer_type',new.reviewer_type,'approval_id',new.id,'revision',f.revision));
 end if;return new;
end $$;
drop trigger if exists bf44_approval_log on public.bf11_approvals;
create trigger bf44_approval_log after insert or update of status on public.bf11_approvals for each row execute function public.bf44_approval_log();

create or replace function public.bf44_order_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare f public.bf44_workflows;j public.bf_ppm_jobs;
begin
 select * into f from public.bf44_workflows where work_order_id=old.id;
 if f.work_order_id is null then
  if new.status is distinct from old.status and exists(select 1 from public.bf44_policies po join public.bf35_project_sites ps on ps.project_id=po.project_id where po.status='active' and po.contract_id=new.contract_id and ps.site_id=new.site_id) then raise exception 'Enroll this work order in its integrated project before continuing';end if;
  return new;
 end if;
 if not(public.bf44_staff(f.project_id,'corrective.manage',old.site_id) or public.bf44_staff(f.project_id,'corrective.execute',old.site_id) or public.bf44_staff(f.project_id,'corrective.approve',old.site_id) or public.bf44_staff(f.project_id,'ppm.manage',old.site_id) or public.bf44_staff(f.project_id,'ppm.execute',old.site_id) or public.bf44_staff(f.project_id,'ppm.approve',old.site_id) or (new.status='closed' and public.bf44_reviewer(f.project_id,'owner'))) then raise exception 'Project execution permission required' using errcode='42501';end if;
 if new.project_id is distinct from f.project_id or new.organization_id<>old.organization_id or new.client_id<>old.client_id or new.contract_id is distinct from old.contract_id or new.site_id<>old.site_id or new.asset_id is distinct from old.asset_id then raise exception 'Integrated maintenance scope is immutable';end if;
 if exists(select 1 from public.bf44_certificates where work_order_id=old.id) then
  if (to_jsonb(new)-array['status','closed_at','updated_at']) is distinct from (to_jsonb(old)-array['status','closed_at','updated_at']) or new.status not in('approved','closed') then raise exception 'Certified work is immutable; raise a follow-up request for additional work';end if;
 end if;
 if new.status is distinct from old.status then
  select * into j from public.bf_ppm_jobs where work_order_id=old.id;
  if j.id is not null and new.status in('in_progress','completed','approved','closed') and new.status<>j.status then raise exception 'Execute the linked approved PPM checklist; do not run a second corrective workflow';end if;
  if new.status='closed' and not exists(select 1 from public.bf44_certificates c join public.bf44_statement_lines l on l.certificate_id=c.id join public.bf44_statements s on s.id=l.statement_id where c.work_order_id=old.id and s.status='approved') then raise exception 'Completion certificate must be included in an owner-approved statement before final closure';end if;
  if old.status in('completed','approved') and new.status in('assigned','in_progress') then
   update public.bf44_workflows set revision=revision+1,report_id=null where work_order_id=old.id;
  end if;
  insert into public.bf44_events(project_id,work_order_id,actor_id,action,details) values(f.project_id,old.id,auth.uid(),'work_order_status',jsonb_build_object('from',old.status,'to',new.status));
 end if;return new;
end $$;
drop trigger if exists bf44_order_guard on public.bf_work_orders;
create trigger bf44_order_guard before update on public.bf_work_orders for each row execute function public.bf44_order_guard();

-- Link/status mirroring: checklist execution owns PPM state; one WO owns materials/closeout.
create or replace function public.bf44_ppm_mirror()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.work_order_id is not null and new.status is distinct from old.status then
  update public.bf_work_orders set status=case when new.status='scheduled' then 'draft' else new.status end,
   approval_status=case when new.status in('approved','closed') then 'approved' when new.status='completed' then 'pending' else 'not_submitted' end,
   started_at=new.started_at,completed_at=new.completed_at,closed_at=new.closed_at,updated_at=now() where id=new.work_order_id and exists(select 1 from public.bf44_workflows where work_order_id=new.work_order_id);
 end if;return new;
end $$;
drop trigger if exists bf44_ppm_mirror on public.bf_ppm_jobs;
create trigger bf44_ppm_mirror after update on public.bf_ppm_jobs for each row execute function public.bf44_ppm_mirror();
create or replace function public.bf44_assign_ppm(p_job uuid,p_user uuid,p_project uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare j public.bf_ppm_jobs;pr public.bf35_projects;pl public.bf_ppm_plans;wo uuid;previous_context text;
begin
 select * into j from public.bf_ppm_jobs where id=p_job for update;
 select * into pl from public.bf_ppm_plans where id=j.plan_id;
 select * into pr from public.bf35_projects where id=p_project;
 if j.id is null or j.status not in('scheduled','assigned') or pr.id is null or pr.organization_id<>j.organization_id or pr.client_id<>j.client_id or pr.contract_id is distinct from pl.contract_id
 or not exists(select 1 from public.bf35_project_sites where project_id=pr.id and site_id=j.site_id)
 or not exists(select 1 from public.bf44_policies where project_id=pr.id and status='active') then raise exception 'PPM job/project scope mismatch';end if;
 if not public.bf44_staff(pr.id,'ppm.manage',j.site_id) or not public.bf44_user_can(p_user,pr.id,'ppm.execute',j.site_id) then raise exception 'PPM assignment permission required' using errcode='42501';end if;
 previous_context:=current_setting('basmat.workflow_project',true);perform set_config('basmat.workflow_project',pr.id::text,true);
 if j.work_order_id is null then
  wo:=public.bf4_action('work_order',null,'create',jsonb_build_object('organization_id',j.organization_id,'client_id',j.client_id,'site_id',j.site_id,'contract_id',pr.contract_id,'asset_id',j.asset_id,'title','Preventive Maintenance - '||j.job_number,'priority','P3'));
  update public.bf_ppm_jobs set work_order_id=wo where id=j.id;
 else wo:=j.work_order_id;perform public.bf44_enroll(wo,pr.id);end if;
 perform set_config('basmat.workflow_project',coalesce(previous_context,''),true);
 update public.bf_ppm_plans set project_id=pr.id where id=pl.id;
 perform public.bf5_assign_job_work_order(j.id,p_user);
 return wo;
end $$;
alter table public.bf44_statements add column if not exists approved_snapshot jsonb;
create or replace function public.bf44_statement_action(p_action text,p_id uuid default null,p_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare st public.bf44_statements;po public.bf44_policies;c public.bf44_certificates;f public.bf44_workflows;rec record;line_count integer;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or pg_column_size(p_data)>32768 then raise exception 'Invalid payload';end if;
 if p_action='create' then
  select * into po from public.bf44_policies where project_id=(p_data->>'project_id')::uuid and status='active';
  if po.project_id is null or not public.bf44_staff(po.project_id,'costing.manage') then raise exception 'Project finance permission required' using errcode='42501';end if;
  insert into public.bf44_statements(project_id,statement_number,period_start,period_end,created_by)
  values(po.project_id,'ST-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.bf44_statement_seq')::text,6,'0'),(p_data->>'period_start')::date,(p_data->>'period_end')::date,auth.uid()) returning * into st;
 else
  select * into st from public.bf44_statements where id=p_id for update;
  if st.id is null then raise exception 'Statement not found';end if;
  select * into po from public.bf44_policies where project_id=st.project_id;
  if p_action in('add_line','submit') then
   if not public.bf44_staff(st.project_id,'costing.manage') then raise exception 'Project finance permission required' using errcode='42501';end if;
   if st.status not in('draft','rejected') then raise exception 'Submitted statement amounts are locked';end if;
   if p_action='add_line' then
    select * into c from public.bf44_certificates where id=(p_data->>'certificate_id')::uuid for update;
    select * into f from public.bf44_workflows where work_order_id=c.work_order_id;
    if c.id is null or f.project_id<>st.project_id or (c.issued_at at time zone 'Asia/Riyadh')::date not between st.period_start and st.period_end then raise exception 'Certificate must belong to the same project and statement period';end if;
    if exists(select 1 from public.bf44_statement_lines where certificate_id=c.id and statement_id<>st.id) then raise exception 'Certificate already included in another statement';end if;
    insert into public.bf44_statement_lines(certificate_id,statement_id,coverage,labor,parts,plant,other,basis,created_by)
    values(c.id,st.id,p_data->>'coverage',coalesce(nullif(p_data->>'labor','')::numeric,0),coalesce(nullif(p_data->>'parts','')::numeric,0),coalesce(nullif(p_data->>'plant','')::numeric,0),coalesce(nullif(p_data->>'other','')::numeric,0),p_data->>'basis',auth.uid())
    on conflict(certificate_id) do update set coverage=excluded.coverage,labor=excluded.labor,parts=excluded.parts,plant=excluded.plant,other=excluded.other,basis=excluded.basis;
   else
    select count(*) into line_count from public.bf44_statement_lines where statement_id=st.id;
    if line_count=0 then raise exception 'Add certified work before submission';end if;
    update public.bf44_statements set status=case when po.consultant_reviewer is null then 'owner_review' else 'consultant_review' end,
     submitted_by=auth.uid(),submitted_at=now(),consultant_by=null,consultant_at=null,comment=null where id=st.id;
   end if;
  elsif p_action in('approve','reject') then
   if st.status not in('consultant_review','owner_review') then raise exception 'Statement is not awaiting review';end if;
   if not public.bf44_reviewer(st.project_id,case when st.status='consultant_review' then 'consultant' else 'owner' end) then raise exception 'Appointed statement reviewer required' using errcode='42501';end if;
   if auth.uid()=st.submitted_by then raise exception 'Independent statement approval required';end if;
   if p_action='reject' then
    if length(btrim(coalesce(p_data->>'comment','')))<5 then raise exception 'Rejection reason required';end if;
    update public.bf44_statements set status='rejected',comment=p_data->>'comment' where id=st.id;
   elsif st.status='consultant_review' then
    update public.bf44_statements set status='owner_review',consultant_by=auth.uid(),consultant_at=now() where id=st.id;
   else
    update public.bf44_statements set status='approved',approved_by=auth.uid(),approved_at=now(),approved_snapshot=jsonb_build_object(
     'number',st.statement_number,'currency',po.currency,'period_start',st.period_start,'period_end',st.period_end,
     'lines',(select jsonb_agg(to_jsonb(l)||jsonb_build_object('certificate_number',cc.certificate_number)) from public.bf44_statement_lines l join public.bf44_certificates cc on cc.id=l.certificate_id where l.statement_id=st.id),
     'net_amount',(select sum(net_amount) from public.bf44_statement_lines where statement_id=st.id),'approved_by',auth.uid(),'approved_at',now()) where id=st.id;
    -- Close the exact same WO and linked PPM job; no duplicate financial work orders.
    for rec in select cc.work_order_id from public.bf44_statement_lines l join public.bf44_certificates cc on cc.id=l.certificate_id where l.statement_id=st.id order by cc.work_order_id loop
     perform 1 from public.bf_work_orders where id=rec.work_order_id for update;
     perform public.bf44_assert_materials(rec.work_order_id);
     update public.bf_ppm_jobs set status='closed',closed_at=now() where work_order_id=rec.work_order_id and status='approved';
     update public.bf_work_orders set status='closed',closed_at=coalesce(closed_at,now()),updated_at=now() where id=rec.work_order_id and status='approved';
     insert into public.bf44_events(project_id,work_order_id,statement_id,actor_id,action) values(st.project_id,rec.work_order_id,st.id,auth.uid(),'cycle_closed');
    end loop;
   end if;
  else raise exception 'Invalid statement action';end if;
 end if;
 insert into public.bf44_events(project_id,statement_id,actor_id,action,details) values(st.project_id,st.id,auth.uid(),'statement_'||p_action,jsonb_build_object('comment',p_data->>'comment'));
 return st.id;
end $$;

-- Immutable snapshots and resolved stock cannot be changed behind a signed certificate.
create or replace function public.bf44_immutable()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Issued completion certificates and audit events are immutable';end $$;
drop trigger if exists bf44_certificate_immutable on public.bf44_certificates;
create trigger bf44_certificate_immutable before update or delete on public.bf44_certificates for each row execute function public.bf44_immutable();
drop trigger if exists bf44_event_immutable on public.bf44_events;
create trigger bf44_event_immutable before update or delete on public.bf44_events for each row execute function public.bf44_immutable();
create or replace function public.bf44_stock_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare rec jsonb;wo uuid;f public.bf44_workflows;site uuid;
begin
 rec:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_table_name='bf8_material_requests' then wo:=(rec->>'work_order_id')::uuid;
 else select work_order_id into wo from public.bf8_material_requests where id=(rec->>'request_id')::uuid;end if;
 select site_id into site from public.bf_work_orders where id=wo for update;
 select * into f from public.bf44_workflows where work_order_id=wo;
 if f.work_order_id is not null and not(public.bf44_staff(f.project_id,'inventory.request',site) or public.bf44_staff(f.project_id,'inventory.manage',site) or public.bf44_staff(f.project_id,'inventory.approve',site)) then raise exception 'Project stock permission required' using errcode='42501';end if;
 if exists(select 1 from public.bf44_workflows where work_order_id=wo and report_id is not null) then raise exception 'Materials are frozen in the issued report; return work for re-review before making changes';end if;
 if tg_op='UPDATE' and tg_table_name='bf8_material_requests' and (to_jsonb(new)->>'work_order_id') is distinct from (to_jsonb(old)->>'work_order_id') then raise exception 'A material request cannot change its work order';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
drop trigger if exists bf44_stock_guard on public.bf8_material_requests;
create trigger bf44_stock_guard before insert or update or delete on public.bf8_material_requests for each row execute function public.bf44_stock_guard();
drop trigger if exists bf44_stock_guard on public.bf8_material_lines;
create trigger bf44_stock_guard before insert or update or delete on public.bf8_material_lines for each row execute function public.bf44_stock_guard();
create or replace function public.bf44_document_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.bf44_workflows where report_id=old.id) or (old.snapshot ? 'revision' and old.snapshot ? 'service_provider' and exists(select 1 from public.bf44_workflows where work_order_id=old.entity_id)) then raise exception 'Integrated final reports are immutable; rework requires a new revision';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
drop trigger if exists bf44_document_guard on public.bf13_documents;
create trigger bf44_document_guard before update or delete on public.bf13_documents for each row execute function public.bf44_document_guard();

create or replace function public.bf44_dossier(p_work_order uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare w public.bf_work_orders;f public.bf44_workflows;po public.bf44_policies;result jsonb;
begin
 select * into w from public.bf_work_orders where id=p_work_order;
 select * into f from public.bf44_workflows where work_order_id=w.id;
 if f.work_order_id is null or not public.bf44_view(f.project_id,w.site_id) then raise exception 'Project work order access required' using errcode='42501';end if;
 select * into po from public.bf44_policies where project_id=f.project_id;
 result:=jsonb_build_object('work_order',to_jsonb(w),'workflow',to_jsonb(f),'trace',public.bf44_snapshot(w.id),
  'policy',to_jsonb(po)||jsonb_build_object('owner_name',(select full_name from public.bf_profiles where id=po.owner_reviewer),'consultant_name',(select full_name from public.bf_profiles where id=po.consultant_reviewer)),
  'ppm_job',(select jsonb_build_object('id',j.id,'number',j.job_number,'status',j.status) from public.bf_ppm_jobs j where j.work_order_id=w.id),
  'report',(select jsonb_build_object('id',d.id,'number',d.document_number,'snapshot',d.snapshot,'hash',d.snapshot_hash,'issued_at',d.generated_at) from public.bf13_documents d where d.id=f.report_id),
  'certificate',(select to_jsonb(c) from public.bf44_certificates c where c.work_order_id=w.id),
  'approvals',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('reviewer_name',(select full_name from public.bf_profiles where id=a.decided_by))) from public.bf11_approvals a join public.bf44_review_links l on l.approval_id=a.id where l.work_order_id=w.id and l.revision=f.revision),'[]'::jsonb),
  'material_requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'number',r.number,'status',r.status)) from public.bf8_material_requests r where r.work_order_id=w.id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('actor',(select full_name from public.bf_profiles where id=e.actor_id)) order by e.id) from public.bf44_events e where e.work_order_id=w.id),'[]'::jsonb),
  'statement',(select jsonb_build_object('id',s.id,'number',s.statement_number,'status',s.status) from public.bf44_certificates c join public.bf44_statement_lines l on l.certificate_id=c.id join public.bf44_statements s on s.id=l.statement_id where c.work_order_id=w.id),
  'capabilities',jsonb_build_object('manage',public.bf44_staff(f.project_id,'corrective.manage',w.site_id),'report',public.bf44_staff(f.project_id,'documents.generate',w.site_id),'submit',public.bf44_staff(f.project_id,'approvals.request',w.site_id),'owner',public.bf44_reviewer(f.project_id,'owner'),'consultant',public.bf44_reviewer(f.project_id,'consultant')));
 return result;
end $$;
create or replace function public.bf44_lookup_reviewer(p_project uuid,p_email text,p_kind text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare pr public.bf35_projects;result jsonb;
begin
 select * into pr from public.bf35_projects where id=p_project;
 if not public.bf44_staff(pr.id,'contracts.manage') and not public.bf44_reviewer(pr.id,'owner') then raise exception 'Contract management permission required' using errcode='42501';end if;
 if p_kind not in('owner','consultant') or length(btrim(coalesce(p_email,'')))<5 then raise exception 'Exact reviewer email required';end if;
 select jsonb_build_object('id',p.id,'name',p.full_name) into result from public.bf_profiles p
 where lower(p.email)=lower(btrim(p_email)) and p.status='active' and
 public.bf44_reviewer_eligible(p.id,pr.id,p_kind);
 if result is null then raise exception 'Active reviewer with the matching owner access was not found';end if;return result;
end $$;
create or replace function public.bf44_statement_read(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare st public.bf44_statements;po public.bf44_policies;
begin
 select * into st from public.bf44_statements where id=p_id;
 if st.id is null or not(public.bf44_staff(st.project_id,'costing.manage') or public.bf44_reviewer(st.project_id,'owner') or public.bf44_reviewer(st.project_id,'consultant')) then raise exception 'Statement access required' using errcode='42501';end if;
 select * into po from public.bf44_policies where project_id=st.project_id;
 return jsonb_build_object('statement',to_jsonb(st),'currency',po.currency,'total',(select coalesce(sum(net_amount),0)::text from public.bf44_statement_lines where statement_id=st.id),
 'project',(select jsonb_build_object('name',p.name,'owner',c.name,'provider',o.name,'contract',co.contract_number) from public.bf35_projects p join public.bf_clients c on c.id=p.client_id join public.bf_organizations o on o.id=p.organization_id join public.bf_contracts co on co.id=p.contract_id where p.id=st.project_id),
 'lines',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('labor',l.labor::text,'parts',l.parts::text,'plant',l.plant::text,'other',l.other::text,'net_amount',l.net_amount::text,'certificate_number',c.certificate_number,'work_order_number',w.work_order_number,'asset',coalesce(a.name_en,a.name_ar),'serial_number',a.serial_number)) from public.bf44_statement_lines l join public.bf44_certificates c on c.id=l.certificate_id join public.bf_work_orders w on w.id=c.work_order_id join public.bf_assets a on a.id=w.asset_id where l.statement_id=st.id),'[]'::jsonb),
 'eligible',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'number',c.certificate_number,'work_order_number',w.work_order_number)) from public.bf44_certificates c join public.bf44_workflows f on f.work_order_id=c.work_order_id join public.bf_work_orders w on w.id=c.work_order_id where f.project_id=st.project_id and not exists(select 1 from public.bf44_statement_lines l where l.certificate_id=c.id) and (c.issued_at at time zone 'Asia/Riyadh')::date between st.period_start and st.period_end),'[]'::jsonb),
 'can_edit',public.bf44_staff(st.project_id,'costing.manage'),'can_review',public.bf44_reviewer(st.project_id,case when st.status='consultant_review' then 'consultant' else 'owner' end));
end $$;
create or replace function public.bf44_center(p_org uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 return jsonb_build_object('version',44,
 'projects',coalesce((select jsonb_agg(jsonb_build_object('id',pr.id,'name',pr.name,'owner',c.name,'provider',o.name,'contract',co.contract_number,'policy',to_jsonb(po),'can_manage',public.bf44_staff(pr.id,'contracts.manage'),'can_activate',public.bf44_reviewer(pr.id,'owner'),'can_finance',public.bf44_staff(pr.id,'costing.manage'))) from public.bf35_projects pr join public.bf_clients c on c.id=pr.client_id join public.bf_organizations o on o.id=pr.organization_id left join public.bf_contracts co on co.id=pr.contract_id left join public.bf44_policies po on po.project_id=pr.id where (p_org is null or pr.organization_id=p_org) and (public.bf44_view(pr.id) or exists(select 1 from public.bf35_project_sites ps where ps.project_id=pr.id and public.bf44_view(pr.id,ps.site_id)))),'[]'::jsonb),
 'work_orders',coalesce((select jsonb_agg(to_jsonb(x)) from (select w.id,w.work_order_number,w.title,w.status,w.project_id,f.revision,a.name_ar,a.name_en,a.serial_number,s.name site_name,c.certificate_number,
 case when j.id is null then 'corrective' else 'preventive' end maintenance_type,st.statement_number,st.status statement_status
 from public.bf44_workflows f join public.bf_work_orders w on w.id=f.work_order_id join public.bf_assets a on a.id=w.asset_id join public.bf_sites s on s.id=w.site_id left join public.bf_ppm_jobs j on j.work_order_id=w.id
 left join public.bf44_certificates c on c.work_order_id=w.id left join public.bf44_statement_lines l on l.certificate_id=c.id left join public.bf44_statements st on st.id=l.statement_id
 where (p_org is null or w.organization_id=p_org) and public.bf44_view(f.project_id,w.site_id) order by w.created_at desc limit 200)x),'[]'::jsonb),
 'unbound',coalesce((select jsonb_agg(to_jsonb(x)) from (select w.id,w.work_order_number,pr.id project_id,pr.name project_name from public.bf_work_orders w join public.bf35_projects pr on pr.contract_id=w.contract_id and pr.organization_id=w.organization_id and pr.client_id=w.client_id join public.bf44_policies po on po.project_id=pr.id and po.status='active' where (p_org is null or w.organization_id=p_org) and w.asset_id is not null and w.status not in('closed','cancelled') and not exists(select 1 from public.bf44_workflows where work_order_id=w.id) and exists(select 1 from public.bf35_project_sites where project_id=pr.id and site_id=w.site_id) and public.bf44_staff(pr.id,'corrective.manage',w.site_id) order by w.created_at desc limit 200)x),'[]'::jsonb),
 'assets',coalesce((select jsonb_agg(to_jsonb(x)) from (select a.id,a.asset_tag,a.name_ar,a.name_en,a.serial_number,pr.id project_id from public.bf_assets a join public.bf35_project_sites ps on ps.site_id=a.site_id and ps.organization_id=a.organization_id and ps.client_id=a.client_id join public.bf35_projects pr on pr.id=ps.project_id join public.bf44_policies po on po.project_id=pr.id and po.status='active' where a.status='active' and (p_org is null or a.organization_id=p_org) and (public.bf44_staff(pr.id,'corrective.request',a.site_id) or public.bf44_reviewer(pr.id,'owner')) order by a.asset_tag limit 500)x),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(x)) from (select r.id,r.project_id,r.request_number,r.title,r.status,public.bf44_staff(r.project_id,'corrective.manage',r.site_id) can_convert from public.bf_service_requests r where r.project_id is not null and (p_org is null or r.organization_id=p_org) and public.bf44_view(r.project_id,r.site_id) order by r.reported_at desc limit 200)x),'[]'::jsonb),
 'statements',coalesce((select jsonb_agg(to_jsonb(x)) from (select st.id,st.project_id,st.statement_number,st.period_start,st.period_end,st.status from public.bf44_statements st join public.bf35_projects pr on pr.id=st.project_id where (p_org is null or pr.organization_id=p_org) and (public.bf44_staff(pr.id,'costing.manage') or public.bf44_reviewer(pr.id,'owner') or public.bf44_reviewer(pr.id,'consultant')) order by st.created_at desc limit 200)x),'[]'::jsonb));
end $$;

create or replace function public.bf44_ppm_scope_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare jid uuid;j public.bf_ppm_jobs;f public.bf44_workflows;
begin
 if tg_table_name='bf_ppm_results' then
  select * into j from public.bf_ppm_jobs where id=new.job_id;
 else j:=new;
  if old.work_order_id is not null and new.work_order_id is distinct from old.work_order_id then raise exception 'PPM work order link is immutable';end if;
 end if;
 select * into f from public.bf44_workflows where work_order_id=j.work_order_id;
 if f.work_order_id is not null then
  if not(public.bf44_staff(f.project_id,'ppm.manage',j.site_id) or public.bf44_staff(f.project_id,'ppm.approve',j.site_id)
   or(public.bf44_staff(f.project_id,'ppm.execute',j.site_id) and j.assigned_to=auth.uid())
   or(tg_table_name='bf_ppm_jobs' and j.status='closed' and public.bf44_reviewer(f.project_id,'owner')))
  then raise exception 'PPM project execution permission required' using errcode='42501';end if;
 end if;return new;
end $$;
drop trigger if exists bf44_ppm_scope_guard on public.bf_ppm_jobs;
create trigger bf44_ppm_scope_guard before update on public.bf_ppm_jobs for each row execute function public.bf44_ppm_scope_guard();
drop trigger if exists bf44_ppm_result_scope_guard on public.bf_ppm_results;
create trigger bf44_ppm_result_scope_guard before insert or update on public.bf_ppm_results for each row execute function public.bf44_ppm_scope_guard();
create or replace function public.bf44_assignment_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare f public.bf44_workflows;w public.bf_work_orders;
begin
 select * into f from public.bf44_workflows where work_order_id=new.work_order_id;
 if f.work_order_id is not null then
  select * into w from public.bf_work_orders where id=new.work_order_id;
  if not(public.bf44_user_can(new.user_id,f.project_id,'corrective.execute',w.site_id) or public.bf44_user_can(new.user_id,f.project_id,'ppm.execute',w.site_id)) then raise exception 'Technician lacks execution permission in this project/site';end if;
 end if;return new;
end $$;
drop trigger if exists bf44_assignment_guard on public.bf_work_order_assignments;
create trigger bf44_assignment_guard before insert or update on public.bf_work_order_assignments for each row execute function public.bf44_assignment_guard();
create or replace function public.bf44_legacy_stock_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.bf44_workflows where work_order_id=new.work_order_id) then raise exception 'Use the unified material request ledger for integrated work orders';end if;return new;
end $$;
drop trigger if exists bf44_legacy_stock_guard on public.bf_inv_requests;
create trigger bf44_legacy_stock_guard before insert on public.bf_inv_requests for each row execute function public.bf44_legacy_stock_guard();
create or replace function public.bf44_statement_immutable()
returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='approved' then raise exception 'Approved statements and their snapshots are immutable';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
drop trigger if exists bf44_statement_immutable on public.bf44_statements;
create trigger bf44_statement_immutable before update or delete on public.bf44_statements for each row execute function public.bf44_statement_immutable();
create or replace function public.bf44_line_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare sid uuid;st public.bf44_statements;
begin
 sid:=case when tg_op='DELETE' then old.statement_id else new.statement_id end;
 select * into st from public.bf44_statements where id=sid for update;
 if st.status not in('draft','rejected') then raise exception 'Submitted statement lines are immutable';end if;
 if tg_op='UPDATE' and (new.statement_id<>old.statement_id or new.certificate_id<>old.certificate_id) then raise exception 'Certified statement line identity is immutable';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
drop trigger if exists bf44_line_guard on public.bf44_statement_lines;
create trigger bf44_line_guard before insert or update or delete on public.bf44_statement_lines for each row execute function public.bf44_line_guard();

-- New tables are read-only through RLS; mutations only through the checked RPCs.
do $$ declare t text;
begin
 foreach t in array array['bf44_policies','bf44_workflows','bf44_review_links','bf44_certificates','bf44_statements','bf44_statement_lines','bf44_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
drop policy if exists bf44_policy_read on public.bf44_policies;
create policy bf44_policy_read on public.bf44_policies for select to authenticated using(public.bf44_view(project_id));
drop policy if exists bf44_workflow_read on public.bf44_workflows;
create policy bf44_workflow_read on public.bf44_workflows for select to authenticated using(public.bf44_view(project_id,(select site_id from public.bf_work_orders where id=work_order_id)));
drop policy if exists bf44_review_read on public.bf44_review_links;
create policy bf44_review_read on public.bf44_review_links for select to authenticated using(exists(select 1 from public.bf44_workflows f where f.work_order_id=bf44_review_links.work_order_id));
drop policy if exists bf44_certificate_read on public.bf44_certificates;
create policy bf44_certificate_read on public.bf44_certificates for select to authenticated using(exists(select 1 from public.bf44_workflows f where f.work_order_id=bf44_certificates.work_order_id));
drop policy if exists bf44_statement_read on public.bf44_statements;
create policy bf44_statement_read on public.bf44_statements for select to authenticated using(public.bf44_staff(project_id,'costing.manage') or public.bf44_reviewer(project_id,'owner') or public.bf44_reviewer(project_id,'consultant'));
drop policy if exists bf44_line_read on public.bf44_statement_lines;
create policy bf44_line_read on public.bf44_statement_lines for select to authenticated using(exists(select 1 from public.bf44_statements s where s.id=statement_id));
drop policy if exists bf44_event_read on public.bf44_events;
create policy bf44_event_read on public.bf44_events for select to authenticated using(public.bf44_view(project_id,(select site_id from public.bf_work_orders where id=work_order_id)));
-- Revoke default PUBLIC execution, including internal helpers and trigger functions.
do $$ declare f record;
begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'bf44\_%' escape '\' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
grant execute on function public.bf44_staff(uuid,text,uuid),public.bf44_reviewer(uuid,text),public.bf44_view(uuid,uuid) to authenticated;
grant execute on function public.bf44_approval_action(text,uuid,jsonb) to authenticated;
grant execute on function public.bf44_policy_save(uuid,uuid,uuid,text),public.bf44_policy_activate(uuid),public.bf44_enroll(uuid,uuid),public.bf44_report_fault(uuid,uuid,text,text,text),public.bf44_convert_request(uuid),public.bf44_assign_ppm(uuid,uuid,uuid),public.bf44_closeout_action(uuid,text),public.bf44_statement_action(text,uuid,jsonb),public.bf44_dossier(uuid),public.bf44_lookup_reviewer(uuid,text,text),public.bf44_statement_read(uuid),public.bf44_center(uuid) to authenticated;
revoke all on sequence public.bf44_certificate_seq,public.bf44_statement_seq from public,anon,authenticated;
commit;
