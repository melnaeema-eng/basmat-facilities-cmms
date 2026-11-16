-- Read-only statement screen: avoid loading work orders, assets, teams and requests.
create or replace function public.bf44_statement_center(p_org uuid default null)
returns jsonb language plpgsql stable security definer
set search_path='' set join_collapse_limit=1 set from_collapse_limit=1 set jit=off
as $function$
declare result jsonb; actor uuid:=auth.uid(); registry boolean:=false;
begin
 if actor is null or not exists(select 1 from public.bf_profiles u where u.id=actor and u.status='active') then
  raise exception 'Authentication required' using errcode='42501';
 end if;
 if p_org is not null then registry:=coalesce(public.bf35_can_view(p_org),false);end if;
 with scoped as materialized (
  select pr.*,c.name owner,o.name provider,co.contract_number contract,to_jsonb(po) policy,
   case when po.owner_reviewer=actor then public.bf44_reviewer(pr.id,'owner') else false end owner_reviewer,
   case when po.consultant_reviewer=actor then public.bf44_reviewer(pr.id,'consultant') else false end consultant_reviewer
  from public.bf35_projects pr
  join public.bf_clients c on c.id=pr.client_id and c.organization_id=pr.organization_id
  join public.bf_organizations o on o.id=pr.organization_id
  left join public.bf_contracts co on co.id=pr.contract_id
  left join public.bf44_policies po on po.project_id=pr.id
  where p_org is null or pr.organization_id=p_org
 ), capabilities as materialized (
  select s.*,case when s.owner_reviewer or s.consultant_reviewer then false
   else public.bf44_staff(s.id,'costing.manage') end can_finance
  from scoped s
 ), visible as materialized (
  select s.* from capabilities s where s.can_finance or s.owner_reviewer or s.consultant_reviewer
   or registry or public.bf44_view(s.id)
   or exists(select 1 from public.bf35_project_sites ps where ps.project_id=s.id and public.bf44_view(s.id,ps.site_id))
 ), projects as materialized (
  select v.id,v.name,v.owner,v.provider,v.contract,v.policy,v.can_finance,
   v.owner_reviewer can_activate,
   case when v.can_finance and v.policy->>'status' is distinct from 'active' then public.bf44_staff(v.id,'contracts.manage') else false end can_manage,
   v.consultant_reviewer
  from visible v
 )
 select jsonb_build_object('version',1,
  'projects',coalesce((select jsonb_agg(to_jsonb(p)-'consultant_reviewer' order by p.owner,p.name,p.id) from projects p),'[]'::jsonb),
  'statements',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id) from (
   select st.id,st.project_id,st.statement_number,st.period_start,st.period_end,st.status,st.created_at
   from public.bf44_statements st join projects p on p.id=st.project_id
   where p.can_finance or p.can_activate or p.consultant_reviewer
   order by st.created_at desc,st.id limit 200
  )x),'[]'::jsonb)) into result;
 return result;
end $function$;
revoke all on function public.bf44_statement_center(uuid) from public,anon;
grant execute on function public.bf44_statement_center(uuid) to authenticated;
