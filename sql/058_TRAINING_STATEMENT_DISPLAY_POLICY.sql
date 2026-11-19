CREATE OR REPLACE FUNCTION public.bf44_statement_read(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare st public.bf44_statements;po public.bf44_policies;
begin
 select * into st from public.bf44_statements where id=p_id;
 if st.id is null or not(public.bf44_staff(st.project_id,'costing.manage') or public.bf44_reviewer(st.project_id,'owner') or public.bf44_reviewer(st.project_id,'consultant')) then raise exception 'Statement access required' using errcode='42501';end if;
 select * into po from public.bf44_policies where project_id=st.project_id;
 return jsonb_build_object('statement',to_jsonb(st),'zero_value_training',exists(
   select 1 from private.bf48_test_cycle_access g where g.project_id=st.project_id and 'finance.manage'=any(g.permission_keys)),'currency',po.currency,'total',(select coalesce(sum(net_amount),0)::text from public.bf44_statement_lines where statement_id=st.id),
 'project',(select jsonb_build_object('name',p.name,'owner',c.name,'provider',o.name,'contract',co.contract_number) from public.bf35_projects p join public.bf_clients c on c.id=p.client_id join public.bf_organizations o on o.id=p.organization_id join public.bf_contracts co on co.id=p.contract_id where p.id=st.project_id),
 'lines',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('labor',l.labor::text,'parts',l.parts::text,'plant',l.plant::text,'other',l.other::text,'net_amount',l.net_amount::text,'certificate_number',c.certificate_number,'work_order_number',w.work_order_number,'asset',coalesce(a.name_en,a.name_ar),'serial_number',a.serial_number)) from public.bf44_statement_lines l join public.bf44_certificates c on c.id=l.certificate_id join public.bf_work_orders w on w.id=c.work_order_id join public.bf_assets a on a.id=w.asset_id where l.statement_id=st.id),'[]'::jsonb),
 'eligible',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'number',c.certificate_number,'work_order_number',w.work_order_number)) from public.bf44_certificates c join public.bf44_workflows f on f.work_order_id=c.work_order_id join public.bf_work_orders w on w.id=c.work_order_id where f.project_id=st.project_id and not exists(select 1 from public.bf44_statement_lines l where l.certificate_id=c.id) and (c.issued_at at time zone 'Asia/Riyadh')::date between st.period_start and st.period_end),'[]'::jsonb),
 'can_edit',public.bf44_staff(st.project_id,'costing.manage'),'can_review',public.bf44_reviewer(st.project_id,case when st.status='consultant_review' then 'consultant' else 'owner' end));
end $function$;
