-- BAFM Sprint R02 — Single Organization Identity
-- One active represented organization per normal user.
-- Roles/project/team/work assignments never create a second organization identity.
-- Safe migration: existing operational history is preserved.

begin;

-- ---------------------------------------------------------------------------
-- 1. Canonical user -> represented organization identity
-- ---------------------------------------------------------------------------
create table if not exists public.bf61_user_home_organizations(
  user_id uuid primary key references public.bf_profiles(id) on delete cascade,
  organization_id uuid not null references public.bf_organizations(id) on delete restrict,
  is_active boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bf61_user_home_org_org_idx
on public.bf61_user_home_organizations(organization_id,is_active);

create table if not exists public.bf61_user_org_history(
  id bigint generated always as identity primary key,
  user_id uuid not null references public.bf_profiles(id) on delete cascade,
  old_organization_id uuid references public.bf_organizations(id) on delete set null,
  new_organization_id uuid not null references public.bf_organizations(id) on delete restrict,
  action text not null check(action in('assign','transfer','repair')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  note text
);

create index if not exists bf61_user_org_history_user_idx
on public.bf61_user_org_history(user_id,changed_at desc);

create table if not exists public.bf61_user_org_conflicts(
  user_id uuid primary key references public.bf_profiles(id) on delete cascade,
  organization_ids uuid[] not null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

-- Build a one-time identity candidate set.
-- Primary source: organization role membership.
-- Compatibility source: the old bridge, but ONLY as an organization hint;
-- project/client/team access tables are not identity sources.
create temporary table bf61_identity_candidates(
 user_id uuid not null,
 organization_id uuid not null,
 primary key(user_id,organization_id)
) on commit drop;

insert into bf61_identity_candidates(user_id,organization_id)
select distinct user_id,organization_id
from public.bf_user_roles
where user_id is not null and organization_id is not null
on conflict do nothing;

do $$
begin
 if to_regclass('public.bf_user_org_memberships') is not null then
  execute $q$
   insert into bf61_identity_candidates(user_id,organization_id)
   select distinct user_id,organization_id
   from public.bf_user_org_memberships
   where active=true
     and source in('manual','primary','staff_directory','access:bf_user_roles')
     and user_id is not null
     and organization_id is not null
   on conflict do nothing
  $q$;
 end if;
end $$;

-- Snapshot ambiguous legacy membership before cleanup.
with ambiguous as(
  select user_id,array_agg(distinct organization_id order by organization_id) organization_ids
  from bf61_identity_candidates
  group by user_id
  having count(distinct organization_id)>1
)
insert into public.bf61_user_org_conflicts(user_id,organization_ids,detected_at,resolved_at,resolved_by)
select user_id,organization_ids,now(),null,null
from ambiguous
on conflict(user_id) do update set
 organization_ids=excluded.organization_ids,
 detected_at=excluded.detected_at,
 resolved_at=null,
 resolved_by=null;

-- Backfill only when the existing system points to exactly ONE organization.
-- Ambiguous legacy users are intentionally left unresolved for a platform admin.
with single_org as(
  select user_id,(array_agg(organization_id))[1] organization_id
  from bf61_identity_candidates
  group by user_id
  having count(*)=1
)
insert into public.bf61_user_home_organizations(user_id,organization_id,assigned_by)
select s.user_id,s.organization_id,null
from single_org s
join public.bf_profiles p on p.id=s.user_id
where p.status<>'archived'
on conflict(user_id) do nothing;

insert into public.bf61_user_org_history(
  user_id,old_organization_id,new_organization_id,action,changed_by,note
)
select h.user_id,null,h.organization_id,'repair',null,'Backfilled from one unambiguous legacy organization'
from public.bf61_user_home_organizations h
where not exists(
  select 1 from public.bf61_user_org_history x where x.user_id=h.user_id
);

-- ---------------------------------------------------------------------------
-- 2. Retire the old multi-organization auto-sync bridge behavior
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
 for r in
  select n.nspname schema_name,c.relname table_name
  from pg_trigger t
  join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where not t.tgisinternal
    and t.tgname='bf_sync_user_org_membership'
 loop
  execute format('drop trigger if exists bf_sync_user_org_membership on %I.%I',r.schema_name,r.table_name);
 end loop;
end $$;

drop function if exists public.bf_sync_user_org_membership_trigger();

do $$
begin
 if to_regclass('public.bf_user_org_memberships') is not null then
  execute 'update public.bf_user_org_memberships set active=false,updated_at=now() where active=true';
  execute $q$
   insert into public.bf_user_org_memberships(user_id,organization_id,source,active,updated_at)
   select user_id,organization_id,'primary',true,now()
   from public.bf61_user_home_organizations
   where is_active
   on conflict(user_id,organization_id,source)
   do update set active=true,updated_at=excluded.updated_at
  $q$;
 end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Remove stale active access outside the canonical represented organization
--    Work history stays untouched.
-- ---------------------------------------------------------------------------
delete from public.bf_user_roles ur
where not exists(
 select 1
 from public.bf61_user_home_organizations h
 where h.user_id=ur.user_id
   and h.is_active
   and h.organization_id=ur.organization_id
);

delete from public.bf_client_access ca
where not exists(
 select 1
 from public.bf61_user_home_organizations h
 where h.user_id=ca.user_id
   and h.is_active
   and h.organization_id=ca.organization_id
);

do $$
begin
 if to_regclass('public.bf11_consultant_access') is not null then
  execute $q$
   delete from public.bf11_consultant_access a
   where not exists(
    select 1
    from public.bf61_user_home_organizations h
    where h.user_id=a.user_id
      and h.is_active
      and h.organization_id=a.organization_id
   )
  $q$;
 end if;
end $$;

update public.bf34_access_scopes s
set is_active=false,updated_at=now()
where s.is_active
  and not exists(
   select 1
   from public.bf61_user_home_organizations h
   where h.user_id=s.user_id
     and h.is_active
     and h.organization_id=s.organization_id
  );

update public.bf35_team_members m
set is_active=false
where m.is_active
  and not exists(
   select 1
   from public.bf61_user_home_organizations h
   where h.user_id=m.user_id
     and h.is_active
     and h.organization_id=m.organization_id
  );

-- ---------------------------------------------------------------------------
-- 4. Canonical helpers
-- ---------------------------------------------------------------------------
create or replace function public.bf61_home_org(p_user uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path=''
as $$
 select h.organization_id
 from public.bf61_user_home_organizations h
 join public.bf_profiles p on p.id=h.user_id
 where h.user_id=p_user
   and h.is_active
   and p.status='active'
 limit 1;
$$;

create or replace function public.bf61_user_represents(p_user uuid,p_org uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select exists(
  select 1
  from public.bf61_user_home_organizations h
  join public.bf_profiles p on p.id=h.user_id
  where h.user_id=p_user
    and h.organization_id=p_org
    and h.is_active
    and p.status='active'
 );
$$;

-- Core permission check now requires the caller's represented organization.
create or replace function public.bf_can(p_org uuid,p_permission text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select public.bf_is_super_admin() or exists(
  select 1
  from public.bf61_user_home_organizations h
  join public.bf_profiles p on p.id=h.user_id
  join public.bf_user_roles ur
    on ur.user_id=h.user_id and ur.organization_id=h.organization_id
  join public.bf_roles r on r.id=ur.role_id
  join public.bf_role_permissions rp on rp.role_id=r.id
  join public.bf_permissions pm on pm.id=rp.permission_id
  where h.user_id=auth.uid()
    and h.is_active
    and h.organization_id=p_org
    and p.status='active'
    and (r.organization_id is null or r.organization_id=h.organization_id)
    and r.code not in('client_admin','client_user')
    and pm.code=p_permission
 );
$$;

create or replace function public.bf_can_read(p_org uuid,p_client uuid,p_permission text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select public.bf_can(p_org,p_permission)
 or (
  public.bf61_user_represents(auth.uid(),p_org)
  and p_permission in('clients.view','contracts.view','sites.view','locations.view','assets.view')
  and exists(
   select 1
   from public.bf_client_access ca
   join public.bf_profiles p on p.id=ca.user_id
   where ca.user_id=auth.uid()
     and ca.organization_id=p_org
     and ca.client_id=p_client
     and p.status='active'
  )
 );
$$;

create or replace function public.bf4_client(p_org uuid,p_client uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select public.bf61_user_represents(auth.uid(),p_org)
 and exists(
  select 1
  from public.bf_profiles p
  join public.bf_client_access a on a.user_id=p.id
  where p.id=auth.uid()
    and p.status='active'
    and a.organization_id=p_org
    and a.client_id=p_client
 );
$$;

create or replace function public.bf11_owner(p_org uuid,p_client uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select public.bf61_user_represents(auth.uid(),p_org)
 and exists(
  select 1
  from public.bf_profiles p
  join public.bf_client_access a on a.user_id=p.id
  where p.id=auth.uid()
    and p.status='active'
    and a.organization_id=p_org
    and a.client_id=p_client
 );
$$;

create or replace function public.bf11_consultant(p_org uuid,p_client uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select public.bf61_user_represents(auth.uid(),p_org)
 and exists(
  select 1
  from public.bf_profiles p
  join public.bf11_consultant_access a on a.user_id=p.id
  where p.id=auth.uid()
    and p.status='active'
    and a.organization_id=p_org
    and a.client_id=p_client
 );
$$;

create or replace function public.bf4_user_can(p_user uuid,p_org uuid,p_permission text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select exists(
  select 1
  from public.bf61_user_home_organizations h
  join public.bf_profiles p on p.id=h.user_id
  join public.bf_user_roles ur
    on ur.user_id=h.user_id and ur.organization_id=h.organization_id
  join public.bf_roles r on r.id=ur.role_id
  join public.bf_role_permissions rp on rp.role_id=r.id
  join public.bf_permissions pm on pm.id=rp.permission_id
  where h.user_id=p_user
    and h.is_active
    and h.organization_id=p_org
    and p.status='active'
    and (r.organization_id is null or r.organization_id=h.organization_id)
    and r.code not in('client_admin','client_user')
    and pm.code=p_permission
 );
$$;

create or replace function public.bf34_scope_match(
 p_org uuid,
 p_client uuid default null,
 p_contract uuid default null,
 p_site uuid default null,
 p_discipline text default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select public.bf_is_super_admin() or (
  public.bf61_user_represents(auth.uid(),p_org)
  and exists(
   select 1
   from public.bf34_access_scopes s
   where s.user_id=auth.uid()
     and s.organization_id=p_org
     and s.is_active
     and (s.valid_from is null or s.valid_from<=current_date)
     and (s.valid_until is null or s.valid_until>=current_date)
     and (
       s.scope_level='organization'
       or (s.scope_level='client' and s.client_id=p_client)
       or (s.scope_level='contract' and s.client_id=p_client and s.contract_id=p_contract)
       or (s.scope_level='site' and s.client_id=p_client and s.site_id=p_site)
       or (s.scope_level='discipline' and lower(s.discipline_code)=lower(p_discipline))
     )
  )
 );
$$;

create or replace function public.bf34_can(
 p_permission text,
 p_org uuid,
 p_client uuid default null,
 p_contract uuid default null,
 p_site uuid default null,
 p_discipline text default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select public.bf_is_super_admin() or (
  public.bf61_user_represents(auth.uid(),p_org)
  and exists(
   select 1
   from public.bf34_access_scopes s
   join public.bf_roles r on r.id=s.role_id
   join public.bf_role_permissions rp on rp.role_id=r.id
   join public.bf_permissions pm on pm.id=rp.permission_id
   join public.bf_profiles pr on pr.id=s.user_id
   where s.user_id=auth.uid()
     and pr.status='active'
     and s.organization_id=p_org
     and s.is_active
     and pm.code=p_permission
     and (r.organization_id is null or r.organization_id=p_org)
     and (s.valid_from is null or s.valid_from<=current_date)
     and (s.valid_until is null or s.valid_until>=current_date)
     and (
       s.scope_level='organization'
       or (s.scope_level='client' and s.client_id=p_client)
       or (s.scope_level='contract' and s.client_id=p_client and s.contract_id=p_contract)
       or (s.scope_level='site' and s.client_id=p_client and s.site_id=p_site)
       or (s.scope_level='discipline' and lower(s.discipline_code)=lower(p_discipline))
     )
  )
 );
$$;

-- ---------------------------------------------------------------------------
-- 5. Access payload sent to the frontend
-- ---------------------------------------------------------------------------
create or replace function public.bf3_my_access()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
 with home as(
  select h.organization_id as id,h.organization_id,o.name,o.name_ar,o.name_en,o.code,o.organization_type,o.logo_url
  from public.bf61_user_home_organizations h
  join public.bf_organizations o on o.id=h.organization_id
  join public.bf_profiles p on p.id=h.user_id
  where h.user_id=auth.uid() and h.is_active and p.status='active'
  limit 1
 )
 select jsonb_build_object(
  'super_admin',public.bf_is_super_admin(),
  'home_organization_id',(select organization_id from home),
  'home_organization',(select to_jsonb(home) from home),
  'roles',coalesce((
   select jsonb_agg(jsonb_build_object(
    'organization_id',ur.organization_id,
    'code',r.code,
    'permission',pm.code
   ))
   from public.bf_user_roles ur
   join public.bf_roles r on r.id=ur.role_id
   join public.bf_role_permissions rp on rp.role_id=r.id
   join public.bf_permissions pm on pm.id=rp.permission_id
   where ur.user_id=auth.uid()
     and (
      public.bf_is_super_admin()
      or ur.organization_id=(select organization_id from home)
     )
     and r.code not in('client_admin','client_user')
     and (r.organization_id is null or r.organization_id=ur.organization_id)
  ),'[]'::jsonb),
  'clients',coalesce((
   select jsonb_agg(jsonb_build_object(
    'organization_id',ca.organization_id,
    'client_id',ca.client_id,
    'role_code',ca.role_code
   ))
   from public.bf_client_access ca
   where ca.user_id=auth.uid()
     and (
      public.bf_is_super_admin()
      or ca.organization_id=(select organization_id from home)
     )
  ),'[]'::jsonb)
 );
$$;

-- ---------------------------------------------------------------------------
-- 6. Guard every future access/assignment record
-- ---------------------------------------------------------------------------
create or replace function public.bf61_membership_guard()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
 if tg_op='UPDATE' then
  if new.user_id is not distinct from old.user_id
     and new.organization_id is not distinct from old.organization_id then
   return new;
  end if;
 end if;

 if new.user_id is null or new.organization_id is null then
  return new;
 end if;

 if not public.bf61_user_represents(new.user_id,new.organization_id) then
  raise exception 'User represents another organization. Assign/transfer the user organization first.'
   using errcode='23514';
 end if;

 return new;
end $$;

drop trigger if exists bf61_user_role_org_guard on public.bf_user_roles;
create trigger bf61_user_role_org_guard
before insert or update on public.bf_user_roles
for each row execute function public.bf61_membership_guard();

drop trigger if exists bf61_client_access_org_guard on public.bf_client_access;
create trigger bf61_client_access_org_guard
before insert or update on public.bf_client_access
for each row execute function public.bf61_membership_guard();

do $$
begin
 if to_regclass('public.bf11_consultant_access') is not null then
  execute 'drop trigger if exists bf61_consultant_access_org_guard on public.bf11_consultant_access';
  execute 'create trigger bf61_consultant_access_org_guard before insert or update on public.bf11_consultant_access for each row execute function public.bf61_membership_guard()';
 end if;
end $$;

drop trigger if exists bf61_access_scope_org_guard on public.bf34_access_scopes;
create trigger bf61_access_scope_org_guard
before insert or update on public.bf34_access_scopes
for each row execute function public.bf61_membership_guard();

drop trigger if exists bf61_team_member_org_guard on public.bf35_team_members;
create trigger bf61_team_member_org_guard
before insert or update on public.bf35_team_members
for each row execute function public.bf61_membership_guard();

-- Work order assignee must belong to the same operating organization.
create or replace function public.bf61_work_order_assignee_guard()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare org_id uuid;
begin
 if tg_op='UPDATE' then
  if new.user_id is not distinct from old.user_id
     and new.work_order_id is not distinct from old.work_order_id then
   return new;
  end if;
 end if;

 select w.organization_id into org_id
 from public.bf_work_orders w
 where w.id=new.work_order_id;

 if org_id is null then raise exception 'Work order not found'; end if;

 if not public.bf61_user_represents(new.user_id,org_id) then
  raise exception 'Assignee must represent the work order organization.'
   using errcode='23514';
 end if;

 return new;
end $$;

drop trigger if exists bf61_work_order_assignee_org_guard on public.bf_work_order_assignments;
create trigger bf61_work_order_assignee_org_guard
before insert or update on public.bf_work_order_assignments
for each row execute function public.bf61_work_order_assignee_guard();

-- PPM assignee must belong to the PPM job organization when the assignee changes.
create or replace function public.bf61_ppm_assignee_guard()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
 if new.assigned_to is null then return new; end if;
 if tg_op='UPDATE' then
  if new.assigned_to is not distinct from old.assigned_to
     and new.organization_id is not distinct from old.organization_id then
   return new;
  end if;
 end if;

 if not public.bf61_user_represents(new.assigned_to,new.organization_id) then
  raise exception 'PPM assignee must represent the PPM job organization.'
   using errcode='23514';
 end if;

 return new;
end $$;

drop trigger if exists bf61_ppm_assignee_org_guard on public.bf_ppm_jobs;
create trigger bf61_ppm_assignee_org_guard
before insert or update on public.bf_ppm_jobs
for each row execute function public.bf61_ppm_assignee_guard();

-- ---------------------------------------------------------------------------
-- 7. Controlled organization assignment / transfer
-- ---------------------------------------------------------------------------
create or replace function public.bf61_set_user_organization(
 p_user uuid,
 p_org uuid,
 p_transfer boolean default false
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
 old_org uuid;
 action_name text;
begin
 if auth.uid() is null then
  raise exception 'Authentication required' using errcode='42501';
 end if;

 if not exists(select 1 from public.bf_profiles p where p.id=p_user and p.status='active') then
  raise exception 'Active user required';
 end if;

 if not exists(select 1 from public.bf_organizations o where o.id=p_org and o.status='active') then
  raise exception 'Active organization required';
 end if;

 select h.organization_id into old_org
 from public.bf61_user_home_organizations h
 where h.user_id=p_user and h.is_active
 for update;

 if old_org is not null and old_org=p_org then
  return;
 end if;

 if old_org is null then
  if not (public.bf_is_super_admin() or public.bf_can(p_org,'users.manage')) then
   raise exception 'User management permission required' using errcode='42501';
  end if;

  -- Ambiguous legacy access was already disabled during migration.
  -- Only the platform administrator may resolve a recorded conflict.
  if exists(
   select 1 from public.bf61_user_org_conflicts c
   where c.user_id=p_user and c.resolved_at is null
  ) and not public.bf_is_super_admin() then
   raise exception 'Platform administrator must resolve this user organization conflict.'
    using errcode='42501';
  end if;

  action_name:='assign';
 else
  if not p_transfer then
   raise exception 'User already represents another organization. Confirm transfer first.'
    using errcode='23514';
  end if;
  if not public.bf_is_super_admin() then
   raise exception 'Only the platform administrator can transfer a user between organizations.'
    using errcode='42501';
  end if;
  action_name:='transfer';
 end if;

 -- Disable/delete old authorization only. Historical work records are not deleted.
 delete from public.bf_user_roles
 where user_id=p_user and organization_id<>p_org;

 delete from public.bf_client_access
 where user_id=p_user and organization_id<>p_org;

 update public.bf34_access_scopes
 set is_active=false,updated_at=now()
 where user_id=p_user and organization_id<>p_org and is_active;

 update public.bf35_team_members
 set is_active=false
 where user_id=p_user and organization_id<>p_org and is_active;

 insert into public.bf61_user_home_organizations(
  user_id,organization_id,is_active,assigned_by,assigned_at,updated_at
 ) values(
  p_user,p_org,true,auth.uid(),now(),now()
 )
 on conflict(user_id) do update set
  organization_id=excluded.organization_id,
  is_active=true,
  assigned_by=auth.uid(),
  assigned_at=now(),
  updated_at=now();

 if to_regclass('public.bf_user_org_memberships') is not null then
  execute 'update public.bf_user_org_memberships set active=false,updated_at=now() where user_id=$1'
   using p_user;
  execute $q$
   insert into public.bf_user_org_memberships(user_id,organization_id,source,active,updated_at)
   values($1,$2,'primary',true,now())
   on conflict(user_id,organization_id,source)
   do update set active=true,updated_at=now()
  $q$ using p_user,p_org;
 end if;

 insert into public.bf61_user_org_history(
  user_id,old_organization_id,new_organization_id,action,changed_by,note
 ) values(
  p_user,old_org,p_org,action_name,auth.uid(),
  case when old_org is null then 'Organization assigned' else 'Organization transferred' end
 );

 update public.bf61_user_org_conflicts
 set resolved_at=now(),resolved_by=auth.uid()
 where user_id=p_user and resolved_at is null;
end $$;

-- Existing role assignment now requires the user's canonical organization first.
create or replace function public.bf3_assign_role(
 p_user uuid,
 p_org uuid,
 p_role uuid,
 p_client uuid default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare r record;
begin
 if not public.bf_can(p_org,'users.manage') and not public.bf_is_super_admin() then
  raise exception 'Permission denied' using errcode='42501';
 end if;

 if not exists(select 1 from public.bf_profiles where id=p_user and status='active') then
  raise exception 'Active user required';
 end if;

 if not public.bf61_user_represents(p_user,p_org) then
  raise exception 'Assign the user to this organization before assigning roles.'
   using errcode='23514';
 end if;

 select * into r
 from public.bf_roles
 where id=p_role and (organization_id is null or organization_id=p_org);

 if not found then raise exception 'Invalid role'; end if;

 if (
  r.code='company_admin'
  or exists(
   select 1
   from public.bf_role_permissions rp
   join public.bf_permissions pm on pm.id=rp.permission_id
   where rp.role_id=r.id and pm.code in('organizations.manage','users.manage')
  )
 ) and not public.bf_is_super_admin() then
  raise exception 'Platform administrator required';
 end if;

 if r.code in('client_admin','client_user') then
  if p_client is null or not exists(
   select 1 from public.bf_clients where id=p_client and organization_id=p_org
  ) then raise exception 'Valid client required'; end if;

  insert into public.bf_client_access(user_id,organization_id,client_id,role_code)
  values(p_user,p_org,p_client,r.code)
  on conflict(user_id,organization_id,client_id)
  do update set role_code=excluded.role_code;
 else
  if p_client is not null then
   raise exception 'Staff roles cannot be assigned as client roles';
  end if;

  insert into public.bf_user_roles(user_id,organization_id,role_id)
  values(p_user,p_org,p_role)
  on conflict do nothing;
 end if;
end $$;

create or replace function public.bf61_remove_user_role(
 p_user uuid,
 p_org uuid,
 p_role uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
 if not (public.bf_is_super_admin() or public.bf_can(p_org,'users.manage')) then
  raise exception 'User management permission required' using errcode='42501';
 end if;

 if not public.bf61_user_represents(p_user,p_org) then
  raise exception 'User does not represent this organization';
 end if;

 delete from public.bf_user_roles
 where user_id=p_user and organization_id=p_org and role_id=p_role;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Directories used by assignment screens
-- ---------------------------------------------------------------------------
create or replace function public.bf4_staff_directory()
returns table(id uuid,full_name text,email text,status text,organization_id uuid)
language sql
stable
security definer
set search_path=''
as $$
 select distinct
  p.id,p.full_name::text,p.email::text,p.status::text,h.organization_id
 from public.bf61_user_home_organizations h
 join public.bf_profiles p on p.id=h.user_id
 where h.is_active
   and p.status='active'
   and public.bf4_staff(h.organization_id,'corrective.manage')
   and public.bf4_user_can(p.id,h.organization_id,'corrective.execute');
$$;

create or replace function public.bf5_staff_directory()
returns table(id uuid,full_name text,email text,organization_id uuid)
language sql
stable
security definer
set search_path=''
as $$
 select distinct
  p.id,p.full_name::text,p.email::text,h.organization_id
 from public.bf61_user_home_organizations h
 join public.bf_profiles p on p.id=h.user_id
 where h.is_active
   and p.status='active'
   and public.bf5_can(h.organization_id,'ppm.manage')
   and public.bf4_user_can(p.id,h.organization_id,'ppm.execute');
$$;

create or replace function public.bf_team_user_directory(p_org uuid default null)
returns setof jsonb
language sql
stable
security definer
set search_path=''
as $$
 select jsonb_build_object(
  'id',p.id,
  'user_id',p.id,
  'organization_id',h.organization_id,
  'full_name',p.full_name,
  'email',p.email,
  'status',p.status
 )
 from public.bf61_user_home_organizations h
 join public.bf_profiles p on p.id=h.user_id
 where h.is_active
   and p.status='active'
   and (p_org is null or h.organization_id=p_org)
   and (
    public.bf_is_super_admin()
    or public.bf35_can_view(h.organization_id)
   )
 order by p.full_name,p.email;
$$;

-- Access review directory must not enumerate staff from unrelated organizations.
create or replace function public.bf39_directory(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare result jsonb;
begin
 if not public.bf39_can_view(p_org)
 then raise exception 'Access review view permission required' using errcode='42501'; end if;

 select jsonb_build_object(
   'users',coalesce((
     select jsonb_agg(jsonb_build_object(
       'id',p.id,
       'full_name',p.full_name,
       'email',p.email,
       'status',p.status
     ) order by p.full_name,p.email)
     from public.bf61_user_home_organizations h
     join public.bf_profiles p on p.id=h.user_id
     where h.organization_id=p_org and h.is_active and p.status='active'
   ),'[]'::jsonb),
   'roles',coalesce((
     select jsonb_agg(jsonb_build_object(
       'id',r.id,
       'name',r.name,
       'code',r.code,
       'organization_id',r.organization_id,
       'is_system',r.is_system
     ) order by r.name)
     from public.bf_roles r
     where r.organization_id is null or r.organization_id=p_org
   ),'[]'::jsonb),
   'scopes',coalesce((
     select jsonb_agg(jsonb_build_object(
       'id',s.id,
       'user_id',s.user_id,
       'user_name',p.full_name,
       'role_id',s.role_id,
       'role_code',r.code,
       'scope_level',s.scope_level,
       'client_id',s.client_id,
       'contract_id',s.contract_id,
       'site_id',s.site_id,
       'discipline_code',s.discipline_code,
       'is_active',s.is_active,
       'valid_from',s.valid_from,
       'valid_until',s.valid_until
     ) order by p.full_name,r.name)
     from public.bf34_access_scopes s
     join public.bf_profiles p on p.id=s.user_id
     join public.bf_roles r on r.id=s.role_id
     where s.organization_id=p_org
   ),'[]'::jsonb)
 ) into result;

 return result;
end $$;

-- User/access administration directory.
create or replace function public.bf61_users_directory(p_org uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
 actor_home uuid:=public.bf61_home_org(auth.uid());
 target uuid:=p_org;
 result jsonb;
begin
 if auth.uid() is null then
  raise exception 'Authentication required' using errcode='42501';
 end if;

 if not public.bf_is_super_admin() then
  if actor_home is null then
   raise exception 'No organization is assigned to this user' using errcode='42501';
  end if;
  if target is not null and target<>actor_home then
   raise exception 'Cross-organization directory access denied' using errcode='42501';
  end if;
  target:=actor_home;
  if not (public.bf_can(target,'users.view') or public.bf_can(target,'users.manage')) then
   raise exception 'User directory permission required' using errcode='42501';
  end if;
 end if;

 select jsonb_build_object(
  'organizations',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',o.id,'name',o.name,'name_ar',o.name_ar,'name_en',o.name_en,
    'code',o.code,'organization_type',o.organization_type,'status',o.status
   ) order by o.name)
   from public.bf_organizations o
   where o.status='active'
     and (public.bf_is_super_admin() or o.id=target)
  ),'[]'::jsonb),

  'roles',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',r.id,'name',r.name,'code',r.code,
    'organization_id',r.organization_id,'is_system',r.is_system
   ) order by r.name)
   from public.bf_roles r
   where public.bf_is_super_admin()
      or r.organization_id is null
      or r.organization_id=target
  ),'[]'::jsonb),

  'users',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',p.id,
    'full_name',p.full_name,
    'email',p.email,
    'status',p.status,
    'organization_id',h.organization_id,
    'organization_name',o.name,
    'organization_code',o.code,
    'roles',coalesce((
      select jsonb_agg(jsonb_build_object(
       'id',r.id,'name',r.name,'code',r.code
      ) order by r.name)
      from public.bf_user_roles ur
      join public.bf_roles r on r.id=ur.role_id
      where ur.user_id=p.id
        and ur.organization_id=h.organization_id
    ),'[]'::jsonb)
   ) order by coalesce(o.name,''),coalesce(p.full_name,p.email))
   from public.bf_profiles p
   left join public.bf61_user_home_organizations h
     on h.user_id=p.id and h.is_active
   left join public.bf_organizations o on o.id=h.organization_id
   where p.status<>'archived'
     and (
      public.bf_is_super_admin() and target is null
      or h.organization_id=target
     )
  ),'[]'::jsonb),

  'conflicts',coalesce((
   select jsonb_agg(jsonb_build_object(
    'user_id',c.user_id,
    'organization_ids',c.organization_ids
   ))
   from public.bf61_user_org_conflicts c
   where public.bf_is_super_admin() and c.resolved_at is null
  ),'[]'::jsonb)
 ) into result;

 return result;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Profiles and home-organization RLS
-- ---------------------------------------------------------------------------
alter table public.bf61_user_home_organizations enable row level security;
alter table public.bf61_user_org_history enable row level security;
alter table public.bf61_user_org_conflicts enable row level security;

revoke all on public.bf61_user_home_organizations,public.bf61_user_org_history,public.bf61_user_org_conflicts
from public,anon,authenticated;
grant select on public.bf61_user_home_organizations,public.bf61_user_org_history,public.bf61_user_org_conflicts
to authenticated;

drop policy if exists bf61_user_home_read on public.bf61_user_home_organizations;
create policy bf61_user_home_read
on public.bf61_user_home_organizations
for select to authenticated
using(
 user_id=auth.uid()
 or public.bf_is_super_admin()
 or public.bf_can(organization_id,'users.view')
 or public.bf_can(organization_id,'users.manage')
);

drop policy if exists bf61_user_org_history_read on public.bf61_user_org_history;
create policy bf61_user_org_history_read
on public.bf61_user_org_history
for select to authenticated
using(
 user_id=auth.uid()
 or public.bf_is_super_admin()
 or (old_organization_id is not null and public.bf_can(old_organization_id,'users.view'))
 or public.bf_can(new_organization_id,'users.view')
);

drop policy if exists bf61_user_org_conflicts_read on public.bf61_user_org_conflicts;
create policy bf61_user_org_conflicts_read
on public.bf61_user_org_conflicts
for select to authenticated
using(public.bf_is_super_admin() or user_id=auth.uid());

drop policy if exists bf3_profile_r on public.bf_profiles;
drop policy if exists bf_s2_profiles_select on public.bf_profiles;
drop policy if exists bf61_profile_read on public.bf_profiles;

create policy bf61_profile_read
on public.bf_profiles
for select to authenticated
using(
 id=auth.uid()
 or public.bf_is_super_admin()
 or exists(
  select 1
  from public.bf61_user_home_organizations h
  where h.user_id=bf_profiles.id
    and h.is_active
    and (
     public.bf_can(h.organization_id,'users.view')
     or public.bf_can(h.organization_id,'users.manage')
    )
 )
);

-- ---------------------------------------------------------------------------
-- 10. API privileges
-- ---------------------------------------------------------------------------
revoke all on function public.bf61_home_org(uuid) from public,anon;
revoke all on function public.bf61_user_represents(uuid,uuid) from public,anon;
revoke all on function public.bf61_set_user_organization(uuid,uuid,boolean) from public,anon;
revoke all on function public.bf61_remove_user_role(uuid,uuid,uuid) from public,anon;
revoke all on function public.bf61_users_directory(uuid) from public,anon;

grant execute on function public.bf61_home_org(uuid) to authenticated;
grant execute on function public.bf61_user_represents(uuid,uuid) to authenticated;
grant execute on function public.bf61_set_user_organization(uuid,uuid,boolean) to authenticated;
grant execute on function public.bf61_remove_user_role(uuid,uuid,uuid) to authenticated;
grant execute on function public.bf61_users_directory(uuid) to authenticated;

revoke all on function public.bf3_my_access() from public,anon;
grant execute on function public.bf3_my_access() to authenticated;

revoke all on function public.bf3_assign_role(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.bf3_assign_role(uuid,uuid,uuid,uuid) to authenticated;

revoke all on function public.bf4_staff_directory() from public,anon;
grant execute on function public.bf4_staff_directory() to authenticated;

revoke all on function public.bf5_staff_directory() from public,anon;
grant execute on function public.bf5_staff_directory() to authenticated;

revoke all on function public.bf_team_user_directory(uuid) from public,anon;
grant execute on function public.bf_team_user_directory(uuid) to authenticated;

revoke all on function public.bf39_directory(uuid) from public,anon;
grant execute on function public.bf39_directory(uuid) to authenticated;

-- Keep the legacy bridge read-only and single-active for compatibility.
do $$
begin
 if to_regclass('public.bf_user_org_memberships') is not null then
  execute 'alter table public.bf_user_org_memberships enable row level security';
  execute 'revoke insert,update,delete on public.bf_user_org_memberships from anon,authenticated';
  execute 'create unique index if not exists bf61_legacy_one_active_org_per_user on public.bf_user_org_memberships(user_id) where active';
 end if;
end $$;

-- Transactional verification: any violation rolls back the whole sprint.
do $$
begin
 if exists(
  select 1
  from public.bf_user_roles ur
  where not exists(
   select 1 from public.bf61_user_home_organizations h
   where h.user_id=ur.user_id and h.is_active and h.organization_id=ur.organization_id
  )
 ) then
  raise exception 'R02 verification failed: user role without matching represented organization remains';
 end if;

 if exists(
  select 1
  from public.bf_client_access ca
  where not exists(
   select 1 from public.bf61_user_home_organizations h
   where h.user_id=ca.user_id and h.is_active and h.organization_id=ca.organization_id
  )
 ) then
  raise exception 'R02 verification failed: client access without matching represented organization remains';
 end if;

 if to_regclass('public.bf11_consultant_access') is not null then
  if exists(
   select 1
   from public.bf11_consultant_access ca
   where not exists(
    select 1 from public.bf61_user_home_organizations h
    where h.user_id=ca.user_id and h.is_active and h.organization_id=ca.organization_id
   )
  ) then
   raise exception 'R02 verification failed: consultant access without matching represented organization remains';
  end if;
 end if;

 if exists(
  select 1
  from public.bf34_access_scopes s
  where s.is_active
    and not exists(
     select 1 from public.bf61_user_home_organizations h
     where h.user_id=s.user_id and h.is_active and h.organization_id=s.organization_id
    )
 ) then
  raise exception 'R02 verification failed: active scope without matching represented organization remains';
 end if;

 if exists(
  select 1
  from public.bf35_team_members m
  where m.is_active
    and not exists(
     select 1 from public.bf61_user_home_organizations h
     where h.user_id=m.user_id and h.is_active and h.organization_id=m.organization_id
    )
 ) then
  raise exception 'R02 verification failed: active team membership without matching represented organization remains';
 end if;

 if to_regprocedure('public.bf61_set_user_organization(uuid,uuid,boolean)') is null
    or to_regprocedure('public.bf61_users_directory(uuid)') is null
    or to_regprocedure('public.bf61_home_org(uuid)') is null then
  raise exception 'R02 verification failed: required functions are missing';
 end if;
end $$;

commit;

notify pgrst,'reload schema';
