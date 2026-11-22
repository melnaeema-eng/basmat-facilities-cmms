begin;

create or replace function private.bf12_ppm_setup_items()
returns table(notification_key text, organization_id uuid, client_id uuid, kind text,
  severity text, title text, body text, occurred_at timestamptz, action_url text)
language sql stable security definer set search_path='' as $$
  with actor as (
    select id from public.bf_profiles where id=auth.uid() and status='active'
  ), procedures as (
    select p.*,
      case
        when p.status='draft' and step.present then 'ppm_procedure_approve'
        when p.status='draft' and p.created_by=u.id then 'ppm_add_steps'
        when p.status='approved' and p.created_by=u.id and not exists(
          select 1 from public.bf_ppm_plans pl
          where pl.procedure_id=p.id and pl.organization_id=p.organization_id and pl.status<>'archived'
        ) then 'ppm_create_plan'
      end as stage
    from actor u cross join public.bf_ppm_procedures p
    cross join lateral (select exists(
      select 1 from public.bf_ppm_steps s where s.procedure_id=p.id
    ) as present) step
    where p.status in ('draft','approved')
      and p.master_template_id is null
      and (p.status='draft' or p.created_by=u.id)
      and public.bf5_can(p.organization_id,'ppm.view')
      and public.bf5_can(p.organization_id,'ppm.manage')
  ), plans as (
    select pl.*, a.asset_tag,
      case when pl.status='draft' then 'ppm_activate_plan' else 'ppm_generate_schedule' end as stage
    from actor u cross join public.bf_ppm_plans pl
    join public.bf_assets a on a.id=pl.asset_id and a.organization_id=pl.organization_id and a.status='active'
    join public.bf_ppm_procedures p on p.id=pl.procedure_id and p.organization_id=pl.organization_id and p.status='approved'
    where (pl.status='draft' or pl.status='active' and not exists(
      select 1 from public.bf_ppm_jobs j where j.plan_id=pl.id
    ))
      and public.bf5_can(pl.organization_id,'ppm.view')
      and public.bf5_can(pl.organization_id,'ppm.manage')
      and (pl.project_id is null and pl.created_by=u.id or
        pl.project_id is not null and public.bf44_staff(pl.project_id,'ppm.manage',pl.site_id))
  )
  select 'ppm-setup:procedure:'||p.id||':'||p.stage, p.organization_id,null::uuid,p.stage,'normal',
    p.code||' — '||coalesce(nullif(p.name_ar,''),p.name_en,p.code),''::text,
    coalesce(ev.occurred_at,p.created_at),
    case when p.stage='ppm_create_plan' then '/ppm?tab=plans' else '/ppm/procedure/'||p.id end
  from procedures p
  left join lateral (
    select max(e.created_at) as occurred_at
    from public.bf_ppm_events e where e.organization_id=p.organization_id
      and e.entity_type='procedure' and e.entity_id=p.id
      and e.action=case p.stage when 'ppm_create_plan' then 'approve' when 'ppm_procedure_approve' then 'add_step' else 'create' end
  ) ev on true
  where p.stage is not null
  union all
  select 'ppm-setup:plan:'||pl.id||':'||pl.stage, pl.organization_id, pl.client_id, pl.stage,'normal',
    pl.code||' — '||pl.asset_tag,''::text,coalesce(ev.occurred_at,pl.created_at),'/ppm/plan/'||pl.id
  from plans pl
  left join lateral (
    select max(e.created_at) as occurred_at
    from public.bf_ppm_events e where e.organization_id=pl.organization_id
      and e.entity_type='plan' and e.entity_id=pl.id and e.action='activate'
      and pl.stage='ppm_generate_schedule'
  ) ev on true;
$$;
revoke all on function private.bf12_ppm_setup_items() from public,anon,authenticated;

create or replace function private.bf12_next_action_items()
returns table(notification_key text,organization_id uuid,client_id uuid,kind text,severity text,
  title text,body text,occurred_at timestamptz,action_url text)
language sql stable security definer set search_path='' as $$
  select * from private.bf12_next_action_before_spare_parts()
  union all
  select 'spare-review:'||r.id,w.organization_id,w.client_id,'spare_review','high',
    w.work_order_number||' — '||r.number,'',r.created_at,'/corrective/work_order/'||w.id
  from public.bf8_material_requests r
  join public.bf_work_orders w on w.id=r.work_order_id
  left join public.bf44_workflows f on f.work_order_id=w.id
  where r.status='submitted' and r.created_by<>auth.uid()
    and w.status in ('accepted','in_progress','on_hold') and f.report_id is null
    and exists(select 1 from public.bf8_material_lines l where l.request_id=r.id)
    and private.bf_spare_can_review(w,f.project_id)
  union all
  select 'spare-purchase:'||q.id,q.organization_id,w.client_id,'spare_purchase','high',
    q.number||' — '||w.work_order_number,'',q.created_at,'/procurement/requisition/'||q.id
  from public.bf_spare_purchase_links link
  join public.bf7_requisitions q on q.id=link.requisition_id
  join public.bf_work_orders w on w.id=q.work_order_id
  where q.status='submitted' and q.created_by<>auth.uid()
    and public.bf7_can(q.organization_id,'procurement.view')
    and (public.bf7_can(q.organization_id,'procurement.manage') or public.bf7_can(q.organization_id,'procurement.approve'))
  union all
  select * from private.bf12_ppm_setup_items();
$$;
revoke all on function private.bf12_next_action_items() from public,anon,authenticated;

commit;
