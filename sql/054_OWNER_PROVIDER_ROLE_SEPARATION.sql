-- Owner/provider separation. Additive only: existing business rows are never rewritten.
-- Exact recorded name aliases and registration numbers identify conflicts; no fuzzy merge.
create table if not exists private.bf54_party_role_claims (
 identity_key text primary key,
 party_role text not null check (party_role in ('owner','provider'))
);
alter table private.bf54_party_role_claims enable row level security;
revoke all on private.bf54_party_role_claims from public,anon,authenticated;

create or replace function private.bf54_party_keys(v jsonb, record_key text default null)
returns text[] language sql immutable set search_path=''
as $$
 select coalesce(array_agg(distinct k order by k),'{}'::text[]) from (
  select record_key k where nullif(record_key,'') is not null
  union all
  select 'name:'||lower(regexp_replace(btrim(n),'[[:space:]]+',' ','g'))
  from unnest(array[v->>'name',v->>'name_ar',v->>'name_en']) n
  where nullif(btrim(n),'') is not null
  union all
  select 'registration:'||lower(regexp_replace(btrim(v->>'registration_no'),'[[:space:]]+','','g'))
  where nullif(btrim(v->>'registration_no'),'') is not null
 ) x
$$;
revoke all on function private.bf54_party_keys(jsonb,text) from public,anon,authenticated;

create or replace view private.bf54_recorded_party_roles as
 select 'bf_organizations'::text source,o.id,
  case when o.organization_type='owner' then 'owner' else 'provider' end party_role,
  private.bf54_party_keys(to_jsonb(o),'organization:'||o.id) identity_keys
 from public.bf_organizations o
 where o.organization_type in ('owner','maintenance_contractor','service_provider','subcontractor')
 union all
 select 'bf_organizations',o.id,'provider',private.bf54_party_keys(to_jsonb(o),'organization:'||o.id)
 from public.bf_organizations o where exists(select 1 from public.bf_contracts c where c.organization_id=o.id)
  or exists(select 1 from public.bf35_projects p where p.organization_id=o.id)
  or exists(select 1 from public.bf_med_company_tenant_links l where l.organization_id=o.id)
  or exists(select 1 from public.bf_med_project_service_companies l where l.organization_id=o.id)
  or exists(select 1 from public.bf_med_tenant_companies c where c.organization_id=o.id)
 union all
 select 'bf_organizations',o.id,'owner',private.bf54_party_keys(to_jsonb(o),'organization:'||o.id)
 from public.bf_organizations o where exists(select 1 from public.bf_med_project_service_companies l where l.owner_organization_id=o.id)
 union all
 select 'bf_clients',c.id,'owner',private.bf54_party_keys(to_jsonb(c),'owner-record:'||c.id)
 from public.bf_clients c where c.party_role='owner'
 union all
 select 'bf_med_company_library',c.id,'provider',private.bf54_party_keys(to_jsonb(c),'library:'||c.id)
 from public.bf_med_company_library c
 union all
 select 'bf_med_service_companies',c.id,'provider',private.bf54_party_keys(to_jsonb(c),'service-company:'||c.id)
 from public.bf_med_service_companies c;
revoke all on private.bf54_recorded_party_roles from public,anon,authenticated;

-- Seed only unambiguous keys. Existing conflicts remain untouched and reviewable.
insert into private.bf54_party_role_claims(identity_key,party_role)
 select k,min(party_role) from private.bf54_recorded_party_roles r
 cross join lateral unnest(r.identity_keys) k
 group by k having count(distinct party_role)=1
on conflict do nothing;

create or replace function private.bf54_claim_party(v jsonb,record_key text,requested_role text)
returns void language plpgsql security definer set search_path=''
as $$
declare k text; keys text[]; held text;
begin
 if requested_role not in ('owner','provider') or requested_role is null then
  raise exception 'Invalid party role';
 end if;
 keys:=private.bf54_party_keys(v,record_key);
 if exists(select 1 from private.bf54_recorded_party_roles r
  where r.party_role<>requested_role and r.identity_keys && keys) then
  raise exception using errcode='23514',constraint='bf54_owner_provider_separation',
   message='OWNER_PROVIDER_CONFLICT: An entity cannot be both an owner and a maintenance provider.';
 end if;
 -- Atomic claims also reject opposite-role writes in concurrent transactions.
 foreach k in array keys loop
  held:=null;
  insert into private.bf54_party_role_claims as c(identity_key,party_role)
  values(k,requested_role)
  on conflict(identity_key) do update set party_role=c.party_role
  returning party_role into held;
  if held<>requested_role then
   raise exception using errcode='23514',constraint='bf54_owner_provider_separation',
    message='OWNER_PROVIDER_CONFLICT: An entity cannot be both an owner and a maintenance provider.';
  end if;
 end loop;
