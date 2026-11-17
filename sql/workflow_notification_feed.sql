CREATE OR REPLACE FUNCTION public.bf12_feed(p_unread_only boolean DEFAULT false, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET "TimeZone" TO 'UTC'
AS $function$
declare
 payload jsonb;
begin
 if auth.uid() is null or not exists(
  select 1 from public.bf_profiles where id=auth.uid() and status='active')
 then raise exception 'Authentication required' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 200
 or p_offset is null or p_offset not between 0 and 10000
 then raise exception 'Invalid pagination';end if;

 with raw as (
  select
   'approval:'||a.id::text notification_key,
   a.organization_id,a.client_id,
   case when a.status='pending' then 'approval_pending'
        when a.status='rejected' then 'approval_rejected'
        else 'approval_decided' end kind,
   case when a.status='pending' then 'high' else 'normal' end severity,
   a.subject title,
   coalesce(a.decision_comment,a.request_comment,'') body,
   coalesce(a.decided_at,a.requested_at) occurred_at,
   case when exists(select 1 from public.bf44_review_links l where l.approval_id=a.id) then '/maintenance-cycle/'||(select l.work_order_id::text from public.bf44_review_links l where l.approval_id=a.id)
    when a.entity_type='ppm_job' then '/ppm/job/'||a.entity_id::text
    else '/corrective/work_order/'||a.entity_id::text end action_url
  from public.bf11_approvals a
  where (public.bf11_can_view(a.organization_id,a.client_id)
   or exists(select 1 from public.bf44_review_links l join public.bf44_workflows f on f.work_order_id=l.work_order_id join public.bf_work_orders w on w.id=f.work_order_id where l.approval_id=a.id and l.revision=f.revision and public.bf44_view(f.project_id,w.site_id)))
   and (
    (a.status='pending' and a.requested_by<>auth.uid() and (
      exists(select 1 from public.bf44_review_links l join public.bf44_workflows f on f.work_order_id=l.work_order_id where l.approval_id=a.id and l.revision=f.revision and public.bf44_reviewer(f.project_id,a.reviewer_type))
      or (not exists(select 1 from public.bf44_review_links l where l.approval_id=a.id) and (
       a.reviewer_type='owner' and public.bf11_owner(a.organization_id,a.client_id)
       or a.reviewer_type='consultant' and public.bf11_consultant(a.organization_id,a.client_id)
      ))
    ))
    or (a.status='rejected' and (a.requested_by=auth.uid() or public.bf4_staff(a.organization_id,'approvals.request')
      or exists(select 1 from public.bf44_review_links l join public.bf44_workflows f on f.work_order_id=l.work_order_id where l.approval_id=a.id and l.revision=f.revision and public.bf44_staff(f.project_id,'approvals.request',null))))
    or (a.status='approved' and a.requested_by=auth.uid())
   )

  union all

  select
   'wo:'||w.id::text||':'||coalesce(w.sla_status,'')||':'||w.status,
   w.organization_id,w.client_id,
   case when w.sla_status='breached' then 'sla_breached'
        when w.status='on_hold' then 'work_order_on_hold'
        else 'work_order_due' end,
   case when w.sla_status='breached' then 'critical'
        when w.priority in('P1','P2') then 'high' else 'normal' end,
   w.work_order_number||' - '||w.title,
   coalesce(w.hold_reason,w.description,''),
   coalesce(w.updated_at,w.created_at),
   '/corrective/work_order/'||w.id::text
  from public.bf_work_orders w
  where w.status not in('closed','cancelled','completed','approved')
   and (public.bf4_staff(w.organization_id,'corrective.manage') or public.bf4_assigned(w.id))
   and (
    w.sla_status='breached'
    or w.status='on_hold'
    or (w.completion_due_at is not null and w.completion_due_at<=now()+interval '24 hours')
   )

  union all

  select
   'ppm:'||j.id::text||':'||j.status,
   j.organization_id,j.client_id,
   case when j.due_date<current_date then 'ppm_overdue' else 'ppm_due' end,
   case when j.due_date<current_date then 'high' else 'normal' end,
   j.job_number,
   'PPM due '||j.due_date::text,
   j.created_at,
   '/ppm/job/'||j.id::text
  from public.bf_ppm_jobs j
  where j.status not in('closed','cancelled','approved','completed')
    and j.due_date<=current_date+1
    and (
      public.bf4_staff(j.organization_id,'ppm.manage')
      or (j.assigned_to=auth.uid() and public.bf4_staff(j.organization_id,'ppm.execute'))
    )

  union all
  select * from private.bf12_next_action_items()
  union all
  select 'workflow:'||q.id::text,q.org,q.client,'workflow_action','normal',q.title,jsonb_build_object('action_ar',q.action_ar,'action_en',q.action_en)::text,q.created_at,q.url
  from private.bf_mail_outbox q where q.recipient=auth.uid() and q.created_at>now()-interval '30 days'
   and (q.kind in('policy','package') or q.permission='' and q.kind in('work_order','ppm_job','statement'))
   and private.bf_mail_valid(q)
 ),
 dedup as (
  select distinct on(notification_key) *
  from raw order by notification_key,occurred_at desc
 ),
 marked as (
  select d.*,(rr.notification_key is not null and (d.kind not in('approval_pending','approval_rejected','approval_decided') or rr.read_at>=d.occurred_at)) is_read,rr.read_at
  from dedup d
  left join public.bf12_notification_reads rr
    on rr.user_id=auth.uid() and rr.notification_key=d.notification_key
 ),
 filtered as (
  select * from marked where not p_unread_only or not is_read
 )
 select jsonb_build_object(
   'total',(select count(*) from marked),
   'unread',(select count(*) from marked where not is_read),
   'items',coalesce((select jsonb_agg(to_jsonb(x)) from (
      select * from filtered order by
       case severity when 'critical' then 1 when 'high' then 2 else 3 end,
       occurred_at desc,notification_key
       limit p_limit offset p_offset
   ) x),'[]'::jsonb),
   'limit',p_limit,'offset',p_offset,
   'has_more',(select count(*) from filtered)>p_offset+p_limit
 ) into payload;
 return payload;
end $function$;
create index bf_mail_outbox_recipient on private.bf_mail_outbox(recipient,created_at desc);
create extension if not exists pg_cron;
select cron.schedule('bf-workflow-notices','* * * * *','select private.bf_mail_expand_pending(20);');

