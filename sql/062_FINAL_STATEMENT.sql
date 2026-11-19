create table private.bf_final_statements (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.bf35_projects(id),
 contract_id uuid not null references public.bf_contracts(id),
 status text not null default 'draft' check(status in ('draft','certificate_review','certificate_approved','statement_review','closed')),
 created_by uuid not null references auth.users(id),
 source text check(source in ('internal','external')),
 certificate_ref text,
 attachment text,
 certificate_note text,
 certificate_by uuid references auth.users(id),
 certificate_submitted_at timestamptz,
 certificate_approved_by uuid references auth.users(id),
 certificate_approved_at timestamptz,
 statement_by uuid references auth.users(id),
 statement_submitted_at timestamptz,
 register_reference text,
 register_attachment text,
 adjustment numeric(18,2),
 adjustment_basis text,
 snapshot jsonb,
 closed_by uuid references auth.users(id),
 closed_at timestamptz,
 review_note text,
 unique(project_id,contract_id)
);
alter table private.bf_final_statements enable row level security;
revoke all on private.bf_final_statements from public,anon,authenticated;

create function private.bf_final_permission(p_project uuid,p_contract uuid,p_owner boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.bf35_projects pr join public.bf44_policies po on po.project_id=pr.id
  where pr.id=p_project and pr.contract_id=p_contract and po.contract_id=p_contract and po.status='active'
    and case when p_owner then public.bf44_reviewer(pr.id,'owner')
     else not public.bf44_reviewer(pr.id,'owner') and not public.bf44_reviewer(pr.id,'consultant')
      and public.bf44_staff(pr.id,'costing.manage') end)
$$;
revoke all on function private.bf_final_permission(uuid,uuid,boolean) from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bf-final-certificates','bf-final-certificates',false,10485760,array['application/pdf']);

create function private.bf_final_file_access(p_path text,p_upload boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.bf_final_statements f
  where f.id::text=split_part(p_path,'/',1)
    and case when p_upload then f.status in ('draft','certificate_approved')
       and p_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
       and private.bf_final_permission(f.project_id,f.contract_id,false)
      else p_path in (f.attachment,f.register_attachment) and (
       private.bf_final_permission(f.project_id,f.contract_id,false)
       or private.bf_final_permission(f.project_id,f.contract_id,true)) end)
$$;
revoke all on function private.bf_final_file_access(text,boolean) from public,anon;
grant execute on function private.bf_final_file_access(text,boolean) to authenticated;
create policy bf_final_certificate_upload on storage.objects for insert to authenticated
 with check(bucket_id='bf-final-certificates' and private.bf_final_file_access(name,true));
create policy bf_final_certificate_read on storage.objects for select to authenticated
 using(bucket_id='bf-final-certificates' and private.bf_final_file_access(name,false));

create function private.bf_final_snapshot(p_project uuid,p_contract uuid)
returns jsonb language sql stable set search_path='' as $$
 with approved as (
  select s.* from public.bf44_statements s
  where s.project_id=p_project and s.status='approved'
    and (s.pricing_contract_id=p_contract or (
      s.pricing_contract_id is null and exists(
       select 1 from public.bf44_statement_lines l join public.bf44_certificates cc on cc.id=l.certificate_id
       join public.bf_work_orders w on w.id=cc.work_order_id
       where l.statement_id=s.id and w.contract_id=p_contract)
      and not exists(
       select 1 from public.bf44_statement_lines l join public.bf44_certificates cc on cc.id=l.certificate_id
       join public.bf_work_orders w on w.id=cc.work_order_id
       where l.statement_id=s.id and w.contract_id is distinct from p_contract)))
 ), lines as (
  select s.id,s.statement_number,cc.certificate_number,w.work_order_number,l.net_amount,l.basis,
     coalesce((select jsonb_agg(jsonb_build_object('item',m.item_code,'description',m.description,
      'quantity',m.quantity,'unit',m.unit,'location',m.location,'work_value',m.work_value,'claim_value',m.claim_value)
      order by m.item_code) from public.bf44_statement_measurements m
      where m.statement_id=s.id and m.certificate_id=cc.id),'[]') measurements
  from approved s join public.bf44_statement_lines l on l.statement_id=s.id
  join public.bf44_certificates cc on cc.id=l.certificate_id join public.bf_work_orders w on w.id=cc.work_order_id
  where w.contract_id=p_contract
 )
 select jsonb_build_object('prior_claim',coalesce((select sum(net_amount) from lines),0),
  'lines',coalesce((select jsonb_agg(to_jsonb(l)-'id' order by l.statement_number,l.certificate_number) from lines l),'[]'),
  'project',pr.name,'contract',c.contract_number,'owner',o.name,'provider',org.name,'currency',po.currency)
 from public.bf35_projects pr join public.bf_contracts c on c.id=p_contract
 join public.bf_clients o on o.id=pr.client_id join public.bf_organizations org on org.id=pr.organization_id
 join public.bf44_policies po on po.project_id=pr.id where pr.id=p_project
