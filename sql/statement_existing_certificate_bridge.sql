-- Register an existing, independently approved certificate for financial use.
-- Original document, dates, issuer, snapshot/hash and closed work order stay unchanged.
create or replace function private.bf44_statement_document_candidates(p_statement uuid)
returns table(document_id uuid,document_number text,generated_at timestamptz,approval_id uuid,work_order_id uuid,work_order_number text,report_id uuid)
language sql stable security definer set search_path='' set join_collapse_limit=1 set from_collapse_limit=1 set jit=off as $function$
 select d.id,d.document_number,d.generated_at,a.id,w.id,w.work_order_number,r.id
 from public.bf44_statements st
 join public.bf35_projects pr on pr.id=st.project_id
 join public.bf44_policies po on po.project_id=pr.id and po.contract_id=pr.contract_id
 join public.bf13_documents d on d.organization_id=pr.organization_id and d.client_id=pr.client_id
 join public.bf11_approvals a on d.entity_type='approval' and d.entity_id=a.id
 left join public.bf_ppm_jobs j on a.entity_type='ppm_job' and j.id=a.entity_id
 join public.bf_work_orders w on w.id=case when a.entity_type='work_order' then a.entity_id else j.work_order_id end
 join public.bf_assets asset on asset.id=w.asset_id and asset.organization_id=pr.organization_id and asset.client_id=pr.client_id and asset.site_id=w.site_id
 join lateral(
  select tr.id from public.bf13_documents tr
  where tr.organization_id=pr.organization_id and tr.client_id=pr.client_id and tr.status='final' and tr.document_type='technical_report'
   and tr.entity_type=a.entity_type and tr.entity_id=a.entity_id and tr.generated_at<=a.decided_at
  order by tr.generated_at desc,tr.id desc limit 1
 )r on true
 where st.id=p_statement and st.status in('draft','rejected')
  and auth.uid() is not null and exists(select 1 from public.bf_profiles u where u.id=auth.uid() and u.status='active')
  and public.bf44_staff(pr.id,'costing.manage')
  and po.owner_reviewer is distinct from auth.uid() and po.consultant_reviewer is distinct from auth.uid()
  and d.document_type='approval_certificate' and d.status='final'
  and a.organization_id=pr.organization_id and a.client_id=pr.client_id and a.reviewer_type='owner' and a.status='approved'
  and d.generated_at>=a.decided_at
  and not exists(select 1 from public.bf11_approvals newer where newer.entity_type=a.entity_type and newer.entity_id=a.entity_id and newer.reviewer_type='owner' and (newer.round>a.round or newer.round=a.round and newer.requested_at>a.requested_at))
  and not exists(select 1 from public.bf13_documents newer where newer.entity_type='approval' and newer.entity_id=a.id and newer.document_type='approval_certificate' and newer.status='final' and (newer.generated_at>d.generated_at or newer.generated_at=d.generated_at and newer.id>d.id))
  and (a.entity_type='work_order' or a.entity_type='ppm_job' and j.organization_id=pr.organization_id and j.client_id=pr.client_id and j.asset_id=w.asset_id and j.site_id=w.site_id)
  and w.organization_id=pr.organization_id and w.client_id=pr.client_id and w.contract_id=pr.contract_id
  and w.status in('approved','closed') and w.asset_id is not null
  and (w.project_id is null or w.project_id=pr.id)
  and exists(select 1 from public.bf35_project_sites ps where ps.project_id=pr.id and ps.site_id=w.site_id and ps.organization_id=pr.organization_id and ps.client_id=pr.client_id)
  and (d.generated_at at time zone 'Asia/Riyadh')::date between st.period_start and st.period_end
  and not exists(select 1 from public.bf44_workflows f where f.work_order_id=w.id)
  and not exists(select 1 from public.bf44_certificates cc where cc.work_order_id=w.id);
$function$;
revoke all on function private.bf44_statement_document_candidates(uuid) from public,anon,authenticated;
create or replace function public.bf44_statement_documents(p_statement uuid)
returns jsonb language sql stable security definer set search_path='' as $function$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.generated_at desc),'[]'::jsonb) from private.bf44_statement_document_candidates(p_statement)x;
$function$;
revoke all on function public.bf44_statement_documents(uuid) from public,anon;
grant execute on function public.bf44_statement_documents(uuid) to authenticated;
create or replace function public.bf44_register_statement_document(p_statement uuid,p_document uuid)
returns uuid language plpgsql security definer set search_path='' as $function$
declare st public.bf44_statements;d public.bf13_documents;a public.bf11_approvals;candidate record;existing uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.bf_profiles where id=auth.uid() and status='active') then raise exception 'Authentication required' using errcode='42501';end if;
 select * into st from public.bf44_statements where id=p_statement for update;
 if st.id is null or st.status not in('draft','rejected') or not public.bf44_staff(st.project_id,'costing.manage') or exists(select 1 from public.bf44_policies p where p.project_id=st.project_id and (p.owner_reviewer=auth.uid() or p.consultant_reviewer=auth.uid())) then raise exception 'Statement preparation permission required' using errcode='42501';end if;
 select cc.id into existing from public.bf44_certificates cc join public.bf44_workflows f on f.work_order_id=cc.work_order_id
 where cc.id=p_document and f.project_id=st.project_id and (cc.issued_at at time zone 'Asia/Riyadh')::date between st.period_start and st.period_end
 and not exists(select 1 from public.bf44_statement_lines sl where sl.certificate_id=cc.id and sl.statement_id<>st.id);
 if existing is not null then return existing;end if;
 select * into d from public.bf13_documents where id=p_document for share;
 if d.id is null or d.status<>'final' or d.document_type<>'approval_certificate' or d.entity_type<>'approval' then raise exception 'Final owner certificate required';end if;
 select * into a from public.bf11_approvals where id=d.entity_id for share;
 if a.status is distinct from 'approved' or a.reviewer_type is distinct from 'owner' then raise exception 'Approved owner decision required';end if;
 select * into candidate from private.bf44_statement_document_candidates(st.id) where document_id=p_document;
 if candidate.document_id is null then raise exception 'Certificate must match the project, owner, contract and statement period, with an approved report and no previous financial enrollment';end if;
 perform 1 from public.bf_work_orders where id=candidate.work_order_id for update;
 insert into public.bf44_workflows(work_order_id,project_id,revision,report_id,enrolled_by)
 values(candidate.work_order_id,st.project_id,1,candidate.report_id,auth.uid());
 insert into public.bf44_review_links(approval_id,work_order_id,revision) values(a.id,candidate.work_order_id,1);
 insert into public.bf44_certificates(id,work_order_id,certificate_number,report_id,snapshot,snapshot_hash,issued_by,issued_at)
 values(d.id,candidate.work_order_id,d.document_number,candidate.report_id,d.snapshot,d.snapshot_hash,d.generated_by,d.generated_at);
 insert into public.bf44_events(project_id,work_order_id,statement_id,actor_id,action,details)
 values(st.project_id,candidate.work_order_id,st.id,auth.uid(),'existing_certificate_registered',jsonb_build_object('source_document_id',d.id,'source_document_number',d.document_number,'source_approval_id',a.id,'preserved_issue_date',d.generated_at,'original_document_unchanged',true,'no_work_order_reopened',true));
 return d.id;
end $function$;
revoke all on function public.bf44_register_statement_document(uuid,uuid) from public,anon;
grant execute on function public.bf44_register_statement_document(uuid,uuid) to authenticated;
