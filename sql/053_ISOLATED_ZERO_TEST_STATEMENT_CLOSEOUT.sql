-- Only the requested registered zero-value training project receives a nested
-- audited write context. All other calls retain the exact original implementation.
begin;
do $copy$
declare definition text;
begin
 if to_regprocedure('private.bf53_original_statement_action(text,uuid,jsonb)') is not null then raise exception 'Already installed';end if;
 select pg_get_functiondef('public.bf44_statement_action(text,uuid,jsonb)'::regprocedure) into definition;
 execute replace(definition,'FUNCTION public.bf44_statement_action(','FUNCTION private.bf53_original_statement_action(');
end $copy$;
revoke all on function private.bf53_original_statement_action(text,uuid,jsonb) from public,anon,authenticated;
create or replace function public.bf44_statement_action(p_action text,p_id uuid default null,p_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare st public.bf44_statements;previous_write text;result uuid;used_context boolean:=false;
begin
 -- No changed authorization or runtime context for any unrelated request.
 if p_action is distinct from 'approve' or not exists(
  select 1 from public.bf44_statements s
  join private.bf48_test_cycle_access g on g.project_id=s.project_id and g.expires_at>now() and 'finance.manage'=any(g.permission_keys)
  join public.bf35_projects pr on pr.id=g.project_id and pr.organization_id=g.organization_id and pr.client_id=g.client_id and pr.contract_id=g.contract_id
  join public.bf_contracts co on co.id=pr.contract_id
  where s.id=p_id and s.status='owner_review' and pr.project_code='PRJ-000021'
  and pr.name='TEST ONLY — دورة وقائية وتصحيحية لجهاز مرافق'
  and co.contract_number='TEST-FM-20261108-01' and coalesce((to_jsonb(co)->>'contract_value')::numeric,0)=0
 ) then return private.bf53_original_statement_action(p_action,p_id,p_data);end if;
 select * into strict st from public.bf44_statements where id=p_id for update;
 if auth.uid() is null or not public.bf44_reviewer(st.project_id,'owner') or auth.uid()=st.submitted_by then
  raise exception 'Independent appointed owner required for test closeout' using errcode='42501';end if;
 if not exists(select 1 from public.bf44_statement_lines where statement_id=st.id)
 or exists(select 1 from public.bf44_statement_lines l
  join public.bf44_certificates c on c.id=l.certificate_id
  join public.bf44_workflows f on f.work_order_id=c.work_order_id
  join public.bf_work_orders w on w.id=c.work_order_id
  join public.bf_assets a on a.id=w.asset_id
  where l.statement_id=st.id and (f.project_id is distinct from st.project_id
   or l.coverage is distinct from 'included' or l.labor<>0 or l.parts<>0 or l.plant<>0 or l.other<>0
   or coalesce(a.name_en,a.name_ar,'') not like 'TEST ONLY%'))
 then raise exception 'Only certified included zero-value test work may close';end if;
 previous_write:=current_setting('bf4.authorized_write',true);
 used_context:=true;
 perform set_config('bf4.authorized_write','yes',true);
 -- Original API still validates appointed reviewer, independence, locked amounts,
 -- materials reconciliation, same certified WOs and normal audit events.
 result:=private.bf53_original_statement_action(p_action,p_id,p_data);
 perform set_config('bf4.authorized_write',coalesce(previous_write,''),true);
 return result;
exception when others then
 if used_context then perform set_config('bf4.authorized_write',coalesce(previous_write,''),true);end if;
 raise;
end $$;
commit;