end $$;
revoke all on function private.bf54_claim_party(jsonb,text,text) from public,anon,authenticated;

create or replace function private.bf54_role_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v jsonb:=to_jsonb(new); previous jsonb; role_name text; fields text[];
 org_row jsonb; owner_row jsonb; company_row jsonb;
begin
 case tg_table_name
  when 'bf_organizations' then fields:=array['name','name_ar','name_en','registration_no','organization_type'];
  when 'bf_clients' then fields:=array['name','party_role'];
  when 'bf_med_company_library' then fields:=array['name_ar','name_en','registration_no','company_type'];
  when 'bf_med_service_companies' then fields:=array['name_ar','name_en','company_type'];
  when 'bf_med_company_tenant_links' then fields:=array['library_company_id','organization_id','status'];
  when 'bf_med_project_service_companies' then fields:=array['organization_id','project_id','company_id','owner_organization_id','status'];
  when 'bf_med_tenant_companies' then fields:=array['organization_id','status'];
  else fields:=array['organization_id','client_id'];
 end case;
 if tg_op='UPDATE' then
  previous:=to_jsonb(old);
  if not exists(select 1 from unnest(fields) f where v->f is distinct from previous->f)
   then return new; end if;
 end if;
 if coalesce(v->>'status','active') in ('inactive','archived','cancelled','closed') then return new; end if;
 if tg_table_name='bf_organizations' then
  role_name:=case when v->>'organization_type'='owner' then 'owner'
   when v->>'organization_type' in ('maintenance_contractor','service_provider','subcontractor') then 'provider' end;
  -- Clearing/changing the type never clears existing claims.
  if role_name is not null then perform private.bf54_claim_party(v,'organization:'||new.id,role_name); end if;
 elsif tg_table_name='bf_clients' then
  if v->>'party_role'='owner' then perform private.bf54_claim_party(v,'owner-record:'||new.id,'owner'); end if;
 elsif tg_table_name in ('bf_med_company_library','bf_med_service_companies') then
  if v->>'company_type'='owner' then
   raise exception using errcode='23514',constraint='bf54_owner_provider_separation',
    message='OWNER_PROVIDER_CONFLICT: An owner cannot be added to the maintenance companies library.';
  end if;
  perform private.bf54_claim_party(v,
   (case when tg_table_name='bf_med_company_library' then 'library:' else 'service-company:' end)||new.id,'provider');
 else
  select to_jsonb(o) into org_row from public.bf_organizations o where o.id=(v->>'organization_id')::uuid;
  if org_row is not null then perform private.bf54_claim_party(org_row,'organization:'||(v->>'organization_id'),'provider'); end if;
  if tg_table_name in ('bf35_projects','bf_contracts') then
   select to_jsonb(c) into owner_row from public.bf_clients c where c.id=(v->>'client_id')::uuid;
   if owner_row is not null then
    if owner_row->>'party_role' is distinct from 'owner' then
     raise exception using errcode='23514',constraint='bf54_owner_provider_separation',message='OWNER_PROVIDER_CONFLICT: Select an owner record for this project or contract.';
    end if;
    perform private.bf54_claim_party(owner_row,'owner-record:'||(v->>'client_id'),'owner');
   end if;
  elsif tg_table_name='bf_med_company_tenant_links' then
   select to_jsonb(c) into company_row from public.bf_med_company_library c where c.id=(v->>'library_company_id')::uuid;
   if company_row is not null then perform private.bf54_claim_party(company_row,'library:'||(v->>'library_company_id'),'provider'); end if;
  elsif tg_table_name='bf_med_project_service_companies' then
   select to_jsonb(c) into company_row from public.bf_med_service_companies c where c.id=(v->>'company_id')::uuid;
   if company_row is not null then perform private.bf54_claim_party(company_row,'service-company:'||(v->>'company_id'),'provider'); end if;
   select to_jsonb(o) into owner_row from public.bf_organizations o where o.id=(v->>'owner_organization_id')::uuid;
   if owner_row is not null then perform private.bf54_claim_party(owner_row,'organization:'||(v->>'owner_organization_id'),'owner'); end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function private.bf54_role_guard() from public,anon,authenticated;

do $$ declare tbl text; begin
 foreach tbl in array array['bf_organizations','bf_clients','bf_med_company_library','bf_med_service_companies',
  'bf_med_company_tenant_links','bf_med_project_service_companies','bf_med_tenant_companies','bf_contracts','bf35_projects'] loop
  execute format('drop trigger if exists bf54_owner_provider_separation on public.%I',tbl);
  execute format('create trigger bf54_owner_provider_separation before insert or update on public.%I for each row execute function private.bf54_role_guard()',tbl);
 end loop;
end $$;