$$;
revoke all on function private.bf_final_snapshot(uuid,uuid) from public,anon,authenticated;

create function public.bf_final_statement(p_project uuid,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare f private.bf_final_statements; contract uuid; owner boolean; finance boolean;
 actor uuid:=auth.uid(); approved_work jsonb; ref text:=btrim(coalesce(p_data->>'reference',''));
 note text:=btrim(coalesce(p_data->>'note','')); certificate_source text:=p_data->>'source';
 path text:=p_data->>'attachment'; amount numeric(18,2);
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select pr.contract_id into contract from public.bf35_projects pr where pr.id=p_project;
 owner:=private.bf_final_permission(p_project,contract,true);
 finance:=private.bf_final_permission(p_project,contract,false);
 if not(owner or finance) then raise exception 'Final statement permission required' using errcode='42501'; end if;
 if p_action='create' and finance then
  insert into private.bf_final_statements(project_id,contract_id,created_by)
  values(p_project,contract,actor) on conflict(project_id,contract_id) do nothing;
 end if;
 select * into f from private.bf_final_statements s where s.project_id=p_project and s.contract_id=contract for update;
 if p_action in ('read','create') then
  return jsonb_build_object('record',case when f.id is not null then to_jsonb(f) end,'finance',finance,'owner',owner);
 end if;
 if f.id is null then raise exception 'Create a final statement draft first'; end if;
 if p_action='submit_certificate' and finance and f.status='draft' then
  if certificate_source is null or certificate_source not in ('internal','external') or length(note) not between 5 and 2000 then
   raise exception 'Certificate source and scope are required'; end if;
  if certificate_source='external' then
   if length(ref) not between 2 and 160 or path is null or left(path,37)<>f.id::text||'/'
    or not exists(select 1 from storage.objects where bucket_id='bf-final-certificates' and name=path
         and owner_id=actor::text and metadata->>'mimetype'='application/pdf')
   then raise exception 'Upload the approved PDF and provide its certificate reference'; end if;
  else
   ref:='FC-'||upper(replace(f.id::text,'-',''));
   path:=null;
  end if;
  approved_work:=private.bf_final_snapshot(p_project,contract);
  update private.bf_final_statements set source=certificate_source,certificate_ref=ref,attachment=path,certificate_note=note,
   certificate_by=actor,certificate_submitted_at=now(),status='certificate_review',review_note=null,
   snapshot=approved_work where id=f.id;
 elsif p_action='approve_certificate' and owner and f.status='certificate_review' and f.certificate_by<>actor then
  update private.bf_final_statements set status='certificate_approved',certificate_approved_by=actor,
   certificate_approved_at=now(),review_note=null where id=f.id;
 elsif p_action='return_certificate' and owner and f.status='certificate_review' and f.certificate_by<>actor then
  if length(note) not between 5 and 2000 then raise exception 'Return reason required'; end if;
  update private.bf_final_statements set status='draft',review_note=note where id=f.id;
 elsif p_action='submit_statement' and finance and f.status='certificate_approved' then
  if length(ref) not between 2 and 160 or length(note) not between 5 and 2000 then
   raise exception 'Work measurement register reference and settlement basis are required'; end if;
  if path is null or path is not distinct from f.attachment or left(path,37)<>f.id::text||'/'
    or not exists(select 1 from storage.objects where bucket_id='bf-final-certificates' and name=path
       and owner_id=actor::text and metadata->>'mimetype'='application/pdf') then
   raise exception 'Attach the final work measurement register as a PDF'; end if;
  if coalesce(p_data->>'adjustment','') !~ '^-?[0-9]{1,16}(\.[0-9]{1,2})?$' then
   raise exception 'Enter a valid final adjustment, or zero'; end if;
  amount:=(p_data->>'adjustment')::numeric;
  if amount<>0 and exists(select 1 from private.bf48_test_cycle_access g where g.project_id=p_project
    and 'finance.manage'=any(g.permission_keys)) then raise exception 'Training final statements require zero adjustment'; end if;
  approved_work:=private.bf_final_snapshot(p_project,contract);
  if approved_work is distinct from f.snapshot then
   raise exception 'Approved work changed after certificate review. Return the final certificate for a new approval';
  end if;
  if exists(select 1 from public.bf44_certificates cc join public.bf44_workflows w on w.work_order_id=cc.work_order_id
    join public.bf_work_orders wo on wo.id=w.work_order_id
    where w.project_id=p_project and wo.contract_id=contract and not exists(
     select 1 from public.bf44_statement_lines l join public.bf44_statements s on s.id=l.statement_id
     where l.certificate_id=cc.id and s.status='approved')) then
   raise exception 'Approve the outstanding work certificates in their maintenance statements first';
  end if;
  update private.bf_final_statements set status='statement_review',statement_by=actor,statement_submitted_at=now(),
   register_reference=ref,register_attachment=path,adjustment=amount,adjustment_basis=note,review_note=null where id=f.id;
 elsif p_action='return_approved_certificate' and owner and f.status='certificate_approved' and f.certificate_by<>actor then
  if length(note) not between 5 and 2000 then raise exception 'Return reason required'; end if;
  update private.bf_final_statements set status='draft',review_note=note,certificate_approved_by=null,
   certificate_approved_at=null where id=f.id;
 elsif p_action='return_statement' and owner and f.status='statement_review' and f.statement_by<>actor then
  if length(note) not between 5 and 2000 then raise exception 'Return reason required'; end if;
  update private.bf_final_statements set status='certificate_approved',review_note=note where id=f.id;
 elsif p_action='close' and owner and f.status='statement_review' and f.statement_by<>actor and f.certificate_approved_at is not null then
  if private.bf_final_snapshot(p_project,contract) is distinct from f.snapshot then
   raise exception 'Approved work changed. Return the statement and certificate for a new review'; end if;
  if exists(select 1 from public.bf44_certificates cc join public.bf44_workflows w on w.work_order_id=cc.work_order_id
    join public.bf_work_orders wo on wo.id=w.work_order_id
    where w.project_id=p_project and wo.contract_id=contract and not exists(
     select 1 from public.bf44_statement_lines l join public.bf44_statements s on s.id=l.statement_id
     where l.certificate_id=cc.id and s.status='approved')) then
   raise exception 'Approve the outstanding work certificates in their maintenance statements first';
  end if;
  update private.bf_final_statements set status='closed',closed_by=actor,closed_at=now(),review_note=null where id=f.id;
 else raise exception 'This action is unavailable at the current step' using errcode='42501';
 end if;
 select * into f from private.bf_final_statements where id=f.id;
 return jsonb_build_object('record',to_jsonb(f),'finance',finance,'owner',owner);
end
$$;
revoke all on function public.bf_final_statement(uuid,text,jsonb) from public,anon;
grant execute on function public.bf_final_statement(uuid,text,jsonb) to authenticated;
