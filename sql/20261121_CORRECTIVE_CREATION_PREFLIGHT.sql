create or replace function public.bf44_corrective_creation_status(
  p_org uuid, p_owner uuid, p_site uuid, p_contract uuid default null
)
returns text
language plpgsql stable security definer set search_path=''
as $$
declare projects uuid[];
begin
  if not exists(select 1 from public.bf_profiles where id=auth.uid() and status='active')
     or not coalesce(public.bf4_staff(p_org,'corrective.manage'),false) then
    return 'organization_access';
  end if;

  if not exists(select 1 from public.bf_sites
    where id=p_site and organization_id=p_org and client_id=p_owner and status='active') then
    return 'invalid_site';
  end if;

  if p_contract is null then return 'allowed'; end if;
  if not exists(select 1 from public.bf_contracts
    where id=p_contract and organization_id=p_org and client_id=p_owner) then
    return 'invalid_contract';
  end if;

  select array_agg(p.project_id) into projects
  from public.bf44_policies p
  join public.bf35_project_sites ps on ps.project_id=p.project_id
  where p.status='active' and p.contract_id=p_contract
    and ps.site_id=p_site and ps.organization_id=p_org and ps.client_id=p_owner;

  if cardinality(projects)>1 then return 'ambiguous_project'; end if;
  if cardinality(projects)=1 then
    if not (public.bf44_staff(projects[1],'corrective.manage',p_site)
      or public.bf44_staff(projects[1],'ppm.manage',p_site)) then
      return 'project_access';
    end if;
    return 'asset_required';
  end if;
  return 'allowed';
end;
$$;
revoke all on function public.bf44_corrective_creation_status(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.bf44_corrective_creation_status(uuid,uuid,uuid,uuid) to authenticated;
