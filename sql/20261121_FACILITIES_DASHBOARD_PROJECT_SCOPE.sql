create function public.bf_fac_dashboard_projects(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); starts date:=date_trunc('month',now() at time zone 'Asia/Riyadh')::date;
 finish date:=(starts+interval '1 month')::date;
 result jsonb;
begin
 if actor is null or not exists(
  select 1 from public.bf_acl_user_organizations m join public.bf_profiles u on u.id=m.user_id and u.status='active'
  join public.bf_organizations o on o.id=m.organization_id and o.status='active'
  where m.user_id=actor and m.organization_id=p_org and m.is_active
 ) then return '{}'::jsonb; end if;
 with scope as materialized (
  select distinct p.id project_id, p.client_id, ps.site_id,
   public.bf44_staff(p.id,'corrective.view',ps.site_id) corrective,
   public.bf44_staff(p.id,'ppm.view',ps.site_id) ppm,
   public.bf44_staff(p.id,'facilities.assets.view',ps.site_id) assets
  from public.bf_acl_user_projects m
  join public.bf35_projects p on p.id=m.project_id and p.organization_id=m.organization_id
  join public.bf35_project_sites ps on ps.project_id=p.id and ps.organization_id=p.organization_id and ps.client_id=p.client_id
  where m.user_id=actor and m.organization_id=p_org and m.is_active
   and m.module_code in ('shared','facilities')
   and (m.site_id is null or m.site_id=ps.site_id)
   and (m.valid_from is null or m.valid_from<=current_date)
   and (m.valid_until is null or m.valid_until>=current_date)
 ), work as materialized (
  select w.id,w.work_order_number,w.title,w.priority,w.status,w.asset_id,w.completion_due_at,w.created_at,w.sla_status
  from public.bf_work_orders w
  left join public.bf44_workflows f on f.work_order_id=w.id
  where w.organization_id=p_org and exists(
   select 1 from scope sc where sc.corrective and sc.project_id=coalesce(w.project_id,f.project_id)
     and sc.site_id=w.site_id and sc.client_id=w.client_id)
 ), recent as (
  select * from work order by created_at desc,id limit 8
 ), visits as (
  select j.status from public.bf_ppm_jobs j join public.bf_ppm_plans plan on plan.id=j.plan_id and plan.organization_id=p_org
  left join public.bf_work_orders w on w.id=j.work_order_id and w.organization_id=p_org
  where j.organization_id=p_org and j.due_date>=starts and j.due_date<finish
    and exists(select 1 from scope sc where sc.ppm and sc.project_id=coalesce(w.project_id,plan.project_id)
      and sc.site_id=j.site_id and sc.client_id=j.client_id)
 ), scoped_assets as (
  select a.id,a.asset_tag,a.name_ar,a.name_en,a.serial_number,a.status
  from public.bf_assets a where a.organization_id=p_org
   and exists(select 1 from scope sc where sc.assets and sc.site_id=a.site_id and sc.client_id=a.client_id)
 )
 select jsonb_build_object(
  'counts',coalesce((select jsonb_build_object(
   'active',count(*) filter(where status not in ('closed','cancelled')),
   'execution',count(*) filter(where status in ('in_progress','on_hold')),
   'review',count(*) filter(where status='completed'),
   'closeout',count(*) filter(where status='approved'),
   'closed',count(*) filter(where status='closed'),
   'assignment',count(*) filter(where status in ('draft','assigned','accepted')),
   'overdue',count(*) filter(where status not in ('closed','cancelled') and sla_status='breached')
  ) from work having exists(select 1 from scope where corrective)),'{}'::jsonb)
  ||coalesce((select jsonb_build_object('ppmTotal',count(*) filter(where status<>'cancelled'),
    'ppmDone',count(*) filter(where status in ('completed','approved','closed')))
   from visits having exists(select 1 from scope where ppm)),'{}'::jsonb)
  ||coalesce((select jsonb_build_object('assets',count(*) filter(where status='active'))
   from scoped_assets having exists(select 1 from scope where assets)),'{}'::jsonb),
  'rows',coalesce((select jsonb_agg(to_jsonb(r)-'sla_status' order by r.created_at desc,r.id) from recent r),'[]'::jsonb),
  'assets',coalesce((select jsonb_object_agg(a.id,to_jsonb(a)-'status') from scoped_assets a
      where exists(select 1 from recent r where r.asset_id=a.id)),'{}'::jsonb)
 ) into result;
 return result;
end
$$;
revoke all on function public.bf_fac_dashboard_projects(uuid) from public,anon;
grant execute on function public.bf_fac_dashboard_projects(uuid) to authenticated;
